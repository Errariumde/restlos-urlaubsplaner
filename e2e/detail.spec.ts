// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The detail popover of a day (docs/SPEC.md, "Detail view"): right-click, Enter, the context-menu key and
// a long press open it; on a narrow calendar or a touch screen it is a bottom sheet.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart, openGallery } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const detail = (page: Page): Locator => page.getByRole("dialog", { name: /^Details for / });

test.describe("in English at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  test("a right-click on 24 Dec shows the reason and the day rule's label", async ({ page }) => {
    await cell(page, 12, 24).click({ button: "right" });
    const popover = detail(page);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAccessibleName(/^Details for Friday,? 24 December 2027$/);
    await expect(popover).toContainText("Christmas Eve: afternoon off (day rule: at most ½)");
    await expect(popover).toContainText("Required work: ½");
    // Nothing else changed: the right-click doesn't toggle the day.
    await expect(cell(page, 12, 24)).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });

  test("Half day – morning sets a half day in the morning, and Escape gives the focus back to the cell", async ({ page }) => {
    const day = cell(page, 6, 14);
    await day.click({ button: "right" });
    const popover = detail(page);
    await expect(popover.getByRole("button", { name: "Full day" })).toBeFocused();
    await expect(popover.getByRole("button", { name: "Remove" })).toBeDisabled();
    await popover.getByRole("button", { name: "Half day – morning" }).click();
    await expect(day).toHaveAttribute("aria-label", /leave half, morning/);
    await expect(popover).toContainText("Half day, morning");
    await expect(popover.getByRole("button", { name: "Half day – morning" })).toBeDisabled();
    await expect(popover.getByRole("button", { name: "Remove" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(day).toBeFocused();
    // One change, one undo step.
    await page.keyboard.press("Control+z");
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });

  test("Enter on a focused cell opens the detail, and the context-menu key too", async ({ page }) => {
    const day = cell(page, 1, 4);
    await day.focus();
    await page.keyboard.press("Enter");
    const popover = detail(page);
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("Leave 2026");
    await expect(popover).toContainText("Leave in another plan");
    await expect(popover).toContainText("This day is already off in another plan.");
    await expect(popover.getByRole("button", { name: "Full day" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(day).toBeFocused();
    await page.keyboard.press("ContextMenu");
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(day).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a click on another cell closes the detail and leaves the focus there", async ({ page }) => {
    await cell(page, 6, 14).click({ button: "right" });
    await expect(detail(page)).toBeVisible();
    await cell(page, 2, 2).click();
    await expect(detail(page)).toBeHidden();
    await expect(cell(page, 2, 2)).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a right-click on another day while the detail is open shows that day", async ({ page }) => {
    await cell(page, 6, 14).click({ button: "right" });
    await expect(detail(page)).toHaveAccessibleName(/^Details for Monday,? 14 June 2027$/);
    await cell(page, 5, 27).click({ button: "right" });
    await expect(detail(page)).toHaveAccessibleName(/^Details for Thursday,? 27 May 2027$/);
    await expect(detail(page)).toContainText("Corpus Christi (public holiday)");
    await expect(detail(page)).toHaveCount(1);
    await expectNoPageProblems(page);
  });
});

test.describe("on a Mac", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test("Ctrl+click opens the detail and doesn't toggle the day", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", { get: () => "MacIntel" });
    });
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await day.click({ modifiers: ["Control"] });
    await expect(detail(page)).toBeVisible();
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });
});

test.describe("on a narrow calendar", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the detail is a bottom sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await day.scrollIntoViewIfNeeded();
    await day.click({ button: "right" });
    const sheet = detail(page);
    await expect(sheet).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await sheet.getByRole("button", { name: "Full day" }).click();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(day).toBeFocused();
    await expectNoPageProblems(page);
  });
});

/** Holds a finger on the cell until the detail shows (the long press fires after 500 ms), then lifts it. */
async function longPress(page: Page, day: Locator): Promise<void> {
  await day.scrollIntoViewIfNeeded();
  const box = await day.boundingBox();
  if (!box) throw new Error("The cell has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await expect(detail(page)).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Lets pending timers and two frames run, so that something that would open has opened. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))),
  );
}

test.describe("on a touch screen", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Touch is emulated in Chromium only.");
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 }, hasTouch: true });

  test("a long press opens the detail sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await longPress(page, day);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });
});

test.describe("on a wide touch screen with a mouse as the primary pointer", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Touch is emulated in Chromium only.");
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 }, hasTouch: true });

  test("a long press opens the sheet, which stays open after the finger lifts", async ({ page }) => {
    // A touch laptop: the primary pointer is fine, so only the touch itself can ask for the sheet.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => original(query.replace("pointer: coarse", "pointer: none"));
    });
    await openApp(page);
    await openExampleFromStart(page);
    await longPress(page, cell(page, 6, 14));
    await settle(page);
    await expect(detail(page)).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expectNoPageProblems(page);
  });
});

test.describe("a detail waiting for its button's release", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  /** A contextmenu on the press, as Linux and macOS send it: the right button is still down. */
  async function pressContextMenu(page: Page, day: Locator, pointerId: number): Promise<void> {
    await day.evaluate((element, id) => {
      element.dispatchEvent(new PointerEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, buttons: 2, pointerId: id }));
    }, pointerId);
  }

  const release = (page: Page, pointerId: number) =>
    page.evaluate((id) => window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: id })), pointerId);

  test("opens on the release of its own pointer only", async ({ page }) => {
    await pressContextMenu(page, cell(page, 6, 14), 7);
    await release(page, 3);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);
    await release(page, 7);
    await expect(detail(page)).toBeVisible();
    await expectNoPageProblems(page);
  });

  test("Escape, a cancelled pointer or leaving the window stops the wait", async ({ page }) => {
    const day = cell(page, 6, 14);
    await pressContextMenu(page, day, 7);
    await page.keyboard.press("Escape");
    await release(page, 7);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);

    await pressContextMenu(page, day, 8);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 8 })));
    await release(page, 8);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);

    await pressContextMenu(page, day, 9);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await release(page, 9);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});

test.describe("in right-to-left text", () => {
  test.skip(({ browserName }) => browserName === "webkit", "The gallery is checked in Chromium and Firefox.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("in RTL the popover opens toward the inline end and stays on screen", async ({ page }) => {
    await openGallery(page, { section: "main-tiles", locale: "en-XB", mode: "light" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const tiles = page.getByRole("rowgroup");
    await expect(tiles.first()).toBeVisible();
    // The leftmost tile of the first row.
    const lefts = await tiles.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
    const firstRow = lefts.filter((box) => Math.abs(box.y - lefts[0]!.y) < 1);
    const leftmost = firstRow.indexOf(firstRow.reduce((a, b) => (b.x < a.x ? b : a)));
    // A Wednesday in the middle of the tile, so the cell sits near the tile's left edge only by its column.
    const target = tiles.nth(leftmost).getByRole("gridcell").nth(9);
    await target.click({ button: "right" });
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    const cellBox = await target.boundingBox();
    const viewport = page.viewportSize();
    expect(box && cellBox && viewport).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    // Toward the inline end (the left): the right edges line up, unless there was no room on the left.
    const cellRight = cellBox!.x + cellBox!.width;
    const flipped = cellRight - box!.width < 0;
    expect(flipped || box!.x + box!.width <= cellRight + 1).toBe(true);
    await expectNoPageProblems(page);
  });
});
