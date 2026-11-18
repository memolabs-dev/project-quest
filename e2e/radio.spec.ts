import { expect, test, type Page } from "@playwright/test";

// The site radio on the demo site (?demo: nothing reaches GitHub). Its picture of the site lives in each test page's own
// localStorage (a fresh context per test), so every test starts from a first visit unless it says otherwise.

const WELCOME = /(Welcome to|Here we are on|Good to see you on) the demo site/;
const CALM = /Dead calm|Not a breath of wind|Quiet as a Sunday/;
const bubble = (page: Page) => page.locator(".radio-bubble");

const ready = async (page: Page, url = "/?demo") => {
  await page.goto(url);
  await expect(page.locator(".sign-label").first()).toBeVisible();
};

/** The radio's state in the store: the fly-over is done, and how many lines it has chosen (said or not). */
const radioState = (page: Page) => page.evaluate(async () => {
  const { useQuest } = await import("/src/client/store.ts");
  const s = useQuest.getState();
  return { arrived: s.arrived, lines: s.radioLines.length };
});

/** Waits until the radio has chosen its lines (said or not). */
const chosen = (page: Page) => expect.poll(async () => (await radioState(page)).lines).toBeGreaterThan(0);

const setting = (page: Page, patch: Record<string, unknown>) =>
  page.addInitScript((p) => {
    if (!localStorage.getItem("project-quest.settings")) localStorage.setItem("project-quest.settings", JSON.stringify(p));
  }, patch);

/** What the test reads of the radio set in the scene: where it stands, the light's colour, the antenna's tilt. */
const sceneRead = (page: Page, what: "spot" | "light" | "tilt") => page.evaluate(async (w) => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const scene = [...fiber._roots.values()][0].store.getState().scene;
  if (w === "spot") {
    const o = scene.getObjectByName("radio-set");
    o.updateWorldMatrix(true, false);
    return { x: o.matrixWorld.elements[12] as number, z: o.matrixWorld.elements[14] as number };
  }
  return w === "light" ? (scene.getObjectByName("radio-light").material.color.getHex() as number) : (scene.getObjectByName("radio-antenna").rotation.z as number);
}, what);

const walkToRadio = async (page: Page) => {
  const target = (await sceneRead(page, "spot")) as { x: number; z: number };
  expect(target).not.toBeNull();
  const prompt = page.locator(".prompt");
  const at = () => page.evaluate(async () => (await import("/src/client/moments/player.ts")).playerPosition);
  const hold = async (key: string, until: () => Promise<boolean>) => {
    await page.keyboard.down(key);
    try {
      for (let i = 0; i < 150 && !(await until()); i++) await page.waitForTimeout(40);
    } finally {
      await page.keyboard.up(key);
    }
  };
  await page.keyboard.down("ShiftLeft");
  for (const key of ["KeyA", "KeyD"]) {
    await hold(key, async () => {
      const p = await at();
      return key === "KeyA" ? p.x <= target.x + 0.3 : p.x >= target.x - 0.3;
    });
  }
  await page.keyboard.up("ShiftLeft");
  await hold("KeyW", async () => /listen to the radio again/.test((await prompt.allTextContents()).join(" ")));
  await expect(prompt).toContainText("E: listen to the radio again");
};

test("the first visit's welcome plays after the arrival", async ({ page }) => {
  await ready(page);
  await expect(bubble(page)).toHaveText(WELCOME);
  await expect(bubble(page).locator("xpath=..")).toHaveAttribute("aria-live", "polite");
});

test("a reload does not repeat the news", async ({ page }) => {
  await ready(page);
  await expect(bubble(page)).toHaveText(WELCOME);
  await page.reload();
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await expect(bubble(page)).toHaveText(CALM);
});

test("after a pallet is moved and the page reloaded, the radio tells it", async ({ page }) => {
  await ready(page);
  await expect(bubble(page)).toHaveText(WELCOME);
  await page.keyboard.press("Escape");
  const pallet = await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const p = useQuest.getState().site!.pallets.find((x) => /Build the shelves/i.test(x.title))!;
    useQuest.getState().open(p.number);
    return { number: p.number, zone: p.zone };
  });
  const card = page.getByRole("dialog", { name: /Build the shelves/ });
  const to = pallet.zone === "In review" ? "Being laid" : "Inspection";
  await card.locator(".zones button", { hasText: to }).click();
  const applied = page.waitForResponse((r) => r.url().includes("/moves/apply"));
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  await page.reload();
  await expect(page.locator(".sign-label").first()).toBeVisible();
  // The line about one pallet points at it: its words are a button that opens the card.
  const line = page.locator(".radio-pallet");
  await expect(line).toBeVisible();
  await line.dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: /Build the shelves/ })).toBeVisible();
});

test("E near the radio replays", async ({ page }) => {
  await ready(page);
  await expect(bubble(page)).toHaveText(WELCOME);
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveCount(0);
  await walkToRadio(page);
  await page.keyboard.press("KeyE");
  await expect(bubble(page)).toHaveText(WELCOME);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("muted, the radio does not speak by itself", async ({ page }) => {
  await setting(page, { radio: false });
  await ready(page);
  // Its lines are chosen (and the picture kept), only not said.
  await chosen(page);
  await page.waitForTimeout(1500);
  await expect(bubble(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("project-quest.radio.demo"))).not.toBeNull();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("checkbox", { name: "Site radio speaks by itself" })).not.toBeChecked();
});

test("the radio waits for an open card", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().open(useQuest.getState().site!.pallets[0].number);
  });
  // Past the fly-over and its second of delay: the radio has not said a word under the card.
  await expect.poll(async () => (await radioState(page)).arrived).toBe(true);
  await page.waitForTimeout(2500);
  await expect(bubble(page)).toHaveCount(0);
  await page.evaluate(async () => (await import("/src/client/store.ts")).useQuest.getState().open(null));
  await expect(bubble(page)).toHaveText(WELCOME);
});

test("reduced motion: the antenna stays still, the light blinks", async ({ page }) => {
  await setting(page, { motion: "reduce" });
  await ready(page);
  await expect(bubble(page)).toBeVisible();
  const lights = new Set<number>();
  const tilts = new Set<number>();
  for (let i = 0; i < 12; i++) {
    lights.add((await sceneRead(page, "light")) as number);
    tilts.add((await sceneRead(page, "tilt")) as number);
    await page.waitForTimeout(120);
  }
  expect([...tilts]).toEqual([0]);
  expect(lights.size).toBe(2);
});

test("the radio makes no request to the server", async ({ browser }) => {
  const api = async (settings: Record<string, unknown>) => {
    const page = await (await browser.newContext()).newPage();
    await setting(page, settings);
    const seen = new Set<string>();
    page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) seen.add(`${r.method()} ${u.pathname}`); });
    await ready(page);
    await chosen(page);
    if (settings.radio !== false) {
      await expect(bubble(page)).toBeVisible();
      await expect(bubble(page)).toHaveCount(0, { timeout: 10_000 });
    } else {
      await page.waitForTimeout(3000);
    }
    await page.context().close();
    return [...seen].sort();
  };
  const without = await api({ radio: false });
  const withRadio = await api({ radio: true });
  expect(withRadio).toEqual(without);
  expect(withRadio.length).toBeGreaterThan(0);
});

test("plain / on the demo server keeps its picture under demo, never main", async ({ page }) => {
  await ready(page, "/");
  await expect(bubble(page)).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("project-quest.radio.")));
  expect(keys).toEqual(["project-quest.radio.demo"]);
});
