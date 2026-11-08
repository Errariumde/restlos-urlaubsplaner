// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What a screen reader gets (docs/SPEC.md, "Accessibility"): the accessibility tree of the calendar, the day detail
// and the allowance panel as ARIA snapshots, and the live regions. What a screen reader then says is checked with
// Orca before a release (`npm run orca`, the release checklist); these tests keep the tree from drifting in between.
// The snapshots list only what they check: rows, cells and list items they leave out may come in between.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openEditedExample } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

/**
 * Leave on Saturday 13 February (a problem), half a day in the morning of Tuesday 15 June, all of Wednesday 16 June,
 * and 3 January 2028, after the period (a problem with a remove button).
 */
const PLAN = {
  plan: {
    days: [
      { date: "2027-02-13", take: "1" },
      { date: "2027-06-15", take: "1/2", part: "start" },
      { date: "2027-06-16", take: "1" },
      { date: "2028-01-03", take: "1" },
    ],
  },
};

test.use({ locale: "de-DE" });

test.describe("beside the calendar", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openEditedExample(page, PLAN);
  });

  test("the month tiles are one grid with a row group per month and every day named in full", async ({ page }) => {
    const grid = page.getByRole("grid", { name: "Kalender" });
    await expect(grid.getByRole("rowgroup", { name: "Februar 2027" })).toMatchAriaSnapshot(`
      - rowgroup "Februar 2027":
        - row "Februar 2027":
          - columnheader "Februar 2027":
            - heading "Februar 2027" [level=2]
        - row "KW Mo Di Mi Do Fr Sa So":
          - columnheader "KW"
          - columnheader "Mo"
          - columnheader "Di"
          - columnheader "Mi"
          - columnheader "Do"
          - columnheader "Fr"
          - columnheader "Sa"
          - columnheader "So"
        - row:
          - rowheader "Kalenderwoche 6":
            - button "Kalenderwoche 6"
          - gridcell "Freitag, 12. Februar 2027, Arbeitstag, kein Urlaub"
          - 'gridcell "Samstag, 13. Februar 2027, Wochenende, ganzer Tag Urlaub, Problem: Dieser Urlaub liegt auf einem freien Tag."'
          - gridcell "Sonntag, 14. Februar 2027, Wochenende, kein Urlaub"
    `);
    await expect(grid.getByRole("rowgroup", { name: "Juni 2027" })).toMatchAriaSnapshot(`
      - rowgroup "Juni 2027":
        - row:
          - rowheader "Kalenderwoche 24"
          - gridcell "Dienstag, 15. Juni 2027, Arbeitstag, halber Tag Urlaub, vormittags, kostet ½"
          - gridcell "Mittwoch, 16. Juni 2027, Arbeitstag, ganzer Tag Urlaub, kostet 1"
    `);
    // Holidays by name, another plan's leave with its calendar, a half working day and mandatory leave.
    await expect(grid.getByRole("rowgroup", { name: "Januar 2027" })).toMatchAriaSnapshot(`
      - rowgroup "Januar 2027":
        - row:
          - rowheader "Kalenderwoche 1"
          - gridcell "Montag, 4. Januar 2027, Arbeitstag, Urlaub aus anderem Plan, Kalender Urlaub 2026"
          - gridcell "Mittwoch, 6. Januar 2027, Feiertag Heilige Drei Könige, kein Urlaub"
    `);
    await expect(grid.getByRole("rowgroup", { name: "Dezember 2027" })).toMatchAriaSnapshot(`
      - rowgroup "Dezember 2027":
        - row:
          - rowheader "Kalenderwoche 51"
          - gridcell "Freitag, 24. Dezember 2027, halber Arbeitstag, kein Urlaub"
        - row:
          - rowheader "Kalenderwoche 52"
          - gridcell "Montag, 27. Dezember 2027, Arbeitstag, Pflichturlaub, kostet 1"
    `);
    // One Tab stop for the whole calendar (roving tabindex).
    await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
    await expectNoPageProblems(page);
  });

  test("the month columns have a column per month and a row per day number, with the same names", async ({ page }) => {
    await page.getByRole("button", { name: "Spalten", exact: true }).click();
    await expect(page.getByRole("grid", { name: "Kalender" })).toMatchAriaSnapshot(`
      - grid "Kalender":
        - row:
          - columnheader "Tag"
          - columnheader "Januar"
          - columnheader "Juni"
          - columnheader "Dezember"
        - row:
          - rowheader "15"
          - gridcell "Freitag, 15. Januar 2027, Arbeitstag, kein Urlaub"
          - gridcell "Dienstag, 15. Juni 2027, Arbeitstag, halber Tag Urlaub, vormittags, kostet ½"
    `);
    await expect(page.getByRole("grid", { name: "Kalender" }).locator('[tabindex="0"]')).toHaveCount(1);
    await expectNoPageProblems(page);
  });

  test("the day detail has a mixed checkbox, pressed switches and zero values in words", async ({ page }) => {
    const detail = page.getByRole("dialog", { name: /^Details für / });
    await cell(page, 6, 15).focus();
    await page.keyboard.press("Enter");
    await expect(detail).toMatchAriaSnapshot(`
      - dialog "Details für Dienstag, 15. Juni 2027":
        - heading "Dienstag, 15. Juni 2027" [level=2]
        - paragraph: Soll 1 Tag
        - paragraph: Urlaub ½ Tag
        - checkbox "Ganzer Tag" [checked=mixed]
        - group "Urlaub an diesem Tag":
          - button "vormittags" [pressed]
          - button "nachmittags"
        - paragraph: Kostet ½ Tag
        - paragraph: Restarbeitszeit ½ Tag
        - list "Gründe":
          - listitem: Normaler Arbeitstag
    `);
    await page.keyboard.press("Escape");
    // The dashes of a zero are hidden: a screen reader hears the words instead.
    await cell(page, 6, 17).focus();
    await page.keyboard.press("Enter");
    await expect(detail).toMatchAriaSnapshot(`
      - dialog "Details für Donnerstag, 17. Juni 2027":
        - paragraph: Soll 1 Tag
        - paragraph: Kein Urlaub
        - checkbox "Ganzer Tag" [checked=false]
        - paragraph: Kostet nichts
        - paragraph: Restarbeitszeit 1 Tag
    `);
    await page.keyboard.press("Escape");
    await cell(page, 6, 19).focus();
    await page.keyboard.press("Enter");
    await expect(detail).toMatchAriaSnapshot(`
      - dialog "Details für Samstag, 19. Juni 2027":
        - paragraph: Kein Soll
        - paragraph: Kein Urlaub nötig
        - list "Gründe":
          - listitem: "Normaler Samstag: frei"
    `);
    await page.keyboard.press("Escape");
    await cell(page, 2, 13).focus();
    await page.keyboard.press("Enter");
    await expect(detail).toMatchAriaSnapshot(`
      - dialog "Details für Samstag, 13. Februar 2027":
        - list "Probleme":
          - listitem: Dieser Urlaub liegt auf einem freien Tag.
    `);
    await expectNoPageProblems(page);
  });

  test("the allowance panel names its lists, and the remove button names its day", async ({ page }) => {
    await expect(page.getByRole("complementary", { name: "Kontingent" })).toMatchAriaSnapshot(`
      - complementary "Kontingent":
        - term: Kontingent (Tage)
        - definition: "30"
        - meter "Verplantes Kontingent"
        - heading "Probleme (2)" [level=3]
        - list "Probleme (2)":
          - listitem:
            - 'button "13. Feb.: Dieser Urlaub liegt auf einem freien Tag."'
          - listitem:
            - text: "3. Jan.: Dieser Urlaub liegt außerhalb des Planzeitraums."
            - button "Urlaub entfernen, 3. Jan."
        - heading "Am Stück frei" [level=3]
        - list "Am Stück frei":
          - listitem: "15. Juni – 15. Juni, bis Mittag: ½ Urlaubstag, ½ Tag frei"
        - table "Pro Kalenderjahr (zur Information)"
        - heading "Legende" [level=3]
        - list "Legende":
          - listitem: Urlaub
          - listitem: Problem
          - listitem: Projektphase
    `);
    await expectNoPageProblems(page);
  });

  test("the hint line is the page's one live region and says the result of a change", async ({ page }) => {
    const live = page.locator("[aria-live]");
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toHaveAttribute("aria-atomic", "true");
    await expect(page.getByTestId("hint-line").locator("[aria-live]")).toHaveCount(1);
    // A div, which Firefox reports as a section: Orca 50 lets a live region's text change past its filter for
    // changes that come many at once only from a section, and a change updates many texts at the same time. From a
    // span or a paragraph the result was never spoken.
    expect(await live.evaluate((element) => element.tagName)).toBe("DIV");
    await cell(page, 6, 17).focus();
    await page.keyboard.press("Space");
    await expect(live).toHaveText("17. Juni: ganzer Tag Urlaub. 23½ Tage übrig.");
    await expectNoPageProblems(page);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("the details sheet has a live line of its own beside the hint line", async ({ page }) => {
    await openEditedExample(page, PLAN);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Kontingent" });
    await expect(sheet).toBeVisible();
    await expect(page.locator("[aria-live]")).toHaveCount(2);
    const own = sheet.locator("[aria-live]");
    await expect(own).toHaveAttribute("aria-live", "polite");
    await expect(own).toHaveAttribute("aria-atomic", "true");
    // A div for Orca, as the hint line's.
    expect(await own.evaluate((element) => element.tagName)).toBe("DIV");
    await sheet.getByRole("button", { name: "Urlaub entfernen, 3. Jan." }).click();
    await expect(own).toHaveText("3. Jan.: kein Urlaub. 24½ Tage übrig.");
    await expectNoPageProblems(page);
  });
});
