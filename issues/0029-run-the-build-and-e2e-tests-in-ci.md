---
status: open
priority:
area: build, CI
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Run the build and the end-to-end tests in CI

## Problem

The `ui` branch added `npm run build`, the size limit, the component gallery and `npm run test:e2e` (Playwright in Chromium, Firefox and WebKit, with axe-core and screenshot baselines). The `check` workflow ran none of them. It now builds the app and the gallery, but a CSP violation or a changed screenshot is still found only locally.

## Context

- Issue 0011 set up the `check` workflow and said: "Build and size check are added later with the UI build", and "`e2e` … come with the branches that add … the UI".
- `docs/SPEC.md`, "Build and CI" and the test strategy table.
- The Playwright browsers come from the Nix dev shell (`playwright-driver`); `@playwright/test` must match its version. Chromium runs only without `LD_LIBRARY_PATH` (`playwright.config.ts` strips it).
- Screenshot baselines in `e2e/__screenshots__` were made on the maintainer's machine. WebKit is software-painted there and has no screenshot comparison. Font rendering on a GitHub runner may differ, so the baselines may need a CI-specific set or a tolerance.
- `npm run test:e2e` runs Chromium and Firefox in parallel and WebKit with `--workers=1` (WebKit flaked under parallel load).

## Acceptance criteria

- [x] CI builds the app and the gallery and fails when the HTML exceeds the size limit: two separate steps in the `check` job.
- [ ] The separate `e2e` workflow from `docs/SPEC.md`, "Workflows" (pull requests with the label `e2e`, before every release, otherwise weekly when there were commits) runs the end-to-end tests inside `nix develop .#ci` (the `ci` shell gains what they need), with the same browsers as locally.
- [ ] It is decided how screenshot comparisons work on the runner (shared baselines with a tolerance, runner-made baselines, or screenshots only locally), and the decision is written down.
- [ ] A failing run keeps the Playwright report as an artifact, without secrets and with a short retention.

## Notes

Found while closing the `ui` branch (Task 16 of `docs/superpowers/plans/2026-11-04-ui-main-screen.md`).
