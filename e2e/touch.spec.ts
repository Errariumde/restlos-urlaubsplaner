// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Touch (docs/SPEC.md, "Calendar interaction"): a tap toggles a day and a swipe scrolls; ranges come with
// the selection mode, where a drag or two taps select and the selection bar applies or cancels. The drags are
// pointer events of type "touch" sent to the cell the finger starts on, as a browser does with its implicit
// pointer capture. The example plan runs from January to December 2027.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const hint = (page: Page): Locator => page.locator('[aria-live="polite"]');
const FULL = /leave full/;
const NONE = /no leave/;
const HALF = /leave half, afternoon/;

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function expectLeave(page: Page, month: number, days: readonly number[], leave: RegExp): Promise<void> {
  for (const day of days) await expect(cell(page, month, day)).toHaveAttribute("aria-label", leave);
}

async function tap(page: Page, locator: Locator): Promise<void> {
  // Into the middle of the window: Playwright's own scrolling can leave a day under the sticky selection bar.
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const { x, y } = await centre(locator);
  await page.touchscreen.tap(x, y);
}

/** Sends one touch pointer event to `target` at the viewport point. */
async function touchEvent(target: Locator, type: string, point: { x: number; y: number }): Promise<void> {
  await target.evaluate(
    (element, { type, x, y }) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 17,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: type === "pointermove" ? -1 : 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    },
    { type, ...point },
  );
}

/** A finger from the centre of `from` to the centre of `to`, in steps, then lifted. */
async function touchDrag(from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = await centre(from);
  const end = await centre(to);
  await touchEvent(from, "pointerdown", start);
  for (let step = 1; step <= 6; step += 1) {
    await touchEvent(from, "pointermove", { x: start.x + ((end.x - start.x) * step) / 6, y: start.y + ((end.y - start.y) * step) / 6 });
  }
  await touchEvent(from, "pointerup", end);
}

test.skip(({ browserName }) => browserName === "firefox", "Playwright's Firefox has no mobile emulation.");
test.use({ locale: "en-GB", viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await openExampleFromStart(page);
  await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
});

test.describe("without the selection mode", () => {
  test("a tap toggles a day", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await expectLeave(page, 6, [14], FULL);
    await tap(page, cell(page, 6, 14));
    await expectLeave(page, 6, [14], NONE);
    await expectNoPageProblems(page);
  });

  test("a swipe plans nothing", async ({ page }) => {
    await touchDrag(cell(page, 6, 14), cell(page, 6, 18));
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });
});

