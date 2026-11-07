// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, type Page } from "@playwright/test";

/** The file URL of the built app (npm run build). */
export const APP_URL: string = new URL("../dist/restlos-urlaubsplaner.html", import.meta.url).href;

declare global {
  interface Window {
    /** CSP violations of the page, recorded by the init script of `openApp`. */
    __restlosCspViolations?: string[];
  }
}

/** The uncaught errors of each page opened with `openApp`. */
const pageErrors = new WeakMap<Page, string[]>();

/**
 * Opens the built app. Every request that isn't `file:` or `blob:` fails the test: the app makes no network
 * request (docs/SPEC.md, "Content Security Policy"). CSP violations and uncaught page errors are recorded
 * for `expectNoPageProblems`.
 */
export async function openApp(page: Page): Promise<void> {
  page.on("request", (request) => {
    const url = request.url();
    expect.soft(/^(file|blob):/.test(url), `network request to ${url}`).toBe(true);
  });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  await page.addInitScript(() => {
    const violations: string[] = [];
    window.__restlosCspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective} blocked ${event.blockedURI || "inline code"}`);
    });
  });
  await page.goto(APP_URL);
}

/** Fails the test if the page opened with `openApp` had a CSP violation or an uncaught error. */
export async function expectNoPageProblems(page: Page): Promise<void> {
  const violations = await page.evaluate(() => window.__restlosCspViolations ?? ["the CSP recorder is missing"]);
  expect(violations, "CSP violations").toEqual([]);
  expect(pageErrors.get(page) ?? ["the page wasn't opened with openApp"], "page errors").toEqual([]);
}
