// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The detail popover of a day (docs/SPEC.md, "Detail view"): right-click, Enter, the context-menu key and
// a long press open it; on a narrow calendar or a touch screen it is a bottom sheet.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dayFromYmd } from "../src/engine/days.ts";
import { expectNoPageProblems, openApp, openEditedExample, openExampleFromStart, openGallery, recorded, recordTexts } from "./helpers.ts";

const cell = (page: Page, month: number, day: number): Locator => page.locator(`[data-day="${String(dayFromYmd(2027, month, day))}"]`);
const detail = (page: Page): Locator => page.getByRole("dialog", { name: /^Details for / });

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
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  test("a right-click on 24 Dec shows the required work, its reasons and the day rule's label", async ({ page }) => {
    await cell(page, 12, 24).click({ button: "right" });
    const popover = detail(page);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAccessibleName(/^Details for Friday,? 24 December 2027$/);
    // The line says where the work lies to screen readers; the bar shows it.
    await expect(popover).toContainText("Required work ½ day in the morning");
    await expect(popover.getByRole("list", { name: "Reasons" }).getByRole("listitem")).toHaveText([
      "Normal Friday: 1 day",
      "Christmas Eve: afternoon off (day rule): at most ½ day",
    ]);
    // Nothing else changed: the right-click doesn't toggle the day.
    await expect(cell(page, 12, 24)).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });

  test("the switches set and shrink the leave, each click one undo step; Escape gives the focus back to the cell", async ({ page }) => {
    const day = cell(page, 6, 14);
    await day.click({ button: "right" });
    const popover = detail(page);
    const fullDay = popover.getByRole("checkbox", { name: "Full day" });
    const morning = popover.getByRole("button", { name: "Morning", exact: true });
    const afternoon = popover.getByRole("button", { name: "Afternoon", exact: true });
    await expect(fullDay).toBeFocused();
    await expect(fullDay).not.toBeChecked();
    // At zero the lines show a dash, which screen readers hear in words.
    await expect(popover).toContainText("No leave");
    await expect(popover).toContainText("Costs nothing");
    await morning.click();
    await expect(day).toHaveAttribute("aria-label", /leave half, morning/);
    await expect(morning).toHaveAttribute("aria-pressed", "true");
    await expect(afternoon).toHaveAttribute("aria-pressed", "false");
    await expect(fullDay).toHaveJSProperty("indeterminate", true);
    await expect(popover).toContainText("Costs ½ day");
    // The free half extends the leave to the full day; the morning then shrinks it to the afternoon.
    await afternoon.click();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await expect(fullDay).toBeChecked();
    await morning.click();
    await expect(day).toHaveAttribute("aria-label", /leave half, afternoon/);
    await expect(morning).toHaveAttribute("aria-pressed", "false");
    // The detail stays open and keeps the focus.
    await expect(morning).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(day).toBeFocused();
    await page.keyboard.press("Control+z");
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await expectNoPageProblems(page);
  });

  test("the popover keeps its width when the values in it change", async ({ page }) => {
    const day = cell(page, 6, 14);
    await day.click({ button: "right" });
    const popover = detail(page);
    const width = async (): Promise<number> => (await popover.boundingBox())?.width ?? 0;
    const before = await width();
    await popover.getByRole("checkbox", { name: "Full day" }).click();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    expect(await width()).toBe(before);
    await expectNoPageProblems(page);
  });

  test("the full-day checkbox sets and takes away the whole day", async ({ page }) => {
    const day = cell(page, 6, 14);
    await day.click({ button: "right" });
    const fullDay = detail(page).getByRole("checkbox", { name: "Full day" });
    await fullDay.click();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await expect(fullDay).toBeChecked();
    await fullDay.click();
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(fullDay).not.toBeChecked();
    await expectNoPageProblems(page);
  });

  test("Enter on a focused cell opens the detail, and the context-menu key too", async ({ page }) => {
    const day = cell(page, 1, 4);
    await day.focus();
    await page.keyboard.press("Enter");
    const popover = detail(page);
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("list", { name: "Calendars" })).toHaveText("Leave 2026");
    // Another plan's leave fills the day: the bar shows it as a fixed block, read by its name, with nothing to switch.
    const bar = popover.getByRole("group", { name: "Leave on this day" });
    await expect(bar.getByText("From another plan", { exact: true })).toBeVisible();
    await expect(bar.getByText("Full day: from another plan", { exact: true })).toHaveCount(1);
    await expect(popover.getByRole("checkbox")).toHaveCount(0);
    await expect(popover.getByRole("button")).toHaveCount(0);
    await expect(popover).toContainText("Leave from Leave 2026: counts there");
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(day).toBeFocused();
    await page.keyboard.press("ContextMenu");
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(day).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a day without work has no leave part and says why", async ({ page }) => {
    await cell(page, 6, 19).click({ button: "right" });
    const popover = detail(page);
    await expect(popover).toContainText("No required work");
    await expect(popover).toContainText("No leave needed");
    await expect(popover.getByRole("group", { name: "Leave on this day" })).toHaveCount(0);
    await expect(popover).toContainText("Normal Saturday: off");
    await expectNoPageProblems(page);
  });

  // The popover doesn't shade the calendar (docs/SPEC.md, "Detail view"): a click on a day closes it and acts.
  test("a click on another day closes the detail, plans that day and leaves the focus there", async ({ page }) => {
    await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", /no leave/);
    await cell(page, 6, 14).click({ button: "right" });
    await expect(detail(page)).toBeVisible();
    await cell(page, 2, 2).click();
    await expect(detail(page)).toBeHidden();
    await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", /leave full/);
    await expect(cell(page, 2, 2)).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a click on free space only closes the detail", async ({ page }) => {
    const allowance = page.getByRole("complementary", { name: "Allowance" });
    const before = await allowance.textContent();
    await cell(page, 6, 14).click({ button: "right" });
    await expect(detail(page)).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(detail(page)).toBeHidden();
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-label", /no leave/);
    expect(await allowance.textContent()).toBe(before);
    await expectNoPageProblems(page);
  });

  test("the free afternoon of 24 December is a fixed block", async ({ page }) => {
    await cell(page, 12, 24).focus();
    await page.keyboard.press("ContextMenu");
    const popover = detail(page);
    const bar = popover.getByRole("group", { name: "Leave on this day" });
    await expect(bar.getByRole("button")).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Morning", exact: true })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Afternoon", exact: true })).toHaveCount(0);
    // Screen readers hear the block by its name; the bar shows "off" in the Soll bar's look.
    await expect(bar.getByText("Afternoon: off", { exact: true })).toHaveCount(1);
    await expect(bar.getByText("off", { exact: true })).toBeVisible();
    // The block's fill, and the Soll bar's free block's above it.
    const fill = (element: Element): string => {
      const style = getComputedStyle(element.closest(".block, .locked") ?? element);
      return `${style.backgroundColor} ${style.backgroundImage}`;
    };
    const free = await bar.getByText("off", { exact: true }).evaluate(fill);
    expect(free).not.toBe(await bar.getByRole("button").evaluate(fill));
    expect(free).toBe(await popover.getByText("off", { exact: true }).first().evaluate(fill));
    await expectNoPageProblems(page);
  });

  test("a right-click on another day while the detail is open shows that day", async ({ page }) => {
    await cell(page, 6, 14).click({ button: "right" });
    await expect(detail(page)).toHaveAccessibleName(/^Details for Monday,? 14 June 2027$/);
    await cell(page, 5, 27).click({ button: "right" });
    await expect(detail(page)).toHaveAccessibleName(/^Details for Thursday,? 27 May 2027$/);
    await expect(detail(page)).toContainText("Corpus Christi (public holiday): off");
    await expect(detail(page)).toHaveCount(1);
    await expectNoPageProblems(page);
  });
});

