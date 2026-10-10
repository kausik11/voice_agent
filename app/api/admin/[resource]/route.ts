import { z } from "zod";
import { db } from "@/lib/db";
import { adminAccess } from "@/lib/admin-access";
import { body, failure, HttpError, sameOrigin } from "@/lib/http";
import {
  defaults,
  settingsSchema,
  knowledgeSchema,
  pricingSchema,
  budgetSchema,
} from "@/lib/config";
import { demoSessions, demoDetail, sampleKnowledge } from "@/lib/demo";
import {
  approvedKnowledge,
  deleteSession,
  expireSessions,
  settings,
} from "@/lib/services";
import { filters, overview, sessionList } from "@/lib/admin-data";
import { budgetState } from "@/lib/budget";
import { csvCell } from "@/lib/domain";
const objectId = z.string().regex(/^[a-f0-9]{24}$/);
export async function GET(
  req: Request,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    const mode = await adminAccess(req.headers);
    const { resource } = await ctx.params;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (mode === "demo") {
      const all = demoSessions();
      const f = filters(url);
      const rows = all.filter(
        (s) =>
          (!f.status || s.status === f.status) &&
          (!f.q ||
            `${s.id} ${s.language} ${s.model}`
              .toLowerCase()
              .includes(f.q.toLowerCase())) &&
          new Date(s.startedAt) >= f.start &&
          new Date(s.startedAt) <= f.end,
      );
      if (resource === "sessions") {
        if (id) {
          const detail = demoDetail(id);
          if (!detail) throw new HttpError(404, "Session not found");
          return Response.json(detail);
        }
        return Response.json({
          rows: rows.slice((f.page - 1) * 10, f.page * 10),
          total: rows.length,
          page: f.page,
        });
      }
      if (resource === "overview") {
        const dates: Record<
          string,
          { date: string; sessions: number; spend: number }
        > = {};
        for (const s of rows) {
          const d = new Date(
            new Date(s.startedAt).toLocaleString("en-US", {
              timeZone: defaults.timezone,
            }),
          );
          if (url.searchParams.get("interval") === "weekly")
            d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dates[date] ??= { date, sessions: 0, spend: 0 };
          dates[date].sessions++;
          dates[date].spend += Number(s.estimatedCost ?? 0);
        }
        return Response.json({
          stats: {
            total: rows.length,
            active: rows.filter((s) => s.status === "ACTIVE").length,
            completed: rows.filter((s) => s.status === "COMPLETED").length,
            failed: rows.filter((s) => s.status === "FAILED").length,
            duration: rows.reduce((n, s) => n + s.duration, 0),
            spend: rows
              .reduce((n, s) => n + Number(s.estimatedCost ?? 0), 0)
              .toFixed(4),
            incomplete: rows.filter((s) => !s.estimatedCost).length,
            tokens: rows.reduce(
              (n, s) =>
                n +
                s.usageTotals["input.AUDIO"] +
                s.usageTotals["output.AUDIO"],
              0,
            ),
          },
          chart: Object.values(dates).reverse(),
          recent: rows.slice(0, 5),
          timezone: defaults.timezone,
          refreshedAt: new Date().toISOString(),
        });
      }
      if (resource === "settings") return Response.json(defaults);
      if (resource === "knowledge")
        return Response.json({
          entries: sampleKnowledge,
          preview:
            "No approved content yet. Sample entries are excluded from the agent’s knowledge.",
        });
      if (resource === "pricing") return Response.json([]);
      if (resource === "budget")
        return Response.json({
          config: null,
          daily: { amount: "0.031", incomplete: 1 },
          monthly: { amount: "1.482", incomplete: 5 },
          reached: [],
          alerts: [],
          demo: true,
        });
      if (resource === "export") return csv(rows);
      throw new HttpError(404, "Not found");
    }
    if (resource === "overview" || resource === "sessions")
      await expireSessions();
    if (resource === "overview")
      return Response.json(await overview(url, (await settings()).timezone));
    if (resource === "sessions") {
      if (!id) return Response.json(await sessionList(url));
      objectId.parse(id);
      const s = await db.voiceSession.findUnique({
        where: { id },
        omit: { credentialHash: true },
      });
      if (!s) throw new HttpError(404, "Session not found");
      const [transcripts, usageEvents, pricing] = await Promise.all([
        db.transcriptMessage.findMany({
          where: { sessionId: id },
          orderBy: { sequence: "asc" },
          take: 1000,
        }),
        db.usageEvent.findMany({
          where: { sessionId: id },
          orderBy: { timestamp: "asc" },
          take: 1000,
        }),
        s.pricingVersionId
          ? db.pricingVersion.findUnique({ where: { id: s.pricingVersionId } })
          : null,
      ]);
      return Response.json({ ...s, transcripts, usageEvents, pricing });
    }
    if (resource === "settings") return Response.json(await settings());
    if (resource === "knowledge")
      return Response.json({
        entries: await db.knowledgeEntry.findMany({
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
        preview: await approvedKnowledge(),
      });
    if (resource === "pricing")
      return Response.json(
        await db.pricingVersion.findMany({
          orderBy: { effectiveAt: "desc" },
          take: 100,
        }),
      );
    if (resource === "budget")
      return Response.json({
        ...(await budgetState()),
        alerts: await db.budgetAlert.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      });
    if (resource === "export") {
      const rows = await db.voiceSession.findMany({
        where: filters(url).where,
        orderBy: { startedAt: "desc" },
        take: 5000,
        omit: { credentialHash: true },
      });
      return csv(rows);
    }
    throw new HttpError(404, "Not found");
  } catch (e) {
    return failure(e);
  }
}
function csv(rows: Record<string, unknown>[]) {
  const columns = [
    "id",
    "startedAt",
    "status",
    "language",
    "duration",
    "model",
    "estimatedCost",
    "costStatus",
    "demo",
  ];
  return new Response(
    [
      columns.join(","),
      ...rows.map((r) =>
        columns
          .map((k) =>
            csvCell(r[k] instanceof Date ? (r[k] as Date).toISOString() : r[k]),
          )
          .join(","),
      ),
    ].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="medha-sessions.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(req);
    if ((await adminAccess(req.headers)) === "demo")
      throw new HttpError(
        403,
        "Demo is read-only. Configure a database to save changes.",
      );
    const { resource } = await ctx.params;
    if (resource === "settings") {
      const config = await body(req, settingsSchema);
      await db.agentSettings.upsert({
        where: { key: "default" },
        create: { key: "default", config },
        update: { config },
      });
      return Response.json({ ok: true });
    }
    if (resource === "knowledge") {
      const { id, ...data } = await body(
        req,
        knowledgeSchema.extend({ id: objectId.optional() }),
      );
      if (id) await db.knowledgeEntry.update({ where: { id }, data });
      else {
        if ((await db.knowledgeEntry.count()) >= 200)
          throw new HttpError(
            409,
            "This initial knowledge editor supports 200 entries.",
          );
        await db.knowledgeEntry.create({ data });
      }
      return Response.json({ ok: true });
    }
    if (resource === "pricing") {
      const data = await body(req, pricingSchema);
      await db.pricingVersion.create({
        data: { ...data, effectiveAt: new Date(data.effectiveAt) },
      });
      return Response.json({ ok: true });
    }
    if (resource === "budget") {
      const data = await body(req, budgetSchema);
      const config = {
        ...data,
        exchangeEffectiveAt: data.exchangeEffectiveAt
          ? new Date(data.exchangeEffectiveAt)
          : null,
      };
      await db.budgetSettings.upsert({
        where: { key: "default" },
        create: { key: "default", ...config },
        update: config,
      });
      return Response.json({ ok: true });
    }
    throw new HttpError(404, "Not found");
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(req);
    if ((await adminAccess(req.headers)) === "demo")
      throw new HttpError(403, "Demo records are read-only.");
    const { resource } = await ctx.params;
    const { id } = await body(req, z.object({ id: objectId }));
    if (resource === "knowledge")
      await db.knowledgeEntry.delete({ where: { id } });
    else if (resource === "sessions") await deleteSession(id);
    else throw new HttpError(404, "Not found");
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
