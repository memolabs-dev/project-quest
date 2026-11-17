import { expect, test, type Page } from "@playwright/test";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
};
/** Opens a pallet's card through the game state, as a click or the action key would. */
const openPallet = async (page: Page, title: RegExp) =>
  page.evaluate(async (source) => {
    const re = new RegExp(source, "i");
    const { useQuest } = await import("/src/client/store.ts");
    const pallet = useQuest.getState().site!.pallets.find((p) => re.test(p.title))!;
    useQuest.getState().open(pallet.number);
  }, title.source);

test("opens a pallet card and moves it after confirmation", async ({ page }) => {
  await ready(page);
  await openPallet(page, /Hang the clock/);
  const card = page.getByRole("dialog", { name: /Hang the clock/ });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /Being laid|En pose/ }).click();
  const confirm = page.getByRole("dialog", { name: /sent to GitHub|partir chez GitHub/ });
  await expect(confirm).toContainText("updateProjectV2ItemFieldValue");
  await expect(confirm).toContainText(/Being laid|En pose/);
  await expect(confirm.getByRole("button", { name: /Send to GitHub|Envoyer à GitHub/ })).toBeFocused();
  await confirm.getByRole("button", { name: /Send to GitHub|Envoyer à GitHub/ }).click();
  await expect(page.getByRole("status")).toContainText(/Being laid|En pose/);
  // The notice clears by itself, so it never covers the site for good.
  await expect(page.locator(".toast")).toBeEmpty({ timeout: 10_000 });
  await page.getByRole("button", { name: /logbook|Carnet/ }).click();
  await expect(page.getByRole("region", { name: /logbook|Carnet/ })).toContainText(/#\d+/);
});

test("switches to French", async ({ page }) => {
  await ready(page);
  await page.getByRole("combobox", { name: /Language|Langue/ }).selectOption("fr");
  await openPallet(page, /Hang the clock/);
  await expect(page.getByRole("dialog", { name: /Hang the clock/ }).getByRole("button", { name: "Fermer" })).toBeVisible();
});

test("a worst-case title does not overflow the card", async ({ page }) => {
  await ready(page);
  await openPallet(page, /very long name/);
  const card = page.getByRole("dialog", { name: /very long name/ });
  await expect(card).toBeVisible();
  const overflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("without GitHub access, explains it and offers the demo", async ({ page }) => {
  await page.goto("http://localhost:5198/");
  await expect(page.getByText("gh auth login")).toBeVisible();
  await expect(page.getByRole("link", { name: /demo site|chantier de démo/ })).toBeVisible();
});

for (const width of [375, 1280]) {
  test(`screenshot at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await ready(page);
    await openPallet(page, /Hang the clock/);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `e2e/screenshots/card-${width}.png` });
  });
}
