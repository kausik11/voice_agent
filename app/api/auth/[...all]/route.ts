import { getAuth } from "@/lib/auth";
import { failure } from "@/lib/http";
import { consume, clientKey } from "@/lib/rate-limit";
import { isDemo } from "@/lib/config";
async function handler(req: Request) {
  try {
    if (isDemo())
      return Response.json(
        { error: "Authentication is unavailable in demo mode." },
        { status: 503 },
      );
    const auth = getAuth();
    if (
      req.method === "POST" &&
      new URL(req.url).pathname.endsWith("/sign-in/email")
    )
      await consume(`login:${clientKey(req)}`, 5);
    return await auth.handler(req);
  } catch (e) {
    return failure(e);
  }
}
export { handler as GET, handler as POST };
