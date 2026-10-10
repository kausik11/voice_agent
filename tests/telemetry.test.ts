import { beforeEach, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
const { tx, events, messages, session } = vi.hoisted(() => {
  const events = new Map<string, Record<string, unknown>>();
  const messages = new Map<string, Record<string, unknown>>();
  const session = {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    status: "CONNECTING",
    expiresAt: new Date(),
    startedAt: new Date(),
    lastActivityAt: new Date(),
    credentialHash: "",
    usageTotals: {},
    pricingVersionId: null,
  };
  return {
    events,
    messages,
    session,
    tx: {
      voiceSession: { findUnique: vi.fn(), update: vi.fn() },
      transcriptMessage: { findUnique: vi.fn(), upsert: vi.fn() },
      usageEvent: { findUnique: vi.fn(), create: vi.fn() },
    },
  };
});
vi.mock("../lib/services", () => ({
  transaction: (fn: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    fn(tx as unknown as Prisma.TransactionClient),
}));
vi.mock("../lib/rate-limit", () => ({ consume: vi.fn() }));
vi.mock("../lib/accounting", () => ({ recalculateSession: vi.fn() }));
import { POST } from "../app/api/sessions/[id]/route";
const credential = "scoped-test-session-credential";
const eventId = "f84c5bbe-9380-4bdf-b381-3edfc7bdf8ed";
beforeEach(() => {
  vi.clearAllMocks();
  events.clear();
  messages.clear();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  Object.assign(session, {
    status: "CONNECTING",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 300000),
    lastActivityAt: new Date(),
    credentialHash: createHash("sha256").update(credential).digest("hex"),
  });
  tx.voiceSession.findUnique.mockResolvedValue(session);
  tx.voiceSession.update.mockImplementation(async ({ data }) =>
    Object.assign(session, data),
  );
  tx.usageEvent.findUnique.mockImplementation(
    async ({ where }) => events.get(where.sessionId_eventId.eventId) ?? null,
  );
  tx.usageEvent.create.mockImplementation(async ({ data }) => {
    events.set(data.eventId, data);
    return data;
  });
  tx.transcriptMessage.findUnique.mockImplementation(
    async ({ where }) => messages.get(where.sessionId_eventId.eventId) ?? null,
  );
  tx.transcriptMessage.upsert.mockImplementation(
    async ({ where, create, update }) => {
      const key = where.sessionId_eventId.eventId;
      messages.set(
        key,
        messages.has(key) ? { ...messages.get(key), ...update } : create,
      );
      return messages.get(key);
    },
  );
});
async function send(payload: unknown, token = credential) {
  return POST(
    new Request("http://localhost:3000/api/sessions/" + session.id, {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id: session.id }) },
  );
}
it("persists a retried usage event exactly once", async () => {
  const payload = {
    status: "ACTIVE",
    usage: [
      {
        eventId,
        raw: {
          promptTokenCount: 42,
          totalTokenCount: 42,
          promptTokensDetails: [{ modality: "AUDIO", tokenCount: 42 }],
        },
      },
    ],
  };
  expect((await send(payload)).status).toBe(200);
  expect((await send(payload)).status).toBe(200);
  expect(tx.usageEvent.create).toHaveBeenCalledTimes(1);
  expect(events.get(eventId)).toMatchObject({
    counterMode: "UNKNOWN",
    trust: "PROVISIONAL",
    source: "BROWSER",
  });
});
it("finalizes one transcript document and ignores a stale partial retry", async () => {
  const partial = {
    eventId,
    speaker: "user",
    sequence: 0,
    text: "Hel",
    final: false,
  };
  await send({ status: "ACTIVE", messages: [partial] });
  await send({ messages: [{ ...partial, text: "Hello", final: true }] });
  await send({ messages: [partial] });
  expect(messages.size).toBe(1);
  expect(messages.get(eventId)).toMatchObject({ text: "Hello", final: true });
});
it("rejects a credential from another session before any writes", async () => {
  expect((await send({ status: "ACTIVE" }, "wrong")).status).toBe(401);
  expect(tx.voiceSession.update).not.toHaveBeenCalled();
});
it("rejects stale scoped credentials", async () => {
  session.expiresAt = new Date(Date.now() - 61000);
  expect((await send({ status: "ACTIVE" })).status).toBe(410);
});
it("expires instead of reactivating a stale session", async () => {
  session.lastActivityAt = new Date(Date.now() - 91000);
  expect((await send({ status: "ACTIVE" })).status).toBe(200);
  expect(session.status).toBe("EXPIRED");
});