test.describe("in the selection mode", () => {
  test.beforeEach(async ({ page }) => {
    const select = page.getByRole("button", { name: "Select", exact: true });
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await select.tap();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Full day", exact: true })).toBeDisabled();
  });

  test("tapping 14 Jun, then 18 Jun, then Full day plans five days", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-selected", "true");
    await expectLeave(page, 6, [14], NONE);
    await tap(page, cell(page, 6, 18));
    for (const day of [14, 15, 16, 17, 18]) await expect(cell(page, 6, day)).toHaveAttribute("aria-selected", "true");
    await expect(hint(page)).toContainText(/^5\sworking days · /);
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await page.getByRole("button", { name: "Full day", exact: true }).tap();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    // The selection is gone, the mode stays.
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Full day", exact: true })).toBeDisabled();
    // One undo step.
    await page.getByRole("button", { name: "Undo", exact: true }).tap();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a week-number tap selects the week's working days; Full day applies them in one step", async ({ page }) => {
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const week = page.getByRole("button", { name: "Week 24", exact: true });
    await week.scrollIntoViewIfNeeded();
    await week.tap();
    for (const day of [14, 15, 16, 17, 18]) await expect(cell(page, 6, day)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(5);
    await expect(hint(page)).toContainText(/^5\sworking days · /);
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(undo).toBeDisabled();
    await page.getByRole("button", { name: "Full day", exact: true }).tap();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await undo.tap();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(undo).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("in the columns, a week-marker tap selects too", async ({ page }) => {
    await page.getByRole("button", { name: "Columns", exact: true }).tap();
    const marker = page.getByRole("grid", { name: "Calendar" }).getByRole("button", { name: "Week 24", exact: true });
    await marker.scrollIntoViewIfNeeded();
    await marker.tap();
    for (const day of [14, 15, 16, 17, 18]) await expect(cell(page, 6, day)).toHaveAttribute("aria-selected", "true");
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a third tap starts a new selection", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await tap(page, cell(page, 6, 16));
    await tap(page, cell(page, 6, 22));
    await expect(cell(page, 6, 22)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(1);
    await expectNoPageProblems(page);
  });

  test("a touch drag selects, and Half day plans half days", async ({ page }) => {
    await touchDrag(cell(page, 6, 14), cell(page, 6, 18));
    for (const day of [14, 15, 16, 17, 18]) await expect(cell(page, 6, day)).toHaveAttribute("aria-selected", "true");
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await page.getByRole("button", { name: "Half day", exact: true }).tap();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], HALF);
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expectNoPageProblems(page);
  });

  test("Remove takes the leave off the selection", async ({ page }) => {
    await expectLeave(page, 8, [3, 4, 5], FULL);
    await tap(page, cell(page, 8, 3));
    await tap(page, cell(page, 8, 5));
    await page.getByRole("button", { name: "Remove leave", exact: true }).tap();
    await expectLeave(page, 8, [3, 4, 5], NONE);
    await expectLeave(page, 8, [2, 6], FULL);
    await expectNoPageProblems(page);
  });

  test("Clear selection changes nothing and keeps the mode", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await tap(page, cell(page, 6, 18));
    await expect(hint(page)).toContainText(/^5\sworking days · /);
    await page.getByRole("button", { name: "Clear selection", exact: true }).tap();
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(hint(page)).not.toContainText("working days");
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("leaving the mode clears the selection and hides the bar", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Select", exact: true }).tap();
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Full day", exact: true })).toHaveCount(0);
    await expectNoPageProblems(page);
  });

  test("the exit button leaves the mode and drops the selection", async ({ page }) => {
    await tap(page, cell(page, 6, 14));
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Exit selection mode", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Selection" })).toHaveCount(0);
    await expectLeave(page, 6, [14], NONE);
    await expectNoPageProblems(page);
  });

  test("the bar keeps its buttons and its height with and without a selection", async ({ page }) => {
    const bar = page.getByRole("region", { name: "Selection" });
    const names = ["Exit selection mode", "Full day", "Half day", "Remove leave", "Clear selection"];
    const enabled = async (): Promise<boolean[]> => Promise.all(names.map((name) => bar.getByRole("button", { name, exact: true }).isEnabled()));
    expect(await enabled()).toEqual([true, false, false, false, false]);
    const before = (await bar.boundingBox())!.height;
    await tap(page, cell(page, 6, 14));
    await expect(hint(page)).toContainText(/^1\sworking day · /);
    expect(await enabled()).toEqual([true, true, true, true, true]);
    expect((await bar.boundingBox())!.height).toBe(before);
    await expectNoPageProblems(page);
  });

  test("the bar doesn't cover the last calendar row", async ({ page }) => {
    const last = cell(page, 12, 31);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = await page.getByRole("region", { name: "Selection" }).boundingBox();
    const box = await last.boundingBox();
    expect(bar && box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
    await expectNoPageProblems(page);
  });

  test("only the day cells take the finger; the grid still scrolls", async ({ page }) => {
    const grid = page.getByRole("grid", { name: "Calendar" });
    expect(await grid.evaluate((element) => getComputedStyle(element).touchAction)).toBe("manipulation");
    expect(await cell(page, 6, 14).evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
    await expectNoPageProblems(page);
  });

  test("the prompt is not in the live region; only real hints are", async ({ page }) => {
    const bar = page.getByRole("region", { name: "Selection" });
    await expect(bar).toContainText("tap the first and the last day");
    await expect(hint(page)).toHaveText("");
    await expectNoPageProblems(page);
  });

  test("two taps work across a scroll, and the bar stays in the window", async ({ page }) => {
    await tap(page, cell(page, 2, 1));
    await expect(cell(page, 2, 1)).toHaveAttribute("aria-selected", "true");
    // Scroll to June without a locator action, which would scroll by itself.
    await cell(page, 6, 4).evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 300));
    const box = await cell(page, 6, 4).boundingBox();
    expect(box && box.y > 0 && box.y + box.height < 800).toBe(true);
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(cell(page, 6, 4)).toHaveAttribute("aria-selected", "true");
    await expect(cell(page, 3, 15)).toHaveAttribute("aria-selected", "true");
    const bar = await page.getByRole("region", { name: "Selection" }).boundingBox();
    expect(bar).not.toBeNull();
    expect(bar!.y).toBeGreaterThanOrEqual(0);
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(800 + 1);
    await expectNoPageProblems(page);
  });

  test("in the columns, a drag from a month header or the day column selects nothing", async ({ page }) => {
    await page.getByRole("button", { name: "Columns", exact: true }).tap();
    const grid = page.getByRole("grid", { name: "Calendar" });
    await expect(grid.getByRole("columnheader").nth(1)).toBeVisible();
    await touchDrag(grid.getByRole("columnheader").nth(1), cell(page, 1, 5));
    await touchDrag(grid.getByRole("row").nth(3).getByRole("rowheader"), cell(page, 1, 8));
    await expect(page.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a long press opens the detail sheet", async ({ page }) => {
    const day = cell(page, 6, 14);
    await day.scrollIntoViewIfNeeded();
    const point = await centre(day);
    await touchEvent(day, "pointerdown", point);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await touchEvent(day, "pointerup", point);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(day).toHaveAttribute("aria-label", NONE);
    await expectNoPageProblems(page);
  });
});
