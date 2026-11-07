// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Overlay scrollbars (Firefox on Linux with GTK, macOS, phones) are drawn over the content: the month columns'
// own scrollbar must not cover their last row. Chromium only: it shows overlay scrollbars headless with a feature flag
// (classic-scrollbars.spec.ts explains why Firefox can't).
import { expect, test, type Page } from "@playwright/test";
import { BROWSER_ENV, columnsScroller, expectNoPageProblems, openApp, openExampleFromStart, openGallery } from "./helpers.ts";

test.use({ launchOptions: { env: BROWSER_ENV, ignoreDefaultArgs: ["--hide-scrollbars"], args: ["--enable-features=OverlayScrollbar"] } });

async function expectRowFree(page: Page): Promise<void> {
  await expect(page.getByRole("grid")).toHaveClass(/overlay-scrollbar/);
  const scroller = await columnsScroller(page);
  expect(scroller.scrolls).toBe(true);
  expect(scroller.scrollbar).toBe(0);
  // At least 0.75 rem between the last row and the end of the scroller, where the overlay scrollbar is drawn.
  expect(scroller.roomBelowLastRow).toBeGreaterThanOrEqual(12);
}

test.describe("with overlay scrollbars", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Only Chromium switches its scrollbars by a flag.");

  test.describe("at 900 px", () => {
    test.use({ locale: "en-GB", viewport: { width: 900, height: 900 } });

    test("the scrollbar of the month columns leaves the last row free", async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      await page.getByRole("button", { name: "Columns", exact: true }).click();
      await expectRowFree(page);
      await expectNoPageProblems(page);
    });
  });

  test.describe("in right-to-left text", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("the scrollbar of the month columns leaves the last row free", async ({ page }) => {
      await openGallery(page, { section: "main-columns", locale: "en-XB", mode: "light" });
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectRowFree(page);
      await expectNoPageProblems(page);
    });
  });

  test.describe("at 1920 px", () => {
    test.use({ locale: "en-GB", viewport: { width: 1920, height: 1000 } });

    test("all 12 months fit: no scrollbar, no extra room", async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      await page.getByRole("button", { name: "Columns", exact: true }).click();
      await expect(page.getByRole("grid")).toBeVisible();
      const scroller = await columnsScroller(page);
      expect(scroller.scrolls).toBe(false);
      await expect(page.getByRole("grid")).not.toHaveClass(/overlay-scrollbar/);
      expect(scroller.paddingEnd).toBe(0);
      await expectNoPageProblems(page);
    });
  });
});
