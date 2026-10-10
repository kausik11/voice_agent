import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { defaults, parseAgentConfig } from "./config";
import { active, expired } from "./domain";
export async function settings() {
  const row = await db.agentSettings.findUnique({ where: { key: "default" } });
  return row ? parseAgentConfig(row.config) : defaults;
}
export async function ensureSettings() {
  return db.agentSettings.upsert({
    where: { key: "default" },
    create: { key: "default", config: defaults },
    update: {},
  });
}
// Deliberately bounded retrieval. Replace this function with indexed retrieval as the corpus grows.
export async function approvedKnowledge() {
  const entries = await db.knowledgeEntry.findMany({
    where: { enabled: true, sample: false },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  let text = "";
  for (const e of entries) {
    const next = `\n[${e.category}] ${e.question}\n${e.answer}\n`;
    if (text.length + next.length > 12000) break;
    text += next;
  }
  return text;
}
export async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await db.$transaction(fn);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(e.code) &&
        n < 3
      )
        continue;
      throw e;
    }
  }
}
export async function expireSessions() {
  const now = new Date();
  const rows = await db.voiceSession.findMany({
    where: {
      status: { in: active },
      OR: [
        { expiresAt: { lte: now } },
        { lastActivityAt: { lt: new Date(Date.now() - 90000) } },
      ],
    },
    take: 200,
  });
  for (const s of rows) {
    if (!expired(s, now)) continue;
    const end = new Date(
      Math.min(
        s.expiresAt.getTime(),
        s.lastActivityAt.getTime() + 90000,
        now.getTime(),
      ),
    );
    await db.voiceSession.updateMany({
      where: { id: s.id, status: { in: active }, revision: s.revision },
      data: {
        status: "EXPIRED",
        endedAt: end,
        duration: Math.max(
          0,
          Math.floor((end.getTime() - s.startedAt.getTime()) / 1000),
        ),
        reason: "Session expired or heartbeat lost",
        revision: { increment: 1 },
      },
    });
  }
  return rows.length;
}
export async function deleteSession(id: string) {
  await transaction(async (tx) => {
    const s = await tx.voiceSession.findUnique({ where: { id } });
    if (!s) return;
    if (active.includes(s.status))
      throw new HttpError(409, "End this session before deleting it");
    await tx.transcriptMessage.deleteMany({ where: { sessionId: id } });
    await tx.usageEvent.deleteMany({ where: { sessionId: id } });
    await tx.voiceSession.delete({ where: { id } });
  });
}
