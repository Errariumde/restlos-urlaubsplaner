// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The allowance panel: figures, the bar with its overdraft, the stretches and the compact layout.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openExampleFromStart } from "./helpers.ts";

import { EXAMPLE_PLANNED_DAYS as PLANNED } from "../tests/fixtures/example-planned.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = await centre(from);
  const end = await centre(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

test.describe("in English at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  test("the example shows its allowance and what the engine computes", async ({ page }) => {
    await expect(page.getByTestId("allowance")).toHaveText("30");
    await expect(page.getByTestId("planned")).toHaveText(String(PLANNED));
    await expect(page.getByTestId("remaining")).toHaveText(String(30 - PLANNED));
    await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", String(PLANNED * 480));
    await expect(page.getByRole("complementary", { name: "Allowance" })).toBeVisible();
    await expectNoPageProblems(page);
  });

  test("dragging five days lowers the remaining figure by five", async ({ page }) => {
    await drag(page, cell(page, 6, 14), cell(page, 6, 18));
    await expect(page.getByTestId("planned")).toHaveText(String(PLANNED + 5));
    await expect(page.getByTestId("remaining")).toHaveText(String(30 - PLANNED - 5));
    await expectNoPageProblems(page);
  });

  test("the stretches and the yearly totals are listed", async ({ page }) => {
    const stretches = page.getByRole("list", { name: "Stretches" });
    await expect(stretches.getByRole("listitem").first()).toContainText(/days? off/);
    await expect(page.getByRole("table", { name: /^Per calendar year/ })).toContainText("2027");
    await expectNoPageProblems(page);
  });

  test("planning past the allowance shows the warning and a value above 30", async ({ page }) => {
    const over = 30 - PLANNED + 2;
    // Eleven weeks of working days in autumn and winter are more than enough; plan week by week.
    let planned = 0;
    for (let week = 0; planned < over; week++) {
      const monday = dayFromYmd(2027, 9, 6) + week * 7;
      await drag(page, page.locator(`[data-day="${String(monday)}"]`), page.locator(`[data-day="${String(monday + 4)}"]`));
      planned += 5;
      await expect(page.getByTestId("planned")).toHaveText(String(PLANNED + planned));
    }
    await expect(page.getByTestId("remaining")).toHaveText(/^[−-]\d/);
    await expect(page.getByText(/days? over the allowance/)).toBeVisible();
    const valuenow = Number(await page.getByRole("meter").getAttribute("aria-valuenow"));
    expect(valuenow).toBeGreaterThan(30 * 480);
    await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /^\d+ of 30 days planned/);
    await expectNoPageProblems(page);
  });
});

/** Scrolls the page until September's last days are on screen, then to the end of the page. */
async function scrollThroughSeptember(page: Page, check: () => Promise<void>): Promise<void> {
  await cell(page, 9, 30).scrollIntoViewIfNeeded();
  await expect(cell(page, 9, 30)).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await check();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await check();
}

// docs/SPEC.md, "Main screen": the allowance display is always visible.
test.describe("the allowance stays in view while the calendar scrolls", () => {
  test.use({ locale: "en-GB" });

  for (const view of ["Tiles", "Columns"] as const) {
    test.describe(`at 1280 px in the ${view.toLowerCase()} view`, () => {
      test.use({ viewport: { width: 1280, height: 600 } });

      test("the sidebar keeps its figures and bar on screen", async ({ page }) => {
        await openApp(page);
        await openExampleFromStart(page);
        await page.getByRole("button", { name: view, exact: true }).click();
        await expect(page.getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-pressed", "true");
        await scrollThroughSeptember(page, async () => {
          await expect(page.getByTestId("remaining")).toBeInViewport({ ratio: 1 });
          await expect(page.getByTestId("planned")).toBeInViewport({ ratio: 1 });
          await expect(page.getByRole("meter")).toBeInViewport({ ratio: 1 });
        });
        await expectNoPageProblems(page);
      });
    });
  }

  test.describe("in a window lower than the sidebar", () => {
    test.use({ viewport: { width: 1280, height: 400 } });

    test("the sidebar scrolls itself and takes the focus for the keyboard", async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      const sidebar = page.getByRole("complementary", { name: "Allowance" });
      await expect(sidebar).toHaveAttribute("tabindex", "0");
      expect(await sidebar.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await sidebar.focus();
      await expect(sidebar).toBeFocused();
      await page.keyboard.press("PageDown");
      // The browsers scroll smoothly: wait for the sidebar to move, not for a time.
      await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expectNoPageProblems(page);
    });
  });

  test.describe("at 375 px", () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test("the compact bar stays at the top and leaves most of the calendar free", async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      const bar = page.getByRole("region", { name: "Allowance" });
      await scrollThroughSeptember(page, async () => {
        await expect(page.getByText(/days? left$/)).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("meter")).toBeInViewport({ ratio: 1 });
        const box = await bar.boundingBox();
        expect(box!.y).toBeLessThanOrEqual(1);
        expect(box!.height).toBeLessThan(800 / 6);
      });
      await expectNoPageProblems(page);
    });

    test("a day reached with the arrows stops below the bar, not under it", async ({ page }) => {
      await openApp(page);
      await openExampleFromStart(page);
      await cell(page, 9, 15).focus();
      // The week above sits just below the top of the window, under the sticky bar.
      await cell(page, 9, 8).evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 10));
      await page.keyboard.press("ArrowUp");
      const focused = cell(page, 9, 8);
      await expect(focused).toBeFocused();
      const bar = await page.getByRole("region", { name: "Allowance" }).boundingBox();
      const box = await focused.boundingBox();
      expect(bar!.y).toBeLessThanOrEqual(1);
      expect(box!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);
      await expectNoPageProblems(page);
    });
  });
});

test.describe("at 600 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 600, height: 800 } });

  test("the compact bar shows and Details expands the panel", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("meter")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Allowance" })).toHaveCount(0);
    const details = page.getByRole("button", { name: "Details", exact: true });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await details.click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("list", { name: "Stretches" })).toBeVisible();
    await details.click();
    await expect(page.getByRole("list", { name: "Stretches" })).toBeHidden();
    await expectNoPageProblems(page);
  });
});

test.describe("when the app narrows", () => {
  test.use({ locale: "en-GB", viewport: { width: 600, height: 800 } });

  test("expanded details do not open the sheet by themselves", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const details = page.getByRole("button", { name: "Details", exact: true });
    await details.click();
    await expect(page.getByRole("list", { name: "Stretches" })).toBeVisible();
    await page.setViewportSize({ width: 400, height: 800 });
    await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(details).toHaveAttribute("aria-expanded", "false");
    // WebKit's harmless "ResizeObserver loop" message under the resize is filtered by the helper.
    await expectNoPageProblems(page);
  });
});

test.describe("at 375 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the page does not scroll sideways", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("meter")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoPageProblems(page);
  });
});

test.describe("at 400 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 400, height: 800 } });

  test("Details opens a sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Allowance" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("list", { name: "Stretches" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expectNoPageProblems(page);
  });
});
