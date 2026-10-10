import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { body, failure, HttpError, sameOrigin } from "@/lib/http";
import { transaction } from "@/lib/services";
import {
  canTransition,
  expired,
  finalizeTranscript,
  terminal,
} from "@/lib/domain";
import { consume } from "@/lib/rate-limit";
import { recalculateSession } from "@/lib/accounting";
const usage = z
  .object({
    promptTokenCount: z.number().int().min(0).max(10000000).optional(),
    responseTokenCount: z.number().int().min(0).max(10000000).optional(),
    totalTokenCount: z.number().int().min(0).max(20000000).optional(),
    cachedContentTokenCount: z.number().int().min(0).optional(),
    thoughtsTokenCount: z.number().int().min(0).optional(),
    toolUsePromptTokenCount: z.number().int().min(0).optional(),
    promptTokensDetails: z
      .array(
        z.object({
          modality: z.string().max(30),
          tokenCount: z.number().int().min(0).max(10000000),
        }),
      )
      .max(10)
      .optional(),
    responseTokensDetails: z
      .array(
        z.object({
          modality: z.string().max(30),
          tokenCount: z.number().int().min(0).max(10000000),
        }),
      )
      .max(10)
      .optional(),
    cacheTokensDetails: z
      .array(
        z.object({
          modality: z.string().max(30),
          tokenCount: z.number().int().min(0).max(10000000),
        }),
      )
      .max(10)
      .optional(),
  })
  .passthrough();
const schema = z.object({
  status: z
    .enum(["ACTIVE", "COMPLETED", "DISCONNECTED", "FAILED", "EXPIRED"])
    .optional(),
  reason: z
    .enum([
      "user_ended",
      "network_lost",
      "provider_closed",
      "provider_error",
      "maximum_duration",
      "page_closed",
    ])
    .optional(),
  messages: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        speaker: z.enum(["user", "assistant"]),
        text: z.string().max(16000),
        sequence: z.number().int().min(0).max(10000),
        final: z.boolean(),
      }),
    )
    .max(40)
    .default([]),
  usage: z
    .array(z.object({ eventId: z.string().uuid(), raw: usage }))
    .max(20)
    .default([]),
});
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const { id } = await ctx.params;
    if (!/^[a-f0-9]{24}$/.test(id))
      throw new HttpError(404, "Session not found");
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) throw new HttpError(401, "Session credential required");
    const input = await body(req, schema);
    const result = await transaction(async (tx) => {
      const s = await tx.voiceSession.findUnique({ where: { id } });
      if (!s) throw new HttpError(404, "Session not found");
      const hash = createHash("sha256").update(token).digest();
      if (!timingSafeEqual(hash, Buffer.from(s.credentialHash, "hex")))
        throw new HttpError(401, "Invalid session credential");
      if (Date.now() > s.expiresAt.getTime() + 60000)
        throw new HttpError(410, "Session credential expired");
      if (terminal.includes(s.status)) return { status: s.status };
      await consume(`telemetry:${id}`, 60);
      let status = input.status ?? s.status;
      if (expired(s)) status = "EXPIRED";
      if (!canTransition(s.status, status))
        throw new HttpError(409, "Invalid session transition");
      for (const m of input.messages) {
        const previous = await tx.transcriptMessage.findUnique({
          where: { sessionId_eventId: { sessionId: id, eventId: m.eventId } },
        });
        if (
          previous &&
          (previous.speaker !== m.speaker || previous.sequence !== m.sequence)
        )
          throw new HttpError(409, "Transcript identity cannot change");
        const final = finalizeTranscript(previous, m);
        await tx.transcriptMessage.upsert({
          where: { sessionId_eventId: { sessionId: id, eventId: m.eventId } },
          create: { ...m, sessionId: id },
          update: { text: final.text, final: final.final },
        });
      }
      let latest = s.usageTotals;
      for (const event of input.usage) {
        const existing = await tx.usageEvent.findUnique({
          where: {
            sessionId_eventId: { sessionId: id, eventId: event.eventId },
          },
        });
        if (existing) continue;
        const normalized: Record<string, number> = {};
        for (const [prefix, details] of [
          ["input", event.raw.promptTokensDetails],
          ["output", event.raw.responseTokensDetails],
          ["cache", event.raw.cacheTokensDetails],
        ] as const)
          for (const detail of details ?? [])
            normalized[`${prefix}.${detail.modality}`] = detail.tokenCount;
        // Google documents response metadata, but not an unambiguous accounting period for this live model.
        // Preserve raw events; do not silently sum periodic snapshots or charge context repeatedly.
        await tx.usageEvent.create({
          data: {
            sessionId: id,
            eventId: event.eventId,
            raw: event.raw as Prisma.InputJsonValue,
            normalized,
            counterMode: "UNKNOWN",
            period: "UNVERIFIED_LIVE_PERIOD",
            source: "BROWSER",
            trust: "PROVISIONAL",
          },
        });
        latest = {
          latestProviderSnapshot: normalized,
          totalTokenCount: event.raw.totalTokenCount ?? null,
        };
      }
      const ended = terminal.includes(status);
      const end = new Date(Math.min(Date.now(), s.expiresAt.getTime()));
      await tx.voiceSession.update({
        where: { id },
        data: {
          status,
          lastActivityAt: new Date(),
          revision: { increment: 1 },
          usageTotals: latest as Prisma.InputJsonValue,
          endedAt: ended ? end : undefined,
          duration: Math.max(
            0,
            Math.floor((end.getTime() - s.startedAt.getTime()) / 1000),
          ),
          reason: input.reason ?? undefined,
        },
      });
      if (input.usage.length)
        await recalculateSession(tx, id, s.pricingVersionId);
      return { status };
    });
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
