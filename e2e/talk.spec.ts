import { expect, test, type Page } from "@playwright/test";

// Answering someone who waits and welcoming a newcomer, on the demo site (nothing reaches GitHub). The demo keeps its
// state in memory and is shared by parallel workers: each test talks to its own person (maria on #12, lucas on #31, sana on #32).

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape");
};

const confirmation = (page: Page) => page.getByRole("dialog", { name: /sent to GitHub/ });

/** The world position of a named object on the site (a crate, a visitor), or null. */
const placeOf = (page: Page, name: string) => page.evaluate(async (who) => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
  const state = [...fiber._roots.values()][0].store.getState();
  const o = state.scene.getObjectByName(who);
  if (!o) return null;
  o.updateWorldMatrix(true, false);
  return { x: o.matrixWorld.elements[12] as number, z: o.matrixWorld.elements[14] as number };
}, name);

/** Walks the foreman toward an object, along the road first and then up to it, until the game offers to talk. */
const walkTo = async (page: Page, name: string, stopAt: RegExp) => {
  const prompt = page.locator(".prompt");
  const at = async () => page.evaluate(async () => (await import("/src/client/moments/player.ts")).playerPosition);
  const hold = async (key: string, until: () => Promise<boolean>) => {
    await page.keyboard.down(key);
    try {
      for (let i = 0; i < 150 && !(await until()); i++) await page.waitForTimeout(40);
    } finally {
      await page.keyboard.up(key);
    }
  };
  const target = (await placeOf(page, name))!;
  expect(target).not.toBeNull();
  // Along the road, to the object's column; a run (Shift) keeps the long walk to the office short.
  await page.keyboard.down("ShiftLeft");
  for (const key of ["KeyA", "KeyD"]) {
    await hold(key, async () => {
      const p = await at();
      return key === "KeyA" ? p.x <= target.x + 0.3 : p.x >= target.x - 0.3;
    });
  }
  await page.keyboard.up("ShiftLeft");
  // Then up to it, one step at a time: it stops as soon as the prompt shows.
  await hold("KeyW", async () => (await prompt.textContent())?.match(stopAt) !== null);
  await expect(prompt).toHaveText(stopAt);
};

test("E near a waiting pallet opens the draft, the confirmation shows the words, nothing leaves, the bubble goes", async ({ page }) => {
  await ready(page);
  const bubble = page.locator(".talk-bubble", { hasText: "fictif-maria" });
  await expect(bubble).toHaveCount(1);
  await expect(bubble).toContainText(/\d+ d/);
  await walkTo(page, "crate-12", /answer fictif-maria/);
  await page.keyboard.press("KeyE");
  const dialog = page.getByRole("dialog", { name: /Answer fictif-maria/ });
  // What the person wrote, quoted in the draft; the caret waits under it.
  await expect(dialog).toContainText("Can I take this one?");
  const area = dialog.getByRole("textbox");
  await expect(area).toHaveValue(/^> FICTIF Can I take this one\? I built shelves before\.\n\n$/);
  // The quote alone is not an answer.
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(page.getByRole("status")).toContainText(/Write your answer/);
  // The hint says what leaves: the quote and the words, and a quoted name notifies nobody.
  await expect(dialog).toContainText("The quote and your words leave as one comment.");
  await area.fill(`${await area.inputValue()}Yes, it is yours: ask @fictif-tom if you get stuck.`);
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(confirmation(page)).toContainText("Yes, it is yours: ask @fictif-tom if you get stuck.");
  // A mention in the player's own words is warned about, as on a welcome.
  await expect(confirmation(page)).toContainText("These words will notify @fictif-tom.");
  await expect(confirmation(page)).toContainText("addComment");
  await expect(confirmation(page)).toContainText("fictif-maria");
  // Nothing has left: the action log holds no talk, and the bubble is still there.
  const talks = async () => ((await (await page.request.get("/api/log?demo=1")).json()) as { gesture: string; target: string }[])
    .filter((r) => r.gesture === "answer" && r.target.endsWith("#12"));
  expect(await talks()).toHaveLength(0);
  await expect(bubble).toHaveCount(1);
  const applied = page.waitForResponse((r) => r.url().includes("/api/talk/answer/apply"));
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  // The site is read again: the last word is the team's, so the sign goes by itself.
  await expect(bubble).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(/Answer sent/);
  expect(await talks()).toHaveLength(1);
});

