---
status: open
priority: 2
area: UI accessibility (day detail, leave bar), component gallery
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Leave bar parts below ¼ are under the target size

## Problem

In a plan whose smallest leave unit is below ¼ (⅕ to 1/32), the day detail's leave bar has more than four parts, each as wide as its share of the day: a 1/16 part is about 18 px wide in the 20rem detail, a 1/32 part about 9 px. That is below the 24 px target size of WCAG 2.5.8 (Target Size, Minimum; level AA) and far below the 2.75rem the bar keeps for its switches with up to four parts. The keyboard reaches every part (arrow keys, Home, End, Space), but a pointer has no control of full size that does the same, which is the exception WCAG 2.5.8 allows for small targets.

axe's target-size rule would report these parts, so the component gallery's group of day details in sixteenths is left out of axe.

## Context

- `src/ui/calendar/LeaveBar.svelte` (the bar, its CSS minimum width for bars of up to four parts) and `src/ui/calendar/leave-switch.ts` (parts, `reach`, the guards of a press).
- `src/gallery/sections/detail-situations.ts`: the sixteenths group's `skipAxe`, which `DayDetailSection.svelte` writes as `data-axe-skip`; `e2e/gallery.spec.ts` runs axe without those groups and checks that only the sixteenths group is left out.
- `docs/SPEC.md`, "Leave bar" (Widths) and "Accessibility".

## Acceptance criteria

- [ ] A bar with more than four parts gets an equivalent control of full size, for example "−" and "+" buttons beside it that shorten or lengthen the own leave by one part from the edge it lies at. Decide in a design the edge with no own leave yet, the names in both languages, the keyboard order and what the hint line says.
- [ ] The control follows the bar's rules: one change and one undo step per press, never leave that lies only on time without work, the guards of a press.
- [ ] axe, with its target-size rule, checks the gallery's day details in sixteenths: their `skipAxe` and `data-axe-skip` go, and the gallery e2e test of what axe leaves out changes with them.
- [ ] `docs/SPEC.md` ("Leave bar", "Accessibility") describes the control and no longer leaves the finer bars out of the checks.

## Notes

- Bars of up to four parts (units `"1"`, ½, ⅓ and ¼) keep each switch at least 2.75rem wide and are checked by axe already (the gallery's quarters group).
- Dragging along the bar and tapping a part stay as they are; the control is an alternative, not a replacement.
