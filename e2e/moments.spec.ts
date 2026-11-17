import { expect, test, type Page } from "@playwright/test";

// The moments on the demo site (nothing reaches GitHub): dust that comes and goes, settings remembered.

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

/** Moves the pallet "Hang the clock" to another yard through the card and the confirmation. */
const movePallet = async (page: Page) => {
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const pallet = useQuest.getState().site!.pallets.find((p) => /Hang the clock/i.test(p.title))!;
    useQuest.getState().open(pallet.number);
  });
  const card = page.getByRole("dialog", { name: /Hang the clock/ });
  await card.locator(".zones button").first().click();
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  await expect(page.getByRole("status")).not.toBeEmpty();
};

const setMotion = async (page: Page, label: RegExp) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: label }).check();
  await page.getByRole("button", { name: "Settings" }).click();
};

/** Where the crate of "Hang the clock" stands in the world now. */
const crateX = (page: Page) => page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const { useQuest } = await import("/src/client/store.ts");
  const n = useQuest.getState().site!.pallets.find((p) => /Hang the clock/i.test(p.title))!.number;
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
  await expect.poll(() => dustShowing(page), { timeout: 5000 }).toBeGreaterThan(0);
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
