// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The component gallery (dist-gallery/gallery.html, npm run build:gallery): axe on every section in every
// locale and mode, screenshots, and the behaviour of the popover and the sheet. Chromium and Firefox only.
import { expect, test, type Page } from "@playwright/test";
import { allCombinations, MODES, SECTIONS, type Combination } from "../src/gallery/params.ts";
import { axeViolations, expectNoPageProblems, openGallery } from "./helpers.ts";

test.skip(({ browserName }) => browserName === "webkit", "The gallery is checked in Chromium and Firefox.");

/** Opens one combination and waits until its section has rendered (and its popover or sheet is open). */
async function show(page: Page, combination: Combination): Promise<void> {
  await openGallery(page, { ...combination });
  await expect(page.locator("[data-section]")).toHaveAttribute("data-section", combination.section);
  if (combination.section === "main-tiles" || combination.section === "main-columns") await expect(page.getByRole("gridcell").first()).toBeVisible();
  if (combination.section === "selection-bar") await expect(page.locator('[aria-live="polite"]')).not.toHaveText("");
  if (combination.section === "day-detail") await expect(page.getByRole("region")).toHaveCount(7);
  if (combination.section === "popover") await expect(page.locator("[popover]")).toBeVisible();
  if (combination.section === "sheet") await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("every gallery section passes axe", () => {
  // axe is injected as a script, which the gallery's CSP (the app's) would block. Only here: every other
  // test runs the gallery under the real policy, so expectNoPageProblems catches CSP violations.
  test.use({ bypassCSP: true });

  for (const combination of allCombinations()) {
    const { section, locale, mode } = combination;
    test(`${section}, ${locale}, ${mode}`, async ({ page }) => {
      // axe checks every one of the main screen's 365 day cells.
      test.slow(section === "main-tiles" || section === "main-columns");
      await show(page, combination);
      expect(await axeViolations(page)).toEqual([]);
      await expectNoPageProblems(page);
    });
  }
});

test.describe("the gallery screenshots", () => {
  for (const section of SECTIONS) {
    for (const mode of MODES) {
      test(`${section}, ${mode}`, async ({ page }) => {
        await show(page, { section, locale: "de", mode });
        await expect(page).toHaveScreenshot(`${section}-${mode}.png`, { fullPage: true });
      });
    }
  }
});

test.describe("the main screen at the four screen sizes", () => {
  for (const width of [375, 768, 1100, 1920]) {
    test.describe(`${String(width)} px`, () => {
      test.use({ viewport: { width, height: 800 } });

      for (const section of ["main-tiles", "main-columns"] as const) {
        for (const mode of MODES) {
          test(`${section}, ${mode}`, async ({ page }) => {
            await show(page, { section, locale: "de", mode });
            // The section keeps its app at 900 px so the 1280 px screenshot scrolls six columns. Wider
            // windows show the app at their full width: all columns fit from about 1100 px of calendar.
            if (section === "main-columns" && width > 900) {
              await page.addStyleTag({ content: '[data-section="main-columns"] > div { inline-size: auto !important; }' });
              // The style must still reach the section's app, or the screenshot would show the 900 px app.
              const app = await page.locator('[data-section="main-columns"] > div').boundingBox();
              expect(app?.width ?? 0).toBeGreaterThan(900);
            }
            await expect(page).toHaveScreenshot(`${section}-${String(width)}-${mode}.png`, { fullPage: true });
          });
        }
      }
    });
  }
});

test.describe("the main screen in right-to-left text at 1280 px", () => {
  // axe runs on these sections in en-XB in "every gallery section passes axe".
  for (const section of ["main-tiles", "main-columns"] as const) {
    test(`${section}, screenshot`, async ({ page }) => {
      await show(page, { section, locale: "en-XB", mode: "light" });
      await expect(page).toHaveScreenshot(`${section}-rtl-light.png`, { fullPage: true });
    });
  }

  test("in RTL the allowance sidebar is at the visual left", async ({ page }) => {
    await show(page, { section: "main-tiles", locale: "en-XB", mode: "light" });
    const sidebar = await page.getByRole("complementary").boundingBox();
    const calendar = await page.getByRole("main").boundingBox();
    expect(sidebar && calendar).toBeTruthy();
    // The gallery page has its own padding, so "at the left" means left of the calendar, in the left half.
    expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(calendar!.x + 1);
    expect(sidebar!.x).toBeLessThan(page.viewportSize()!.width / 2);
    await expectNoPageProblems(page);
  });
});

test("the day cells mirror their diagonal splits in right-to-left text", async ({ page }) => {
  await show(page, { section: "day-cell", locale: "en-XB", mode: "light" });
  await expect(page).toHaveScreenshot("day-cell-rtl-light.png", { fullPage: true });
});

test("buttons keep a visible border in forced colours", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await show(page, { section: "controls", locale: "de", mode: "light" });
  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  const button = page.getByRole("button", { name: "Speichern", exact: true }).first();
  const width = await button.evaluate((element) => parseFloat(getComputedStyle(element).borderBlockStartWidth));
  expect(width).toBeGreaterThanOrEqual(1);
});

