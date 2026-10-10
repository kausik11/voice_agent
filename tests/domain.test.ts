import { describe, it, expect } from "vitest";
import {
  aggregateUsage,
  calculateCost,
  canTransition,
  expired,
  finalizeTranscript,
  csvCell,
  isAdmin,
} from "../lib/domain";
import {
  settingsSchema,
  defaults,
  pricingSchema,
  budgetSchema,
} from "../lib/config";
describe("decimal-safe accounting", () => {
  it("calculates exact category costs before display rounding", () =>
    expect(
      calculateCost(
        { "input.AUDIO": 12345, "output.AUDIO": 9876 },
        { "input.AUDIO": "0.123456789", "output.AUDIO": "2.987654321" },
      ),
    ).toEqual({ cost: "0.031030148134", status: "PROVISIONAL" }));
  it("rounds only at the documented twelve-decimal storage boundary", () =>
    expect(
      calculateCost({ "input.TEXT": 1 }, { "input.TEXT": "0.0000005" }).cost,
    ).toBe("0.000000000001"));
  it("does not invent pricing", () =>
    expect(calculateCost({ "input.AUDIO": 500 }, null)).toEqual({
      cost: null,
      status: "PRICING_UNAVAILABLE",
    }));
  it("marks absent categories incomplete", () =>
    expect(
      calculateCost(
        { "input.AUDIO": 10, "output.AUDIO": 50 },
        { "input.AUDIO": "1" },
      ).status,
    ).toBe("INCOMPLETE"));
  it("marks missing usage incomplete", () =>
    expect(calculateCost({}, { "input.AUDIO": "1" }).status).toBe(
      "INCOMPLETE",
    ));
  it("rejects negative or fractional counters", () => {
    expect(() => calculateCost({ audio: -1 }, { audio: "1" })).toThrow();
    expect(() => calculateCost({ audio: 1.5 }, { audio: "1" })).toThrow();
  });
  it("supports distinct cache and additional billable categories", () =>
    expect(
      calculateCost(
        { "cache.TEXT": 1000000, thoughts: 1000000 },
        { "cache.TEXT": "0.1", thoughts: "0.2" },
      ).cost,
    ).toBe("0.300000000000"));
});
describe("usage counters and idempotency", () => {
  it("adds incremental events exactly once", () => {
    const a = {
      eventId: "a",
      normalized: { audio: 10 },
      counterMode: "INCREMENTAL" as const,
      period: "turn1",
    };
    expect(
      aggregateUsage([a, a, { ...a, eventId: "b", normalized: { audio: 20 } }])
        .totals.audio,
    ).toBe(30);
  });
  it("takes the high water mark of cumulative counters even out of order", () => {
    const e = {
      eventId: "a",
      normalized: { audio: 10 },
      counterMode: "CUMULATIVE" as const,
      period: "connection1",
    };
    expect(
      aggregateUsage([
        { ...e, normalized: { audio: 30 } },
        e,
        { ...e, eventId: "b", normalized: { audio: 20 } },
      ]).totals.audio,
    ).toBe(30);
  });
  it("separates cumulative reporting periods", () => {
    const e = {
      eventId: "a",
      normalized: { audio: 10 },
      counterMode: "CUMULATIVE" as const,
      period: "connection1",
    };
    expect(
      aggregateUsage([e, { ...e, eventId: "b", period: "connection2" }]).totals
        .audio,
    ).toBe(20);
  });
  it("never silently sums unknown live metadata", () =>
    expect(
      aggregateUsage([
        {
          eventId: "a",
          normalized: { audio: 10 },
          counterMode: "UNKNOWN",
          period: "unknown",
        },
      ]),
    ).toEqual({ totals: {}, complete: false }));
});
describe("session lifecycle", () => {
  it.each([
    ["CREATED", "CONNECTING"],
    ["CONNECTING", "ACTIVE"],
    ["ACTIVE", "COMPLETED"],
    ["ACTIVE", "EXPIRED"],
    ["CONNECTING", "FAILED"],
  ])("allows %s → %s", (a, b) => expect(canTransition(a, b)).toBe(true));
  it.each([
    ["COMPLETED", "ACTIVE"],
    ["EXPIRED", "ACTIVE"],
    ["CREATED", "ACTIVE"],
    ["FAILED", "CONNECTING"],
  ])("rejects %s → %s", (a, b) => expect(canTransition(a, b)).toBe(false));
  it("permits idempotent state retries", () =>
    expect(canTransition("COMPLETED", "COMPLETED")).toBe(true));
  it("expires an abandoned session", () =>
    expect(
      expired(
        { expiresAt: new Date(200000), lastActivityAt: new Date(0) },
        new Date(90001),
      ),
    ).toBe(true));
  it("expires at maximum duration", () =>
    expect(
      expired(
        { expiresAt: new Date(1000), lastActivityAt: new Date(900) },
        new Date(1000),
      ),
    ).toBe(true));
  it("keeps a timely heartbeat active", () =>
    expect(
      expired(
        { expiresAt: new Date(100000), lastActivityAt: new Date(900) },
        new Date(1000),
      ),
    ).toBe(false));
});
describe("transcript finalization", () => {
  it("updates one partial message instead of appending copies", () =>
    expect(
      finalizeTranscript(
        { text: "Hel", final: false },
        { text: "Hello", final: true },
      ),
    ).toEqual({ text: "Hello", final: true }));
  it("does not overwrite a final transcript with an old retry", () =>
    expect(
      finalizeTranscript(
        { text: "Hello", final: true },
        { text: "Hel", final: false },
      ),
    ).toEqual({ text: "Hello", final: true }));
  it("preserves an unfinished transcript as partial", () =>
    expect(finalizeTranscript(null, { text: "Hel", final: false }).final).toBe(
      false,
    ));
});
describe("authorization and validation", () => {
  it("rejects anonymous and ordinary users", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ role: "viewer" })).toBe(false);
    expect(isAdmin({ role: "admin" })).toBe(true);
  });
  it("accepts defaults and rejects unsupported models", () => {
    expect(settingsSchema.safeParse(defaults).success).toBe(true);
    expect(
      settingsSchema.safeParse({ ...defaults, model: "invented-model" })
        .success,
    ).toBe(false);
  });
  it("requires an exchange rate date", () =>
    expect(
      budgetSchema.safeParse({
        daily: null,
        monthly: null,
        blockNew: false,
        inrRate: "80",
        exchangeEffectiveAt: null,
        hostingMonthly: null,
        telephoneMonthly: null,
      }).success,
    ).toBe(false));
  it("rejects invented pricing categories", () =>
    expect(
      pricingSchema.safeParse({
        model: defaults.model,
        currency: "USD",
        effectiveAt: new Date().toISOString(),
        sourceUrl: "https://ai.google.dev",
        rates: { fake: "1" },
      }).success,
    ).toBe(false));
  it.each(['=HYPERLINK("evil")', "+cmd", "-cmd", "@SUM(1)", " \t=cmd"])(
    "escapes spreadsheet formulas: %s",
    (v) => expect(csvCell(v).startsWith("\"'")).toBe(true),
  );
  it("quotes commas and embedded quotes", () =>
    expect(csvCell('hello,"world"')).toBe('"hello,""world"""'));
});
it("does not assume a missing usage category is zero", () =>
  expect(
    calculateCost(
      { "input.AUDIO": 100 },
      { "input.AUDIO": "1", "output.AUDIO": "2" },
    ).status,
  ).toBe("INCOMPLETE"));
it("refuses to mix cumulative and incremental counters for one period", () =>
  expect(
    aggregateUsage([
      {
        eventId: "a",
        normalized: { audio: 10 },
        counterMode: "INCREMENTAL",
        period: "same",
      },
      {
        eventId: "b",
        normalized: { audio: 20 },
        counterMode: "CUMULATIVE",
        period: "same",
      },
    ]).complete,
  ).toBe(false));
import { telemetryBatches } from "../lib/telemetry-batches";
it("batches long Bengali transcripts by UTF-8 bytes, not character count", () => {
  const messages = Array.from({ length: 3 }, (_, i) => ({
    eventId: String(i),
    speaker: "user" as const,
    text: "ক".repeat(16000),
    sequence: i,
    final: true,
  }));
  const batches = telemetryBatches(messages, []);
  expect(batches.length).toBe(3);
  for (const b of batches)
    expect(new TextEncoder().encode(JSON.stringify(b)).length).toBeLessThan(
      65536,
    );
});
it("keeps precision for large counts and nine-decimal configured rates", () =>
  expect(
    calculateCost(
      { "input.TEXT": 99999999 },
      { "input.TEXT": "999999999.123456789" },
    ).cost,
  ).toBe("99999998912.345679776543"));
