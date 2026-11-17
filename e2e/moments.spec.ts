import { expect, test, type Page } from "@playwright/test";

// The moments on the demo site (nothing reaches GitHub): dust that comes and goes, settings remembered.
// They move "Build the shelves", a pallet no other spec touches: the demo server is shared by parallel workers.

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape");
};

/** How many of the director's dust particles are showing now. */
const dustShowing = (page: Page) => page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const state = [...fiber._roots.values()][0].store.getState();
  const mesh = state.scene.getObjectByName("moment-dust");
  if (!mesh) return -1;
  let n = 0;
  const m = mesh.instanceMatrix.array as Float32Array;
  for (let i = 0; i < mesh.count; i++) if (Math.abs(m[i * 16]) > 0.001) n++;
  return n;
});

/** Moves the pallet "Build the shelves" to another yard through the card and the confirmation. */
const movePallet = async (page: Page) => {
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const pallet = useQuest.getState().site!.pallets.find((p) => /Build the shelves/i.test(p.title))!;
    useQuest.getState().open(pallet.number);
  });
  const card = page.getByRole("dialog", { name: /Build the shelves/ });
  await card.locator(".zones button").first().click();
  // On a loaded machine the dev server can answer late: the clock starts once the move is applied.
  const applied = page.waitForResponse((r) => r.url().includes("/moves/apply"));
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  await expect(page.getByRole("status")).not.toBeEmpty();
};

const setMotion = async (page: Page, label: RegExp) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: label }).check();
  await page.getByRole("button", { name: "Settings" }).click();
};

/** Where the crate of "Build the shelves" stands in the world now. */
const crateX = (page: Page) => page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const { useQuest } = await import("/src/client/store.ts");
  const n = useQuest.getState().site!.pallets.find((p) => /Build the shelves/i.test(p.title))!.number;
  const state = [...fiber._roots.values()][0].store.getState();
  const crate = state.scene.getObjectByName(`crate-${n}`);
  const v = { x: 0, y: 0, z: 0 };
  crate.updateWorldMatrix(true, false);
  const e = crate.matrixWorld.elements;
  v.x = e[12];
  return v.x;
});

test("a moved pallet goes to its new yard and stays there", async ({ page }) => {
  await ready(page);
  await setMotion(page, /^Full$/);
  const before = await crateX(page);
  await movePallet(page);
  await page.waitForTimeout(1200);
  expect(Math.abs((await crateX(page)) - before)).toBeGreaterThan(2);
});

test("a moved pallet raises dust that fades", async ({ page }) => {
  await ready(page);
  await setMotion(page, /^Full$/);
  await movePallet(page);
  // Dust lives 0.7 s: sample often, or a loaded machine's slower polls step over it.
  await expect.poll(() => dustShowing(page), { timeout: 5000, intervals: [50] }).toBeGreaterThan(0);
  await expect.poll(() => dustShowing(page), { timeout: 5000 }).toBe(0);
});

test("mute is remembered across a reload", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("checkbox", { name: "Sound" }).uncheck();
  await page.reload();
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("checkbox", { name: "Sound" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Sound" }).check();
});

test("reduced motion shows no particle and still the notice", async ({ page }) => {
  await ready(page);
  await setMotion(page, /^Reduced$/);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await movePallet(page);
  await page.waitForTimeout(400);
  expect(await dustShowing(page)).toBe(0);
  await setMotion(page, /Follow my system/);
});
