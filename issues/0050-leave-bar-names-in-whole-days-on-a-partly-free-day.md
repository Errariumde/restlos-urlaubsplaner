---
status: open
priority: 3
area: UI accessibility (day detail, leave bar names)
branch:
created: 2026-11-09
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Leave bar names in whole days on a partly free day

## Problem

In a plan whose smallest leave unit is `"1"`, the day detail's leave bar has one part, and every name of a part is the whole day. On a day with less than a full day of work, such as 24 December with ½ of work in the morning, the bar is:

- a switch over the morning's work (day positions 0 to 240), named "Ganzer Tag" / "Full day", and
- a fixed block over the free afternoon (240 to 480), read as "Ganzer Tag: frei" / "Full day: off".

Next to the "Ganzer Tag" switch, the block's name sounds as if the whole day were off, although only the afternoon is. Its visible text ("frei" / "off") is right; only the name screen readers hear is wrong.

The same happens to a switch over time without work. With own ½ at the end of 24 December (from a file: leave on time that is off anyway), the afternoon is a pressed switch that takes that leave away, and the bar has two buttons, "Ganzer Tag" and "Ganzer Tag: frei" / "Full day: off". The second again reads as if the whole day were off.

## Context

- `src/ui/calendar/detail.ts`, `placeText`: a block whose first and last part are the same part is named after that part, and with one part per day that is the whole day.
- `src/ui/calendar/leave-switch.ts`, `partName`: with a count of 1 every index is `{ kind: "day" }`, so the block's `first` and `last` are the whole day.
- `src/ui/calendar/detail.ts`, `switchText`: a switch over time without work is named like the fixed block it stands for, but from `partText` of its part, not from `placeText`, so a fix in `placeText` alone doesn't reach it.
- It is older than the bar in finer units: with one part per day the bar has always named its parts this way. The e2e tests of the plan in whole days (`e2e/min-unit.spec.ts`) use a normal working day, where the bar has no fixed block.

## Acceptance criteria

- [ ] A fixed block over time without work (or over mandatory leave or another plan's leave) that is less than the whole day is named so that it doesn't read as the whole day, in both languages; for example after where it lies in the day ("nachmittags: frei" / "Afternoon: off" on 24 December, or a name for a share at the start or the end of the day). Decide the wording with the `ui-texts` skill.
- [ ] The switch over time without work is named the same way as the fixed block it stands for ("nachmittags: frei" / "Afternoon: off" for own ½ at the end of 24 December from a file).
- [ ] A unit test with unit `"1"` on 24 December, with the free time at the start too, for the fixed block and for the switch over time without work, and the block over the whole day still read as "Ganzer Tag: …".
- [ ] `docs/SPEC.md` ("Leave bar", Names) says how such a block is named.

## Notes

- The switch itself is right to be "Ganzer Tag": with unit `"1"` a press books or removes a full day, which on 24 December costs ½.
