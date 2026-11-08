---
status: open
priority:
area: ui, accessibility
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Forced colours: day types and the allowance bar

## Problem

In forced colours (Windows contrast themes, Firefox's contrast control set to custom colours) the browser replaces the tokens with system colours. Planned days and pressed buttons draw their own Highlight and HighlightText, but two things are still lost:

- Working day, weekend, holiday, half working day and paid closure look the same: Canvas with CanvasText digits. Only the label tells them apart, so the calendar's main information is missing for sighted users of a contrast theme.
- The allowance bar loses its fill: planned leave against the allowance isn't visible (seen in Chromium's emulation).

## Context

- `src/ui/calendar/DayCell.svelte`, the `@media (forced-colors: active)` block; `src/ui/allowance/AllowanceBar.svelte`.
- `e2e/gallery.spec.ts`, "in forced colours": screenshots of the controls, the toolbar, the day cells and the main screen in Chromium and Firefox, with Playwright's `forcedColors` emulation.
- `docs/SPEC.md`, "Accessibility".

## Acceptance criteria

- [ ] In forced colours, weekend, holiday, half working day and paid closure can be told apart from a working day and from each other, with system colours only (for example patterns in CanvasText or GrayText), and planned leave stays the strongest mark.
- [ ] The allowance bar shows the planned share and an overdraft in forced colours.
- [ ] The forced-colour screenshots show both; checked once in a real contrast theme (Windows or Firefox's contrast control).

## Notes

Decided on 2026-11-07, when the UI was reviewed: fix the digits on planned days and the labels of pressed buttons first, the day types later. A trial that hatched weekends and holidays in system colours looked too heavy next to the leave fills.
