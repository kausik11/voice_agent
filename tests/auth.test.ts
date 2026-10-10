import { beforeEach, describe, it, expect, vi } from "vitest";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("better-auth", () => ({ betterAuth: () => ({ api: { getSession } }) }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => ({}) }));
vi.mock("../lib/db", () => ({ db: {} }));
import { requireAdmin } from "../lib/auth";
import { adminAccess } from "../lib/admin-access";
beforeEach(() => {
  process.env.DATABASE_URL = "mongodb://localhost/test";
  process.env.BETTER_AUTH_SECRET = "test-secret-for-repeatable-mocked-tests";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.DEMO_MODE = "false";
  getSession.mockReset();
});
describe("server authorization", () => {
  it("rejects requests without a server session", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin(new Headers())).rejects.toMatchObject({
      status: 401,
    });
  });
  it("rejects a valid session without admin authorization", async () => {
    getSession.mockResolvedValue({ user: { role: "viewer" } });
    await expect(requireAdmin(new Headers())).rejects.toMatchObject({
      status: 401,
    });
  });
  it("accepts a verified admin session", async () => {
    getSession.mockResolvedValue({ user: { role: "admin" } });
    await expect(requireAdmin(new Headers())).resolves.toMatchObject({
      user: { role: "admin" },
    });
  });
  it("does not allow a demo cookie to bypass live authorization", async () => {
    getSession.mockResolvedValue(null);
    await expect(
      adminAccess(new Headers({ cookie: "mma-demo=1" })),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("requires explicit demo entry even for sample admin data", async () => {
    process.env.DEMO_MODE = "true";
    await expect(adminAccess(new Headers())).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      adminAccess(new Headers({ cookie: "mma-demo=1" })),
    ).resolves.toBe("demo");
  });
});
