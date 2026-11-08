// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// A day that mandatory leave covers in part (docs/SPEC.md, "Range rules"): setting leave fills the free rest, and
// the cell names both kinds with their shares (docs/SPEC.md, "Day cell: what is shown how").
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openEditedExample } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

test.describe("a half-day closure on Thursday 4 March, in English", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openEditedExample(page, {
      contract: {
        rules: [
          {
            id: "half-closure",
            label: "Half-day closure",
            match: { type: "fixed", month: 3, day: 4 },
            mandatory: "1/2",
            part: "end",
          },
        ],
      },
    });
  });

  test("Space fills the free morning beside the closure", async ({ page }) => {
    const thursday = cell(page, 3, 4);
    await expect(thursday).toHaveAttribute("aria-label", /, mandatory leave half, afternoon, costs ½$/);
    await thursday.focus();
    await page.keyboard.press(" ");
    await expect(thursday).toHaveAttribute("aria-label", /, leave half, morning and mandatory leave half, afternoon, costs 1$/);
    // A second press takes the own leave away again.
    await page.keyboard.press(" ");
    await expect(thursday).toHaveAttribute("aria-label", /, mandatory leave half, afternoon, costs ½$/);
    await expectNoPageProblems(page);
  });

  test("the detail's full-day checkbox sets the same rest, beside the locked closure", async ({ page }) => {
    const thursday = cell(page, 3, 4);
    await thursday.focus();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("dialog", { name: /^Details for / });
    await expect(detail.getByRole("group", { name: "Leave on this day" })).toContainText("Mandatory leave");
    await expect(detail.getByRole("button", { name: "Afternoon", exact: true })).toHaveCount(0);
    await detail.getByRole("checkbox", { name: "Full day" }).click();
    await expect(thursday).toHaveAttribute("aria-label", /, leave half, morning and mandatory leave half, afternoon, costs 1$/);
    await expectNoPageProblems(page);
  });
});
