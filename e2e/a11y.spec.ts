// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// axe on the built app with the built-in example: the month tiles, the month columns, the detail of a day
// and the selection bar, at 1280 and 375 px, in light and dark. The gallery checks every section in every
// locale (gallery.spec.ts); this checks the screens as they are put together. Chromium and Firefox only.
import { expect, test, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { axeViolations, expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

test.skip(({ browserName }) => browserName === "webkit", "axe runs in Chromium and Firefox.");
// axe is injected as a script, which the app's CSP would block.
test.use({ bypassCSP: true, locale: "de-DE" });

const cell = (page: Page, month: number, day: number) => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

const STATES = ["tiles", "columns", "detail", "selection"] as const;
type State = (typeof STATES)[number];

/** Brings the example into `state`. The app starts in the tiles view. */
async function reach(page: Page, state: State, width: number): Promise<void> {
  switch (state) {
    case "tiles":
      break;
    case "columns":
      await page.getByRole("button", { name: "Spalten", exact: true }).click();
      await expect(page.getByRole("columnheader").first()).toBeVisible();
      break;
    case "detail":
      // A popover at 1280 px, a sheet on the narrow calendar.
      await cell(page, 6, 14).click({ button: "right" });
      await expect(page.getByRole("dialog")).toBeVisible();
      break;
    case "selection": {
      // The Select toggle shows below 800 px (or on a touch screen) and stays while the mode is on.
      if (width >= 800) await page.setViewportSize({ width: 375, height: 800 });
      await page.getByRole("button", { name: "Auswählen", exact: true }).click();
      if (width >= 800) await page.setViewportSize({ width, height: 800 });
      await cell(page, 6, 14).click();
      await expect(page.locator('[aria-selected="true"]')).toHaveCount(1);
      await expect(page.getByRole("region", { name: "Auswahl" })).toBeVisible();
      break;
    }
  }
}

for (const width of [1280, 375]) {
  for (const mode of ["light", "dark"] as const) {
    test.describe(`${String(width)} px, ${mode}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: mode });

      for (const state of STATES) {
        test(`${state} passes axe`, async ({ page }) => {
          // axe checks every one of the 365 day cells.
          test.slow();
          await openApp(page);
          await openExampleFromStart(page);
          await expect(page.getByRole("grid").first()).toBeVisible();
          await reach(page, state, width);
          expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(mode === "dark");
          expect(await axeViolations(page)).toEqual([]);
          await expectNoPageProblems(page);
        });
      }
    });
  }
}
