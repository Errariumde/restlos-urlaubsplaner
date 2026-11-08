// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The month tiles: planning leave by drag, click, Shift-click and week number, and the hint line while
// dragging. The example plan runs from January to December 2027 and has leave from 2 to 13 August.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart, openGallery } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const hint = (page: Page): Locator => page.locator('[aria-live="polite"]');

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses the mouse on `from` and moves it in steps to `to`, without releasing it. */
async function dragTo(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = await centre(from);
  const end = await centre(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
}

async function expectLeave(page: Page, month: number, days: readonly number[], leave: RegExp): Promise<void> {
  for (const day of days) await expect(cell(page, month, day)).toHaveAttribute("aria-label", leave);
}

declare global {
  interface Window {
    /** Holds back the page's "apply" messages to the engine worker (a slow worker), or sends the held ones. */
    __holdApply?: (on: boolean) => void;
  }
}

const FULL = /leave full/;
const NONE = /no leave/;

test.describe("in English at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Kept unbound on purpose: it is called with each worker as `this` below.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const send = Worker.prototype.postMessage;
      const held: [Worker, unknown][] = [];
      let hold = false;
      window.__holdApply = (on) => {
        hold = on;
        if (!on) for (const [worker, message] of held.splice(0)) send.call(worker, message);
      };
      Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
        if (hold && (message as { type?: string } | null)?.type === "apply") held.push([this, message]);
        else send.call(this, message, ...(rest as [StructuredSerializeOptions]));
      };
    });
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  test("dragging from Mon 14 Jun to Fri 18 Jun plans five days", async ({ page }) => {
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await dragTo(page, cell(page, 6, 14), cell(page, 6, 18));
    await expect(hint(page)).toContainText(/^5\sworking days · /);
    await page.mouse.up();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await expect(hint(page)).toHaveText("5 days changed. 3 days left.");
    await expectNoPageProblems(page);
  });

  test("Friday 1 Jan sits under the Friday header: empty slots are cells too", async ({ page }) => {
    const position = await cell(page, 1, 1).evaluate((element) =>
      [...(element.parentElement?.querySelectorAll(':scope > [role="gridcell"]') ?? [])].indexOf(element),
    );
    const heads = await page.getByRole("rowgroup").first().getByRole("row").nth(1).getByRole("columnheader").allInnerTexts();
    // The week column's header comes first, as the week number comes first in the row (a rowheader, not a cell).
    expect(heads[position + 1]).toBe("Fri");
    await expectNoPageProblems(page);
  });

  test("a drag that starts on leave removes it", async ({ page }) => {
    await expectLeave(page, 8, [3, 4, 5, 6, 9, 10, 11], FULL);
    await dragTo(page, cell(page, 8, 4), cell(page, 8, 10));
    await page.mouse.up();
    await expectLeave(page, 8, [4, 5, 6, 9, 10], NONE);
    await expectLeave(page, 8, [3, 11], FULL);
    await expectNoPageProblems(page);
  });

  test("click toggles, Shift-click extends", async ({ page }) => {
    await cell(page, 6, 14).click();
    await expectLeave(page, 6, [14], FULL);
    await cell(page, 6, 14).click();
    await expectLeave(page, 6, [14], NONE);

    await cell(page, 6, 7).click();
    await cell(page, 6, 11).click({ modifiers: ["Shift"] });
    await expectLeave(page, 6, [7, 8, 9, 10, 11], FULL);
    await expectLeave(page, 6, [12, 13, 14], NONE);
    await expectNoPageProblems(page);
  });

  test("a week-number click sets the week and a second click removes it", async ({ page }) => {
    const week = page.getByRole("button", { name: "Week 24", exact: true });
    await week.click();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await expectLeave(page, 6, [19, 20], /weekend, no leave/);
    await week.click();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expectNoPageProblems(page);
  });

  test("a drag released outside the window applies once; pointercancel discards", async ({ page }) => {
    // April is in the first row of tiles, so the toolbar stays in view.
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await expect(undo).toBeDisabled();
    await dragTo(page, cell(page, 4, 12), cell(page, 4, 14));
    const toolbar = await centre(page.getByRole("toolbar", { name: "Plan toolbar" }));
    // One jump: on the way up the pointer would cross the cells of earlier weeks, which the drag would follow.
    await page.mouse.move(toolbar.x, toolbar.y);
    await page.mouse.up();
    await expectLeave(page, 4, [12, 13, 14], FULL);
    await expect(hint(page)).toHaveText("3 days changed. 5 days left.");
    await undo.click();
    await expectLeave(page, 4, [12, 13, 14], NONE);
    await expect(undo).toBeDisabled();

    await dragTo(page, cell(page, 4, 19), cell(page, 4, 21));
    await expect(hint(page)).toContainText("3");
    await page.dispatchEvent(`[data-day="${String(dayFromYmd(2027, 4, 21))}"]`, "pointercancel");
    await expect(hint(page)).toHaveText("");
    await page.mouse.up();
    await expectLeave(page, 4, [19, 20, 21], NONE);
    await expect(hint(page)).toHaveText("");
    await expect(undo).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a drag from 29 Jan into 2 Feb across the tile gap sets the days in between", async ({ page }) => {
    await dragTo(page, cell(page, 1, 29), cell(page, 2, 2));
    await page.mouse.up();
    await expectLeave(page, 1, [29], FULL);
    await expectLeave(page, 2, [1, 2], FULL);
    await expectLeave(page, 1, [30, 31], /weekend, no leave/);
    await expectNoPageProblems(page);
  });

  test("undo removes the whole drag in one step", async ({ page }) => {
    await dragTo(page, cell(page, 6, 14), cell(page, 6, 18));
    await page.mouse.up();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await page.keyboard.press("Control+z");
    await expectLeave(page, 6, [14, 15, 16, 17, 18], NONE);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("Escape during a drag discards it", async ({ page }) => {
    await dragTo(page, cell(page, 6, 14), cell(page, 6, 16));
    await expect(hint(page)).toContainText(/^3\sworking days · /);
    await page.keyboard.press("Escape");
    await expect(hint(page)).toHaveText("");
    await page.mouse.up();
    await expectLeave(page, 6, [14, 15, 16], NONE);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a click while a change is still being applied changes nothing, and works after", async ({ page }) => {
    // The init script of this describe holds back every "apply" message to the worker while __holdApply is on.
    await page.evaluate(() => window.__holdApply?.(true));
    await cell(page, 6, 14).click();
    await cell(page, 6, 15).click();
    await page.getByRole("button", { name: "Week 25", exact: true }).click();
    await page.evaluate(() => window.__holdApply?.(false));
    await expectLeave(page, 6, [14], FULL);
    // A click once the plan is idle; its answer comes after any earlier apply.
    await cell(page, 6, 16).click();
    await expectLeave(page, 6, [16], FULL);
    await expectLeave(page, 6, [15, 21, 22, 23, 24, 25], NONE);
    await cell(page, 6, 15).click();
    await expectLeave(page, 6, [15], FULL);
    await expectNoPageProblems(page);
  });

  test("a drag over a weekend only changes nothing and adds no undo step", async ({ page }) => {
    await dragTo(page, cell(page, 6, 19), cell(page, 6, 20));
    await page.mouse.up();
    await expectLeave(page, 6, [19, 20], /weekend, no leave/);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });
});

