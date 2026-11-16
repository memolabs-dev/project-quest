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
    await expect(book.locator("li.outline")).toHaveCount(4);
    await page.screenshot({ path: `e2e/screenshots/levels-skillbook-${width}.png` });
  });
}
