<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Browsers and file URLs

## Supported browsers

The current **Firefox ESR** (153, as of 2026-10-17; ESR 140 received its last update on 2026-09-29, see [Mozilla's release calendar](https://whattrainisitnow.com/calendar/)) and current Firefox, the two newest versions of Chromium browsers (Chrome, Edge) and Safari (macOS, iOS). The ESR is decisive: only browser features available there are used (among others container queries, `<dialog>`, popover, `DecompressionStream`, Web Workers, WebAssembly; checked against the ESR before project start). Vite's `build.target` is set to the current ESR. Playwright's Firefox is a patched Playwright build, not the ESR; ESR compatibility is therefore checked manually with `firefox-esr` from the dev shell.

## Opened from disk

- No `fetch()` on local files: holiday data and images are embedded inline.
