import { z } from "zod";
import { isDemo } from "./config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  const requested = new URL(req.url);
  const host = req.headers.get("host");
  if (host) requested.host = host;
  const expected =
    !isDemo() && process.env.BETTER_AUTH_URL
      ? new URL(process.env.BETTER_AUTH_URL).origin
      : requested.origin;
  if (req.headers.get("origin") !== expected)
    throw new HttpError(403, "Request origin not allowed");
}
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return schema.parse(JSON.parse(text));
}
export function failure(e: unknown) {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return Response.json(
      { error: "Invalid input. Check the form fields." },
      { status: 400 },
    );
  return Response.json(
    { error: "Service unavailable. Check database and server configuration." },
    { status: 503 },
  );
}
