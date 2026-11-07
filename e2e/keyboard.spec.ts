// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Planning leave with the keyboard only (docs/SPEC.md, "Calendar interaction"): one Tab stop, the arrows,
// PageUp/PageDown, Shift+arrows for a visible selection, Space, H, Delete and Escape. No mouse in this file.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const hint = (page: Page): Locator => page.locator('[aria-live="polite"]');
const selected = (page: Page): Locator => page.locator('[role="gridcell"][aria-selected="true"]');

async function expectLeave(page: Page, month: number, days: readonly number[], leave: RegExp): Promise<void> {
  for (const day of days) await expect(cell(page, month, day)).toHaveAttribute("aria-label", leave);
}

const FULL = /leave full/;
const NONE = /no leave/;

test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  // The start screen's only button, by keyboard.
  await page.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
});

test("Tab reaches the grid in one stop, and the next Tab leaves it", async ({ page }) => {
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
  const focusedCell = page.locator('[role="gridcell"]:focus');
  for (let presses = 0; presses < 40 && (await focusedCell.count()) === 0; presses++) await page.keyboard.press("Tab");
  await expect(focusedCell).toHaveCount(1);
  const day = await focusedCell.getAttribute("data-day");
  // Back out of the grid and in again: the same cell, in one stop.
  await page.keyboard.press("Shift+Tab");
  await expect(focusedCell).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(focusedCell).toHaveAttribute("data-day", day ?? "");
  // Forward: nothing after the grid takes the focus at this width. Chromium and WebKit leave the page;
  // headless Firefox has no browser UI to go to and keeps the focus where it is. Never on another cell.
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      page.evaluate((from) => {
        const cell = document.activeElement?.closest<HTMLElement>('[role="gridcell"]');
        return !document.hasFocus() || cell === null || cell === undefined || cell.dataset.day === from;
      }, day),
    )
    .toBe(true);
  await expectNoPageProblems(page);
});

test("the arrows move the focus, and Shift+→ four times then Space plans five days", async ({ page }) => {
  await cell(page, 6, 11).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 6, 21)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 6, 12)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 6, 14)).toBeFocused();

  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(cell(page, 6, 18)).toBeFocused();
  await expect(selected(page)).toHaveCount(5);
  await expect(cell(page, 6, 14)).toHaveAttribute("aria-selected", "true");
  await expect(hint(page)).toContainText(/^5 working days · /);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
  await expect(selected(page)).toHaveCount(0);
  await expect(hint(page)).toHaveText("");
  // Space did not scroll the page.
  await expect(cell(page, 6, 18)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.keyboard.press("Control+z");
  await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
  await expectNoPageProblems(page);
});

test("Space with Shift still held plans the selection and doesn't scroll", async ({ page }) => {
  await cell(page, 6, 14).focus();
  await page.keyboard.down("Shift");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(selected(page)).toHaveCount(5);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await page.keyboard.up("Shift");
  await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
  await expect(selected(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expectNoPageProblems(page);
});

test("Shift+H and Shift+Delete work like H and Delete", async ({ page }) => {
  await cell(page, 6, 15).focus();
  await page.keyboard.press("Shift+H");
  await expect(cell(page, 6, 15)).toHaveAttribute("aria-label", /leave half/);
  await page.keyboard.press("Shift+Delete");
  await expectLeave(page, 6, [15], NONE);
  await expectNoPageProblems(page);
});

test("Space toggles one day, H gives a half day and Delete removes it", async ({ page }) => {
  await cell(page, 6, 15).focus();
  await page.keyboard.press("Space");
  await expectLeave(page, 6, [15], FULL);
  await page.keyboard.press("Space");
  await expectLeave(page, 6, [15], NONE);
  await page.keyboard.press("h");
  await expect(cell(page, 6, 15)).toHaveAttribute("aria-label", /leave half/);
  await page.keyboard.press("Delete");
  await expectLeave(page, 6, [15], NONE);
  await page.keyboard.press("h");
  // A key while the change before is applied is ignored: wait for it.
  await expect(cell(page, 6, 15)).toHaveAttribute("aria-label", /leave half/);
  await page.keyboard.press("Backspace");
  await expectLeave(page, 6, [15], NONE);
  await expectNoPageProblems(page);
});

test("H and Delete on a selection set half days and remove them, each in one undo step", async ({ page }) => {
  await cell(page, 6, 14).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("h");
  await expectLeave(page, 6, [14, 15, 16], /leave half/);
  await expect(selected(page)).toHaveCount(0);
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Delete");
  await expectLeave(page, 6, [14, 15, 16], NONE);
  await page.keyboard.press("Control+z");
  await expectLeave(page, 6, [14, 15, 16], /leave half/);
  await page.keyboard.press("Control+z");
  await expectLeave(page, 6, [14, 15, 16], NONE);
  await expectNoPageProblems(page);
});

test("Escape clears a selection and its hint", async ({ page }) => {
  await cell(page, 6, 14).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(selected(page)).toHaveCount(9);
  await expect(hint(page)).toContainText(/working days/);
  await page.keyboard.press("Escape");
  await expect(selected(page)).toHaveCount(0);
  await expect(hint(page)).toHaveText("");
  await page.keyboard.press("Space");
  await expectLeave(page, 6, [22], FULL);
  await expectLeave(page, 6, [14, 15, 21], NONE);
  await expectNoPageProblems(page);
});

test("an arrow without Shift clears the selection", async ({ page }) => {
  await cell(page, 6, 14).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(selected(page)).toHaveCount(2);
  await page.keyboard.press("ArrowRight");
  await expect(selected(page)).toHaveCount(0);
  await expect(hint(page)).toHaveText("");
  await expectNoPageProblems(page);
});

test("PageDown moves to the next month and PageUp back", async ({ page }) => {
  await cell(page, 6, 14).focus();
  await page.keyboard.press("PageDown");
  await expect(cell(page, 7, 14)).toBeFocused();
  await expect(cell(page, 7, 14)).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  await expect(cell(page, 5, 14)).toBeFocused();
  await page.keyboard.press("End");
  await expect(cell(page, 5, 16)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(cell(page, 5, 10)).toBeFocused();
  await expectNoPageProblems(page);
});

test("the letter shortcuts still work from a cell, and H doesn't trigger one", async ({ page }) => {
  await cell(page, 6, 14).focus();
  const weeks = page.getByRole("button", { name: "Week 24", exact: true });
  await expect(weeks).toBeVisible();
  await page.keyboard.press("h");
  await expect(weeks).toBeVisible();
  await page.keyboard.press("k");
  await expect(weeks).toBeHidden();
  await expectNoPageProblems(page);
});