test.describe("the leave bar, in English at 1280 px", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  /** Opens the detail of a day with the context-menu key and gives its leave bar. */
  async function openBar(page: Page, month: number, day: number): Promise<Locator> {
    await cell(page, month, day).focus();
    await page.keyboard.press("ContextMenu");
    return detail(page).getByRole("group", { name: "Leave on this day" });
  }

  test("the leave bar is one Tab stop", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const fullDay = detail(page).getByRole("checkbox", { name: "Full day" });
    await expect(fullDay).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(part("1st sixteenth")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(part("2nd sixteenth")).toBeFocused();
    await page.keyboard.press("End");
    await expect(part("16th sixteenth")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(part("1st sixteenth")).toBeFocused();
    await expect(bar.locator('[tabindex="0"]')).toHaveCount(1);
    // Shift+Tab leaves the bar from its last switch in one step, and Tab comes back to that switch. (Leaving
    // forwards and coming back with Shift+Tab depends on the browser here: the popover is last in the page, and
    // Firefox wraps a Tab there round to the toolbar.)
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Tab");
    await expect(fullDay).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(part("16th sixteenth")).toBeFocused();
    await page.keyboard.press("Home");
    for (let step = 0; step < 12; step++) await page.keyboard.press("ArrowRight");
    await expect(part("13th sixteenth")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("hint-line")).toHaveText(/^14\sJun: leave ¼, at the end of the day\./);
    await expect(part("13th sixteenth")).toHaveAttribute("aria-pressed", "true");
    await expect(part("13th sixteenth")).toBeFocused();
    // One more Tab leaves the bar, from a switch in its middle.
    await page.keyboard.press("Tab");
    expect(await bar.evaluate((element) => element.contains(document.activeElement))).toBe(false);
    await expectNoPageProblems(page);
  });

  /** A value line of the detail by its label ("Costs", "Work left"). */
  const line = (page: Page, name: string): Locator => detail(page).locator("p", { hasText: new RegExp(`^${name}`) });

  /** Presses the mouse on the centre of `from` and moves it to the point `to` in steps, the button still down. */
  async function pressAndMove(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
    const start = await centre(from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
  }

  /** Records every change of a switch's `aria-pressed` or `disabled` in the bar from now on, as the page's `stateChanges`. */
  async function recordStates(bar: Locator): Promise<void> {
    await bar.evaluate((element) => {
      const changes: string[] = [];
      Object.assign(window, { stateChanges: changes });
      new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : undefined;
          changes.push(`${target?.getAttribute("aria-label") ?? ""}: ${record.attributeName ?? ""}`);
        }
      }).observe(element, { attributes: true, attributeFilter: ["aria-pressed", "disabled"], subtree: true });
    });
  }

  const stateChanges = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { stateChanges: string[] }).stateChanges);

  /** Whether a switch is drawn pressed, which in a drag's preview its `aria-pressed` doesn't say. */
  const drawnPressed = /(^|\s)pressed(\s|$)/;

  test("dragging along the bar previews and applies the leave", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const day = cell(page, 6, 14);
    const hintLine = page.getByTestId("hint-line");
    await recordTexts(hintLine.locator("[aria-live]"));
    await recordStates(bar);
    // From the 13th sixteenth (nearer the end, so the leave reaches from the end) to the 9th: half a day.
    await pressAndMove(page, part("13th sixteenth"), await centre(part("9th sixteenth")));
    await expect(line(page, "Costs")).toContainText("½ day");
    await expect(line(page, "Work left")).toContainText("½ day");
    await expect(part("9th sixteenth")).toHaveClass(drawnPressed);
    await expect(part("8th sixteenth")).not.toHaveClass(drawnPressed);
    // Only a preview: nothing is applied, and nothing is said. The switches keep their states, also the focused
    // one the leave now covers in the preview, so screen readers hear no step of the drag.
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    expect(await recorded(page)).toEqual([]);
    await expect(part("13th sixteenth")).toBeFocused();
    await expect(part("13th sixteenth")).toHaveClass(drawnPressed);
    await expect(part("13th sixteenth")).toHaveAttribute("aria-pressed", "false");
    expect(await stateChanges(page)).toEqual([]);
    await page.mouse.up();
    await expect(day).toHaveAttribute("aria-label", /leave half, afternoon/);
    await expect(line(page, "Costs")).toContainText("½ day");
    // The result is said once, and the focus stays on the pressed switch.
    await expect(hintLine).toHaveText(/^14\sJun: leave half, afternoon\./);
    expect(await recorded(page)).toHaveLength(1);
    await expect(part("13th sixteenth")).toBeFocused();
    await expect(part("13th sixteenth")).toHaveAttribute("aria-pressed", "true");
    // One change, one undo step.
    await page.keyboard.press("Escape");
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await undo.click();
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a cancelled drag changes nothing", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const day = cell(page, 6, 14);
    const costs = line(page, "Costs");
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const target = await centre(part("9th sixteenth"));
    // Escape drops the preview and keeps the detail open; the release after it is no press either.
    await pressAndMove(page, part("13th sixteenth"), target);
    await expect(costs).toContainText("½ day");
    await page.keyboard.press("Escape");
    await expect(costs).toContainText("–");
    await expect(part("9th sixteenth")).toHaveAttribute("aria-pressed", "false");
    await page.mouse.up();
    await expect(detail(page)).toBeVisible();
    await expect(costs).toContainText("–");
    await expect(part("13th sixteenth")).toHaveAttribute("aria-pressed", "false");
    // A release outside the detail, below or above it: off the bar the preview is gone already.
    await pressAndMove(page, part("13th sixteenth"), target);
    await expect(costs).toContainText("½ day");
    const box = await detail(page).boundingBox();
    if (!box) throw new Error("The detail has no box");
    const below = box.y + box.height + 30;
    await page.mouse.move(target.x, below < 790 ? below : box.y - 30, { steps: 4 });
    await expect(costs).toContainText("–");
    await page.mouse.up();
    await expect(detail(page)).toBeVisible();
    await expect(costs).toContainText("–");
    await expect(part("13th sixteenth")).toHaveAttribute("aria-pressed", "false");
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a drag past an end of the bar reaches the end part; one off the bar above or below changes nothing", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const day = cell(page, 6, 14);
    const costs = line(page, "Costs");
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const box = await bar.boundingBox();
    if (!box) throw new Error("The bar has no box");
    // From the 6th sixteenth (nearer the start, so the leave reaches from the start) to the 8th: half a day. Below the
    // bar by less than its height it still counts; above it by more than its height it doesn't.
    const eighth = await centre(part("8th sixteenth"));
    await pressAndMove(page, part("6th sixteenth"), eighth);
    await expect(costs).toContainText("½ day");
    await page.mouse.move(eighth.x, box.y + box.height * 1.5, { steps: 2 });
    await expect(costs).toContainText("½ day");
    await page.mouse.move(eighth.x, box.y - box.height * 1.5, { steps: 2 });
    await expect(costs).toContainText("–");
    await page.mouse.up();
    await expect(costs).toContainText("–");
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    // Past the bar's right end, beyond its box: the leave reaches the last part, a full day.
    await pressAndMove(page, part("6th sixteenth"), { x: Math.min(box.x + box.width + 30, 1279), y: box.y + box.height / 2 });
    await expect(costs).toContainText("1 day");
    await expect(part("16th sixteenth")).toHaveClass(drawnPressed);
    await page.mouse.up();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    // One change, one undo step.
    await page.keyboard.press("Escape");
    await undo.click();
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    await expectNoPageProblems(page);
  });

  test("a press that wobbles into the next part by less than 10 px is a press, a longer move a drag", async ({ page }) => {
    await openEditedExample(page, {});
    const bar = await openBar(page, 6, 14);
    const morning = bar.getByRole("button", { name: "Morning", exact: true });
    const day = cell(page, 6, 14);
    const box = await morning.boundingBox();
    if (!box) throw new Error("The morning has no box");
    // Pressed 3 px left of the edge between the halves, let go 5 px right of it: 8 px, still the morning's press.
    const y = box.y + box.height / 2;
    const edge = box.x + box.width;
    await page.mouse.move(edge - 3, y);
    await page.mouse.down();
    await page.mouse.move(edge + 5, y, { steps: 4 });
    await page.mouse.up();
    await expect(day).toHaveAttribute("aria-label", /leave half, morning/);
    // The same press moved 12 px into the afternoon is a drag: from the start through the afternoon, a full day.
    await page.mouse.move(edge - 3, y);
    await page.mouse.down();
    await page.mouse.move(edge + 9, y, { steps: 4 });
    await page.mouse.up();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await expectNoPageProblems(page);
  });

  test("keys press nothing while a pointer is down on the bar", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const day = cell(page, 6, 14);
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const box = await bar.boundingBox();
    if (!box) throw new Error("The bar has no box");
    // In the preview the focused 13th sixteenth is booked and "Full day" mixed; Space on either changes nothing.
    await pressAndMove(page, part("13th sixteenth"), await centre(part("9th sixteenth")));
    await expect(line(page, "Costs")).toContainText("½ day");
    await expect(part("13th sixteenth")).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Shift+Tab");
    await expect(detail(page).getByRole("checkbox", { name: "Full day" })).toBeFocused();
    await page.keyboard.press("Space");
    // Released above the bar by more than its height: the drag ends without a change too.
    await page.mouse.move(box.x + box.width / 2, box.y - box.height * 1.5, { steps: 2 });
    await page.mouse.up();
    await expect(line(page, "Costs")).toContainText("–");
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    // Once the pointer is up, Space presses again.
    await page.keyboard.press("Space");
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await expectNoPageProblems(page);
  });

  test("the focus stays in the bar when the pressed switch goes", async ({ page }) => {
    // Own leave on the free afternoon (a problem): its switch is named like the fixed block it stands for.
    await openEditedExample(page, { plan: { days: [{ date: "2027-12-24", take: "1/2", part: "end" }] } });
    const bar = await openBar(page, 12, 24);
    const free = bar.getByRole("button", { name: "Afternoon: off", exact: true });
    await expect(free).toHaveAttribute("aria-pressed", "true");
    await free.focus();
    await page.keyboard.press("Space");
    await expect(cell(page, 12, 24)).toHaveAttribute("aria-label", /no leave/);
    await expect(bar.getByRole("button", { name: /^Afternoon/ })).toHaveCount(0);
    await expect(bar.getByText("Afternoon: off", { exact: true })).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Morning", exact: true })).toBeFocused();
    await expectNoPageProblems(page);
  });

  /** Whether the focus is on a switch of the bar. */
  const focusOnSwitch = (bar: Locator): Promise<boolean> =>
    bar.evaluate((element) => document.activeElement instanceof HTMLButtonElement && element.contains(document.activeElement));

  // 24 December lies in the last row of the calendar, so in an 800 px window its detail has to open above it. WebKit
  // sometimes opens it below the day instead, past the window's edge, where no scrolling reaches it (issue 0025,
  // browser behaviour left untested by the feasibility run), and the mouse then presses on nothing. In a window tall
  // enough for the detail to fit below the day, every browser opens it there.
  test.describe("in a window tall enough for the detail of 24 December below it", () => {
    test.use({ viewport: { width: 1280, height: 1800 } });

    test("the focus stays in the bar when a drag takes the pressed switch away", async ({ page }) => {
      // Own leave on the free afternoon; dragged from it to the morning, the preview is a full day, under which the
      // free afternoon is a fixed block: the pressed switch is gone while the drag goes on.
      await openEditedExample(page, { plan: { days: [{ date: "2027-12-24", take: "1/2", part: "end" }] } });
      const bar = await openBar(page, 12, 24);
      const free = bar.getByRole("button", { name: "Afternoon: off", exact: true });
      const morning = bar.getByRole("button", { name: "Morning", exact: true });
      await pressAndMove(page, free, await centre(morning));
      await expect(morning).toHaveClass(drawnPressed);
      await expect(morning).toHaveAttribute("aria-pressed", "false");
      await expect(free).toHaveCount(0);
      // Escape brings it back, and the focus with it.
      await page.keyboard.press("Escape");
      await expect(free).toBeFocused();
      await page.mouse.up();
      await expect(free).toBeFocused();
      await expect(cell(page, 12, 24)).toHaveAttribute("aria-label", /leave half/);
      // Released on the morning: the full day is set, and the focus goes to the switch nearest to the gone one.
      await pressAndMove(page, free, await centre(morning));
      await page.mouse.up();
      await expect(line(page, "Leave")).toContainText("1 day");
      await expect(free).toHaveCount(0);
      await expect(morning).toBeFocused();
      await expectNoPageProblems(page);
    });

    test("the focus comes back into the bar after a drag that the preview took the pressed switch from and that changes nothing", async ({ page }) => {
      // Own leave on the free afternoon; dragged onto the morning, the preview is a full day without the pressed switch.
      await openEditedExample(page, { plan: { days: [{ date: "2027-12-24", take: "1/2", part: "end" }] } });
      const bar = await openBar(page, 12, 24);
      const free = bar.getByRole("button", { name: "Afternoon: off", exact: true });
      const morning = bar.getByRole("button", { name: "Morning", exact: true });
      const undo = page.getByRole("button", { name: "Undo", exact: true });
      const box = await bar.boundingBox();
      if (!box) throw new Error("The bar has no box");
      const target = await centre(morning);
      await pressAndMove(page, free, target);
      await expect(free).toHaveCount(0);
      // Off the bar by more than its height: no preview, and the release changes nothing.
      await page.mouse.move(target.x, box.y + box.height * 2.5, { steps: 2 });
      await expect(free).toHaveCount(1);
      await page.mouse.up();
      await settle(page);
      await expect(cell(page, 12, 24)).toHaveAttribute("aria-label", /leave half/);
      await expect(undo).toBeDisabled();
      expect(await focusOnSwitch(bar)).toBe(true);
      await expect(free).toBeFocused();
      await expectNoPageProblems(page);
    });
  });

  test("the focus comes back into the bar after a drag released on the bar that changes nothing", async ({ page }) => {
    // Every Friday works ¾ of a day; on Friday 18 June, in quarters, own ¼ lies on the free rest (a problem) and
    // another plan's leave on the 2nd quarter.
    const week = [{ from: "2026-01-01", required: { mon: "1", tue: "1", wed: "1", thu: "1", fri: "3/4", sat: "0", sun: "0" } }];
    const otherPlan = {
      id: "previous-year",
      name: { de: "Urlaub 2026", en: "Leave 2026" },
      type: "otherPlan",
      color: { slot: "accent-3" },
      visible: true,
      plan: { id: "7005d0ea-dbdf-48e9-a000-d7a22608ca76", name: { de: "Beispiel GmbH", en: "Beispiel GmbH" }, revision: 9 },
      entries: [{ date: "2027-06-18", from: "1/4", to: "1/2", kind: "leave" }],
    };
    await openEditedExample(page, {
      contract: { week, minUnit: "1/4" },
      plan: { days: [{ date: "2027-06-18", take: "1/4", part: "end" }] },
      root: { sources: [otherPlan] },
    });
    const bar = await openBar(page, 6, 18);
    const free = bar.getByRole("button", { name: "4th quarter: off", exact: true });
    const first = bar.getByRole("button", { name: "1st quarter", exact: true });
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    // To the 3rd quarter: the preview books the afternoon, under which the free rest is a fixed block, so the pressed
    // switch goes. On to the 1st quarter: no own leave can reach there across the other plan's, so no preview.
    await pressAndMove(page, free, await centre(bar.getByRole("button", { name: "3rd quarter", exact: true })));
    await expect(free).toHaveCount(0);
    const target = await centre(first);
    await page.mouse.move(target.x, target.y, { steps: 4 });
    await expect(free).toHaveCount(1);
    await page.mouse.up();
    await settle(page);
    await expect(cell(page, 6, 18)).toHaveAttribute("aria-label", /leave ¼/);
    await expect(undo).toBeDisabled();
    expect(await focusOnSwitch(bar)).toBe(true);
    await expect(free).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a press or a drag that loses the window does nothing, also on the release after it", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const day = cell(page, 6, 14);
    const costs = line(page, "Costs");
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const blur = (): Promise<boolean> => page.evaluate(() => window.dispatchEvent(new Event("blur")));
    // Pressed on the 13th sixteenth, the window loses the focus before the button comes up, and some time passes:
    // the click after the release is no press.
    const thirteenth = await centre(part("13th sixteenth"));
    await page.mouse.move(thirteenth.x, thirteenth.y);
    await page.mouse.down();
    await blur();
    await settle(page);
    await page.mouse.up();
    await settle(page);
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    // A drag that loses the window drops its preview, and its release changes nothing.
    await pressAndMove(page, part("13th sixteenth"), await centre(part("9th sixteenth")));
    await expect(costs).toContainText("½ day");
    await blur();
    await expect(costs).toContainText("–");
    await settle(page);
    await page.mouse.up();
    await settle(page);
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expect(undo).toBeDisabled();
    // A new press is one again.
    await part("13th sixteenth").click();
    await expect(day).toHaveAttribute("aria-label", /leave ¼, at the end of the day/);
    await expectNoPageProblems(page);
  });

  test("after a release whose click lands outside the bar, the next click on a switch is a press", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    const box = await bar.boundingBox();
    if (!box) throw new Error("The bar has no box");
    const from = await centre(part("13th sixteenth"));
    const to = await centre(part("9th sixteenth"));
    // A drag made of script events, which brings no click of its own: pressed on the 13th sixteenth, moved to the 9th
    // and released far below the bar, which changes nothing.
    await part("13th sixteenth").dispatchEvent("pointerdown", { pointerId: 9, isPrimary: true, button: 0, clientX: from.x, clientY: from.y, bubbles: true });
    const onWindow = (type: string, point: { x: number; y: number }): Promise<boolean> =>
      page.evaluate(([name, x, y]) => window.dispatchEvent(new PointerEvent(name, { pointerId: 9, isPrimary: true, clientX: x, clientY: y, bubbles: true })), [type, point.x, point.y] as const);
    await onWindow("pointermove", to);
    await expect(line(page, "Costs")).toContainText("½ day");
    await onWindow("pointerup", { x: to.x, y: box.y + box.height * 4 });
    await expect(line(page, "Costs")).toContainText("–");
    // Its click lands outside the bar. Then a switch gets a click with neither a pointer pressed on the bar nor a key, as
    // an assistive technology's default action gives it: that is a press.
    await page.evaluate(() => {
      document.body.click();
    });
    await part("13th sixteenth").evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-label", /leave ¼, at the end of the day/);
    await expectNoPageProblems(page);
  });

  test("a press on the free rest of a ¾ day takes the leave there away and keeps the focus on the afternoon", async ({ page }) => {
    // Every Friday works ¾ of a day; own ¼ at the end of Friday 18 June lies only on its free rest (a problem).
    const week = [{ from: "2026-01-01", required: { mon: "1", tue: "1", wed: "1", thu: "1", fri: "3/4", sat: "0", sun: "0" } }];
    await openEditedExample(page, { contract: { week }, plan: { days: [{ date: "2027-06-18", take: "1/4", part: "end" }] } });
    const bar = await openBar(page, 6, 18);
    const free = bar.getByRole("button", { name: "Afternoon: off", exact: true });
    await expect(free).toHaveAttribute("aria-pressed", "true");
    await free.click();
    await expect(cell(page, 6, 18)).toHaveAttribute("aria-label", /no leave/);
    await expect(free).toHaveCount(0);
    await expect(bar.getByText("Afternoon: off", { exact: true })).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Afternoon", exact: true })).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("a preview that fails shows the day's own values in the lines, and the release still applies the drag", async ({ page }) => {
    // The engine worker refuses every preview message from the moment the page sets `failPreviews`. The page records
    // what it logs as an error (the message of an Error) and the rejections nothing handled.
    await page.addInitScript(() => {
      const rejections: string[] = [];
      const logged: string[] = [];
      Object.assign(window, { rejections, logged, failPreviews: false });
      window.addEventListener("unhandledrejection", (event) => rejections.push(String(event.reason)));
      const log = console.error.bind(console);
      console.error = (...args: unknown[]): void => {
        logged.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "));
        log(...args);
      };
      const post = Reflect.get(Worker.prototype, "postMessage") as (this: Worker, message: unknown, options?: unknown) => void;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: unknown): void {
        const fail = (window as unknown as { failPreviews: boolean }).failPreviews;
        if (fail && (message as { type?: unknown } | null)?.type === "preview") throw new Error("No preview");
        post.call(this, message, options);
      };
    });
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const bar = await openBar(page, 6, 14);
    const part = (name: string): Locator => bar.getByRole("button", { name, exact: true });
    // The engine gives the preview of half a day: the lines show it.
    await pressAndMove(page, part("13th sixteenth"), await centre(part("9th sixteenth")));
    await expect(line(page, "Costs")).toContainText("½ day");
    await expect(line(page, "Work left")).toContainText("½ day");
    // From now on it fails. The drag goes on to ¾ of a day: the bar draws it, and the lines go back to the day's own
    // values instead of keeping the half day's.
    await page.evaluate(() => Object.assign(window, { failPreviews: true }));
    const fifth = await centre(part("5th sixteenth"));
    await page.mouse.move(fifth.x, fifth.y, { steps: 4 });
    await expect(part("5th sixteenth")).toHaveClass(drawnPressed);
    await expect(line(page, "Costs")).toContainText("–");
    await expect(line(page, "Work left")).toContainText("1 day");
    await page.mouse.up();
    await expect(cell(page, 6, 14)).toHaveAttribute("aria-label", /leave ¾, at the end of the day/);
    await expect(line(page, "Costs")).toContainText("¾ day");
    await settle(page);
    // The error is logged, and no rejection is left unhandled.
    const recorded = await page.evaluate(() => {
      const { rejections, logged } = window as unknown as { rejections: string[]; logged: string[] };
      return { rejections, logged };
    });
    expect(recorded.logged).toContain("No preview");
    expect(recorded.rejections).toEqual([]);
    await expectNoPageProblems(page);
  });
});

