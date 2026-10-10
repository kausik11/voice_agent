import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
export function filters(url: URL) {
  const page = Math.max(
    1,
    Math.min(10000, Number(url.searchParams.get("page")) || 1),
  );
  const days = Math.max(
    1,
    Math.min(366, Number(url.searchParams.get("days")) || 7),
  );
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").slice(0, 100);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const start = from ? new Date(from) : new Date(Date.now() - days * 86400000);
  const end = to ? new Date(to + "T23:59:59.999Z") : new Date();
  if (isNaN(+start) || isNaN(+end) || end < start)
    throw new HttpError(400, "Invalid date range");
  const where: Prisma.VoiceSessionWhereInput = {
    demo: false,
    startedAt: { gte: start, lte: end },
    ...(status ? { status } : {}),
  };
  // ObjectId search is exact; model/language search is bounded and case insensitive.
  if (q) {
    if (/^[a-f0-9]{24}$/.test(q)) where.id = q;
    else
      where.OR = [
        { model: { contains: q, mode: "insensitive" } },
        { language: { contains: q, mode: "insensitive" } },
      ];
  }
  return { page, days, status, q, start, end, where };
}
export async function sessionList(url: URL) {
  const f = filters(url);
  const [rows, total] = await Promise.all([
    db.voiceSession.findMany({
      where: f.where,
      orderBy: { startedAt: "desc" },
      skip: (f.page - 1) * 10,
      take: 10,
      omit: { credentialHash: true },
    }),
    db.voiceSession.count({ where: f.where }),
  ]);
  return { rows, total, page: f.page };
}
export async function overview(url: URL, timezone: string) {
  const f = filters(url);
  const base: Prisma.InputJsonObject = {
    demo: false,
    startedAt: {
      $gte: { $date: f.start.toISOString() },
      $lte: { $date: f.end.toISOString() },
    },
    ...(f.status ? { status: f.status } : {}),
  };
  const group = {
    $group: {
      _id: null,
      total: { $sum: 1 },
      duration: { $sum: "$duration" },
      active: {
        $sum: {
          $cond: [
            { $in: ["$status", ["CREATED", "CONNECTING", "ACTIVE"]] },
            1,
            0,
          ],
        },
      },
      completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
      failed: {
        $sum: {
          $cond: [
            { $in: ["$status", ["FAILED", "DISCONNECTED", "EXPIRED"]] },
            1,
            0,
          ],
        },
      },
      incomplete: {
        $sum: {
          $cond: [
            { $in: ["$costStatus", ["INCOMPLETE", "PRICING_UNAVAILABLE"]] },
            1,
            0,
          ],
        },
      },
      spend: {
        $sum: {
          $convert: {
            input: "$estimatedCost",
            to: "decimal",
            onError: 0,
            onNull: 0,
          },
        },
      },
      tokens: { $sum: { $ifNull: ["$usageTotals.totalTokenCount", 0] } },
    },
  };
  const [stats, chart, recent] = await Promise.all([
    db.voiceSession.aggregateRaw({ pipeline: [{ $match: base }, group] }),
    db.voiceSession.aggregateRaw({
      pipeline: [
        { $match: base },
        {
          $group: {
            _id: {
              $dateToString: {
                format:
                  url.searchParams.get("interval") === "weekly"
                    ? "%G-W%V"
                    : "%Y-%m-%d",
                date: "$startedAt",
                timezone,
              },
            },
            sessions: { $sum: 1 },
            spend: {
              $sum: {
                $convert: {
                  input: "$estimatedCost",
                  to: "decimal",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ],
    }),
    db.voiceSession.findMany({
      where: f.where,
      take: 5,
      orderBy: { startedAt: "desc" },
      omit: { credentialHash: true },
    }),
  ]);
  const s = (stats as unknown as Record<string, unknown>[])[0] ?? {};
  const decimal = (v: unknown) =>
    typeof v === "object" && v !== null && "$numberDecimal" in v
      ? String((v as { $numberDecimal: string }).$numberDecimal)
      : String(v ?? "0");
  return {
    stats: { ...s, spend: decimal(s.spend) },
    chart: (chart as unknown as Record<string, unknown>[]).map((r) => ({
      date: r._id,
      sessions: r.sessions,
      spend: Number(decimal(r.spend)),
    })),
    recent,
    timezone,
    refreshedAt: new Date().toISOString(),
  };
}
