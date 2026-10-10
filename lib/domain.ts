import Decimal from "decimal.js";
const CostDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});
export const terminal = ["COMPLETED", "DISCONNECTED", "FAILED", "EXPIRED"];
export const active = ["CREATED", "CONNECTING", "ACTIVE"];
export function canTransition(from: string, to: string) {
  if (from === to) return true;
  return (
    (
      {
        CREATED: ["CONNECTING", "FAILED", "EXPIRED"],
        CONNECTING: [
          "ACTIVE",
          "FAILED",
          "DISCONNECTED",
          "EXPIRED",
          "COMPLETED",
        ],
        ACTIVE: ["COMPLETED", "DISCONNECTED", "FAILED", "EXPIRED"],
      } as Record<string, string[]>
    )[from]?.includes(to) ?? false
  );
}
export function expired(
  session: { expiresAt: Date; lastActivityAt: Date },
  now = new Date(),
) {
  return (
    session.expiresAt <= now ||
    now.getTime() - session.lastActivityAt.getTime() > 90000
  );
}
export type Counters = Record<string, number>;
export type CounterMode = "INCREMENTAL" | "CUMULATIVE" | "UNKNOWN";
export function aggregateUsage(
  events: {
    eventId: string;
    normalized: Counters;
    counterMode: CounterMode;
    period: string;
  }[],
) {
  const seen = new Set<string>();
  const totals: Counters = {};
  const snapshots: Record<string, Counters> = {};
  let complete = true;
  const modes = new Map<string, CounterMode>();
  for (const e of events) {
    if (seen.has(e.eventId)) continue;
    seen.add(e.eventId);
    if (e.counterMode === "UNKNOWN") {
      complete = false;
      continue;
    }
    if (modes.has(e.period) && modes.get(e.period) !== e.counterMode) {
      complete = false;
      continue;
    }
    modes.set(e.period, e.counterMode);
    for (const [key, value] of Object.entries(e.normalized)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        complete = false;
        continue;
      }
      if (e.counterMode === "INCREMENTAL")
        totals[key] = (totals[key] ?? 0) + value;
      else {
        const prior = (snapshots[e.period] ??= {});
        prior[key] = Math.max(prior[key] ?? 0, value);
      }
    }
  }
  for (const snapshot of Object.values(snapshots))
    for (const [key, n] of Object.entries(snapshot))
      totals[key] = (totals[key] ?? 0) + n;
  return { totals, complete };
}
export function calculateCost(
  usage: Counters,
  rates: Record<string, string> | null,
  complete = true,
) {
  if (!rates) return { cost: null, status: "PRICING_UNAVAILABLE" };
  let sum = new CostDecimal(0);
  if (!Object.keys(usage).length) complete = false;
  for (const category of Object.keys(rates))
    if (usage[category] === undefined) complete = false;
  for (const [category, count] of Object.entries(usage)) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("Invalid token count");
    if (rates[category] === undefined) {
      if (count > 0) complete = false;
      continue;
    }
    sum = sum.plus(new CostDecimal(rates[category]).mul(count).div(1000000));
  }
  return {
    cost: sum.toFixed(12, Decimal.ROUND_HALF_UP),
    status: complete ? "PROVISIONAL" : "INCOMPLETE",
  };
}
export function finalizeTranscript(
  previous: { text: string; final: boolean } | null,
  next: { text: string; final: boolean },
) {
  return previous?.final ? previous : next;
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function isAdmin(user: { role?: string } | null | undefined) {
  return user?.role === "admin";
}
