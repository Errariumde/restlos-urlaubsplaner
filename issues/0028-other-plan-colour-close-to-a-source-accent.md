---
status: open
priority:
area: UI
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Other-plan colour close to a source accent

## Problem

`--r-accent-3` (hue 350) and `--r-other-plan` (hue 320) look alike. In the example plan the source "Leave 2026" (type "Leave from another plan") has the slot `accent-3`, so on 4 and 5 January 2027 its dashed lane and the dashed other-plan border of the same cells are hard to tell apart.

## Context

- Tokens: `src/ui/styles/tokens.css` (day types and accents 1–8).
- The day cell draws other-plan days with a dashed border (layer 3) and every visible source as a lane (layer 4), other-plan sources included (`src/ui/calendar/cell-lanes.ts`, `DayCell.svelte`).
- Found while building the month tiles on the UI branch.

## Acceptance criteria

The maintainer decides, then one of these holds:

- the other-plan hue is moved far enough from every accent that a border and a lane on the same cell are told apart, or
- other-plan sources are left out of the lanes (the border and the cell label already show them), and the spec's "Day cell" section says so.

## Notes

The colour alone is not the only cue: the lane is a 3 px line at the bottom, the border runs round the cell. The two still read as one dashed shape on small cells.
