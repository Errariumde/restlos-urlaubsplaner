// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Where the plan's problems show (docs/SPEC.md, "Problems"): a mark on the day number and the day's label.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openEditedExample } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

test.describe("leave on Saturday 13 February, in English", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openEditedExample(page, { plan: { days: [{ date: "2027-02-13", take: "1" }] } });
  });

  test("the day number is marked and the label says the problem, in both views", async ({ page }) => {
    const saturday = cell(page, 2, 13);
    await expect(saturday).toHaveAttribute("aria-label", /, problem: This leave lies on a day off\.$/);
    await expect(saturday.locator(".problem")).toHaveText("13");
    // The day before has no problem, so neither.
    await expect(cell(page, 2, 12)).not.toHaveAttribute("aria-label", /problem/);
    await expect(cell(page, 2, 12).locator(".problem")).toHaveCount(0);
    await page.getByRole("button", { name: "Columns", exact: true }).click();
    await expect(cell(page, 2, 13).locator(".problem")).toHaveText("13");
    await expectNoPageProblems(page);
  });

  test("the mark goes with the problem", async ({ page }) => {
    const saturday = cell(page, 2, 13);
    await saturday.focus();
    await page.keyboard.press("Delete");
    await expect(saturday).toHaveAttribute("aria-label", /no leave$/);
    await expect(saturday.locator(".problem")).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});
