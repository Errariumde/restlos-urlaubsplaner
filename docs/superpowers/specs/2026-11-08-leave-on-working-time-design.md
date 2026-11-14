<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: leave costs only where it overlaps the working time, and a leave bar in the plan's unit

As of: 2026-11-08. Branch: `leave-on-working-time`. Issues: 0031 (charge leave only where it overlaps the working time) and 0008 (part suggestion with finer leave steps). Three small items of 0014 (small code and test gaps from the file-format branch) are ticked along the way.

## Intent

The counting model charges `min(taken, required)` per day and ignores where in the day the leave lies. On a day whose required work is lowered with a part, that contradicts the rule "leave on time that is off anyway costs nothing", which already holds for whole days (a Sunday costs nothing). In the built-in example, 24 December has the rule "Heiligabend: nachmittags frei" (`requiredAtMost: "1/2"`, `part: "end"`): booking the afternoon costs ½ and frees the whole day, although the afternoon was free anyway.

The maintainer decided:

- Leave is charged only where it overlaps the day's working time.
- The app itself never creates leave that lies wholly on time that is off anyway. Such leave can only come from a hand-edited file, and it is then reported as a problem, like leave on a day off.
- The day detail's leave bar offers the plan's smallest leave unit (`minUnit`), not only half days. This is the "finer steps" UI that `docs/SPEC.md` ("Finer granularity: prepared, not implemented") left for later, done now for the detail's leave bar.

## Goals

1. **Overlap rule in the engine.** The cost of a day is how much of the leave overlaps the working time, for own and mandatory leave, at any multiple of 1/480.
2. **The UI can't create leave on free time.** The detail's leave bar, the "Ganzer Tag" checkbox, H, Space, clicks, week clicks and every range action only create own leave that overlaps working time.
3. **Leave wholly on free time is a problem** when it still comes from a file.
4. **The leave bar in the plan's unit**, with free time and other kinds of leave as fixed blocks, names for screen readers, one Tab stop, and tap or drag for small parts.
5. **The part suggestion (0008)** never suggests a side that frees no work while the other side does.
6. **The documentation** states the new rule everywhere the old one stands, including the AGENTS.md hard rule.

## Non-goals

- A `part` for the work week. Work-week entries have no part, so the free time of a part-time day lies at the end (the work in the morning), as the engine already assumes. Someone who works the afternoon of a part-time day can't say so. A new issue keeps this.
- A calendar key for finer steps, and a `minUnit` setting in a contract dialog (there is no contract dialog yet). H and the range actions stay at half and full days. A new issue keeps both, replacing the spec's "one more key".
- Reporting own leave that lies wholly under mandatory leave (it costs nothing extra today and stays as it is; the leave bar already locks such parts).
- Reporting mandatory leave on free time: it comes from rules or sources, not from the user, and it simply costs nothing there.
- Migrating plan files: nothing is released, so there is no file written under the old meaning outside the repository. The example files are checked (see Testing).

## Anti-goals

- Charging any leave on time that is off anyway, through any path: own leave, mandatory leave, a range, H, a file.
- A leave bar control that offers a booking which changes nothing (leave wholly on free time).
- Making `part` mean different things in different places. It means the start or the end of the **day** everywhere: leave, mandatory leave, overrides, rules and source entries.

## Constraints

