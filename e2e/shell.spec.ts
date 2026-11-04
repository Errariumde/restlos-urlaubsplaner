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
