import { expect, test, type Page } from "@playwright/test";

// The levels on the demo site (nothing reaches GitHub). One file, run in order: the demo keeps one player's
// progress in memory for the whole server, so each test starts again from nothing.
test.describe.configure({ mode: "serial" });

const startAgain = async (page: Page) => {
  const res = await page.request.post("/api/levels/reset", { data: {} });
  expect(res.ok()).toBe(true);
};
const graduate = async (page: Page) => {
  for (const event of ["walked", "card-opened", "card-read", "pallet-moved"]) {
    expect((await page.request.post("/api/levels/event", { data: { event } })).ok()).toBe(true);
  }
};

test("a tutorial graduate founds their site: the dialog shows what would be sent, and sends nothing", async ({ page }) => {
  await startAgain(page);
  await graduate(page);
  await page.goto("/?site=practice");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
  await expect(mentor).toBeVisible();
  await mentor.getByRole("button", { name: /Found my site/ }).click();
  const dialog = page.getByRole("dialog", { name: /Found your site/ });
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(dialog).toContainText(/Create the repository you\/my-first-site \(public\) and its board/);
  await expect(dialog).toContainText("createRepository");
  await expect(dialog).toContainText("createProjectV2");
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await expect(dialog).toContainText(/gh auth login/);
  await page.screenshot({ path: "e2e/screenshots/levels-found.png" });
});

/** Opens a pallet's card through the game state, as a click or the action key would. */
const openPallet = async (page: Page, title: RegExp) =>
  page.evaluate(async (source) => {
    const re = new RegExp(source, "i");
    const { useQuest } = await import("/src/client/store.ts");
    const pallet = useQuest.getState().site!.pallets.find((p) => re.test(p.title))!;
    useQuest.getState().open(pallet.number);
  }, title.source);

for (const width of [1280, 375]) {
  test(`a new player plays the tutorial from start to end (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 800 });
    await startAgain(page);
    await page.goto("/?demo=1");
    await expect(page.locator(".sign-label").first()).toBeVisible();
    const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
    await mentor.getByRole("button", { name: "Lend a hand" }).click();
    await expect(mentor).toContainText(/Walk with the keys/);

    // Level 1: walk, then open a pallet.
    await page.keyboard.press("Escape");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyW");
    await openPallet(page, /Hang the clock/);
    const card = page.getByRole("dialog", { name: /Hang the clock/ });
    await expect(card).toBeVisible();

    // Level 2: read the card, then tell Mémé.
    await card.getByRole("button", { name: "Got it, Mémé" }).click();

    // Level 3: push the pallet to another yard, through the confirmation.
    await card.locator(".zones button").first().click(); // the demo board keeps earlier moves: any other yard will do
    await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();

    await expect(mentor.getByRole("link", { name: /your own site/ })).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/levels-mentor-${width}.png` });
    await page.getByRole("button", { name: "Skills" }).click();
    const book = page.getByRole("region", { name: "Skills" });
    await expect(book.locator("li.earned")).toHaveCount(3);
    await expect(book.locator("li.outline")).toHaveCount(13);
    await page.screenshot({ path: `e2e/screenshots/levels-skillbook-${width}.png` });
  });
}

