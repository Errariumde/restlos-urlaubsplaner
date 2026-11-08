// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, test } from "@playwright/test";
import { expectNoPageProblems, openApp } from "./helpers.ts";

test.describe("in German", () => {
  test.use({ locale: "de-DE" });

  test("the start screen offers the example and opens it", async ({ page }) => {
    // CSP violations also show up as console errors (in Firefox and Chromium, not as an event in every case).
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const workers: string[] = [];
    page.on("worker", (worker) => workers.push(worker.url()));
    await openApp(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("restlos");
    await expect(page.getByText("Urlaub rund um Feiertage und Brückentage planen")).toBeVisible();
    const buttons = page.getByRole("button");
    await expect(buttons).toHaveCount(1);
    await expect(buttons).toHaveText("Beispiel ansehen");

    await buttons.click();
    const toolbar = page.getByRole("banner");
    await expect(toolbar).toContainText("Beispiel GmbH");
    await expect(toolbar).toContainText("Beispiel – Änderungen werden nicht gespeichert");
    await expect(page.getByRole("button", { name: "Beispiel ansehen" })).toHaveCount(0);

    // The engine worker runs as a classic worker from a blob: URL, without a CSP violation.
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatch(/^blob:/);
    expect(consoleErrors, "console errors").toEqual([]);
    await expectNoPageProblems(page);
  });
});

test("a double click on the example button starts one worker", async ({ page }) => {
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await openApp(page);
  await page.getByRole("button").dblclick();
  await expect(page.getByRole("banner")).toBeVisible();
  expect(workers).toHaveLength(1);
  await expectNoPageProblems(page);
});

test.describe("in English", () => {
  test.use({ locale: "en-US" });

  test("the start screen is in English when the browser is", async ({ page }) => {
    await openApp(page);
    await expect(page.getByText("Vacation planner for bridge days and holidays")).toBeVisible();
    await page.getByRole("button", { name: "View example" }).click();
    await expect(page.getByRole("banner")).toContainText("Example – changes are not saved");
    await expectNoPageProblems(page);
  });
});
