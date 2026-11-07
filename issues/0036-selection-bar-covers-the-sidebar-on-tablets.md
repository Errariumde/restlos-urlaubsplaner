---
status: open
priority: 3
area: main screen layout (MainScreen.svelte, SelectionBar.svelte)
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# The selection bar covers the sidebar's end on touch screens from 800 px

## Problem

On a coarse-pointer screen at least 800 px wide (a landscape tablet), the toolbar offers the selection mode and the allowance is the sticky sidebar (`max-block-size: 100dvh`). In the selection mode the sticky SelectionBar (`z-index: 10`) sits over the bottom of the window and covers the end of the sidebar. The sidebar's own scroll can't bring that part out from under the bar.

## Context

- `src/ui/screens/MainScreen.svelte`, `.panel`; `src/ui/calendar/SelectionBar.svelte`, `.bar`.
- Found by the final review of branch `ui` (`final-review.md`, parked items).

## Acceptance criteria

- [ ] In the selection mode the sidebar's whole content can be scrolled into view above the selection bar, for example with `max-block-size: calc(100dvh - <bar size>)` while the mode is on, or padding at the panel's block end.
- [ ] An e2e test (Chromium, `hasTouch`, about 1024 × 600) scrolls the sidebar to its end in the selection mode and checks that its last element is above the bar.
- [ ] `npm run check` and `npm run test:e2e` pass.

## Notes
