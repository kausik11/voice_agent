import { isDemo } from "@/lib/config";
import { failure, sameOrigin, HttpError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!isDemo()) throw new HttpError(404, "Not found");
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": `medha-demo=1; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie":
            "medha-demo=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
