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

  test("the mode switch sets data-scheme and color-scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openApp(page);
    await openExampleFromStart(page);
    const html = page.locator("html");
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(html).toHaveAttribute("data-scheme", "dark");
    await expect(html).toHaveCSS("color-scheme", "dark");
    // The tokens follow: the page surface changes with the scheme.
    const darkSurface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(html).toHaveAttribute("data-scheme", "light");
    await expect(html).toHaveCSS("color-scheme", "light");
    await expect(page.locator("body")).not.toHaveCSS("background-color", darkSurface);
    await page.getByRole("button", { name: "Auto", exact: true }).click();
    await expect(html).toHaveAttribute("data-scheme", "light");
    await expect(html).toHaveCSS("color-scheme", "light");
    await expectNoPageProblems(page);
  });

  test("with reduced motion the mode switch starts no transitions", async ({ page }) => {
    // Issue 0032: a reduced-motion reset with a duration above 0 made every changed colour of every element a transition.
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.locator("html")).toHaveAttribute("data-scheme", "light");
    // Switch and count in one task: transitions of 0.01ms would be over before a second evaluate.
    const started = await page.evaluate(() => {
      const root = document.documentElement;
      root.dataset.scheme = "dark";
      root.style.colorScheme = "dark";
      void document.body.offsetHeight;
      return document.getAnimations().length;
    });
    expect(started).toBe(0);
  });

  test("auto follows prefers-color-scheme, also when it changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openApp(page);
    const html = page.locator("html");
    // The start screen already follows the system.
    await expect(html).toHaveAttribute("data-scheme", "dark");
    await expect(html).toHaveCSS("color-scheme", "dark");
    await openExampleFromStart(page);
    await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).toHaveAttribute("data-scheme", "light");
    await expect(html).toHaveCSS("color-scheme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveAttribute("data-scheme", "dark");

    // A fixed mode ignores the system until the mode is auto again.
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(html).toHaveAttribute("data-scheme", "light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveAttribute("data-scheme", "light");
    await expect(html).toHaveCSS("color-scheme", "light");
    await page.getByRole("button", { name: "Auto", exact: true }).click();
    await expect(html).toHaveAttribute("data-scheme", "dark");
    await expect(html).toHaveCSS("color-scheme", "dark");
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

  test("a menu left open while the app gets wide is closed when it gets narrow again", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "More options" })).toBeVisible();
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 420, height: 800 });
    await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "More options" })).toBeHidden();
  });
});

test.describe("German at 375 px", () => {
  test.use({ locale: "de-DE", viewport: { width: 375, height: 700 } });

  test("view switch, Select, undo, redo and More share one line", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const names = ["Kacheln", "Spalten", "Auswählen", "Rückgängig", "Wiederholen", "Mehr"];
    const tops: number[] = [];
    for (const name of names) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      tops.push(Math.round(box!.y));
    }
    expect(new Set(tops).size, `tops ${tops.join(", ")}`).toBe(1);
  });
});

test.describe("shortcuts", () => {
  test.use({ locale: "en-US", viewport: { width: 1100, height: 800 } });

  test("a held key toggles once", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const columns = page.getByRole("button", { name: "Columns", exact: true });
    await page.keyboard.down("v");
    await page.keyboard.down("v"); // auto-repeat: down again without up
    await page.keyboard.up("v");
    await expect(columns).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("v");
    await expect(columns).toHaveAttribute("aria-pressed", "false");

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
    // Shortcuts wait while the modal sheet is open.
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: "Columns", exact: true })).toHaveAttribute("aria-pressed", "false");
    // Tap targets are at least 40 px on touch.
    await page.keyboard.press("Escape");
    const undo = await page.getByRole("button", { name: "Undo", exact: true }).boundingBox();
    expect(undo!.width).toBeGreaterThanOrEqual(40);
    expect(undo!.height).toBeGreaterThanOrEqual(40);
    await page.getByRole("button", { name: "More", exact: true }).tap();
    const weeks = await page.getByRole("checkbox", { name: "Calendar weeks" }).locator("xpath=..").boundingBox();
    expect(weeks!.height).toBeGreaterThanOrEqual(40);
    await expect(page.locator("[popover]:popover-open")).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});
