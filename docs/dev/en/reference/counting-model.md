<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Counting model

How the engine computes a day's required work and the cost of its leave. The unit, the cost as an overlap, the order of the layers and the offer of the calendar's actions are set by the "Counting model" [hard rule](../../../../AGENTS.md#hard-rules). How weights, `take` and `part` are written is in [Plan files and rule sets](file-format.md#values). The reasons are in [Counting choices](../explanation/counting-choices.md).

## Cost of a day

`evaluateLeave` in `src/engine/counting/leave.ts` computes the cost in day positions: 0 is the start of the day, 480 its end.

- **Leave** lies at the start or the end of the day, as its `part` says; a full day covers the whole day. Leave from another plan lies at its span.
- **Working time** is one block as long as the required work. On a day with less work, the free time lies at the end unless the layer that decides the required work says `part: "start"` ([Part](day-rules-format.md#part)).
- **Work week:** its entries have no `part`, so on a part-time weekday the work lies at the start of the day (issue 0047, a part for work-week entries).

| Day | Leave | Cost | Result |
| --- | --- | --- | --- |
| normal working day | full | 1 | full day off |
| normal working day | ½, either part | ½ | half day off |
| 24 Dec, work ½ in the morning | ½ afternoon | 0 | nothing changes; problem `leaveOnFreeTime` |
| 24 Dec, work ½ in the morning | ½ morning | ½ | full day off |
| 24 Dec, work ½ in the morning | full | ½ | full day off |
| Friday ½ from the work week | as on 24 Dec | | |
| ¾ day (free at the end) | ½ afternoon | ¼ | free from noon |
| ¾ day (free at the end) | ½ morning | ½ | ¼ is worked |
| ¾ day (free at the end) | full | ¾ | full day off |
| weekend, holiday | any | 0 | not selectable; problem `leaveWithoutRequiredWork` when it comes from a file |

The problems are reported by `computePlan` in `src/engine/counting/plan.ts`. The calendar's actions set no own leave on a day without required work, and the leave bar books no own leave that lies only on time without work.

Where partial leave lies also decides:

- whether the day joins a stretch, an unbroken run of time off (`findStretches` in `src/engine/counting/stretches.ts`);
- how it overlaps mandatory leave on the same day, see [Mandatory leave](#mandatory-leave);
- where the day cell and the day detail draw it. Half days are shown as morning or afternoon.

## Units

`UNITS_PER_DAY` in `src/engine/weight.ts` is 480. 480 = 2⁵ · 3 · 5, so ½, ⅓, ¼, ⅕, ⅙, ⅛, 1/16 and 1/32 are whole numbers of units.

- **Smallest leave unit:** the calendar plans in the open plan's `minUnit` ([Smallest leave unit](file-format.md#smallest-leave-unit)). Under a unit that ½ is no multiple of, such as `"1"`, H changes nothing and the hint line says that the plan has no half days (`src/ui/calendar/keyboard.svelte.ts`). The selection bar then offers no half day (`halfDayFits` in `src/ui/calendar/range.ts`).
- **Leave bar:** the day detail's leave bar splits the day into parts of `minUnit`, at most 32. A finer unit is drawn in its smallest multiple that gives at most 32 parts (`partCount` in `src/ui/calendar/leave-switch.ts`).
- **Display:** `formatDays` in `src/ui/i18n/format.ts` is the one function that writes day amounts. It is exact for every multiple of 1/480: the whole days, then the fraction in lowest terms, as a Unicode glyph where one exists ("12¾"), else as numerator/denominator, after a no-break space when whole days come first ("3/32", "1 3/32").
- **Day cell:** the fill of each share covers an area of the cell proportional to the share (`src/ui/calendar/day-leave.ts`).
- **Tests:** property tests in `tests/engine/counting/leave.test.ts` and `tests/engine/counting/plan.test.ts` compute with random multiples of 1/32 and of 1/480.

## Required work

`requiredWork` in `src/engine/counting/required.ts` computes a day's required work in the order of the "Counting model" [hard rule](../../../../AGENTS.md#hard-rules). The minimum is taken over the base value from the work week and every lowering layer that applies: built-in public holidays (0), `holiday` sources (their `required`, `"0"` … `"1"`), `paidClosure` sources (0) and `requiredAtMost` rules. Forced rules (`requiredExactly`) and the manual override of a single date: [Effects](day-rules-format.md#effects).

Where the free time lies when several layers give the same value: [Part](day-rules-format.md#part). The source types are listed in [Types](file-format.md#types). Mandatory leave, time off needed, `info` sources and leave from another plan are no layers: they don't change the required work.

## Mandatory leave

Mandatory leave comes from `mandatory` day rules ([Effects](day-rules-format.md#effects)) and `mandatory` sources ([Types](file-format.md#types)).

- **Changes:** the calendar's actions and the leave bar change only own leave (`changeFor` in `src/ui/calendar/range.ts`, `src/ui/calendar/leave-switch.ts`). Mandatory leave changes only with its rule or source.
- **With own leave:** on different parts of the day they add up; on the same part see [Part](day-rules-format.md#part).
- **With leave from another plan:** see [Leave from another plan](file-format.md#leave-from-another-plan).

## Work week

The work week is a list of entries with start dates ([Work week](file-format.md#work-week)). The list has no end date: the rules describe ongoing employment, and there is no separate state for days before or after it.
