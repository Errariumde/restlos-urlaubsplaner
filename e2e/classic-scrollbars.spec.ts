// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Classic scrollbars take their own room below the content: the month columns get no extra gap for them
// (overlay-scrollbars.spec.ts has the other case). Chromium only: Playwright hides the scrollbars of headless
// Chromium with a flag that can be left out; Playwright's Firefox hides them with a user-agent style sheet
// (`scrollbar-width: none !important`) that a page can't undo.
import { expect, test } from "@playwright/test";
import { BROWSER_ENV, columnsScroller, expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

test.use({ launchOptions: { env: BROWSER_ENV, ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.describe("with classic scrollbars at 900 px", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Only Chromium can show its scrollbars headless.");
  test.use({ locale: "en-GB", viewport: { width: 900, height: 900 } });

  test("the month columns get no extra gap below their last row", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "Columns", exact: true }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    const scroller = await columnsScroller(page);
    expect(scroller.scrolls).toBe(true);
    expect(scroller.scrollbar).toBeGreaterThan(0);
    await expect(page.getByRole("grid")).not.toHaveClass(/overlay-scrollbar/);
    expect(scroller.paddingEnd).toBe(0);
    await expectNoPageProblems(page);
  });
});