test.describe("on a phone", () => {
  test.use({ locale: "de-DE", viewport: { width: 375, height: 800 } });

  test("one tile per row and no horizontal scroll at 375 px", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const tiles = page.getByRole("rowgroup");
    await expect(tiles).toHaveCount(12);
    const january = await tiles.nth(0).boundingBox();
    const february = await tiles.nth(1).boundingBox();
    expect(january && february && february.y > january.y + january.height - 1).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoPageProblems(page);
  });
});

test.describe("on a touch screen", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Touch is emulated in Chromium only.");
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 }, hasTouch: true });

  test("a tap toggles a day", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 1, 13);
    await day.scrollIntoViewIfNeeded();
    const point = await centre(day);
    await page.touchscreen.tap(point.x, point.y);
    await expect(day).toHaveAttribute("aria-label", FULL);
    await page.touchscreen.tap(point.x, point.y);
    await expect(day).toHaveAttribute("aria-label", NONE);
    await expectNoPageProblems(page);
  });
});

test.describe("in right-to-left text", () => {
  test.skip(({ browserName }) => browserName === "webkit", "The gallery is checked in Chromium and Firefox.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openGallery(page, { section: "main-tiles", locale: "en-XB", mode: "light" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("in RTL the week number sits at the visual right of its row", async ({ page }) => {
    const row = page.getByRole("row").filter({ has: page.getByRole("rowheader") }).nth(2);
    const header = await row.getByRole("rowheader").boundingBox();
    expect(header).not.toBeNull();
    const cells = row.getByRole("gridcell");
    expect(await cells.count()).toBeGreaterThan(0);
    for (const box of await cells.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().x))) {
      expect(header!.x).toBeGreaterThan(box);
    }
    await expectNoPageProblems(page);
  });

  test("in RTL ArrowRight moves to the previous day", async ({ page }) => {
    await cell(page, 6, 16).focus();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 6, 15)).toBeFocused();
    await expect(cell(page, 6, 15)).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 6, 16)).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("in RTL a drag from right to left sets the days in between", async ({ page }) => {
    const from = await centre(cell(page, 6, 14));
    const to = await centre(cell(page, 6, 18));
    expect(from.x).toBeGreaterThan(to.x);
    await dragTo(page, cell(page, 6, 14), cell(page, 6, 18));
    await page.mouse.up();
    await expectLeave(page, 6, [14, 15, 16, 17, 18], FULL);
    await expectNoPageProblems(page);
  });
});
