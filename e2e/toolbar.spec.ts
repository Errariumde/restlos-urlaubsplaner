// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, test } from "@playwright/test";
import { expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

test.describe("in English", () => {
  test.use({ locale: "en-US", viewport: { width: 1100, height: 800 } });

  test("the language switch changes texts without reload", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("banner")).toContainText("Example – changes are not saved");

    const navigations: string[] = [];
    page.on("framenavigated", (frame) => navigations.push(frame.url()));
    await page.getByRole("button", { name: "DE", exact: true }).click();
    await expect(page.getByRole("banner")).toContainText("Beispiel – Änderungen werden nicht gespeichert");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("banner")).toContainText("Example – changes are not saved");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(navigations).toEqual([]);
    await expectNoPageProblems(page);
  });

  test("the mode switch sets color-scheme", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await scheme()).toBe("dark");
    await page.getByRole("button", { name: "Light", exact: true }).click();
    expect(await scheme()).toBe("light");
    await page.getByRole("button", { name: "Auto", exact: true }).click();
    expect(await scheme()).toBe("light dark");
    await expectNoPageProblems(page);
  });

  test("the plan name, the period and the focus", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Beispiel GmbH (no collective agreement, as of 2026)");
    await expect(heading).toBeFocused();
    await expect(page.getByRole("toolbar", { name: "Plan toolbar" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(/Jan – Dec 2027/);
    await expectNoPageProblems(page);
  });

  test("V switches the view, W aligns in the columns view, K switches the weeks", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const tiles = page.getByRole("button", { name: "Tiles", exact: true });
    const columns = page.getByRole("button", { name: "Columns", exact: true });
    const align = page.getByRole("checkbox", { name: "Align by weekday" });
    const weeks = page.getByRole("checkbox", { name: "Calendar weeks" });

    await expect(tiles).toHaveAttribute("aria-pressed", "true");
    await expect(align).toHaveCount(0);
    await page.keyboard.press("w"); // does nothing in the tiles view
    await page.keyboard.press("v");
    await expect(columns).toHaveAttribute("aria-pressed", "true");
    await expect(align).not.toBeChecked();
    await page.keyboard.press("w");
    await expect(align).toBeChecked();
    await page.keyboard.press("v");
    await expect(tiles).toHaveAttribute("aria-pressed", "true");

    await expect(weeks).toBeChecked();
    await page.keyboard.press("k");
    await expect(weeks).not.toBeChecked();
    // A click on the checkbox itself still works, and the letter shortcuts work while it has the focus.
    await weeks.focus();
    await page.keyboard.press("k");
    await expect(weeks).toBeChecked();
    await expectNoPageProblems(page);
  });

  test("undo and redo are disabled without history and Ctrl+Z is swallowed", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");
    await expectNoPageProblems(page);
  });
});

test.describe("on a narrow app", () => {
  test.use({ locale: "en-US", viewport: { width: 420, height: 800 } });

  test("mode, language and the checkboxes move into the More menu", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const more = page.getByRole("button", { name: "More", exact: true });
    await expect(more).toBeVisible();
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toBeHidden();
    await expect(page.getByRole("checkbox", { name: "Calendar weeks" })).toBeHidden();
    // The view switch and undo/redo stay on the bar.
    await expect(page.getByRole("button", { name: "Tiles", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();

    await more.click();
    const menu = page.getByRole("dialog", { name: "More options" });
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await menu.getByRole("checkbox", { name: "Calendar weeks" }).click();
    await expect(menu.getByRole("checkbox", { name: "Calendar weeks" })).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("More is gone again when the app gets wide", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toBeVisible();
  });
});

test.describe("on a touch device", () => {
  test.use({ locale: "en-US", viewport: { width: 420, height: 800 }, hasTouch: true, isMobile: true });
  test.skip(({ browserName }) => browserName !== "chromium", "isMobile is Chromium only.");

  test("the More menu opens as a sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await page.getByRole("button", { name: "More", exact: true }).tap();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.locator("[popover]:popover-open")).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});
