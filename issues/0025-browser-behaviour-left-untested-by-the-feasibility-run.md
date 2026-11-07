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

`docs/superpowers/specs/2026-10-24-feasibility-tests-design.md`, section "Results (2026-11-02)", rows marked "Not tested". The calendar test (I4, `UID`s in Nextcloud's trash bin) is tracked in issue 0010.

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
- **Safari, mouse drag at compact widths:** when the hint line's text wraps at the start of a drag, the sticky region grows and the calendar below it moves down. Chromium and Firefox keep the cells in place with scroll anchoring; WebKit has none, so the cells move under the pointer (seen in the dev shell's WebKit, `e2e/allowance.spec.ts`, "the hint line stays in view during a drag", 375 px, 2026-11-04). Check it in a real Safari; if it shows, give the hint line a fixed height at compact widths or let it overlay the calendar.

## Notes

- Open design question found by the branch review: does the built-in example plan get recovery copies? The spec says changes to it are not saved automatically.
- The run's driver needed `remote.prefs.recommended = false` in Firefox profiles, or Firefox shares storage between all local files (see the design's Results). Use the same setting for any automated `file://` test.
- WebKit from the dev shell paints in software at about two frames a second (2026-11-04, UI branch Task 11). With the month tiles on screen, opening a plan or resizing the window takes several seconds, so WebKit tests run in parallel timed out at random. `npm run test:e2e` now runs WebKit alone with one worker after Chromium and Firefox, and the WebKit project has longer timeouts (`playwright.config.ts`). The slowness is the headless software renderer, not the page: a real Safari with a GPU still needs checking (see Safari above).
