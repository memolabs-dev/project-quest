import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The ui-craft sweep (overflow, contrast, touch targets, input sizes) at four widths, light theme only:
// the game has a single light theme on purpose.
const script = readFileSync(new URL("./ui-check.js", import.meta.url), "utf8");

for (const coarse of [false, true]) {
  test(`interface sweep, ${coarse ? "touch" : "mouse"} pointer`, async ({ browser }) => {
    const context = await browser.newContext(coarse ? { hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } } : {});
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".top-right")).toBeVisible();
    await page.addScriptTag({ content: script });
    const result = await page.evaluate(() =>
      (window as unknown as { uiCheck: (o: object) => Promise<{ totals: Record<string, number>; failures: unknown[] }> })
        .uiCheck({ themes: ["light"], settle: 3000 }));
    console.log(JSON.stringify(result.failures).slice(0, 1500));
    expect(result.totals).toEqual({ overflow: 0, contrast: 0, targets: 0, inputs: 0 });
    await context.close();
  });
}
