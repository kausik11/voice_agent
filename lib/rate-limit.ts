import { createHmac } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";
export async function consume(key: string, max: number, seconds = 60) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const id = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`${key}:${bucket}`)
    .digest("hex");
  const result = await db.rateBucket.upsert({
    where: { key: id },
    create: {
      key: id,
      count: 1,
      expiresAt: new Date((bucket + 2) * seconds * 1000),
    },
    update: { count: { increment: 1 } },
  });
  if (result.count > max)
    throw new HttpError(
      429,
      "Too many requests. Please wait a minute and try again.",
    );
}
export function clientKey(req: Request) {
  const header = process.env.TRUSTED_IP_HEADER;
  return header
    ? req.headers.get(header)?.split(",")[0].trim() || "unknown"
    : "shared-public";
}
