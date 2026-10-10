import { Prisma } from "@prisma/client";
import {
  aggregateUsage,
  calculateCost,
  type Counters,
  type CounterMode,
} from "./domain";
// Called inside the session transaction. UNKNOWN metadata is retained but never billed.
export async function recalculateSession(
  tx: Prisma.TransactionClient,
  id: string,
  pricingVersionId: string | null,
) {
  const events = await tx.usageEvent.findMany({
    where: { sessionId: id },
    orderBy: { timestamp: "asc" },
    take: 10000,
  });
  // A reviewed full-session snapshot replaces browser accounting, never adds to it.
  // Earlier reviewed snapshots remain in the audit history.
  const reconciled = events.filter((e) => e.source === "RECONCILED").at(-1);
  const billableEvents = reconciled ? [reconciled] : events;
  const { totals, complete } = aggregateUsage(
    billableEvents.map((e) => ({
      eventId: e.eventId,
      normalized: e.normalized as Counters,
      counterMode: e.counterMode as CounterMode,
      period: e.period,
    })),
  );
  const pricing = pricingVersionId
    ? await tx.pricingVersion.findUnique({ where: { id: pricingVersionId } })
    : null;
  const estimate = calculateCost(
    totals,
    pricing?.rates as Record<string, string> | null,
    complete && events.length < 10000,
  );
  // A partial zero must not masquerade as zero spending.
  await tx.voiceSession.update({
    where: { id },
    data: {
      estimatedCost:
        complete &&
        events.length < 10000 &&
        estimate.status !== "INCOMPLETE" &&
        Object.keys(totals).length
          ? estimate.cost
          : null,
      costStatus: estimate.status,
    },
  });
  return estimate;
}
