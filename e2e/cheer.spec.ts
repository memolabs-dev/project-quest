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

test("after a pallet is laid, Thank is offered and sends a reaction with words", async ({ page }) => {
  await ready(page);
  // A pallet already laid on the demo board, seen open then laid: what a refresh shows when someone closes it.
  await page.evaluate(async () => {
    const { useQuest } = await import("/src/client/store.ts");
    const now = useQuest.getState().site!;
    const reopened = { ...now, pallets: now.pallets.map((p) => (/Pour the foundations/.test(p.title) ? { ...p, closed: false, zone: "In progress" } : p)) };
    useQuest.getState().setSite(reopened);
    useQuest.getState().setSite(now);
  });
  const offer = page.getByRole("region", { name: /Thank/ });
  await expect(offer).toContainText(/Thank the team/);
  await offer.getByRole("button", { name: /^Thank$/ }).click();
  const dialog = page.getByRole("dialog", { name: /Thank for/ });
  await dialog.getByRole("radio", { name: /❤️/ }).check();
  await dialog.getByRole("textbox").fill("Thanks @maria-fictif, the foundations are solid!");
  await dialog.getByRole("button", { name: /Show what will be sent/ }).click();
  await expect(confirmation(page)).toContainText("addComment");
  await expect(confirmation(page)).toContainText("These words will notify @maria-fictif.");
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  await expect(page.getByRole("status")).toContainText(/Thanked/);
  await expect(offer).toHaveCount(0);
});

test("reduced motion keeps the emoji and the sound only", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /^Reduced$/ }).check();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.down("KeyW");
  await expect(page.getByText(/to cheer maria-fictif/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyR");
  await page.getByRole("group", { name: /Cheer maria-fictif/ }).getByRole("button", { name: /🚀/ }).click();
  await confirmation(page).getByRole("button", { name: /Send to GitHub/ }).click();
  const greet = page.locator(".greet-emoji");
  await expect(greet).toHaveText("🚀");
  await expect(greet).not.toHaveClass(/rising/);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /Follow my system/ }).check();
});
