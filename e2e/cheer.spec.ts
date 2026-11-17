import { expect, test, type Page } from "@playwright/test";

// Cheering the site's people on the demo site (nothing reaches GitHub): the gesture is shown, confirmed, then ticked.
test.describe.configure({ mode: "serial" });

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
  await page.keyboard.press("Escape");
};

const confirmation = (page: Page) => page.getByRole("dialog", { name: /sent to GitHub/ });

test("R near a worker opens the emojis and the confirmation shows the reaction", async ({ page }) => {
  await ready(page);
  await page.keyboard.down("KeyW");
  await expect(page.getByText(/to cheer maria-fictif/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyR");
  const picker = page.getByRole("group", { name: /Cheer maria-fictif/ });
  await expect(picker.getByRole("button")).toHaveCount(4);
  await picker.getByRole("button", { name: /🎉/ }).click();
  await expect(confirmation(page)).toContainText("addReaction");
  await expect(confirmation(page)).toContainText("HOORAY");
  const applied = page.waitForResponse((r) => r.url().includes("/api/warm/cheer/apply"));
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  await page.keyboard.press("KeyR");
  await expect(page.getByRole("group", { name: /Cheer maria-fictif/ }).getByRole("button", { name: /🎉/ })).toHaveAttribute("aria-pressed", "true");
});

test("a second cheer of the same emoji is refused while it is given: the picker offers to take it back", async ({ page }) => {
  await ready(page);
  await page.keyboard.down("KeyW");
  await expect(page.getByText(/to cheer maria-fictif/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyR");
  await page.getByRole("group", { name: /Cheer maria-fictif/ }).getByRole("button", { name: /🎉/ }).click();
  await expect(confirmation(page)).toContainText("removeReaction");
  await confirmation(page).getByRole("button", { name: /Cancel/ }).click();
  await expect(confirmation(page)).toHaveCount(0);
});

test("the card cheers a pallet with no worker", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const p = useQuest.getState().site!.pallets.find((x) => /Light the reading room/.test(x.title))!;
    useQuest.getState().open(p.number);
  });
  const card = page.getByRole("dialog", { name: /Light the reading room/ });
  await card.getByRole("group", { name: /Cheer/ }).getByRole("button", { name: /❤️/ }).click();
  await expect(confirmation(page)).toContainText("HEART");
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  await expect(page.getByRole("status")).toContainText(/Cheered/);
});
