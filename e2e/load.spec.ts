import { expect, test, type Page } from "@playwright/test";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
};

// The first visit to the dev server compiles modules on demand, which a player of a built site never pays:
// warm the server once, then measure a fresh page.
test("the site loads within 10 seconds", async ({ page, context }) => {
  await ready(page);
  const fresh = await context.newPage();
  const start = Date.now();
  await ready(fresh);
  const ms = Date.now() - start;
  console.log(`load: ${ms} ms`);
  expect(ms).toBeLessThan(10_000);
});

