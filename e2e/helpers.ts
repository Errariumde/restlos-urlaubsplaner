// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, type Page } from "@playwright/test";

/** The file URL of the built app (npm run build). */
export const APP_URL: string = new URL("../dist/restlos-urlaubsplaner.html", import.meta.url).href;

/**
 * Opens the built app. Every request that isn't `file:` or `blob:` fails the test: the app makes no network
 * request (docs/SPEC.md, "Content Security Policy").
 */
export async function openApp(page: Page): Promise<void> {
  page.on("request", (request) => {
    const url = request.url();
    expect.soft(/^(file|blob):/.test(url), `network request to ${url}`).toBe(true);
  });
  await page.goto(APP_URL);
}
