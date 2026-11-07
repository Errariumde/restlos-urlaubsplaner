---
status: open
priority: 3
area: UI accessibility (main screen)
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Accessibility and UX follow-ups of the main screen

## Problem

Branch `ui` left small accessibility and UX gaps on the main screen. None blocks, but they cost little before more screens copy the patterns.

## Context

- Found at the end of branch `ui`; axe-core reports none of them.

## Acceptance criteria

- [ ] **Undo/Redo keep the focus:** when Undo or Redo becomes disabled while it has the focus, the focus moves to the other button or to the grid's Tab stop instead of falling to `<body>` (`src/ui/screens/Toolbar.svelte`; DayDetail and SelectionBar already do this).
- [ ] **The week button says what it does:** `WeekNumber.svelte` and the week marker in `MonthColumns.svelte` are named "Week 23" (`calendar.week`). Use a name that states the action, for example "Plan week {week}" / "Woche {week} planen" (and the selection mode's "Select week {week}"), or add a description. Update the e2e locators.
- [ ] **Language options:** `toolbar.language.de`/`.en` read "DE"/"EN", announced as letters. Give each an accessible name in its own language ("Deutsch", "English") with `lang` on the button.
- [ ] **Toolbar role:** `Toolbar.svelte` has `role="toolbar"` without arrow-key navigation between its controls. Either add roving arrow keys or drop the role and keep the labelled group.
- [ ] **Meter values:** the allowance meter's `aria-valuenow`/`aria-valuemax` are internal units (480 per day) in `AllowanceBar.svelte`. Give them in days (divide by `UNITS_PER_DAY`); `aria-valuetext` stays. Update `e2e/allowance.spec.ts`.
- [ ] **Heading levels:** `AllowancePanel.svelte` puts an `h3` ("Stretches") in the `aside` under the toolbar's `h1`, with no `h2`. Add an `h2` for the panel (visible or visually hidden) or adjust the levels.
- [ ] **First Shift-click:** a Shift-click without a visible anchor extends from `app.focusDay` (`gestures.svelte.ts`, `anchor = selection?.anchor ?? lastClicked ?? app.focusDay`), which a mouse user never sees: Shift-clicking 10 Aug as the first action plans 1 Jan–10 Aug in one step, without a preview. Fall back to `focusDay` only after the grid had keyboard focus, or treat such a Shift-click as a plain click.
- [ ] **Negative remainder in the hint:** `hint.range` says "−2 days left" / "−2 Tage übrig" for a negative remainder. Use a select on the sign with an "over the allowance" wording, as the allowance warning does (`ui-texts` skill).
- [ ] `npm run check` and `npm run test:e2e` pass.

## Notes

Each item can be its own commit; the texts go through the `ui-texts` skill.
