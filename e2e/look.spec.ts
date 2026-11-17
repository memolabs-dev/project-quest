import { expect, test, type Page } from "@playwright/test";

// Fixed views of the demo site, to compare before and after a visual change. LOOK_TAG=before|after.
const tag = process.env.LOOK_TAG ?? "after";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape"); // skips the arrival fly-over when there is one
  // The models are in and two frames drawn: the views are steady without a fixed wait.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // The follow camera eases in from where the skipped fly-over left it: let it settle, or slower first frames
  // (shaders compiling) show a different view.
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

const settings = (page: Page) => page.getByRole("button", { name: "Settings" });

test("the miniature effect is remembered across a reload", async ({ page }) => {
  await ready(page);
  await settings(page).click();
  const box = page.getByRole("checkbox", { name: "Miniature effect" });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.reload();
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await settings(page).click();
  await expect(page.getByRole("checkbox", { name: "Miniature effect" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Miniature effect" }).check();
});

test("reduced motion: no birds and no sway", async ({ page }) => {
  await ready(page);
  const weather = () => page.evaluate(async () => {
    const { windUniforms } = await import("/src/client/scene/wind.ts");
    const urls = performance.getEntriesByType("resource").map((e) => e.name);
    const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
    const state = [...fiber._roots.values()][0].store.getState();
    return { wind: windUniforms.uWindStrength.value, birds: state.scene.getObjectByName("birds")?.count ?? -1 };
  });
  await settings(page).click();
  await page.getByRole("radio", { name: /^Full$/ }).check();
  await expect.poll(async () => (await weather()).wind).toBe(1);
  await page.getByRole("radio", { name: /^Reduced$/ }).check();
  await expect.poll(weather).toEqual({ wind: 0, birds: 0 });
  await page.getByRole("radio", { name: /Follow my system/ }).check();
});