test("the popover opens below its anchor, closes on Escape and gives the focus back", async ({ page, browserName }) => {
  await show(page, { section: "popover", locale: "en", mode: "light" });
  const popover = page.getByRole("dialog", { name: "Day details" });
  const anchor = page.getByRole("button", { name: "Show details" });
  const placement = await popover.getAttribute("data-placement");
  // CSS anchor positioning or the JS fallback: printed so the report can say which browser took which path.
  console.log(`popover placement in ${browserName}: ${placement ?? "none"}`);

  const popoverBox = await popover.boundingBox();
  const anchorBox = await anchor.boundingBox();
  expect(popoverBox && anchorBox && popoverBox.y >= anchorBox.y + anchorBox.height).toBe(true);
  await expect(popover.getByRole("button", { name: "Take the day" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(anchor).toBeFocused();

  await anchor.click();
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "Take the day" }).click();
  await expect(popover).toBeHidden();
  await expect(anchor).toBeFocused();
  await expectNoPageProblems(page);
});

test("the sheet closes by Escape, a backdrop click and its close button", async ({ page }) => {
  await show(page, { section: "sheet", locale: "en", mode: "light" });
  const sheet = page.getByRole("dialog", { name: "Settings" });
  const opener = page.getByRole("button", { name: "Show the sheet" });

  // Docked to the bottom of the window, full width.
  const box = await sheet.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && Math.round(box.y + box.height) === viewport.height && Math.round(box.width) === viewport.width).toBe(true);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(sheet).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(sheet).toBeVisible();
  // A click inside the sheet doesn't close it, nor does a press inside that is released on the backdrop.
  await sheet.getByText("On a phone").click();
  await expect(sheet).toBeVisible();
  const text = await sheet.getByText("On a phone").boundingBox();
  expect(text).not.toBeNull();
  await page.mouse.move(text!.x + 5, text!.y + 5);
  await page.mouse.down();
  await page.mouse.move(10, 10, { steps: 5 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  await expectNoPageProblems(page);
});

test("undo and redo mirror in right-to-left text, other icons don't", async ({ page }) => {
  await show(page, { section: "controls", locale: "en-XB", mode: "light" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const scaleOf = (name: string) =>
    page.getByRole("button", { name, exact: true }).last().locator("svg").evaluate((svg) => getComputedStyle(svg).scale);
  expect(await scaleOf("‮Undo‬")).toBe("-1 1");
  expect(await scaleOf("‮Redo‬")).toBe("-1 1");
  expect(await scaleOf("‮More‬")).toBe("none");
});

test("the overview links to every section in every locale and mode, under the app's CSP", async ({ page }) => {
  await openGallery(page, undefined);
  await expect(page.locator("main a")).toHaveCount(allCombinations().length);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /^default-src 'none'; connect-src 'none';/);
  await expectNoPageProblems(page);
});

test("a checkbox shows its checked value, not the click, until the owner changes it", async ({ page }) => {
  await show(page, { section: "controls", locale: "en", mode: "light" });
  // The first two checkboxes have a constant value (off, on); the click only reaches their owner.
  const boxes = page.getByRole("checkbox", { name: "Calendar weeks" });
  await boxes.nth(0).click();
  await expect(boxes.nth(0)).not.toBeChecked();
  await boxes.nth(1).click();
  await expect(boxes.nth(1)).toBeChecked();
  // The owner did store those clicks: the focus example shows that state (the last click asked for off),
  // and its own click changes it.
  await expect(boxes.nth(2)).not.toBeChecked();
  await boxes.nth(2).click();
  await expect(boxes.nth(2)).toBeChecked();
  await expectNoPageProblems(page);
});
