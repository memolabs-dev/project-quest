import { expect, test, type Page } from "@playwright/test";

// A day on the site, on the demo (nothing reaches GitHub): the morning's jobs, a job ticked by a real gesture, the
// evening at the office and its page in the logbook.
test.describe.configure({ mode: "serial" });

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".sign-label").first()).toBeVisible();
};

const board = (page: Page) => page.getByRole("region", { name: "Today's jobs" });
const day = (page: Page) => page.evaluate(async () => {
  const { useQuest } = await import("/src/client/store.ts");
  const d = useQuest.getState().day;
  return d ? { jobs: d.jobs, done: d.done } : null;
});

test("the morning: the radio gives the day's jobs, the board lists them", async ({ page }) => {
  await ready(page);
  await expect(board(page)).toBeVisible();
  const d = (await day(page))!;
  expect(d.jobs.length).toBeGreaterThan(0);
  expect(d.jobs.length).toBeLessThanOrEqual(3);
  await expect(board(page).getByRole("listitem")).toHaveCount(d.jobs.length);
  // After its news, the radio's last line is the morning's.
  await expect(page.locator(".radio-bubble")).toContainText(/jobs? (today|on today's board)|Today's menu/, { timeout: 40_000 });
});

test("getting the stuck pallet out of the stock ticks its job, and a reload takes the day up", async ({ page }) => {
  await ready(page);
  await expect(board(page)).toBeVisible();
  const before = (await day(page))!;
  const i = before.jobs.findIndex((j) => j.kind === "unstick");
  test.skip(i < 0, "the demo gave no stuck pallet today");
  const job = before.jobs[i] as { pallet: number };
  await board(page).getByRole("button", { name: new RegExp(`#${job.pallet} out of the stock`) }).click();
  const card = page.getByRole("dialog", { name: /.+/ }).filter({ hasText: `#${job.pallet}` });
  await card.locator(".zones button").first().click();
  const applied = page.waitForResponse((r) => r.url().includes("/moves/apply"));
  await page.getByRole("dialog", { name: /sent to GitHub/ }).getByRole("button", { name: /Send to GitHub/ }).click();
  expect((await applied).ok()).toBe(true);
  await expect.poll(async () => (await day(page))!.done[i], { timeout: 10_000 }).toBe(true);
  await expect(board(page).getByRole("listitem").nth(i)).toHaveClass(/done/);
  // The page closed and opened again: the same day, its job still ticked, and the radio says the work goes on.
  await page.reload();
  await expect(board(page)).toBeVisible();
  const after = (await day(page))!;
  expect(after.jobs).toEqual(before.jobs);
  expect(after.done[i]).toBe(true);
  await expect(page.locator(".radio-bubble")).toContainText(/Back to work|pick up where|day goes on|Every job is done|all ticked|Nothing left/, { timeout: 40_000 });
});

test("closing the day: the evening line, the page in the logbook, no day left open", async ({ page }) => {
  await ready(page);
  await expect(board(page)).toBeVisible();
  // The radio has said its morning first (the evening must not be cut by it).
  await expect(page.locator(".radio-bubble")).toContainText(/jobs? (today|on today's board)|Today's menu|free day|in order/, { timeout: 40_000 });
  await board(page).getByRole("button", { name: "Close the day" }).click();
  await expect(page.locator(".radio-bubble")).toContainText(/Day over|whistle|Lights out/, { timeout: 30_000 });
  // The radio stands far from the office: the evening is written on the board too, until folded away.
  const evening = page.getByRole("status", { name: "Day 1 is over" });
  await expect(evening).toContainText(/Day over|whistle|Lights out/);
  await evening.getByRole("button", { name: "See you tomorrow" }).click();
  await expect(evening).toHaveCount(0);
  await expect(board(page)).toHaveCount(0);
  expect(await day(page)).toBeNull();
  await page.getByRole("button", { name: "Site logbook" }).click();
  const log = page.getByRole("region", { name: "Site logbook" });
  await expect(log.getByRole("heading", { name: "Days" })).toBeVisible();
  await expect(log).toContainText(/Day 1, \d{4}-\d{2}-\d{2}/);
});
