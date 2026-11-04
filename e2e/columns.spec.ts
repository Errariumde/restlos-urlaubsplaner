// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The month columns (docs/SPEC.md, "View 2"): one column per month with a fixed day column, the drag, the
// alignment by weekday, the week markers, the view switch that keeps the focused day, and right-to-left text.
// The example plan runs from January to December 2027.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart, openGallery } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const grid = (page: Page): Locator => page.getByRole("grid", { name: "Calendar" });
const FULL = /leave full/;
const NONE = /no leave/;

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function expectLeave(page: Page, month: number, days: readonly number[], leave: RegExp): Promise<void> {
  for (const day of days) await expect(cell(page, month, day)).toHaveAttribute("aria-label", leave);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

test.describe("in English at 1920 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1920, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "Columns", exact: true }).click();
    await expect(grid(page).getByRole("columnheader", { name: "June", exact: true })).toBeVisible();
  });

  test("the 12 month headers of the example are visible without scrolling", async ({ page }) => {
    const headers = grid(page).getByRole("row").first().getByRole("columnheader");
    // The short names are there too, hidden on a wide calendar.
    await expect(headers).toHaveText(["Day", ...MONTHS], { useInnerText: true });
    for (const box of await headers.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1920);
    }
    expect(await grid(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expectNoPageProblems(page);
  });

  test("31 March sits under the March header: empty slots are cells too", async ({ page }) => {
    const headers = grid(page).getByRole("row").first().locator('[role="columnheader"]');
    const names = await headers.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).innerText.trim()));
    const lastRow = grid(page).getByRole("row").nth(31);
    const position = await lastRow.evaluate((row, day) => {
      const cells = [...row.querySelectorAll(':scope > [role="rowheader"], :scope > [role="gridcell"]')];
      return cells.findIndex((element) => element.getAttribute("data-day") === day);
    }, String(dayFromYmd(2027, 3, 31)));
    expect(position).toBe(names.indexOf("March"));
    expect(position).toBe(3);
    await expectNoPageProblems(page);
  });

  test("dragging down the column from 14 to 18 June plans five days", async ({ page }) => {
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    const start = await centre(cell(page, 6, 14));
    const end = await centre(cell(page, 6, 18));
    expect(end.x).toBe(start.x);
    expect(end.y).toBeGreaterThan(start.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(page.locator('[aria-live="polite"]')).toContainText(/^5 working days · /);
    await page.mouse.up();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await expectNoPageProblems(page);
  });

  test("W aligns by weekday: 1 Feb 2027, a Monday, is in the first row", async ({ page }) => {
    const firstRow = grid(page).getByRole("row").nth(1);
    await expect(firstRow.getByRole("rowheader")).toHaveText("1");
    await expect(firstRow.locator(`[data-day="${String(dayFromYmd(2027, 1, 1))}"]`)).toHaveCount(1);
    await page.keyboard.press("w");
    await expect(page.getByRole("checkbox", { name: "Align by weekday" })).toBeChecked();
    await expect(firstRow.getByRole("rowheader")).toHaveText("Mon");
    await expect(firstRow.locator(`[data-day="${String(dayFromYmd(2027, 2, 1))}"]`)).toHaveCount(1);
    // 1 Jan 2027 is a Friday: the fifth row.
    await expect(firstRow.locator(`[data-day="${String(dayFromYmd(2027, 1, 1))}"]`)).toHaveCount(0);
    await expect(grid(page).getByRole("row").nth(5).locator(`[data-day="${String(dayFromYmd(2027, 1, 1))}"]`)).toHaveCount(1);
    await expectNoPageProblems(page);
  });

  test("the week markers plan a week, and K hides them", async ({ page }) => {
    const week = page.getByRole("button", { name: "Week 24", exact: true });
    await expect(week).toBeVisible();
    // The marker sits in the cell of the week's first day, Monday 14 June.
    await expect(cell(page, 6, 14).getByRole("button", { name: "Week 24", exact: true })).toHaveCount(1);
    await week.click();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await page.keyboard.press("k");
    await expect(page.getByRole("button", { name: /^Week \d+$/ })).toHaveCount(0);
    await expectNoPageProblems(page);
  });

  test("V keeps the focused day, and closes its detail first", async ({ page }) => {
    await cell(page, 6, 14).focus();
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: "Tiles", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(cell(page, 6, 14)).toBeFocused();
    await expect(cell(page, 6, 14)).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: "Columns", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(cell(page, 6, 14)).toBeFocused();

    await page.keyboard.press("Enter");
    const detail = page.getByRole("dialog", { name: /^Details for / });
    await expect(detail).toBeVisible();
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: "Tiles", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(detail).toHaveCount(0);
    await expect(cell(page, 6, 14)).toBeFocused();
    await expect(cell(page, 6, 14)).toBeInViewport();
    await expectNoPageProblems(page);
  });

  test("the arrows move in the columns: down a day, right to the next month", async ({ page }) => {
    await cell(page, 6, 14).focus();
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, 6, 15)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 7, 15)).toBeFocused();
    await page.keyboard.press("Shift+ArrowUp");
    await expect(cell(page, 7, 14)).toBeFocused();
    await expect(cell(page, 7, 14)).toHaveAttribute("aria-selected", "true");
    await expect(cell(page, 7, 15)).toHaveAttribute("aria-selected", "true");
    await expectNoPageProblems(page);
  });
});

