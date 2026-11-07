// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The phone width with long texts (Review Focus 5): at 375 px in the long pseudo-locale en-XA, the page never
// scrolls sideways (only the month columns scroll, inside their own scroller), and every toolbar control is
// either on the bar, inside the window, or in the More menu, never both and never neither.
import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../src/ui/i18n/en.json" with { type: "json" };
import { pseudoCatalog } from "../src/ui/i18n/pseudo.ts";
import { expectNoPageProblems, openGallery } from "./helpers.ts";

const XA = pseudoCatalog(en, "long");

function text(key: keyof typeof en): string {
  const message = XA[key];
  if (message === undefined) throw new Error(`No message ${key}`);
  return message;
}

test.use({ viewport: { width: 375, height: 800 } });

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? Infinity,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** Whether `locator` is visible and lies inside the window's width. */
async function onScreen(locator: Locator, width: number): Promise<boolean> {
  if (!(await locator.isVisible())) return false;
  const box = await locator.boundingBox();
  return box !== null && box.x >= 0 && box.x + box.width <= width;
}

/** Each control is on the bar or in the More menu, exactly once. */
async function expectEveryControlOnce(page: Page, controls: readonly { role: "button" | "checkbox"; key: keyof typeof en }[]): Promise<void> {
  const toolbar = page.getByRole("toolbar", { name: text("toolbar.label") });
  const more = toolbar.getByRole("button", { name: text("toolbar.more"), exact: true });
  expect(await onScreen(more, 375)).toBe(true);
  await more.click();
  const menu = page.getByRole("dialog", { name: text("toolbar.moreLabel") });
  await expect(menu).toBeVisible();
  for (const { role, key } of controls) {
    const name = text(key);
    const onBar = await onScreen(toolbar.getByRole(role, { name, exact: true }), 375);
    const inMenu = await onScreen(menu.getByRole(role, { name, exact: true }), 375);
    expect(Number(onBar) + Number(inMenu), `${key}: on the bar ${String(onBar)}, in More ${String(inMenu)}`).toBe(1);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
}

const COMMON = [
  { role: "button", key: "toolbar.view.tiles" },
  { role: "button", key: "toolbar.view.columns" },
  { role: "checkbox", key: "toolbar.weeks" },
  { role: "button", key: "toolbar.select" },
  { role: "button", key: "toolbar.undo" },
  { role: "button", key: "toolbar.redo" },
  { role: "button", key: "toolbar.mode.light" },
  { role: "button", key: "toolbar.mode.dark" },
  { role: "button", key: "toolbar.mode.auto" },
  { role: "button", key: "toolbar.language.de" },
  { role: "button", key: "toolbar.language.en" },
] as const;

test.describe("at 375 px in en-XA", () => {
  test("the month tiles don't scroll sideways and every toolbar control is reachable", async ({ page }) => {
    await openGallery(page, { section: "main-tiles", locale: "en-XA", mode: "light" });
    await expect(page.getByRole("gridcell").first()).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectEveryControlOnce(page, COMMON);
    await expectNoSidewaysScroll(page);
    await expectNoPageProblems(page);
  });

  test("the month columns scroll only inside their own scroller, and Align is in More", async ({ page }) => {
    await openGallery(page, { section: "main-columns", locale: "en-XA", mode: "light" });
    await expect(page.getByRole("gridcell").first()).toBeVisible();
    const grid = page.getByRole("grid");
    expect(await grid.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await expectNoSidewaysScroll(page);
    await expectEveryControlOnce(page, [...COMMON, { role: "checkbox", key: "toolbar.align" }]);
    await expectNoSidewaysScroll(page);
    await expectNoPageProblems(page);
  });
});
