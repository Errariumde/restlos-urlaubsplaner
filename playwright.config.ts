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
    // The dev shell's WebKit has no GPU. Through Mesa's software renderer (llvmpipe) it painted at about two
    // frames a second and crashed about once every four tests, in llvmpipe or with an abort; Skia painting on
    // the CPU (WEBKIT_SKIA_ENABLE_CPU_RENDERING) avoids both: all WebKit tests took 3.6 instead of 22.6 minutes,
    // without a crash (2026-11-08). `npm run test:e2e` still runs WebKit alone with one worker after Chromium
    // and Firefox, with longer timeouts; parallel runs had timed out at random (issue 0025, browser behaviour
    // left untested by the feasibility run). The test:e2e scripts start with `ulimit -c 0`: with
    // systemd-coredump, every crash wrote a dump that took up to two minutes and slowed the whole machine. Set
    // it yourself before calling `playwright test` directly.
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport, launchOptions: { env: { ...env, WEBKIT_SKIA_ENABLE_CPU_RENDERING: "1" } } },
      timeout: 90_000,
      expect: { timeout: 20_000 },
    },
  ],
});
