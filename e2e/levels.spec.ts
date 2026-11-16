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