- AGENTS.md hard rules: 480 integer units per day, no floats, no special cases for ½; the engine works down to 1/32 (and exactly in 1/480).
- `npm run perf` must pass. The baseline is never raised without the maintainer's approval; if the new cost computation costs more than 5 % in a scenario, stop and ask.
- Only features of the current Firefox ESR; check ESR behaviour manually.
- UI texts in both catalogs, ICU MessageFormat, `ui-texts` skill. Svelte components through the Svelte MCP autofixer.
- The app can open only the built-in example so far (issue 0030, open real files in the UI), whose unit is ½. Users see a finer unit or a finer working time only once files can be opened. The e2e tests already open an edited example (`openEditedExample` in `e2e/helpers.ts`, which merges changes into the example's `contract`, `plan` or root; `e2e/min-unit.spec.ts` uses it for the unit `"1"`), and the component gallery can show any day.

## The rule (decided)

### Where leave and work lie

- **Leave** lies at day positions (0 = start of the day, 480 = end). `part: "start"` covers `[0, take)`, `part: "end"` covers `[480 − take, 480)`, and a full day covers `[0, 480)`. Leave from another plan already lies at day positions (`from`, `to`) and keeps them.
- **Work** lies where the required work says. A full working day covers `[0, 480)`. A lowered value is one block beside its free time: the free time lies at the end unless the deciding layer says `part: "start"` (`RequiredWork.freePart`, unchanged). This holds the same way for the work week, holiday calendars, paid closures, day rules and overrides.

### Cost

- The cost of own and mandatory leave is the length of its overlap with the work block.
- Own and mandatory leave on the same time count once (mandatory leave is charged, own leave there costs nothing extra), as today.
- Mandatory leave isn't charged where leave from another plan covers it; own leave there is charged and reported (`leaveTakenInOtherPlan`), as today, but only for the part that overlaps work.
- Outside the plan period nothing is charged, as today.

| Day | Leave | Cost | Result |
| --- | --- | --- | --- |
| normal working day | full | 1 | full day off |
| normal working day | ½, either part | ½ | half day off |
| 24 Dec, work ½ in the morning | ½ afternoon | 0 | nothing changes; a problem |
| 24 Dec, work ½ in the morning | ½ morning | ½ | full day off |
| 24 Dec, work ½ in the morning | full | ½ | full day off |
| Friday ½ from the work week | as on 24 Dec | | |
| ¾ day (free at the end) | ½ afternoon | ¼ | free from noon |
| ¾ day (free at the end) | ½ morning | ½ | ¼ is worked |
| ¾ day (free at the end) | full | ¾ | full day off |
| weekend, holiday | any | 0 | not selectable; a problem when it comes from a file |

### What follows

- **Free time, stretches, time off needed:** free time at the start and the end of the day is the free stretch touching that edge, made of time without work and every kind of leave. Leave on free time doesn't change it. Stretches and "time off needed" keep working on these values; their rules don't change.
- **Charged spans** (`DayLeave.charged`, what another plan imports as "Leave from another plan") are the charged overlaps in day positions.
- **Placed spans** (`DayLeave.placed`, what the cell, its label and the detail draw) show each kind of leave where it lies in the day, also on free time. A day made wholly free by own leave still fills the cell, as today.

### The problem

- Own leave in the plan period that overlaps no working time at all is a problem.
- On a day without required work this is today's `leaveWithoutRequiredWork` ("Dieser Urlaub liegt auf einem freien Tag." / "This leave lies on a day off."), unchanged.
- On a day with working time it is a new problem code with its own texts: "Dieser Urlaub liegt auf ohnehin freier Zeit." / "This leave lies on time that is off anyway." It shows on the cell, in the allowance panel's problems list and in the detail, like the other problems.

## The UI (decided)

### No path creates leave on free time

- **"Ganzer Tag"** stays. It is ticked when the day is wholly free and some leave lies on it, unticked when no leave lies on it, and mixed otherwise. Unticked or mixed, a click books a full day (`take "1"`, as a click on a day without own leave does); ticked, a click takes the own leave away. This is today's behaviour; only "ticked" now also counts time without work as free.
- **The range rules of `docs/SPEC.md` stay** (one function for click, Space, H, Delete, Shift-click, drag, week click and the selection bar), with one change: "an edge of the working time" becomes "an edge of the day", reached directly or across time without work.
  - With no other leave on the day, "full" books a full day (on 24 December it costs ½), and "half" books half a day at the end, unless the end half has no work; then at the start. On 24 December H books the morning, which frees the whole day for ½.
  - With mandatory leave or another plan's leave on the day, "full" covers the work they leave free and "half" covers half a day of it at most, from the edge it reaches, as long as that work is one stretch reaching an edge of the day; otherwise the day stays as it is, as today. Example: 24 December with mandatory leave in the first quarter leaves the work from ¼ to ½; "full" books ¾ at the end and costs ¼.
  - "Half" never books half a day that frees no work left; where neither side would, the day stays as it is.
  - A day that is wholly free with own leave on it counts as set: "full" leaves it alone (no change, no undo step), and a week click whose days are all set takes the week away, as today.
- **The leave bar** has no switch for a part without work (below).

### The leave bar in the plan's unit

- **Parts.** The bar is split into parts of the plan's unit: two parts ("vormittags", "nachmittags") with ½, four with ¼, sixteen with 1/16, one ("Ganzer Tag") with `"1"`. A unit that would give more than 32 parts uses the smallest multiple of it that gives at most 32 (1/48 → 1/24; 1/480 → 1/32).
- **Each part is drawn only over its working time.** A part wholly without work is a fixed block. A part with some work is a switch as wide as its work, beside a fixed block for the rest. Example: the afternoon of a ¾ day with unit ½ is a ¼ "nachmittags" switch and a ¼ fixed block, lined up with the Soll bar above.
- **Widths.** With at most four parts (units `"1"`, ½, ¼), a switch is never narrower than about 2.75rem; the fixed block beside it gets narrower instead. With more parts (⅛ to 1/32) every part is as wide as its share, which goes below the touch size (in the 20rem detail a 1/16 part is about 18 px). Tap, drag and the keyboard still reach them. The accessibility checks (axe, including its target-size rule) cover the bar down to ¼; finer units are not checked for now, and a new issue keeps the equivalent full-size control that WCAG 2.5.8 needs for them.
- **Fixed blocks for time without work look exactly like the Soll bar's free block:** the same fill (the one `requiredView` in `src/ui/calendar/detail.ts` gives the day, e.g. the holiday dots for a half holiday, the half-day hatch for a day rule or a part-time day) and the same text ("frei"). Neighbouring fixed blocks of the same kind merge.
- **Mandatory leave and other plans' leave** lock the parts they cover wholly (the whole part), as today, and are drawn inside the switches they cover in part. On time without work they win over "frei": a part without work that mandatory leave covers is a fixed "Pflichturlaub" block (Muster AG's 31 December, mandatory leave for the whole of a half day), so the bar agrees with the cell, which draws the leave there.
- **Leave on free time from a file.** A part without work that own leave covers on its own (the problem case) is a normal, pressed switch, so a click can take the leave away. Once it's gone, the part is a fixed block again. Own leave that covers free time as part of a booking that also covers work (a full day on 24 December) doesn't turn the free part into a switch: it stays the fixed block.
- **What a press does:** own leave is always one block from one edge of the day. A press on a free part extends the block up to and including it; a press on a booked part shrinks the block to just before it; with no own leave, the block starts from the nearer edge. This is today's logic with more parts. Each press is one change and one undo step; the hint line says the result.
- **Text.** A part too narrow for its text shows none.
- **Names for screen readers.** Halves keep "vormittags" / "nachmittags", the whole day "Ganzer Tag". Smaller parts are named by their ordinal and their share: "4. Sechzehntel" / "4th sixteenth", "2. Viertel" / "2nd quarter". A fixed block reads as its range and kind: "13. bis 16. Sechzehntel: frei" / "13th to 16th sixteenth: off", "nachmittags: Pflichturlaub". A switch is a toggle button (`aria-pressed`), its name doesn't change with its state.
- **Keyboard.** The bar is one Tab stop (roving tabindex). The arrow keys move between the switches, Home and End go to the first and the last one, Space and Enter press. Fixed blocks are not stops; they are read in browse mode. "Ganzer Tag" stays its own Tab stop.
- **Touch and mouse.** A tap or click on the bar acts on the part under the pointer. Pressing and dragging along the bar sets how far the leave reaches from its edge, snapping to the parts. While dragging, the detail itself shows the preview: the bar draws the leave as it would be, and the "Kostet" and "Restarbeitszeit" lines show the values they would have. The hint line can't show it, because on narrow screens the detail is a bottom sheet that shades the page. Releasing applies it as one change and one undo step; the result is said once, by the hint line beside the popover or by the sheet's own status line (`SheetStatus.svelte`). Screen readers hear only that result, not the steps of the drag.

