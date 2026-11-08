// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The smallest leave unit (docs/file-format.md, "Smallest leave unit"): a plan that counts leave in whole days
// offers no half day anywhere, and H says so in the hint line instead of doing nothing silently.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openEditedExample } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

test.describe("a plan in whole days, in English", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1" } });
  });

  test("H sets nothing and the hint line says why", async ({ page }) => {
    const monday = cell(page, 6, 14);
    await monday.focus();
    await page.keyboard.press("h");
    await expect(page.getByTestId("hint-line")).toHaveText("This plan has no half days.");
    await expect(monday).toHaveAttribute("aria-label", /no leave/);
    // H again: the same words, but a new text for the live region (a trailing no-break space), so screen
    // readers announce it again.
    const live = page.locator('[aria-live="polite"]');
    const first = await live.textContent();
    await page.keyboard.press("h");
    await expect.poll(() => live.textContent()).not.toBe(first);
    await expect(page.getByTestId("hint-line")).toHaveText("This plan has no half days.");
    // Space still sets a full day, and the message gives way.
    await page.keyboard.press(" ");
    await expect(monday).toHaveAttribute("aria-label", /leave full/);
    await expect(page.getByTestId("hint-line")).toHaveText("14 Jun: leave full. 7 days left.");
    await expectNoPageProblems(page);
  });

  test("the detail offers a full day but no half day", async ({ page }) => {
    await cell(page, 6, 14).focus();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("dialog", { name: /^Details for / });
    await expect(detail.getByRole("button", { name: "Full day", exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: /^Half day/ })).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});

test.describe("a plan in whole days, in the selection mode at 700 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 700, height: 800 } });

  test("the selection bar has no half day", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1" } });
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const bar = page.getByRole("region", { name: "Selection" });
    await expect(bar.getByRole("button", { name: "Full day", exact: true })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Half day", exact: true })).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});
