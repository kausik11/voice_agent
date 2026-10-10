import { requireAdmin } from "./auth";
import { isDemo } from "./config";
import { HttpError } from "./http";
export async function adminAccess(headers: Headers) {
  if (isDemo()) {
    if (
      !headers
        .get("cookie")
        ?.split(";")
        .some((c) => c.trim() === "medha-demo=1")
    )
      throw new HttpError(
        401,
        "Open the demo from the administrator login page.",
      );
    return "demo";
  }
  await requireAdmin(headers);
  return "live";
}