### Part suggestion when a file has no part (0008)

`suggestParts` (used by the reader for `partSuggested`) prefers the side that frees the whole day, as today. Next, it never suggests a side whose leave frees no work while the other side's does: that covers free time and time that mandatory leave already covers (mandatory ½ at the end with own ¼ suggests the start). Then the neighbouring days decide, as today; otherwise there is no suggestion.

## Documentation to change

- `docs/SPEC.md`: the counting model ("The one formula", its table and the paragraph on where partial leave lies); "Finer granularity: prepared, not implemented" (the Data model row's `part` "of the working time", the Engine row, the Operation row, "What is still missing later"); "Calendar interaction" (H on a partly free day, the range rules); the detail view paragraph (parts in the plan's unit, fixed blocks, names, keyboard, tap and drag; the sentence "until issue 0031 … is done" goes); "Problems".
- `docs/day-rules-format.md` and `docs/file-format.md`: `part` means the start or the end of the day; required work and its free time; cost spans.
- `AGENTS.md`, hard rule "Counting model": cost per day = the overlap of the leave with the working time; "UI v1 offers only full and half days" becomes: the detail's leave bar offers the plan's unit, H and ranges half and full days.
- Code comments that say "of the working time" or "inside the work block" (`types.ts`, `leave.ts`, `leave-switch.ts`, `range.ts`, `day-leave.ts`).
- `CHANGELOG.md` under Unreleased.

