import { expect, test, type Page } from "@playwright/test";

// The site's people on the demo site (nothing reaches GitHub): workers follow their crate and greet the foreman.
test.describe.configure({ mode: "serial" });

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape");
};

/** A worker's body position in the world, by login. */
const workerX = (page: Page, login: string) => page.evaluate(async (who) => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const state = [...fiber._roots.values()][0].store.getState();
  const body = state.scene.getObjectByName(`worker-${who}`);
  if (!body) return null;
  body.updateWorldMatrix(true, false);
  return body.matrixWorld.elements[12] as number;
}, login);

test("a worker shows their name when the foreman comes near", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".worker-name")).toHaveCount(0);
  await page.keyboard.down("KeyW");
  await expect(page.locator(".worker-name").first()).toBeVisible({ timeout: 8000 });
  await page.keyboard.up("KeyW");
});

// After the name test: the demo board keeps this move for the rest of the run.
test("a worker follows their pallet to its new yard", async ({ page }) => {
  await ready(page);
  const before = await workerX(page, "maria-fictif");
  expect(before).not.toBeNull();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const p = useQuest.getState().site!.pallets.find((x) => /Paint the facade/.test(x.title))!;
    useQuest.getState().open(p.number);
  });
  await page.getByRole("dialog", { name: /Paint the facade/ }).locator(".zones button").first().click();
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  await expect.poll(async () => Math.abs((await workerX(page, "maria-fictif"))! - before!), { timeout: 5000 }).toBeGreaterThan(2);
});

/** The clip the foreman is playing now. */
const foremanClip = (page: Page) => page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const state = [...fiber._roots.values()][0].store.getState();
  return (state.scene.getObjectByName("foreman")?.userData.clip as string | undefined) ?? null;
});

test("the foreman sits after a while and stands at a key", async ({ page }) => {
  await ready(page);
  await expect.poll(() => foremanClip(page), { timeout: 20_000, intervals: [1000] }).toBe("Sit_Floor_Idle");
  await page.keyboard.down("KeyW");
  await expect.poll(() => foremanClip(page), { timeout: 3000 }).not.toBe("Sit_Floor_Idle");
  await page.keyboard.up("KeyW");
});
