// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Edge autoscroll (docs/SPEC.md, "Calendar interaction"): a drag held near the edge of the visible calendar
// scrolls the page, or the month columns sideways, and the range follows without the pointer moving; so does a
// wheel turn during the drag. The edges are the sticky region at the top and the selection bar at the bottom.
// No timing: each test polls until the scroll and the range have moved. The example plan runs through 2027.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const hint = (page: Page): Locator => page.locator('[aria-live="polite"]');

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The working days the hint line counts, 0 without a hint. */
async function hintDays(page: Page): Promise<number> {
  const match = /^(\d+)\s/.exec((await hint(page).textContent()) ?? "");
  return match ? Number(match[1]) : 0;
}

/** Presses the mouse on the first day and moves it onto the second, so the drag has begun. */
async function startDrag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await centre(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const next = await centre(to);
  await page.mouse.move(next.x, next.y, { steps: 3 });
  await expect(hint(page)).toContainText(/^2\sworking days · /);
}

const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

test.describe("in the tiles at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
  });

  test("holding the mouse at the bottom edge scrolls down, and the range follows", async ({ page }) => {
    await startDrag(page, cell(page, 1, 11), cell(page, 1, 12));
    const { x } = await centre(cell(page, 1, 12));
    await page.mouse.move(x, 795, { steps: 3 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
    await expect.poll(() => hintDays(page)).toBeGreaterThan(10);
    // Escape ends the drag and changes nothing.
    await page.keyboard.press("Escape");
    await expect(hint(page)).toHaveText("");
    await expect(cell(page, 1, 11)).toHaveAttribute("aria-label", /no leave/);
    await expect(cell(page, 1, 12)).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });

  test("below the window the scroll goes on and the range follows the last row in view", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Playwright's Firefox sends no pointer move outside the viewport.");
    await startDrag(page, cell(page, 1, 11), cell(page, 1, 12));
    const { x } = await centre(cell(page, 1, 12));
    await page.mouse.move(x, 860, { steps: 3 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
    await expect.poll(() => hintDays(page)).toBeGreaterThan(10);
    await page.keyboard.press("Escape");
    await expectNoPageProblems(page);
  });

  test("holding the mouse just below the sticky region scrolls up", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const before = await scrollY(page);
    expect(before).toBeGreaterThan(300);
    await startDrag(page, cell(page, 12, 15), cell(page, 12, 16));
    const line = (await page.getByTestId("hint-line").boundingBox())!;
    const { x } = await centre(cell(page, 12, 16));
    await page.mouse.move(x, line.y + line.height + 5, { steps: 3 });
    await expect.poll(() => scrollY(page)).toBeLessThan(before - 200);
    await expect.poll(() => hintDays(page)).toBeGreaterThan(10);
    await page.keyboard.press("Escape");
    await expectNoPageProblems(page);
  });

  test("a wheel turn during the drag moves the range without a pointer move", async ({ page }) => {
    await startDrag(page, cell(page, 1, 11), cell(page, 1, 12));
    // One week row, so the pointer rests on Tuesday 19 January afterwards.
    const row = (await centre(cell(page, 1, 19))).y - (await centre(cell(page, 1, 12))).y;
    await page.mouse.wheel(0, row);
    await expect.poll(() => scrollY(page)).toBeGreaterThanOrEqual(row - 1);
    await expect.poll(() => hintDays(page)).toBe(7);
    await page.keyboard.press("Escape");
    await expectNoPageProblems(page);
  });
});

test.describe("in the month columns at 900 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 900, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "Columns", exact: true }).click();
  });

  test("holding the mouse at the end of the grid scrolls the months sideways, and the range follows", async ({ page }) => {
    const grid = page.getByRole("grid", { name: "Calendar" });
    await startDrag(page, cell(page, 1, 11), cell(page, 1, 12));
    const box = (await grid.boundingBox())!;
    const { y } = await centre(cell(page, 1, 12));
    await page.mouse.move(box.x + box.width - 3, y, { steps: 3 });
    await expect.poll(() => grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(200);
    await expect.poll(() => hintDays(page)).toBeGreaterThan(30);
    await page.keyboard.press("Escape");
    await expectNoPageProblems(page);
  });
});

test.describe("in the selection mode at 700 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 700, height: 800 } });

  test("a mouse drag held just above the selection bar scrolls down, and the selection follows", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const bar = page.getByRole("region", { name: "Selection" });
    await expect(bar).toBeVisible();
    await startDrag(page, cell(page, 1, 11), cell(page, 1, 12));
    const top = (await bar.boundingBox())!.y;
    const { x } = await centre(cell(page, 1, 12));
    await page.mouse.move(x, top - 5, { steps: 3 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
    await expect.poll(() => page.locator('[role="gridcell"][aria-selected="true"]').count()).toBeGreaterThan(14);
    await page.mouse.up();
    // The selection stays for the bar; nothing is planned yet.
    await expect(cell(page, 1, 11)).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });
});
