---
status: open
priority: 3
area: UI (day detail, leave bar, range rules), engine (counting)
branch:
created: 2026-11-09
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Duplicated helpers and wasted work in the leave bar and the range rules

## Problem

Since leave is charged by its overlap with the working time, the engine, the range rules and the leave bar each compute with spans of a day, and each has its own copy of the same small helpers. The day detail and the leave bar repeat the same styles and markup. Two places compute a value twice. None of it is wrong today, but a fix in one copy can miss the others.

1. **Interval helpers in three places.** Each file defines half-open spans of day positions and works on them:
   - `src/engine/counting/leave.ts`: `Interval` (line 78), `union` (81), `difference` (101), `measure` (115), `measureWithin` (122), `within` (137), `blockStart` (148, where the work block starts) and `pieceSpan` (153, where a piece of leave lies).
   - `src/ui/calendar/range.ts`: `OwnPiece` (16), `Span` (17), `spanOf` (41), `workBlock` (48) and `uncoveredWork` (54, the work no piece covers: a `difference` of the work block and the pieces).
   - `src/ui/calendar/leave-switch.ts`: `Span` (91), `union` (94), `minus` (105, the same as `difference`), `within` (120), `measure` (124), `spanOf` (129) and `OwnPiece` (137); the work block again inline (162–163).
   - `src/ui/calendar/day-leave.ts`, `workStops` (112): the start of the work block once more.
   - `OwnPiece` is defined twice, differently: in `range.ts` as own leave only, in `leave-switch.ts` as own or mandatory leave.
2. **Styles and markup of the value lines twice.** `src/ui/calendar/DayDetail.svelte` and `src/ui/calendar/LeaveBar.svelte` both define `.part` (DayDetail 178, LeaveBar 397), `.line` (193, 403), `.name` (201, 411), `b` (207, 415), `.spoken` (213, 421) and `.bar` (226, 434), and both write the amount markup of a value line: the label and the amount, or at zero a dash that screen readers hear as "none" (the `amount` snippet in DayDetail, lines 72–80; the leave line in LeaveBar, 327–335).
3. **A new preview for every drag object.** `src/ui/calendar/LeaveBar.svelte` (lines 71–73): `dragged` is derived from the whole `drag` object, so every new one, as `follow` makes for each change of the part under the pointer and `release` makes for the released drag, calls `reach()` again. The new change object reruns the preview effect (281–303), which asks the worker again, and `shown` builds the bar again, also when the take and the part are the same as before and while the released change is being applied. The stale answers are dropped, so this is only wasted work.
4. **`suggestParts` evaluates a day twice.** `src/engine/counting/suggest.ts` (line 47) computes `evaluateLeave(today.required, today.leave, today.inPeriod).remaining`, but `today.evaluation` already holds it: `computePlan` evaluates each day with exactly these arguments (`src/engine/counting/plan.ts`, lines 130–133), and `suggestParts` has removed the requested days' own leave from the input before.

## Context

- Found while finishing the branch `leave-on-working-time` (issue 0031, charge leave only where it overlaps the working time).
- `docs/SPEC.md`, "Detail view" and "Leave bar"; `AGENTS.md`, "Performance" (`npm run perf`).

## Acceptance criteria

- [ ] One shared module for spans of a day (half-open, in day positions: union, difference, within, measure, where a piece of leave lies, where the work block lies), used by `leave.ts`, `range.ts`, `leave-switch.ts` and `day-leave.ts`; one `OwnPiece` type, or two with names that say what they hold. The engine part stays free of UI imports. Its existing tests pass, and the module has its own.
- [ ] The value line's markup and its styles (`.part`, `.line`, `.name`, `b`, `.spoken`, `.bar`) exist once, for example as a shared component or a style in the components layer, used by `DayDetail.svelte` and `LeaveBar.svelte`; the gallery's day details and the e2e tests of the detail look and read as before.
- [ ] The leave bar asks for a preview and builds the drawn bar only when the take or the part of the dragged change changes, not for a new drag object with the same change, and not for the released drag; a test shows one preview request per change.
- [x] `suggestParts` uses `today.evaluation.remaining`; its tests pass unchanged. Done on `leave-on-working-time`, when the suggestion started to prefer leave on work to leave on time without work.
- [ ] `npm run check` and `npm run perf` stay green.