test.describe("on a Mac", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test("Ctrl+click opens the detail and doesn't toggle the day", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", { get: () => "MacIntel" });
    });
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await day.click({ modifiers: ["Control"] });
    await expect(detail(page)).toBeVisible();
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });
});

test.describe("on a narrow calendar", () => {
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 } });

  test("the detail is a bottom sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await day.scrollIntoViewIfNeeded();
    await day.click({ button: "right" });
    const sheet = detail(page);
    await expect(sheet).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await sheet.getByRole("checkbox", { name: "Full day" }).click();
    await expect(day).toHaveAttribute("aria-label", /leave full/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(day).toBeFocused();
    await expectNoPageProblems(page);
  });
});

/** Holds a finger on the cell until the detail shows (the long press fires after 500 ms), then lifts it. */
async function longPress(page: Page, day: Locator): Promise<void> {
  await day.scrollIntoViewIfNeeded();
  const box = await day.boundingBox();
  if (!box) throw new Error("The cell has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await expect(detail(page)).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Lets pending timers and two frames run, so that something that would open has opened. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))),
  );
}

test.describe("on a touch screen", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Touch is emulated in Chromium only.");
  test.use({ locale: "en-GB", viewport: { width: 375, height: 800 }, hasTouch: true });

  test("a long press opens the detail sheet", async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    const day = cell(page, 6, 14);
    await longPress(page, day);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await expectNoPageProblems(page);
  });

  test("a finger drags along the leave bar instead of scrolling the sheet", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const day = cell(page, 6, 14);
    await longPress(page, day);
    const sheet = detail(page);
    const bar = sheet.getByRole("group", { name: "Leave on this day" });
    const from = await centre(bar.getByRole("button", { name: "13th sixteenth", exact: true }));
    const to = await centre(bar.getByRole("button", { name: "9th sixteenth", exact: true }));
    // Real touch input: the browser's own capture of the finger and its choice between panning and dragging.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * step) / 6, y: from.y }] });
    }
    await expect(sheet.locator("p", { hasText: /^Costs/ })).toContainText("½ day");
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(day).toHaveAttribute("aria-label", /leave half, afternoon/);
    await expectNoPageProblems(page);
  });

  test("a finger moved up or down on the leave bar previews nothing and changes nothing", async ({ page }) => {
    await openEditedExample(page, { contract: { minUnit: "1/16" } });
    const day = cell(page, 6, 14);
    await longPress(page, day);
    const sheet = detail(page);
    const bar = sheet.getByRole("group", { name: "Leave on this day" });
    const costs = sheet.locator("p", { hasText: /^Costs/ });
    // The switches a preview draws pressed (by their class: their `aria-pressed` stays as the bar is during a drag).
    const drawn = bar.locator("button.pressed");
    const from = await centre(bar.getByRole("button", { name: "13th sixteenth", exact: true }));
    // The browser pans (the switch allows panning up and down) and so cancels the pointer; with panning not allowed
    // it would keep sending the pointer's moves to the bar.
    await page.evaluate(() => {
      Object.assign(window, { pointerCancels: 0 });
      window.addEventListener("pointercancel", () => Object.assign(window, { pointerCancels: (window as unknown as { pointerCancels: number }).pointerCancels + 1 }), true);
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x, y: from.y - step * 20 }] });
      await expect(costs).toContainText("–");
      await expect(drawn).toHaveCount(0);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settle(page);
    expect(await page.evaluate(() => (window as unknown as { pointerCancels: number }).pointerCancels)).toBe(1);
    await expect(costs).toContainText("–");
    await expect(drawn).toHaveCount(0);
    await expect(day).toHaveAttribute("aria-label", /no leave/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expectNoPageProblems(page);
  });
});

