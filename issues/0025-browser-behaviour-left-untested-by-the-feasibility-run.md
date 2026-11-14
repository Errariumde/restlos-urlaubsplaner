---
status: open
priority:
area: UI
branch:
created: 2026-11-02
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Browser behaviour left untested by the feasibility run

## Problem

The version 1 feasibility tests ran automated and headless (2026-11-02). Some behaviour needs real dialogs, a person's eyes or a platform the run didn't have. `docs/SPEC.md` relies on documentation or a safe default for these, and the UI branch should check them once the real UI exists.

## Context

`docs/feasibility.md`, section "Not tested" and the rows marked so. The calendar test (I4, `UID`s in Nextcloud's trash bin) is tracked in issue 0010 (iCal import and export).

## Acceptance criteria

Each point below is checked in the browsers named, and `docs/SPEC.md` is updated where the result differs from what it assumes:

- **S7, Chromium:** saving back into the opened file from `file://`; whether a kept file handle still writes after a reload; whether a permission granted to one local file covers other local files. Until then the spec keeps no file handle for a restored plan.
- **Ctrl+O, Firefox ESR:** the app's Open dialog, with Enter on the focused "Choose file…" button, opens the file picker.
- **K3, Firefox:** Ctrl+S and Ctrl+O with "Override Keyboard Shortcuts" set to Block: the buttons still work.
- **K4, all browsers:** a file dropped outside a drop zone doesn't navigate away.
- **S8, Firefox:** the download name with "Always ask where to save files".
- **`navigator.storage.persist()`:** whether a prompt appears (Firefox, Chromium).
- **A real move or rename of the HTML file in Firefox** starts with empty storage (the run only used a copy).
- **Safari (macOS) and iOS:** storage on `file://`, and the Pages version's offline mode.
- **Private windows:** the app works with empty or throwing storage.
- **Safari, mouse drag at compact widths:** the hint line now keeps a one-line slot and a longer text grows over the calendar, so the cells stay in place when a drag makes it wrap (`e2e/allowance.spec.ts`, "a hint that wraps at 375 px", passes in the dev shell's WebKit). Before, the sticky region grew and the calendar moved down: Chromium kept the cells in place with scroll anchoring, Firefox only on a scrolled page and not at its very top, and WebKit not at all (seen 2026-11-04 and 2026-11-08). Check once in a real Safari that the cells stay under the pointer.
- **Safari, the day detail of a day near the bottom of the page:** the popover is placed with CSS anchor positioning, below the day, and `position-try-fallbacks: flip-block` should flip it above when it doesn't fit (`src/ui/controls/Popover.svelte`). In the dev shell's WebKit it sometimes stays below, past the window's edge, where no scrolling reaches it, because the page is already scrolled to its end. Seen 2026-11-09 on `main` and on the branch `leave-on-working-time`: example plan at 1280 × 800, 24 December 2027 (last row of the tiles) focused, context-menu key. The detail opened below in 4 of 6 runs with the example as it is, in 1 to 5 of 6 with own leave added on that day. It stayed there for 1.5 s and more. In a window of 1280 × 1600 it opened above in 8 of 8 runs. Chromium and Firefox flip it every time. Check in a real Safari. If it happens there too, the popover needs a fallback: place it again once its content has its size, or use the script placement `Popover.svelte` already has for browsers without anchor positioning. The leave bar's mouse tests on 24 December run in a window of 1280 × 1800 for this reason (`e2e/detail.spec.ts`).

## Notes

- Open design question found by the branch review: does the built-in example plan get recovery copies? The spec says changes to it are not saved automatically.
- The run's driver needed `remote.prefs.recommended = false` in Firefox profiles, or Firefox shares storage between all local files (see the design's Results). Use the same setting for any automated `file://` test.
- WebKit from the dev shell paints in software at about two frames a second (2026-11-04, while the month tiles were built). With the month tiles on screen, opening a plan or resizing the window takes several seconds, so WebKit tests run in parallel timed out at random. `npm run test:e2e` now runs WebKit alone with one worker after Chromium and Firefox, and the WebKit project has longer timeouts (`playwright.config.ts`). The slowness is the headless software renderer, not the page: a real Safari with a GPU still needs checking (see Safari above). Since 2026-11-08 the WebKit project lets Skia paint on the CPU instead of through Mesa's llvmpipe (`WEBKIT_SKIA_ENABLE_CPU_RENDERING`): all WebKit tests took 3.6 instead of 22.6 minutes, without a crash. Not tried yet: whether WebKit now also passes in parallel with Chromium and Firefox, and with the normal timeouts.
