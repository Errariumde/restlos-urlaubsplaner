// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, type Page } from "@playwright/test";

/** The file URL of the built app (npm run build). */
export const APP_URL: string = new URL("../dist/restlos-urlaubsplaner.html", import.meta.url).href;

declare global {
  interface Window {
    /** CSP violations of the page, recorded by the init script of `openApp`. */
    __restlosCspViolations?: string[];
    /** axe-core, injected by `axeViolations`. */
    axe: typeof import("axe-core");
  }
}

const AXE_PATH = new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname;

/**
 * Injects axe-core and returns its WCAG 2.2 AA violations for the whole page, one line per node. The page must
 * be opened with `test.use({ bypassCSP: true })`: the app's CSP blocks the injected script.
 */
export async function axeViolations(page: Page): Promise<{ id: string; nodes: string[] }[]> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] });
    return result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary ?? ""}`),
    }));
  });
}

/**
 * WebKit reports this when a layout change under a resize makes a ResizeObserver callback resize again. It is
 * harmless (the notifications arrive in the next frame) and not an error of the app.
 */
const BENIGN_ERRORS = new Set(["ResizeObserver loop completed with undelivered notifications."]);

/** The uncaught errors of each page opened with `openApp` or `openGallery`. */
const pageErrors = new WeakMap<Page, string[]>();

/** The file URL of the built component gallery (npm run build:gallery). */
export const GALLERY_URL: string = new URL("../dist-gallery/gallery.html", import.meta.url).href;

/**
 * Opens `url` and records what `expectNoPageProblems` checks. Every request that isn't `file:` or `blob:`
 * fails the test.
 */
async function open(page: Page, url: string): Promise<void> {
  page.on("request", (request) => {
    const requested = request.url();
    expect.soft(/^(file|blob):/.test(requested), `network request to ${requested}`).toBe(true);
  });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => {
    if (!BENIGN_ERRORS.has(error.message)) errors.push(`${error.name}: ${error.message}`);
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    window.__restlosCspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective} blocked ${event.blockedURI || "inline code"}`);
    });
  });
  await page.goto(url);
}

/**
 * Opens the built app. Every request that isn't `file:` or `blob:` fails the test: the app makes no network
 * request (docs/SPEC.md, "Content Security Policy"). CSP violations and uncaught page errors are recorded
 * for `expectNoPageProblems`.
 */
export async function openApp(page: Page): Promise<void> {
  await open(page, APP_URL);
}

/** Clicks the start screen's only button, which opens the built-in example, and waits for the main screen. */
export async function openExampleFromStart(page: Page): Promise<void> {
  await page.getByRole("button").click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("restlos");
}

/** Opens the built gallery on one section, locale and mode (`?section=…&locale=…&mode=…`), or on the overview. */
export async function openGallery(page: Page, params: { section: string; locale: string; mode: string } | undefined): Promise<void> {
  const search = params ? `?${new URLSearchParams(params).toString()}` : "";
  await open(page, GALLERY_URL + search);
}

/** Fails the test if the page opened with `openApp` or `openGallery` had a CSP violation or an uncaught error. */
export async function expectNoPageProblems(page: Page): Promise<void> {
  const violations = await page.evaluate(() => window.__restlosCspViolations ?? ["the CSP recorder is missing"]);
  expect(violations, "CSP violations").toEqual([]);
  expect(pageErrors.get(page) ?? ["the page wasn't opened with openApp"], "page errors").toEqual([]);
}
