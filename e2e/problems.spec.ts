// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Where the plan's problems show (docs/SPEC.md, "Problems"): a mark on the day number, the day's label and the list
// in the allowance panel, whose rows open the day's detail.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openEditedExample, openExampleFromStart } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const detail = (page: Page): Locator => page.getByRole("dialog", { name: /^Details for / });
const problemList = (page: Page): Locator => page.getByRole("list", { name: /^Problems \(\d+\)$/ });

/** Leave on Saturday 13 February (a day off) and on 3 January 2028, after the plan period. */
const TWO_PROBLEMS = {
  plan: {
    days: [
      { date: "2027-02-13", take: "1" },
      { date: "2028-01-03", take: "1" },
    ],
  },
};

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

test.describe("the problems list beside the calendar", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test("lists the problems by day; a day in the calendar opens its detail", async ({ page }) => {
    await openEditedExample(page, TWO_PROBLEMS);
    const list = problemList(page);
    await expect(list).toHaveAccessibleName("Problems (2)");
    await expect(list.getByRole("listitem")).toHaveText([
      /^13 Feb\S*: This leave lies on a day off\.$/,
      /^3 Jan\S*: This leave lies outside the plan period\.\s+Remove leave$/,
    ]);
    // The day after the period is not in the calendar: its row offers to remove the leave instead.
    await expect(list.getByRole("button")).toHaveCount(2);
    await list.getByRole("button", { name: /^13 Feb/ }).click();
    await expect(detail(page)).toHaveAccessibleName(/^Details for Saturday,? 13 February 2027$/);
    await expect(detail(page)).toContainText("This leave lies on a day off.");
    await page.keyboard.press("Escape");
    await expect(detail(page)).toBeHidden();
    await expect(cell(page, 2, 13)).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("is not there without problems", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("list", { name: "Stretches" })).toBeVisible();
    await expect(problemList(page)).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});

test.describe("the problems in the compact bar", () => {
  test.use({ locale: "en-GB", viewport: { width: 700, height: 800 } });

  test("the bar counts them; a row in the details closes them and opens the day's detail", async ({ page }) => {
    await openEditedExample(page, TWO_PROBLEMS);
    const bar = page.getByRole("region", { name: "Allowance" });
    await expect(bar).toContainText("2 problems");
    const details = page.getByRole("button", { name: "Details", exact: true });
    await details.click();
    await problemList(page).getByRole("button", { name: /^13 Feb/ }).click();
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(detail(page)).toHaveAccessibleName(/^Details for Saturday,? 13 February 2027$/);
    await expect(cell(page, 2, 13)).toBeInViewport();
    await expectNoPageProblems(page);
  });
});

test.describe("the problems on a phone", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("a row in the details sheet closes it and opens the day's sheet", async ({ page }) => {
    await openEditedExample(page, TWO_PROBLEMS);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Allowance" });
    await sheet.getByRole("button", { name: /^13 Feb/ }).click();
    await expect(sheet).toBeHidden();
    await expect(detail(page)).toHaveAccessibleName(/^Details for Saturday,? 13 February 2027$/);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(detail(page)).toBeHidden();
    await expect(cell(page, 2, 13)).toBeFocused();
    // Closed by a key, so the day shows the focus ring; Firefox wouldn't show it after the dialog's own refocus.
    await expect.poll(() => cell(page, 2, 13).evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await expect(cell(page, 2, 13)).toBeInViewport();
    await expectNoPageProblems(page);
  });
});

test.describe("leave outside the plan period", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test("its row removes the leave in one undo step, and the focus goes to the row in its place", async ({ page }) => {
    await openEditedExample(page, TWO_PROBLEMS);
    const list = problemList(page);
    await list.getByRole("button", { name: /^Remove leave, 3\sJan$/ }).click();
    await expect(list).toHaveAccessibleName("Problems (1)");
    await expect(list.getByRole("button", { name: /^13 Feb/ })).toBeFocused();
    // The plan's own leave costs nothing; the company closure (27 to 30 December) takes 4 of the 30 days.
    await expect(page.getByTestId("hint-line")).toHaveText("3 Jan: no leave. 26 days left.");
    await page.keyboard.press("Control+z");
    await expect(problemList(page)).toHaveAccessibleName("Problems (2)");
    await expectNoPageProblems(page);
  });

  test("removing the last problem, far from the period, leaves the focus on the stretches heading", async ({ page }) => {
    // More than a year after the period, where the engine computes no day.
    await openEditedExample(page, { plan: { days: [{ date: "2029-01-03", take: "1" }] } });
    await problemList(page).getByRole("button", { name: /^Remove leave, 3\sJan$/ }).click();
    await expect(problemList(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Stretches" })).toBeFocused();
    await expect(page.getByTestId("hint-line")).toHaveText("3 Jan: no leave. 26 days left.");
    await expectNoPageProblems(page);
  });
});

test.describe("leave outside the plan period on a phone", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the details sheet stays open and says the result in its own line", async ({ page }) => {
    await openEditedExample(page, TWO_PROBLEMS);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Allowance" });
    await sheet.getByRole("button", { name: /^Remove leave/ }).click();
    await expect(sheet).toBeVisible();
    await expect(problemList(page)).toHaveAccessibleName("Problems (1)");
    await expect(sheet.locator('[aria-live="polite"]')).toHaveText("3 Jan: no leave. 26 days left.");
    await expect(sheet.getByRole("button", { name: /^13 Feb/ })).toBeFocused();
    await expectNoPageProblems(page);
  });
});
