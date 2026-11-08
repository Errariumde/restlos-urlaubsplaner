---
status: open
priority:
area: engine (counting model), spec
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Charge leave only where it overlaps the working time

## Problem

The counting model charges `min(taken, required)` per day and ignores where in the day the leave lies. On a day with lowered required work that has a part, the result contradicts the rule "leave on time that is off anyway costs nothing", which already holds for whole days (a Sunday costs nothing).

Example from the bundled example plan: 24 December has `requiredAtMost: "1/2"` with `part: "end"` (work in the morning, the afternoon off). Booking the afternoon as leave costs ½ and marks the whole day off, although the afternoon was free anyway. The maintainer found this in the manual Firefox ESR check of the `ui` branch on 2026-11-04 and expected it to cost nothing.

## Context

- `docs/SPEC.md`, Counting model: the table row "New Year's Eve … ½ | half | ½ | full day off", and the paragraph "Where in the day partial leave lies … doesn't change the cost of that leave on its own".
- The engine already compares parts of the day where pieces of leave meet: own and mandatory leave on the same part count once, and mandatory leave isn't charged where leave from another plan covers it (`docs/day-rules-format.md`, `part`).
- `docs/file-format.md`: `from`/`to` spans (shares measured from the start of the working time) and the cost entries' spans.
- AGENTS.md hard rule: 480 units per day, cost per day = min(taken, required). This rule changes with the decision below, so AGENTS.md changes too.

## Decision (maintainer, 2026-11-04)

Leave is charged only where it overlaps the working time of the day. On 24 December (work ½ in the morning): leave in the afternoon costs 0 and changes nothing; leave in the morning costs ½ and makes the whole day off; a full day costs ½. Done on its own branch after `ui`.

## Acceptance criteria

- [ ] `docs/SPEC.md` (counting model table and paragraph), `docs/day-rules-format.md`, `docs/file-format.md` and AGENTS.md state the overlap rule, including how required work without a part, overrides with a part, and finer shares (down to 1/32) place the working time.
- [ ] The engine computes the cost as the overlap of the leave's span with the working span; tests cover 24 Dec morning/afternoon/full, a normal day, overrides with `part: "start"`, and the existing mandatory/other-plan overlap cases.
- [ ] Stretches and "Time off needed" stay consistent with the new cost (a no-cost piece of leave on free time doesn't change them).
- [ ] The UI's detail actions and hint line show the new costs; a booking that costs nothing and frees nothing is either not offered or shown as such (decide in the design).
- [ ] `npm run perf` passes; a scenario is added if the cost computation changes its input size behaviour.
- [ ] Plan files written before the change load unchanged; the changed cost is reported where it differs, if the design wants that.

## Notes

- The UI reads where each kind of leave lies from the engine (`DayLeave.placed` in `src/engine/counting/leave.ts`, read by `src/ui/calendar/day-leave.ts`), so a change of where leave lies shows in the cell, its label and the detail without UI work.
- Today own and mandatory leave are both placed inside the work block. On 24 December (work in the morning) own ½ at the end lies at day positions 0–240, own ¼ at the end at 120–240, and mandatory ½ at the end at 0–240. Once leave on free time lies where it is, the cell draws it there, as it draws own leave on a Saturday.
- On the acceptance criterion "not offered or shown as such": the maintainer chose "shown as such" on 2026-11-07; the detail shows such leave with no cost ("–").
- The day detail's leave bar (`src/ui/calendar/leave-switch.ts`) already draws own and mandatory leave at the start or the end of the day as its `part` says, and its switches write `part` that way: a click on the afternoon of 24 December writes `take` ½ at the `end`. Until this issue is done, that leave costs ½ and the cell draws it in the morning.
- `part` then means "of the day" instead of "of the working time"; the Data model row of `docs/SPEC.md`, "Finer granularity: prepared, not implemented", says the latter and changes with it.
