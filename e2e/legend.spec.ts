// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The legend at the end of the allowance panel (docs/SPEC.md, "Allowance display"): only what the calendar draws,
// then the calendars; and one style for all the panel's section headings.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openEditedExample, openExampleFromStart } from "./helpers.ts";

const legend = (scope: Page | Locator): Locator => scope.getByRole("list", { name: /^(Legend|Legende)$/ });

/** The example's marks: leave, the company closure (27 to 30 December), the other plan's days in January,
 * weekends, holidays and 24 and 31 December; then its two calendars in the order of the sources. */
const EXAMPLE_ENTRIES = ["Leave", "Mandatory leave", "Leave in another plan", "Weekend", "Holiday", "Half working day", "Project phase", "Leave 2026"];

test.describe("beside the calendar", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test("the legend ends the panel and names what the example has", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const panel = page.getByRole("complementary", { name: "Allowance" });
    await expect(legend(panel).getByRole("listitem")).toHaveText(EXAMPLE_ENTRIES);
    await expect(panel.getByRole("heading").last()).toHaveText("Legend");
    await expectNoPageProblems(page);
  });

  test("the problem mark is in the legend while a day has one", async ({ page }) => {
    await openEditedExample(page, { plan: { days: [{ date: "2027-02-13", take: "1" }] } });
    const entries = legend(page).getByRole("listitem");
    await expect(entries.filter({ hasText: /^\s*Problem\s*$/ })).toHaveCount(1);
    const saturday = page.locator(`[data-day="${String(dayFromYmd(2027, 2, 13))}"]`);
    await saturday.focus();
    await page.keyboard.press("Delete");
    await expect(entries.filter({ hasText: /^\s*Problem\s*$/ })).toHaveCount(0);
    // No own leave is left in the plan, so neither is its entry.
    await expect(entries.filter({ hasText: /^\s*Leave\s*$/ })).toHaveCount(0);
    await expectNoPageProblems(page);
  });

  test("all section headings of the panel look alike", async ({ page }) => {
    await openEditedExample(page, { plan: { days: [{ date: "2027-02-13", take: "1" }] } });
    const panel = page.getByRole("complementary", { name: "Allowance" });
    const looks = await panel.locator("h3, caption").evaluateAll((headings) =>
      headings.map((heading) => {
        const style = getComputedStyle(heading);
        return `${style.fontSize} ${style.fontWeight}`;
      }),
    );
    // Problems, stretches, totals per year, legend.
    expect(looks).toHaveLength(4);
    expect(new Set(looks).size).toBe(1);
    await expectNoPageProblems(page);
  });
});

test.describe("in German", () => {
  test.use({ locale: "de-DE", viewport: { width: 1280, height: 800 } });

  test("the legend uses the German words", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(legend(page).getByRole("listitem")).toHaveText([
      "Urlaub",
      "Pflichturlaub",
      "Urlaub aus anderem Plan",
      "Wochenende",
      "Feiertag",
      "Halber Arbeitstag",
      "Projektphase",
      "Urlaub 2026",
    ]);
    await expectNoPageProblems(page);
  });
});

test.describe("on a phone", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the legend is in the details sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(legend(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Allowance" });
    await expect(legend(sheet).getByRole("listitem")).toHaveText(EXAMPLE_ENTRIES);
    await expectNoPageProblems(page);
  });
});
