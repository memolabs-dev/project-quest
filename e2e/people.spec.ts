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

// After the name test: the demo board keeps this move for the rest of the run. jo-fictif moves, not maria-fictif:
// the cheer spec walks up to maria, on the same demo server, at the same time.
test("a worker follows their pallet to its new yard", async ({ page }) => {
  await ready(page);
  const before = await workerX(page, "jo-fictif");
  expect(before).not.toBeNull();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const p = useQuest.getState().site!.pallets.find((x) => /Draw the reading room/.test(x.title))!;
    useQuest.getState().open(p.number);
  });
  await page.getByRole("dialog", { name: /Draw the reading room/ }).locator(".zones button").first().click();
  // On a loaded machine the dev server can answer late: the clock starts once the move is applied.
  const applied = page.waitForResponse((r) => r.url().includes("/moves/apply"));
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  await expect.poll(async () => Math.abs((await workerX(page, "jo-fictif"))! - before!), { timeout: 5000 }).toBeGreaterThan(2);
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

/** A worker's head turn and wave, read from the scene (the worker's animated group, not its body). */
const workerLife = (page: Page, login: string) => page.evaluate(async (who) => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const state = [...fiber._roots.values()][0].store.getState();
  const group = state.scene.getObjectsByProperty("name", `worker-${who}`).find((o: { userData: { clip?: string } }) => o.userData.clip !== undefined);
  return group ? { yaw: group.userData.yaw as number, waving: group.userData.waving as boolean } : null;
}, login);

/** Walks forward until a worker's name shows; returns their login. */
const walkToAWorker = async (page: Page) => {
  await page.keyboard.down("KeyW");
  await expect(page.locator(".worker-name").first()).toBeVisible({ timeout: 8000 });
  await page.keyboard.up("KeyW");
  return (await page.locator(".worker-name").first().textContent())!;
};

test("near a worker, their head turns toward the foreman and they wave once, then go back to work", async ({ page }) => {
  await ready(page);
  const login = await walkToAWorker(page);
  // The wave starts with the name and lasts one clip: seen while it plays, then over.
  await expect.poll(async () => (await workerLife(page, login))?.waving, { timeout: 2000, intervals: [50] }).toBe(true);
  await expect.poll(async () => Math.abs((await workerLife(page, login))?.yaw ?? 0), { timeout: 5000 }).toBeGreaterThan(0.05);
  await expect.poll(async () => (await workerLife(page, login))?.waving, { timeout: 8000 }).toBe(false);
});

test("with reduced motion a worker shows their name only: no wave, no head turn", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /^Reduced$/ }).check();
  // Closed by its button: the focus leaves the radio input, where keys are words and never walk the foreman.
  await page.getByRole("button", { name: "Settings" }).click();
  const login = await walkToAWorker(page);
  for (let i = 0; i < 6; i++) {
    expect(await workerLife(page, login)).toEqual({ yaw: 0, waving: false });
    await page.waitForTimeout(250);
  }
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /Follow my system/ }).check();
});