test.describe("on a wide touch screen with a mouse as the primary pointer", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Touch is emulated in Chromium only.");
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 }, hasTouch: true });

  test("a long press opens the sheet, which stays open after the finger lifts", async ({ page }) => {
    // A touch laptop: the primary pointer is fine, so only the touch itself can ask for the sheet.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => original(query.replace("pointer: coarse", "pointer: none"));
    });
    await openApp(page);
    await openExampleFromStart(page);
    await longPress(page, cell(page, 6, 14));
    await settle(page);
    await expect(detail(page)).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expectNoPageProblems(page);
  });
});

test.describe("a detail waiting for its button's release", () => {
  test.use({ locale: "en-GB", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openExampleFromStart(page);
    await expect(page.getByRole("grid", { name: "Calendar" })).toBeVisible();
  });

  /** A contextmenu on the press, as Linux and macOS send it: the right button is still down. */
  async function pressContextMenu(page: Page, day: Locator, pointerId: number): Promise<void> {
    await day.evaluate((element, id) => {
      element.dispatchEvent(new PointerEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, buttons: 2, pointerId: id }));
    }, pointerId);
  }

  const release = (page: Page, pointerId: number) =>
    page.evaluate((id) => window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: id })), pointerId);

  test("opens on the release of its own pointer only", async ({ page }) => {
    await pressContextMenu(page, cell(page, 6, 14), 7);
    await release(page, 3);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);
    await release(page, 7);
    await expect(detail(page)).toBeVisible();
    await expectNoPageProblems(page);
  });

  test("Escape, a cancelled pointer or leaving the window stops the wait", async ({ page }) => {
    const day = cell(page, 6, 14);
    await pressContextMenu(page, day, 7);
    await page.keyboard.press("Escape");
    await release(page, 7);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);

    await pressContextMenu(page, day, 8);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 8 })));
    await release(page, 8);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);

    await pressContextMenu(page, day, 9);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await release(page, 9);
    await settle(page);
    await expect(detail(page)).toHaveCount(0);
    await expectNoPageProblems(page);
  });
});

