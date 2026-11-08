// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What the hint line says after a change (docs/SPEC.md, "Calendar interaction"): the changed day's leave or the
// number of changed days, or undo and redo, and the allowance left. It is the one polite live region, so screen
// readers hear the result of every change, by keyboard, mouse or touch. The example plan leaves 8 days.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const hintLine = (page: Page): Locator => page.getByTestId("hint-line");

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("in English at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
  });

  test("a change by keyboard says what the day has now, undo and redo say so too", async ({ page }) => {
    await cell(page, 6, 14).focus();
    await page.keyboard.press(" ");
    await expect(hintLine(page)).toHaveText("14 Jun: leave full. 7 days left.");
    await page.keyboard.press("Control+z");
    await expect(hintLine(page)).toHaveText("Undone. 8 days left.");
    await page.keyboard.press("Control+y");
    await expect(hintLine(page)).toHaveText("Redone. 7 days left.");
    // The words follow the language, also after the change.
    await page.getByRole("button", { name: "DE", exact: true }).click();
    await expect(hintLine(page)).toHaveText("Wiederholt. 7 Tage übrig.");
    await expectNoPageProblems(page);
  });

  test("a click and a drag say what changed", async ({ page }) => {
    await cell(page, 6, 15).click();
    await expect(hintLine(page)).toHaveText("15 Jun: leave full. 7 days left.");
    const from = await centre(cell(page, 6, 21));
    const to = await centre(cell(page, 6, 23));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    // While dragging the line previews on its band; after the release it says the result, quietly.
    await expect(hintLine(page)).toHaveClass(/active/);
    await page.mouse.up();
    await expect(hintLine(page)).toHaveText("3 days changed. 4 days left.");
    await expect(hintLine(page)).not.toHaveClass(/active/);
    await expectNoPageProblems(page);
  });
});

test.describe("on a narrow calendar, in English", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the bottom sheet says the result of its actions itself", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await day.scrollIntoViewIfNeeded();
    await day.click({ button: "right" });
    const sheet = page.getByRole("dialog", { name: /^Details for / });
    await expect(sheet).toBeVisible();
    const status = sheet.locator('[aria-live="polite"]');
    await expect(status).toHaveText("");
    await sheet.getByRole("button", { name: "Full day" }).click();
    await expect(status).toHaveText("14 Jun: leave full. 7 days left.");
    await expectNoPageProblems(page);
  });
});
