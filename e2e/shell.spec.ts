// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, test } from "@playwright/test";
import { expectNoPageProblems, openApp } from "./helpers.ts";

test("the built file carries the CSP first and makes no network request", async ({ page }) => {
  await openApp(page);
  const first = await page.evaluate(() => document.head.children[1]?.outerHTML ?? "");
  expect(first).toContain('http-equiv="Content-Security-Policy"');
  await expect(page.locator("h1")).toHaveText("restlos");
  // No code path that could reach the network, such as Vite's modulepreload polyfill.
  expect(await page.content()).not.toContain("fetch(");
  await expectNoPageProblems(page);
});

test("the engine worker starts from file://", async ({ page }) => {
  // CSP violations also show up as console errors (in Firefox and Chromium, not as an event in every case).
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await openApp(page);
  // main.ts sets this after the worker answered the opening of the example.
  await expect(page.locator("body")).toHaveAttribute("data-engine", "ready");
  expect(workers).toHaveLength(1);
  expect(workers[0]).toMatch(/^blob:/);
  expect(consoleErrors, "console errors").toEqual([]);
  await expectNoPageProblems(page);
});
