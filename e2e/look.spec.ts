import { expect, test, type Page } from "@playwright/test";

// Fixed views of the demo site, to compare before and after a visual change. LOOK_TAG=before|after.
const tag = process.env.LOOK_TAG ?? "after";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape"); // skips the arrival fly-over when there is one
  await page.waitForTimeout(1500);
};
const walk = async (page: Page, key: string, ms: number) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(800);
};

test("look: overview, yard, buildings", async ({ page }) => {
  await ready(page);
  await page.screenshot({ path: `e2e/screenshots/look-overview-${tag}.png` });
  await walk(page, "KeyW", 1200);
  await page.screenshot({ path: `e2e/screenshots/look-yard-${tag}.png` });
  await walk(page, "KeyW", 2600);
  await page.screenshot({ path: `e2e/screenshots/look-buildings-${tag}.png` });
});
