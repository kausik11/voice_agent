import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";
import { isAdmin } from "./domain";
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (
    !process.env.DATABASE_URL ||
    !process.env.BETTER_AUTH_SECRET ||
    !process.env.BETTER_AUTH_URL
  )
    throw new HttpError(
      503,
      "Authentication requires DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL.",
    );
  return (instance ??= createAuth());
}
function createAuth() {
  return betterAuth({
    database: prismaAdapter(db, { provider: "mongodb" }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "viewer", input: false },
      },
    },
    advanced: {
      database: { generateId: () => randomBytes(12).toString("hex") },
      useSecureCookies: process.env.BETTER_AUTH_URL!.startsWith("https://"),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
  });
}
export async function requireAdmin(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });
  if (!isAdmin(session?.user as { role?: string } | undefined))
    throw new HttpError(401, "Administrator login required");
  return session;
}
