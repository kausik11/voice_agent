import { hashPassword } from "better-auth/crypto";
import { db } from "../lib/db";
import { z } from "zod";
async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
  const password = z
    .string()
    .min(12)
    .max(128)
    .parse(process.env.ADMIN_PASSWORD);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const hash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email } }))
      throw new Error(
        "An account already exists for this email. No changes made.",
      );
    const user = await tx.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME || "Administrator",
        emailVerified: true,
        role: "admin",
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hash,
      },
    });
  });
  console.log("Administrator created. Sign in at /admin/login.");
}
main()
  .catch(() => {
    console.error(
      "Administrator setup failed. Check the database, a valid email, a new account, and a password of 12–128 characters.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
