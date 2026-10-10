/** Operator-only import of a complete, verified, modality-specific billable session snapshot. */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { db } from "../lib/db";
import { transaction } from "../lib/services";
import { recalculateSession } from "../lib/accounting";
import { terminal } from "../lib/domain";
const count = z.number().int().min(0).max(100000000);
const schema = z.object({
  sessionId: z.string().regex(/^[a-f0-9]{24}$/),
  eventId: z.string().uuid(),
  pricingVersionId: z.string().regex(/^[a-f0-9]{24}$/),
  evidenceUrl: z.string().url(),
  reviewedBy: z.string().min(1).max(100),
  normalized: z.object({
    "input.TEXT": count,
    "input.AUDIO": count,
    "output.TEXT": count,
    "output.AUDIO": count,
    "cache.TEXT": count,
    "cache.AUDIO": count,
    thoughts: count,
    tool: count,
  }),
  raw: z.record(z.string(), z.unknown()),
});
async function main() {
  if (!process.argv[2]) throw new Error("Pass a reviewed usage JSON file");
  const input = schema.parse(
    JSON.parse(await readFile(process.argv[2], "utf8")),
  );
  await transaction(async (tx) => {
    const session = await tx.voiceSession.findUniqueOrThrow({
      where: { id: input.sessionId },
    });
    if (!terminal.includes(session.status) || session.demo)
      throw new Error("Only ended live sessions can be reconciled");
    const pricing = await tx.pricingVersion.findUniqueOrThrow({
      where: { id: input.pricingVersionId },
    });
    if (pricing.model !== session.model)
      throw new Error("Pricing model mismatch");
    // The original pricing version, if present, cannot be silently substituted.
    if (session.pricingVersionId && session.pricingVersionId !== pricing.id)
      throw new Error("Use the session’s existing pricing version");
    if (pricing.effectiveAt > session.startedAt)
      throw new Error("Pricing was not effective at session start");
    const existing = await tx.usageEvent.findUnique({
      where: {
        sessionId_eventId: { sessionId: session.id, eventId: input.eventId },
      },
    });
    if (existing) {
      if (
        JSON.stringify(existing.normalized) !== JSON.stringify(input.normalized)
      )
        throw new Error("An event ID cannot be reused for different usage");
      return;
    }
    await tx.usageEvent.create({
      data: {
        sessionId: session.id,
        eventId: input.eventId,
        raw: JSON.parse(
          JSON.stringify({
            provider: input.raw,
            evidenceUrl: input.evidenceUrl,
            reviewedBy: input.reviewedBy,
          }),
        ),
        normalized: input.normalized,
        counterMode: "CUMULATIVE",
        period: "FULL_SESSION_BILLABLE",
        source: "RECONCILED",
        trust: "ADMIN_REVIEWED",
      },
    });
    await tx.voiceSession.update({
      where: { id: session.id },
      data: {
        pricingVersionId: pricing.id,
        usageTotals: { billableTotals: input.normalized },
        revision: { increment: 1 },
      },
    });
    await recalculateSession(tx, session.id, pricing.id);
  });
  console.log(
    "Reconciled session estimate saved; original browser metadata retained.",
  );
}
main()
  .catch(() => {
    console.error(
      "Reconciliation failed. Check the reviewed input, terminal session, immutable event ID and matching effective pricing version.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