## Calls made in this design (to check)

- The new problem gets its own code and texts; the day-off case keeps `leaveWithoutRequiredWork`.
- "Ganzer Tag" is ticked whenever the day is wholly free and leave lies on it, also after H on 24 December (only the morning booked); mixed or unticked it books a full day, ticked it removes the leave.
- A full day on 24 December keeps the afternoon as a fixed block, not a pressed switch.
- Halves keep "vormittags" / "nachmittags"; ordinals only for smaller parts.
- More than 32 parts fall back to the smallest multiple of the unit with at most 32 parts.
- The minimum switch width of about 2.75rem, for bars of up to four parts.
- `leaveTakenInOtherPlan` counts only the part of own leave that overlaps work.
- No new calendar key; H and ranges stay at halves.
- The range rules stay; own leave may reach the day's edge across time without work.
- A day wholly free with own leave on it counts as set for "full" and the week click.
- The drag preview shows in the detail (bar, "Kostet", "Restarbeitszeit"), not in the hint line.
- Mandatory leave and other plans' leave on time without work show as their fixed blocks, not "frei".

## Left to the builder

- The data shapes in the engine (how `evaluateLeave` represents the work block and the overlap; whether `costStart` and `costEnd` keep their meaning or change with the stretch code), as long as the results above hold and the perf gate passes.
- The name of the new problem code.
- How the leave bar measures "too narrow for its text" (a container query or a threshold on the share).
- The catalog keys and the ICU form of the part names (`selectordinal` for English ordinals; a select over the possible denominators 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32).
- The order of work, as long as the engine change comes first with its tests, and each commit passes `npm run check`.

## Small items of issue 0014 done along the way

In files this branch changes anyway: the doc comment of the `otherPlan` source day in `src/engine/counting/types.ts` ("covers leave here but never costs"); `checkSpan` moved out of `leave.ts` to a shared place (it is imported by `required.ts`); the nested ternary of the `uncoveredNeed` filter in `src/engine/counting/plan.ts`. Tick them in 0014; the issue stays open.

## New issues

- A `part` for work-week entries, so a part-time day can have its work in the afternoon.
- A calendar key for finer steps and the `minUnit` setting in the contract dialog (replacing the spec's "one more key").
- Leave bar parts below ¼ are smaller than the target size of WCAG 2.5.8 (24 px) and the spec's touch size: an equivalent full-size control (for example "−" / "+" buttons that shorten or lengthen the leave by one part), and the accessibility checks extended to the finer units.

## Testing

- **Engine:** the table above as unit tests; overrides with `part: "start"`; holiday calendars with a part; mandatory leave on free time (costs nothing); the mandatory and other-plan overlap cases; random multiples of 1/32 in the property tests (cost never exceeds the overlap, never exceeds `min(take, required)`, equals it on a full working day); stretches and time off needed unchanged by leave on free time; the new problem; `suggestParts` with mandatory ½ at the end and own ¼, and on 24 December.
- **Example files:** `npm run plan` on every file in `examples/`; every changed cost or problem is explained (the Muster AG plans book 24 December, a full working day there, so they should not change).
- **UI unit tests:** the leave bar for units `"1"`, ½, ¼, 1/16, 1/48 and 1/480; free time at either end; mandatory and other-plan blocks; leave on free time from a file and its removal; press logic; the "Ganzer Tag" states; `changeFor` with H and full on 24 December and on a ¾ day.
- **e2e:** H on 24 December books the morning; the afternoon of 24 December is a fixed block; the problem from a hand-edited plan (`openEditedExample` with own ½ at the end on 2027-12-24); with `openEditedExample` and `minUnit` `"1/16"` (and a work-week day of `"9/16"`): keyboard in the bar (one Tab stop, arrows, Home/End, Space), drag along the bar, the hint line; ARIA snapshots of the bar with ½ and 1/16; the gallery gets the leave bar with finer units and finer working time, with screenshots; axe (with its target-size rule) runs on the bars with units `"1"`, ½ and ¼, and the gallery's bars with finer units are left out of it with a comment that names the new issue.
- **Perf:** `npm run perf`; a scenario only if the cost computation's input-size behaviour changes.
- **Manual (Firefox ESR):** a short guided check of 24 December and of the leave bar with a finer unit in the gallery.
