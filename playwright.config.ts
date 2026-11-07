// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// End-to-end tests against the built file (npm run test:e2e builds it first). The browsers come from the
// Nix dev shell (PLAYWRIGHT_BROWSERS_PATH). Tests that need a narrower or wider window set their own viewport
// (375, 768, 1100 or 1920 px).
import { defineConfig, devices } from "@playwright/test";

// The config runs in Node; the project has no @types/node.
declare const process: { env: Record<string, string | undefined> };

const viewport = { width: 1280, height: 800 };

// The browsers bring their own libraries. An LD_LIBRARY_PATH from the shell (alsa-lib built against a newer
// glibc) stops Chromium ("GLIBC_2.43 not found") and Firefox ("Couldn't load XPCOM") from starting.
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[0] !== "LD_LIBRARY_PATH" && entry[1] !== undefined),
);

export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  // Screenshot baselines are committed (e2e/__screenshots__/<spec>/<name>-<browser>-<platform>.png).
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  use: { launchOptions: { env } },
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport } },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport } },
    // The dev shell's WebKit paints in software at about two frames a second; with the month tiles on the
    // screen, opening the plan or resizing takes seconds. `npm run test:e2e` runs it alone with one worker
    // after Chromium and Firefox (Ruling Q); parallel runs timed out at random (issue 0025).
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport }, timeout: 90_000, expect: { timeout: 20_000 } },
  ],
});
