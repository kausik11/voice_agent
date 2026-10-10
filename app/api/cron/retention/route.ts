import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { expireSessions } from "@/lib/services";
import { failure, HttpError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const actual = Buffer.from(req.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
    if (
      !process.env.CRON_SECRET ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new HttpError(401, "Unauthorized");
    const expired = await expireSessions();
    const sessions = await db.voiceSession.findMany({
      where: {
        transcriptPurged: false,
        transcriptExpiresAt: { lte: new Date() },
      },
      select: { id: true },
      take: 500,
    });
    const result = await db.transcriptMessage.deleteMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
    });
    await db.voiceSession.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { transcriptPurged: true },
    });
    await db.rateBucket.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return Response.json({ expired, transcriptsDeleted: result.count });
  } catch (e) {
    return failure(e);
  }
}
