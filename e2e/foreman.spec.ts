import { expect, test } from "@playwright/test";

test("the foreman walks toward the yards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/foreman-idle.png" });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e/screenshots/foreman-walking.png" });
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyW");
  await expect(page.locator(".prompt")).toBeVisible();
});