test("a journeyman's edit dialog asks for the text and the message, and sends nothing", async ({ page }) => {
  await startAgain(page);
  await graduate(page);
  await page.goto("/?site=practice");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const s = useQuest.getState();
    const ids = ["a1-walk", "a2-read-issue", "a3-read-board", "a4-found-site", "a5-write-issue", "a6-take-issue", "a7-move-issue"];
    s.setLevels({
      login: "you", canWrite: false, path: null, ranks: { volunteer: null, lead: null }, current: "a8-edit-file", rank: "apprentice",
      stamps: ids.map((levelId) => ({ levelId, proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" })),
      unlocks: { helmet: true, skillBook: true, ownSite: true, trowel: true, firstBuilding: false, van: false, realProjects: false },
      practice: { name: "my-first-site", exists: true, readme: null, issue: 1, pull: null, unassigned: null, defaultBranch: null, workBranch: null, mainMoved: false, closedPull: null },
      real: null, team: { exists: false, parcels: false, labels: [], milestones: [], sprint: { field: false, current: null, points: 0, capacity: null, loaded: [], unsized: [] }, wip: { limit: null, count: 0 }, bulletin: null, teamDay: false, visitJobs: [], duplicateWrong: false, name: "my-first-team" },
    });
  });
  const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
  await mentor.getByRole("button", { name: /Use the trowel/ }).click();
  const dialog = page.getByRole("dialog", { name: /Edit your README/ });
  await expect(dialog.getByLabel(/The file's text/)).toHaveValue("# my-first-site\n");
  await expect(dialog.getByLabel(/What you changed/)).toBeVisible();
  await expect(dialog).toContainText(/still empty: the game lays its first stone/);
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/levels-edit.png" });
});

test("at the last level, a good first issue's card offers to ask for it, and the demo sends nothing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().setLevels({
      login: "you", canWrite: false, path: null, ranks: { volunteer: null, lead: null }, current: "a16-ask-good-first", rank: "team-leader",
      stamps: Array.from({ length: 15 }, (_, i) => ({ levelId: `x${i}`, proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" })),
      unlocks: { helmet: true, skillBook: true, ownSite: true, trowel: true, firstBuilding: true, van: true, realProjects: true },
      practice: { name: "my-first-site", exists: true, readme: null, issue: null, pull: null, unassigned: null, defaultBranch: "main", workBranch: null, mainMoved: false, closedPull: null },
      real: { issues: 1 }, team: { exists: false, parcels: false, labels: [], milestones: [], sprint: { field: false, current: null, points: 0, capacity: null, loaded: [], unsized: [] }, wip: { limit: null, count: 0 }, bulletin: null, teamDay: false, visitJobs: [], duplicateWrong: false, name: "my-first-team" },
    });
  });
  await openPallet(page, /Lay the square's paving/);
  await page.getByRole("dialog", { name: /Lay the square's paving/ }).getByRole("button", { name: "Ask for it" }).click();
  const dialog = page.getByRole("dialog", { name: /Ask for this issue/ });
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(dialog).toContainText("addComment");
  await expect(dialog).toContainText(/I'd like to work on this one/);
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/levels-ask.png" });
});

test("a lead chooses to run the site, then founds the team site: the requests are shown, nothing is sent", async ({ page }) => {
  await startAgain(page);
  await page.goto("/");
  const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
  await mentor.getByRole("button", { name: "Run the site" }).click();
  await expect(mentor.getByRole("link", { name: /To your team site/ })).toBeVisible();
  await page.goto("/?site=team");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  await mentor.getByRole("button", { name: /Found my team site/ }).click();
  const dialog = page.getByRole("dialog", { name: /Found your team site/ });
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  for (const m of ["createRepository", "createProjectV2", "updateProjectV2Field", "createProjectV2Field"]) await expect(dialog).toContainText(m);
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/lead-found.png" });
  await startAgain(page);
});

test("a site manager declares the sprint's capacity as the game's rule, and sets the mayor's visit", async ({ page }) => {
  await page.goto("/?site=team");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  const lead = (current: string, team: Record<string, unknown>) => page.evaluate(async ([current, team]) => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().setLevels({
      login: "you", canWrite: false, path: "lead", ranks: { volunteer: null, lead: "site-foreman" }, current: current as string, rank: "site-foreman",
      stamps: ["l1-found-team", "l2-sort-parcels", "l3-ready", "l4-size"].map((levelId) => ({ levelId, proof: "u", stampedAt: "2026-11-17T00:00:00Z" })),
      unlocks: { helmet: false, skillBook: true, ownSite: false, trowel: false, firstBuilding: false, van: false, realProjects: false },
      practice: { name: "my-first-site", exists: false, readme: null, issue: null, pull: null, unassigned: null, defaultBranch: null, workBranch: null, mainMoved: false, closedPull: null },
      real: null,
      team: { exists: true, parcels: true, labels: [], milestones: [], sprint: { field: true, current: "Sprint 1", points: 0, capacity: null, loaded: [], unsized: [] }, wip: { limit: null, count: 0 }, bulletin: null, teamDay: false, visitJobs: [], duplicateWrong: false, name: "my-first-team", ...(team as object) },
    });
  }, [current, team] as const);
  await lead("l5-sprint", {});
  const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
  await expect(mentor).toContainText(/The game's rule, not GitHub's/);
  await expect(mentor).toContainText("XS 1, S 2, M 3, L 5, XL 8");
  await expect(mentor.getByLabel(/Points the team can carry/)).toHaveValue("8");
  await page.screenshot({ path: "e2e/screenshots/lead-capacity.png" });

  await lead("l6-milestone", {});
  await expect(mentor).toContainText("The mayor");
  await mentor.getByRole("button", { name: /Set the mayor's visit/ }).click();
  const dialog = page.getByRole("dialog", { name: /Set the mayor's visit/ });
  await expect(dialog.getByLabel("Title")).toHaveValue("FICTIF The mayor's visit");
  await expect(dialog.getByLabel("Due date")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/lead-milestone.png" });
});

test("a project director writes the evening bulletin from the radio's draft, and the demo sends nothing", async ({ page }) => {
  await page.goto("/?site=team");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().setLevels({
      login: "you", canWrite: false, path: "lead", ranks: { volunteer: null, lead: "site-manager" }, current: "l9-bulletin", rank: "site-manager",
      stamps: ["l1-found-team", "l2-sort-parcels", "l3-ready", "l4-size", "l5-sprint", "l6-milestone", "l7-split", "l8-rope"]
        .map((levelId) => ({ levelId, proof: "u", stampedAt: "2026-11-17T00:00:00Z" })),
      unlocks: { helmet: false, skillBook: true, ownSite: false, trowel: false, firstBuilding: false, van: false, realProjects: false },
      practice: { name: "my-first-site", exists: false, readme: null, issue: null, pull: null, unassigned: null, defaultBranch: null, workBranch: null, mainMoved: false, closedPull: null },
      real: null,
      team: {
        exists: true, parcels: true, labels: [], milestones: [], sprint: { field: true, current: "Sprint 1", points: 2, capacity: 3, loaded: [2], unsized: [] },
        wip: { limit: null, count: 0 }, bulletin: null, teamDay: false, visitJobs: [], duplicateWrong: false, name: "my-first-team",
      },
    });
  });
  const mentor = page.getByRole("complementary", { name: "Mémé Truelle" });
  await expect(mentor).toContainText("The site radio");
  await mentor.getByRole("button", { name: /Write the evening bulletin/ }).click();
  const dialog = page.getByRole("dialog", { name: /The evening bulletin/ });
  await expect(dialog.getByLabel("The bulletin")).toHaveValue("FICTIF Evening bulletin, 2026-11-17.\nSprint 1: 2 of 3 points loaded.");
  for (const s of ["On track", "At risk", "Off track", "Complete", "Inactive"]) await expect(dialog.getByLabel(s)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Send to GitHub/ })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/lead-bulletin.png" });
});

test("a dialog keeps the keyboard inside, Escape closes it and the focus goes back; the skill book's tabs follow the arrows", async ({ page }) => {
  await page.goto("/?site=team");
  await expect(page.getByTestId("site-canvas")).toBeVisible();
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    useQuest.getState().setLevels({
      login: "you", canWrite: false, path: "lead", ranks: { volunteer: null, lead: "site-manager" }, current: "l9-bulletin", rank: "site-manager",
      stamps: [{ levelId: "a1-walk", proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" }],
      unlocks: { helmet: true, skillBook: true, ownSite: false, trowel: false, firstBuilding: false, van: false, realProjects: false },
      practice: { name: "my-first-site", exists: false, readme: null, issue: null, pull: null, unassigned: null, defaultBranch: null, workBranch: null, mainMoved: false, closedPull: null },
      real: null,
      team: {
        exists: true, parcels: true, labels: [], milestones: [], sprint: { field: false, current: null, points: 0, capacity: null, loaded: [], unsized: [] },
        wip: { limit: null, count: 0 }, bulletin: null, teamDay: false, visitJobs: [], duplicateWrong: false, name: "my-first-team",
      },
    });
  });
  const opener = page.getByRole("button", { name: /Write the evening bulletin/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: /The evening bulletin/ });
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.getByRole("button", { name: "Skills" }).click();
  const lead = page.getByRole("tab", { name: /Run the site|lead/i });
  await lead.focus();
  await page.keyboard.press("ArrowLeft");
  const volunteer = page.getByRole("tab", { selected: true });
  await expect(volunteer).toBeFocused();
  const panel = await volunteer.getAttribute("aria-controls");
  await expect(page.locator(`#${panel}`)).toHaveAttribute("role", "tabpanel");
});