// The visitor sana is welcomed here, under reduced motion: the demo's people are used once each (shared in-memory state).
test("reduced motion: the bubble goes, no wave", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /^Reduced$/ }).check();
  await page.getByRole("button", { name: "Settings" }).click();
  // The sound player is the game's one: its calls are the proof the moment's sound was asked for.
  await page.evaluate(async () => {
    const { gameSound } = await import("/src/client/sound.ts");
    const sound = await gameSound();
    const w = window as unknown as { __played: string[] };
    w.__played = [];
    const play = sound.play.bind(sound);
    sound.play = (name, opts) => { w.__played.push(name); play(name, opts); };
  });
  await expect(page.locator(".talk-bubble", { hasText: "fictif-sana" })).toHaveCount(1);
  await walkTo(page, "worker-fictif-sana", /welcome fictif-sana/);
  await page.keyboard.press("KeyE");
  const dialog = page.getByRole("dialog", { name: /Welcome fictif-sana/ });
  await expect(dialog).toContainText("FICTIF Fix a typo in the readme");
  // A warm draft, to edit; the demo repository has no contributing guide, so none is linked.
  await expect(dialog.getByRole("textbox")).toHaveValue(/first contribution/);
  await expect(dialog.getByRole("textbox")).not.toHaveValue(/CONTRIBUTING|contributing guide/);
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(confirmation(page)).toContainText("first contribution");
  // Every clip the visitor plays from now until they leave the site is kept: none of them may be a wave.
  await page.evaluate(async () => {
    const urls = performance.getEntriesByType("resource").map((e) => e.name);
    const fiber = await import(urls.find((u) => /\/deps\/@react-three_fiber\.js/.test(u))!);
    const state = [...fiber._roots.values()][0].store.getState();
    const seen = new Set<string>();
    (window as unknown as { __clips: Set<string> }).__clips = seen;
    setInterval(() => state.scene.traverse((o: { name: string; userData: { clip?: string } }) => {
      if (o.name === "worker-fictif-sana" && o.userData.clip) seen.add(o.userData.clip);
    }), 16);
  });
  const applied = page.waitForResponse((r) => r.url().includes("/api/talk/welcome/apply"));
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  // The bubble goes, there is no rising emoji, and the visitor does not wave: they keep the clip they had.
  await expect(page.locator(".talk-bubble", { hasText: "fictif-sana" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(/Welcome sent/);
  await expect(page.locator(".greet-emoji")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __played: string[] }).__played)).toContain("cheer");
  const clips = await page.evaluate(() => [...(window as unknown as { __clips: Set<string> }).__clips]);
  expect(clips.length).toBeGreaterThan(0);
  expect(clips).not.toContain("Interact");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /Follow my system/ }).check();
});

test("Send twice sends one comment", async ({ page }) => {
  await ready(page);
  // Lucas's first pull request closes a pallet: the card holds the button, and a mention is warned about.
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().open(useQuest.getState().site!.people!.newcomers.find((x) => x.login === "fictif-lucas")!.pallet!);
  });
  await page.getByRole("dialog", { name: /Light the reading room/ }).getByRole("button", { name: /Welcome fictif-lucas/ }).click();
  const dialog = page.getByRole("dialog", { name: /Welcome fictif-lucas/ });
  await dialog.getByRole("textbox").fill("Welcome! Thanks for the fix, @fictif-reviewer will take a look.");
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(confirmation(page)).toContainText("These words will notify @fictif-reviewer.");
  const sends: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/talk/welcome/apply")) sends.push(r.url()); });
  const send = confirmation(page).getByRole("button", { name: /Send to GitHub/ });
  await send.dblclick();
  await expect(page.locator(".talk-bubble", { hasText: "fictif-lucas" })).toHaveCount(0);
  const log = (await (await page.request.get("/api/log?demo=1")).json()) as { gesture: string; target: string }[];
  expect(log.filter((r) => r.gesture === "welcome" && r.target.endsWith("#31"))).toHaveLength(1);
  expect(sends).toHaveLength(1);
});