test.describe("in right-to-left text", () => {
  test.skip(({ browserName }) => browserName === "webkit", "The gallery is checked in Chromium and Firefox.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("in RTL the arrow keys move through the leave bar in the reading direction", async ({ page }) => {
    await openGallery(page, { section: "day-detail", locale: "en-XB", mode: "light" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The bar of the first day in quarters: its first quarter lies at the right.
    const quarters = page.locator("section", { has: page.getByRole("heading", { name: /Leave in quarters/ }) });
    const bar = quarters.getByRole("group").first();
    const first = bar.getByRole("button", { name: /1st quarter/ });
    const second = bar.getByRole("button", { name: /2nd quarter/ });
    expect((await first.boundingBox())!.x).toBeGreaterThan((await second.boundingBox())!.x);
    await first.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(second).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(first).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(second).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(first).toBeFocused();
    await expectNoPageProblems(page);
  });

  test("in RTL the popover opens toward the inline end and stays on screen", async ({ page }) => {
    await openGallery(page, { section: "main-tiles", locale: "en-XB", mode: "light" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const tiles = page.getByRole("rowgroup");
    await expect(tiles.first()).toBeVisible();
    // The leftmost tile of the first row.
    const lefts = await tiles.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
    const firstRow = lefts.filter((box) => Math.abs(box.y - lefts[0]!.y) < 1);
    const leftmost = firstRow.indexOf(firstRow.reduce((a, b) => (b.x < a.x ? b : a)));
    // A Wednesday in the middle of the tile, so the cell sits near the tile's left edge only by its column.
    const target = tiles.nth(leftmost).getByRole("gridcell").nth(9);
    await target.click({ button: "right" });
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    const cellBox = await target.boundingBox();
    const viewport = page.viewportSize();
    expect(box && cellBox && viewport).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    // Toward the inline end (the left): the right edges line up, unless there was no room on the left.
    const cellRight = cellBox!.x + cellBox!.width;
    const flipped = cellRight - box!.width < 0;
    expect(flipped || box!.x + box!.width <= cellRight + 1).toBe(true);
    await expectNoPageProblems(page);
  });
});
