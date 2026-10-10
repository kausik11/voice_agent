import { test, expect } from "@playwright/test";
test("public demo requires notice consent and produces only a labelled sample", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A little guidance. A real conversation.",
    }),
  ).toBeVisible();
  const start = page.getByRole("button", { name: "Try a sample conversation" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();
  await expect(
    page.getByRole("button", { name: "End conversation" }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText(
    "Hello! How can I arrange a visit?",
    { timeout: 5000 },
  );
  await page.getByRole("button", { name: "End conversation" }).click();
  await expect(
    page.getByRole("button", { name: "Start a new conversation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/public-desktop.png",
    fullPage: true,
  });
});
test("admin API and pages require access; demo can navigate every screen", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/sessions")).status()).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByRole("button", { name: "Explore demo dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer picture." }),
  ).toBeVisible();
  await expect(
    page.getByText("Conversation activity", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sessions-panel:visible tbody tr")).toHaveCount(5);
  await page.screenshot({
    path: "artifacts/admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Conversations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Conversations", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter by status").selectOption("FAILED");
  await expect(page.locator(".sessions-panel:visible tbody tr")).toHaveCount(3);
  await page.getByLabel("Filter by status").selectOption("");
  await page
    .getByRole("link", { name: "View session demo-001", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Knowledge base", exact: true }).click();
  await page.getByRole("button", { name: "Add FAQ" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save FAQ" })).toBeDisabled();
  await page.getByRole("button", { name: "Close editor" }).click();
  for (const [link, heading] of [
    ["Agent settings", "Make Medha your own."],
    ["Model pricing", "Know what goes into a cost."],
    ["Budget & alerts", "A little peace of mind."],
  ]) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
test("mobile public layout fits viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", {
      name: "Services & support Find the right information",
    })
    .click();
  await expect(
    page.getByText("Ask about the support you are looking for.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/public-mobile.png",
    fullPage: true,
  });
});

test("typed questions require consent and demo explains live setup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Your question").fill("Explain gravity");
  await expect(
    page.getByRole("button", { name: "Send question" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Your question").press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Live answers are not enabled" }),
  ).toContainText("Live answers are not enabled");
  await expect(page.getByLabel("Your question")).toHaveValue("Explain gravity");
  await page.getByRole("button", { name: /Learn something new/ }).click();
  await expect(page.getByLabel("Your question")).toHaveValue(
    "Why is the sky blue?",
  );
});
