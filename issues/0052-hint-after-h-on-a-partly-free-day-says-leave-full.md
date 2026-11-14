---
status: open
priority: 3
area: UI (cell label, hint line)
branch:
created: 2026-11-09
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# The hint after H on a partly free day says "leave full"

## Problem

On 24 December with ½ of required work at the start of the day (the afternoon free, as the bundled example plan `examples/plans/beispiel-gmbh-2027.urlaub.json` has it), focus the day and press H. H books the morning, ½ at the `"start"`, which frees the whole day for ½. Then:

- the hint line says "24 Dec: leave full." ("24. Dez.: ganzer Tag Urlaub."), and the cell's label says "leave full" too;
- the day detail says "Leave ½ day" and "Costs ½ day" ("Urlaub ½ Tag", "Kostet ½ Tag").

The user pressed "half day" and hears "full". A screen reader user can't tell from the hint whether H booked half a day or a full day.

## Context

- `src/ui/calendar/day-leave.ts`, `dayLeave`: a day that own leave alone makes wholly free gets `fill: "full"` and no shares, whatever the own leave's `take`; the same for mandatory leave (`fill: "mandatory"`).
- `src/ui/calendar/label.ts`, `leaveText`: `fill: "full"` reads as `day.leave.own` with the amount `full` ("leave full" / "ganzer Tag Urlaub"). The cell's label (`cellLabel`) and the hint line (`src/ui/calendar/status.ts`, `statusText`) both use it.
- `e2e/keyboard.spec.ts`, "H on 24 December books the morning": asserts the current wording for the cell's label and the hint line.
- `docs/SPEC.md`, "Day cell: what is shown how" (2. Fill: a kind fills the cell when it is the day's only leave and no work is left; the label names each kind with its amount and where it lies) and "Calendar interaction" (the hint line's result after a change).
- Issue 0037 (accessibility and UX follow-ups of the main screen) has no item on this.

## Acceptance criteria

- [ ] On a day that own leave below a full day makes wholly free, the cell's label and the hint line name what was booked (for example half a day, the morning) and that the day is now off, in both languages; decide the wording with the `ui-texts` skill. A full day of own leave still reads as a full day.
- [ ] The same for mandatory leave below a full day that makes a day wholly free, or a note in `docs/SPEC.md` why it stays as it is.
- [ ] Unit tests of `leaveText` and `statusText` for 24 December after H, in both languages; `e2e/keyboard.spec.ts` ("H on 24 December …") asserts the new wording.
- [ ] `docs/SPEC.md` ("Day cell: what is shown how", "Calendar interaction") says how such a day is named.

## Notes

- The cell's fill can stay full: the drawing shows that the day is off, the words say what was booked.
