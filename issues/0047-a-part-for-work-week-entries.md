---
status: open
priority: 3
area: engine (required work), file format, contract
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# A part for work-week entries

## Problem

A work-week entry gives each weekday its required work as a share of the day, but not where in the day that work lies. The engine puts the free time of a lowered day at the end unless the layer that decides the day says `part: "start"`, and the work week has no `part`. So a part-time day always has its work in the morning: someone who works half of Friday in the afternoon can't say so.

Since leave costs only where it overlaps the working time (issue 0031, charge leave only where it overlaps the working time), this decides what leave costs. With work on Friday afternoons, a booked Friday afternoon reads as leave on time that is off anyway (cost 0, the problem `leaveOnFreeTime`), and a booked morning costs ½ and frees the day, both the wrong way round.

## Context

- `src/engine/counting/required.ts`: `RequiredWork.freePart` comes from the deciding layer's `part`, else `"end"`; the work-week layer has none.
- `docs/file-format.md`, "Work week": an entry has `from` and `required` (`mon` … `sun`), nothing else.
- `docs/SPEC.md`, "Work week with validity" and "Finer granularity"; day rules, holiday calendars and overrides already take a `part`.
- An override with a `part` can set it for single dates, which is no answer for a whole work week.

## Acceptance criteria

- [ ] A work-week entry can say where the work of its weekdays lies (an optional `part` for the entry or per weekday; decide which in a design), optional in the file format, with today's behaviour (work at the start of the day, free time at the end) as its default.
- [ ] The engine places the free time of such a day by it; cost, stretches, time off needed, the part suggestion and the day detail's leave bar follow without changes of their own.
- [ ] Tests: a Friday with ½ of work in the afternoon, where own leave in the morning costs nothing and is reported as `leaveOnFreeTime`, own leave in the afternoon costs ½ and frees the day, and a full day costs ½.
- [ ] Files without it read and compute as before.
- [ ] `docs/SPEC.md` and `docs/file-format.md` describe it.

## Notes

- It was left out when leave started to cost only where it overlaps the working time, to keep that change to the counting model and the day detail.
- The contract dialog (not built yet) would offer it beside each weekday's share.