/** The week markers that touch or cover their day's number and weekday (less than 2 px apart). */
async function markersOverText(page: Page): Promise<string[]> {
  return page.getByRole("grid").evaluate((element) => {
    const found: string[] = [];
    for (const marker of element.querySelectorAll<HTMLElement>("[role=gridcell] button")) {
      const text = marker.closest("[role=gridcell]")?.querySelector(".number");
      if (!text) continue;
      const chip = marker.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(text);
      const words = range.getBoundingClientRect();
      const apart = words.right + 2 <= chip.left || chip.right + 2 <= words.left;
      if (!apart) found.push(`${text.textContent?.trim() ?? ""} / ${marker.textContent?.trim() ?? ""}`);
    }
    return found;
  });
}

// Firefox ESR painted the week markers of a new month columns view first at their wide place, then moved
// them: the narrow place came from a container query on each of the 365 cells, resolved after a first paint.
// The place now follows from the cell's own width in the same layout, and the cells are no query containers.
for (const [width, gap] of [[1453, 1], [1700, 16]] as const) {
  test.describe(`at ${String(width)} px, the week marker`, () => {
    test.use({ locale: "de-DE", viewport: { width, height: 800 } });

    test(`stands ${String(gap)} px from the cell's end, decided without a per-cell container query`, async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      await page.getByRole("button", { name: "Spalten", exact: true }).click();
      const day = cell(page, 2, 8);
      await expect(day.getByRole("button")).toBeVisible();
      const place = await day.evaluate((element) => {
        const chip = element.querySelector("button")!.getBoundingClientRect();
        return {
          gap: element.getBoundingClientRect().right - chip.right,
          containers: [element, ...element.querySelectorAll("*")].filter((node) => getComputedStyle(node).containerType !== "normal").length,
        };
      });
      expect(place.containers).toBe(0);
      expect(place.gap).toBeCloseTo(gap, 0);
      await expectNoPageProblems(page);
    });
  });
}

// The narrowest columns: 6 visible at a calendar of 520 px (an app of about 550 px without the sidebar or
// 870 px with it), and all 12 at a calendar of 1100 px (an app of about 1450 px), each about 80 px wide.
for (const width of [552, 873, 1453]) {
  test.describe(`at ${String(width)} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [locale, columns] of [["en-GB", "Columns"], ["de-DE", "Spalten"]] as const) {
      test.describe(locale, () => {
        test.use({ locale });

        test("the week markers leave the day and weekday free", async ({ page }) => {
          await openApp(page);
          await openExampleFromStart(page);
          await page.getByRole("button", { name: columns, exact: true }).click();
          await expect(cell(page, 1, 4).getByRole("button")).toBeVisible();
          // The case this is about: a column narrower than the room the text, the marker and the lanes need side by side.
          expect((await cell(page, 1, 4).boundingBox())!.width).toBeLessThan(90);
          expect(await markersOverText(page)).toEqual([]);
          await expectNoPageProblems(page);
        });
      });
    }
  });
}

test.describe("in right-to-left text", () => {
  test.skip(({ browserName }) => browserName === "webkit", "The gallery is checked in Chromium and Firefox.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openGallery(page, { section: "main-columns", locale: "en-XB", mode: "light" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("in RTL the day column stays fixed at the right while the months scroll", async ({ page }) => {
    const scroller = page.getByRole("grid");
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const header = scroller.getByRole("row").nth(1).getByRole("rowheader");
    const before = await header.boundingBox();
    const area = await scroller.boundingBox();
    expect(before && area).toBeTruthy();
    // At the visual right of the scroller.
    expect(Math.abs(before!.x + before!.width - (area!.x + area!.width))).toBeLessThanOrEqual(2);
    const firstCell = scroller.getByRole("row").nth(1).getByRole("gridcell").first();
    const cellBefore = await firstCell.boundingBox();
    const moved = await scroller.evaluate((element) => {
      element.scrollLeft = -200;
      return element.scrollLeft;
    });
    expect(moved).not.toBe(0);
    await expect.poll(async () => (await firstCell.boundingBox())?.x).not.toBe(cellBefore?.x);
    expect(await header.boundingBox()).toEqual(before);
    await expectNoPageProblems(page);
  });

  test("the week markers leave the day and weekday free", async ({ page }) => {
    expect(await markersOverText(page)).toEqual([]);
  });

  test("a focused cell is never under the sticky day column", async ({ page }) => {
    const scroller = page.getByRole("grid");
    const padding = await scroller.evaluate((element) => getComputedStyle(element).scrollPaddingInlineStart);
    const dayColumn = await scroller.getByRole("row").nth(1).getByRole("rowheader").boundingBox();
    expect(parseFloat(padding)).toBeCloseTo(dayColumn!.width, 0);
    await expectNoPageProblems(page);
  });

  test("in RTL ArrowLeft moves to the next month", async ({ page }) => {
    await cell(page, 6, 14).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 7, 14)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 6, 14)).toBeFocused();
    await expectNoPageProblems(page);
  });
});
