import Decimal from "decimal.js";
import { db } from "./db";
export async function spendingSince(since: Date) {
  const data = await db.voiceSession.aggregateRaw({
    pipeline: [
      {
        $match: {
          demo: false,
          startedAt: { $gte: { $date: since.toISOString() } },
        },
      },
      {
        $group: {
          _id: null,
          amount: {
            $sum: {
              $convert: {
                input: "$estimatedCost",
                to: "decimal",
                onNull: 0,
                onError: 0,
              },
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
        },
      },
    ],
  });
  const row = (
    data as unknown as {
      amount?: { $numberDecimal?: string };
      incomplete?: number;
    }[]
  )[0];
  return {
    amount: row?.amount?.$numberDecimal ?? "0",
    incomplete: row?.incomplete ?? 0,
  };
}
export async function budgetState() {
  const config = await db.budgetSettings.findUnique({
    where: { key: "default" },
  });
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [daily, monthly] = await Promise.all([
    spendingSince(day),
    spendingSince(month),
  ]);
  const reached: string[] = [];
  if (config)
    for (const [period, total, threshold, date] of [
      ["daily", daily, config.daily, day],
      ["monthly", monthly, config.monthly, month],
    ] as const) {
      if (threshold && new Decimal(total.amount).gte(threshold)) {
        reached.push(period);
        const key = `${period}:${date.toISOString()}:${threshold}`;
        await db.budgetAlert.upsert({
          where: { key },
          create: { key, period, amount: total.amount, threshold },
          update: {},
        });
      }
    }
  // Opt-in blocking fails closed when a configured period contains unknown spending.
  const unknown = !!(
    (config?.daily && daily.incomplete) ||
    (config?.monthly && monthly.incomplete)
  );
  return {
    config,
    daily,
    monthly,
    reached,
    blocked: !!config?.blockNew && (reached.length > 0 || unknown),
  };
}
