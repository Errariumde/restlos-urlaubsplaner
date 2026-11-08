---
status: open
priority: 3
area: UI (problems list, day detail), plan sources
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dismiss a time-off need for one day

## Problem

A "Time off needed" source reports the problem `uncoveredNeed` on every day of the plan period where the need is not covered. `docs/SPEC.md` ("How a day's required work comes about", time off needed) says that dismissing it for one day adds the date to the entry's exceptions, and `docs/file-format.md` ("Time off needed") says the same for the file: add the date to the entry's `except`, or remove a single-date entry. The app has no way to do that: the problem stays in the list, on the cell and in the detail until the day is free, and the only way out is editing the file by hand.

## Context

The problems show on the day cells, in the allowance panel and in the day detail (`src/ui/calendar/problems.ts`, `src/ui/allowance/AllowancePanel.svelte`, `src/ui/calendar/DayDetail.svelte`). The app can't edit sources yet, so there is nothing to build the action on.

## Acceptance criteria

- [ ] An `uncoveredNeed` problem offers "Für diesen Tag ausblenden" / "Dismiss for this day" (wording to be decided) where it shows with its day: the problems list and the day's detail.
- [ ] Dismissing adds the date to `except` of every entry of the need sources that cover the day (`sourceIds` of the problem), or removes an entry that has only that date; the problem and the cell mark go.
- [ ] One dismissal is one change and one undo step, and the hint line says the result.
- [ ] The saved plan file holds the new `except`, and reading it again shows no problem on that day.
- [ ] e2e tests for the list and the detail, in both languages.

## Notes

- Only `uncoveredNeed` can be dismissed this way. The other problems (leave outside the period, leave on a day off, leave already in another plan, contradicting day rules) go when the leave or the rules change.
- An entry with a `match` (a repeat) gets an exception; a single-date entry is removed, so the file doesn't keep an entry that matches no day.
- `except` holds at most 400 dates (`docs/file-format.md`, sources); at that limit the action says why it can't add one.
