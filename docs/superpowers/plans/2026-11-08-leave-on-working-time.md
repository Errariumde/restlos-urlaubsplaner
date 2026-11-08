<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Leave on working time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave costs only where it overlaps the day's working time, the app never books leave wholly on free time (a file that does is a problem), and the day detail's leave bar works in the plan's smallest leave unit.

**Architecture:** The engine (`src/engine/counting/leave.ts`) moves own and mandatory leave from "an edge of the work block" to day positions and charges the overlap with the work block; everything downstream (problems, stretches, the reader's part suggestion) reads its results. The UI's range rules (`range.ts`) and leave bar model (`leave-switch.ts`) compute in day positions too; `DayDetail.svelte` renders the bar in parts of the plan's unit, with one Tab stop and dragging.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest with fast-check, Playwright (Chromium, Firefox, WebKit) with axe-core and ARIA snapshots, intl-messageformat catalogs.

**Spec:** `docs/superpowers/specs/2026-11-08-leave-on-working-time-design.md` (read it first; this plan argues from it). Project rules: `AGENTS.md`, `docs/SPEC.md`.

## Global Constraints

- Work in the worktree `/tmp/claude-1001/-home-ai-Projekte-restlos-urlaubsplaner/7af75a1f-1450-42b3-9151-de1b556e19d3/scratchpad/wtb`, on branch `leave-on-working-time`. Never build or test in `/home/ai/Projekte/restlos-urlaubsplaner`.
- Run tools only through npm scripts (`npm run …`, `npm test`). Never `npx`, in any form, not even `npx --no-install`. Type-check with `npm run typecheck`.
- Never add, remove or update a package.
- `npm run check` must pass before every commit (lint, typecheck, tests, perf gate, catalog, CSS and reference checks, `reuse lint`).
- e2e, at low priority and only the specs a task touches, in Chromium and Firefox: `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/<spec>.ts`. Changed screenshots: add `--update-snapshots=changed`, then look at every changed PNG before committing it.
- The perf baseline (`tests/perf/baseline.json`) is never changed. If `npm run perf` fails, stop and report the numbers.
- Commit with exactly this form, on the branch, never on `main`, never push, tag or sign:
  `git -c commit.gpgsign=false commit -m "<subject>" -m "<body>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Subjects are plain sentences ("Charge leave only where it overlaps the working time"), no prefixes.
- 1 day = 480 integer units; no floats; no special cases for ½; every function works for any multiple of 1/480.
- The engine never uses JavaScript `Date`.
- UI texts only through both catalogs (`src/ui/i18n/de.json`, `en.json`), ICU MessageFormat, `ui-texts` skill (`.claude/skills/ui-texts/SKILL.md`): German informal and short, English plain; day amounts through `formatDays`, never `#` for fractions.
- New or changed Svelte components go through the Svelte MCP autofixer (`svelte-autofixer`) until it reports nothing.
- Repository text stands on its own: no pointers to chats, sessions or reviews; an issue number always gets a short description next to it, e.g. "issue 0031 (charge leave only where it overlaps the working time)". `docs/superpowers/` is never linked from anywhere.
- Only features of the current Firefox ESR.
- Sizes in rem, except borders, outlines and marks up to 16 px (`npm run check` enforces it).

## Review Focus

- **Another plan's leave on this plan's time without work** (the other plan charged the afternoon of 31 December; here 31 December is ½ with work in the morning): it covers none of this plan's work, adds no problem, and mandatory leave in the morning is still charged. Test in Task 1.
- **A work-week change that puts a booked half day on free time** (own ½ at the end on a Friday that a new work-week entry makes ½): cost 0, the problem `leaveOnFreeTime`, and the detail can take it away. Test in Task 2 (engine) and Task 4 (bar).
- **A unit that doesn't fit halves** (`minUnit` 160, "1/3"): three parts named "1. Drittel" … "3. Drittel", "Ganzer Tag" present, H still says the plan has no half days. Test in Task 4 (and the e2e in Task 5 keeps `e2e/min-unit.spec.ts` green).
- **The focus after a press removes the pressed switch** (the problem case: the free afternoon's switch turns into a fixed block): the focus stays in the bar on a switch, never on `<body>`. Test in Task 5.
- **A drag that ends outside the bar or is cancelled** (`pointercancel`, Escape): no change is applied and the preview disappears. Test in Task 6.

## Before Task 1 (done by the coordinator, not a task)

The design, this plan and the issue status changes (0031 and 0008 `next` on this branch, 0027 `wontfix`) are committed on `leave-on-working-time` in the main checkout, which then goes back to `main`; the worktree above checks out the branch.

---

### Task 1: The overlap rule in `evaluateLeave`

**Files:**
- Modify: `src/engine/counting/leave.ts` (the whole evaluation; doc comments)
- Modify: `src/engine/weight.ts` (gains `checkSpan`)
- Modify: `src/engine/counting/required.ts:10` (import `checkSpan` from `../weight`)
- Modify: `src/engine/counting/types.ts:8` (`Part` comment) and `:75` (the `otherPlan` source-day comment)
- Modify: `docs/SPEC.md` ("The one formula" with its table and the paragraph after it; "Finer granularity", rows Data model and Engine), `docs/day-rules-format.md` and `docs/file-format.md` (every place `part` says "of the working time"; required work and its free time; the cost spans), `AGENTS.md` (hard rule "Counting model", first sentence about the cost)
- Modify: `issues/0014-file-format-follow-ups.md` (tick the `types.ts:72` comment item and the `checkSpan` item)
- Test: `tests/engine/counting/leave.test.ts`, `tests/engine/weight.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export function checkSpan(from: number, to: number, what: string): void` in `src/engine/weight.ts` (moved unchanged; `leave.ts` and `required.ts` import it from there).
  - `DayLeave` keeps every field with the same name and type and gains `readonly ownWorkOverlap: Units` — the length of own leave's overlap with the work block, charged or not (0 without own leave).
  - `evaluateLeave(required, pieces, charge)` and `overlappingOtherPlanIds(required, pieces)` keep their signatures. Semantics:
    - work block `W = [a, a + r)` with `r = required.value`, `a = freePart === "end" ? 0 : 480 − r` (empty when `r = 0`);
    - own and mandatory pieces lie at day positions: `part: "start"` → `[0, take)`, `"end"` → `[480 − take, 480)`; other-plan pieces at `[from, to)`;
    - `mandPlaced = mand − other`, `ownPlaced = own − mandPlaced`, `otherPlaced = other − ownPlaced` (anywhere in the day);
    - charged = `(mandPlaced ∩ W)` and `(ownPlaced ∩ W)` when `charge`, else nothing; `cost`, `ownCost`, `mandatoryCost`, `charged` from these;
    - `remaining = r − |W ∩ (own ∪ mand ∪ other)|`, `whole = remaining === 0`;
    - `freeStart` / `freeEnd`: 480 when whole, else the length of the stretch of `([0,480) − W) ∪ own ∪ mand ∪ other` touching 0 / 480;
    - `costStart` / `costEnd`: the whole cost / 0 when whole, else the charged length inside `[0, freeStart)` / `[480 − freeEnd, 480)`;
    - `ownCoveredByOtherPlan = |(own ∩ W) ∩ other| > 0`; `overlappingOtherPlanIds` names the other-plan pieces that overlap `own ∩ W`;
    - `placed`: `[]` when the day has no leave, else `ownPlaced`, `mandPlaced`, `otherPlaced` as spans, sorted by `from` — no longer clipped to `W`.

- [ ] **Step 1: Write the failing tests** in `tests/engine/counting/leave.test.ts`:
  - Extend the `it.each` table (`[cost, ownCost, mandatoryCost, remaining, freeStart, freeEnd]`) with:
    - `"24 Dec: own ½ afternoon on free time"`: `at(240)`, `[own(240, "end")]` → `[0, 0, 0, 240, 0, 240]`
    - `"24 Dec: own ½ morning frees the day"`: `at(240)`, `[own(240, "start")]` → `[240, 240, 0, 0, 480, 480]` (already there; keep)
    - `"24 Dec: a full day costs ½"`: `at(240)`, `[own(480)]` → `[240, 240, 0, 0, 480, 480]`
    - `"¾ day: own ½ afternoon costs ¼"`: `at(360)`, `[own(240, "end")]` → `[120, 120, 0, 240, 0, 240]`
    - `"¾ day: own ½ morning costs ½"`: `at(360)`, `[own(240, "start")]` → `[240, 240, 0, 120, 240, 120]`
    - `"free start: own ½ start on free time"`: `at(240, "start")`, `[own(240, "start")]` → `[0, 0, 0, 240, 240, 0]`
    - `"mandatory ½ at the end on a ½ day costs nothing"`: `at(240)`, `[mand(240)]` → `[0, 0, 0, 240, 0, 240]` (replaces the row "mandatory ½ on a day with at most ½")
    - `"another plan's afternoon on this plan's free afternoon"`: `at(240)`, `[mand(240, "start"), other(240, 480)]` → `[240, 0, 240, 0, 480, 480]` (Review Focus)
  - `it("measures own leave's overlap with the work", …)`: `ownWorkOverlap` is 0 for `at(240), [own(240, "end")]`, 240 for `at(240), [own(480)]`, 0 for `at(0), [own(480)]`, 0 without own leave.
  - Replace `"costs min(taken, required work) for any multiple of 1/32"` with `"costs the overlap with the work for any multiple of 1/32"`: for `r`, `take`, `p`, `freePart` from the same arbitraries, `cost` equals the overlap of the piece's day span with `W`, `cost ≤ Math.min(take, r)`, and `cost === Math.min(take, r)` when `r === 480`.
  - Rewrite the slot model in `"matches a slot-by-slot model of the day"` over the 480 slots of the day: slot `i` is work when `a ≤ i < a + r`; a piece covers slot `i` when `i < take` (start), `i ≥ 480 − take` (end) or `from ≤ i < to` (other plan); free slots are non-work slots and slots any kind covers; `p` / `q` are the runs of free slots from 0 / from 479; charged = work slots with (mandatory and not other) or own, counted as mandatory first; placed = mandatory-not-other, else own, else other, over all slots; `ownWorkOverlap` = work slots own covers. Compare the whole `DayLeave` with `toEqual` as now (including `ownWorkOverlap`).
  - Update the expectations that change: `"places other-plan pieces by day position when naming overlaps"` uses `own(240, "end")` and still expects `["afternoon"]`; in `"places each kind where it lies"`, the last line becomes `expect(evaluateLeave(at(0), [own(480)], true).placed).toEqual([{ from: 0, to: 480, kind: "own" }])`.
  - Move the `checkSpan` cases to the weight tests: `checkSpan(0, 480, "x")` passes; `(240, 240)`, `(-15, 240)`, `(240, 495)`, `(1.5, 240)` throw `RangeError`.

- [ ] **Step 2: Run the tests and see them fail**

  Run: `npm test -- tests/engine/counting/leave.test.ts`
  Expected: FAIL on the new rows (e.g. "24 Dec: own ½ afternoon on free time" gets cost 240), on `ownWorkOverlap` (undefined) and on the slot model.

- [ ] **Step 3: Note the example plans' results before the change**

  Run, for each file in `examples/plans/` and `examples/rules/`: `npm run plan -- <file> > $TMPDIR/plan-before/<name>.txt` (create the folder first). Keep the folder for Step 6.

- [ ] **Step 4: Implement** the semantics in the Interfaces block in `src/engine/counting/leave.ts`, move `checkSpan` to `src/engine/weight.ts`, and fix the comments in `leave.ts` and `types.ts` (`Part`: "the start or the end of the day"; the `otherPlan` source day: "Frees the work time it covers and the mandatory leave there; never costs in this plan."). Keep a fast path for a day without leave pieces (most days), which builds no lists.

- [ ] **Step 5: Run the tests and see them pass**

  Run: `npm test -- tests/engine/counting/leave.test.ts tests/engine/weight.test.ts`
  Expected: PASS. Then `npm test` for the whole suite: tests elsewhere that pinned the old cost on a partly free day (plan, suggest, stretches, read and UI tests) fail; fix only those whose expectation the new rule changes, each with the new value the rule gives, and list them in the commit body.

- [ ] **Step 6: Compare the example plans**

  Run Step 3's commands again into `$TMPDIR/plan-after/` and `diff -r $TMPDIR/plan-before $TMPDIR/plan-after`.
  Expected: no difference, or only differences on days whose required work is lowered with leave on its free time; explain each in the commit body. (The Muster AG plans book 24 December, a full working day there, so they should not change.)

- [ ] **Step 7: Update the documentation** named under Files to the overlap rule, with the design's table (normal day, 24 Dec morning/afternoon/full, ¾ day, weekend) in `docs/SPEC.md`, and tick the two 0014 items.

- [ ] **Step 8: Run the check**

  Run: `npm run check`
  Expected: all green, `npm run perf` included. A perf failure stops the task (Global Constraints).

- [ ] **Step 9: Commit**

  `git add -A && git -c commit.gpgsign=false commit -m "Charge leave only where it overlaps the working time" -m "<what changed, the changed test expectations, the example diff>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 2: The problem "leave on time that is off anyway"

**Files:**
- Modify: `src/engine/counting/plan.ts` (`Problem`, `PROBLEM_ORDER`, the problem checks, the `uncoveredNeed` filter)
- Modify: `src/ui/calendar/problems.ts` (`problemText`), `src/ui/i18n/de.json`, `src/ui/i18n/en.json`, `src/gallery/sections/AllowanceSection.svelte` (one sample of the new problem)
- Modify: `docs/SPEC.md` ("Problems"), `issues/0014-file-format-follow-ups.md` (tick the `uncoveredNeed` ternary item)
- Test: `tests/engine/counting/plan.test.ts`, `tests/ui/calendar/problems.test.ts`, `tests/ui/calendar/label.test.ts`, `e2e/problems.spec.ts`

**Interfaces:**
- Consumes: `DayLeave.ownWorkOverlap` (Task 1).
- Produces:
  - `Problem` gains `{ readonly code: "leaveOnFreeTime"; readonly day: DayNumber }`.
  - `PROBLEM_ORDER`: `leaveOutsidePeriod` 0, `leaveWithoutRequiredWork` 1, `leaveOnFreeTime` 2, `leaveTakenInOtherPlan` 3, `conflictingForcedRules` 4, `uncoveredNeed` 5.
  - Raised for a day in the period when own leave lies on it, `required.value > 0` and `evaluation.ownWorkOverlap === 0`.
  - Catalog key `detail.problem.leaveOnFreeTime`: de `"Dieser Urlaub liegt auf ohnehin freier Zeit."`, en `"This leave lies on time that is off anyway."`

- [ ] **Step 1: Write the failing tests**
  - `tests/engine/counting/plan.test.ts`, `it("reports own leave on the free afternoon of 24 December", …)`: a plan with the Christmas Eve rule (`requiredAtMost` 240, `part: "end"`) and own `{ day: 24 Dec, take: 240, part: "end" }` → problems contain `{ code: "leaveOnFreeTime", day }`, the day's cost is 0 and its `remaining` 240.
  - Same file, `it("reports a half day a later work-week entry puts on free time", …)` (Review Focus): a work week whose second entry from a Monday makes Friday 240 (`fri: 240`), own `{ day: that Friday, take: 240, part: "end" }` → `leaveOnFreeTime` on that Friday, cost 0.
  - Same file, `it("keeps leave on a day off as its own problem", …)`: own leave on a Saturday still gives `leaveWithoutRequiredWork` and not `leaveOnFreeTime`.
  - Same file: own full day and own ½ morning on 24 December give no `leaveOnFreeTime`.
  - Same file, `it("leave on free time changes neither stretches nor time off needed", …)`: with the Christmas Eve rule and a `needed` source of 240 at the end on 24 December, the need is covered (no `uncoveredNeed`) with and without own `{ take: 240, part: "end" }` there, and the stretch that starts on 24 December at offset 240 has the same start, end and cost both ways.
  - `tests/ui/calendar/problems.test.ts`: `problemText("leaveOnFreeTime", t)` with the German and English catalogs gives the two sentences above.
  - `e2e/problems.spec.ts`, a `describe` in English and one in German with `openEditedExample(page, { plan: { days: [{ date: "2027-12-24", take: "1/2", part: "end" }] } })`: the cell's `aria-label` ends with `, problem: This leave lies on time that is off anyway.` (German: `…Dieser Urlaub liegt auf ohnehin freier Zeit.`), the problems list has one row with that sentence, and `expectNoPageProblems(page)`.

- [ ] **Step 2: Run them and see them fail**

  Run: `npm test -- tests/engine/counting/plan.test.ts tests/ui/calendar/problems.test.ts`
  Expected: FAIL (no `leaveOnFreeTime`).

- [ ] **Step 3: Implement** the problem in `plan.ts`, rewrite the `uncoveredNeed` filter as `source.type === "needed" && ((source.part ?? "end") === "end" ? evaluation.freeEnd < source.take : evaluation.freeStart < source.take)`, add the case to `problemText`, the catalog keys, and one sample row (`{ code: "leaveOnFreeTime", day: dayFromYmd(2027, 12, 24) }`) in the gallery's allowance section.

- [ ] **Step 4: Run the unit tests and the e2e spec**

  Run: `npm test` then `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/problems.spec.ts e2e/gallery.spec.ts`
  Expected: PASS; the allowance section's screenshots change by the new row only (update them as in Global Constraints and look at them).

- [ ] **Step 5: Update `docs/SPEC.md` "Problems"** (the new problem next to "leave on a day off") and tick the 0014 item.

- [ ] **Step 6: Run the check and commit**

  Run: `npm run check` (green), then commit: subject `Report leave that lies on time that is off anyway as a problem`.

---

### Task 3: The part suggestion prefers the side that frees work (issue 0008)

**Files:**
- Modify: `src/engine/counting/suggest.ts` (`suggestParts`, `suggestPart` doc comment)
- Modify: `docs/file-format.md` (`partSuggested`: what is suggested), `issues/0008-part-suggestion-with-finer-leave-steps.md` (`status: done`, `closed: 2026-11-08`, `branch: leave-on-working-time`)
- Test: `tests/engine/counting/suggest.test.ts`

**Interfaces:**
- Consumes: `evaluateLeave` (Task 1).
- Produces: `suggestParts(input, requests): (Part | null)[]` and `suggestPart(input, day, take)`, same signatures. Order of rules: (1) the side whose leave frees the whole day ("end" if both); (2) if exactly one side's leave lowers `remaining` below the day's `remaining` without the requested leave, that side; (3) the neighbouring days as today; (4) `null`.

- [ ] **Step 1: Write the failing tests** in `tests/engine/counting/suggest.test.ts`:
  - Replace `"suggests the end when the leave covers all work either way"` with `it("suggests the start on 24 December, where the work lies in the morning", …)`: `suggest("2027-12-24", HALF, { contract: { ...BAVARIA, rules: CHRISTMAS_EVE_RULES } })` is `"start"`.
  - `it("prefers the side not covered by mandatory leave", …)`: rule `{ id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF }` (part "end"), `suggest("2027-12-24", 120, …)` is `"start"` (today it is `"end"`, from the free Saturday after).
  - `it("lets the neighbours decide when both sides free work", …)`: `suggest("2027-05-10", 120)` is still `"start"`.

- [ ] **Step 2: Run and see them fail**

  Run: `npm test -- tests/engine/counting/suggest.test.ts`
  Expected: FAIL on the mandatory case (gets `"end"`); the 24 December case may already pass after Task 1 — that is fine, it pins the result.

- [ ] **Step 3: Implement** rule (2) in `suggestParts`, between the whole-day check and the neighbours.

- [ ] **Step 4: Run** `npm test` (PASS), update `docs/file-format.md` and close issue 0008.

- [ ] **Step 5: Run the check and commit**

  `npm run check`, then commit: subject `Suggest the part of the day where the leave frees work`.

---

### Task 4: Range rules and the leave bar model in day positions and in the plan's unit

**Files:**
- Modify: `src/ui/calendar/range.ts` (`freeRest` replaced, `changeFor`, new exports)
- Modify: `src/ui/calendar/leave-switch.ts` (rewritten model)
- Modify: `src/ui/calendar/day-leave.ts` (doc comment only, unless a test shows a change; see Step 5)
- Modify: `docs/SPEC.md` ("Calendar interaction", the range rules: "an edge of the working time" → "an edge of the day, reached directly or across time without work"; H on a partly free day)
- Test: `tests/ui/calendar/range.test.ts`, `tests/ui/calendar/leave-switch.test.ts`, `tests/ui/calendar/day-leave.test.ts`

**Interfaces:**
- Consumes: the engine's day results (Task 1); `LeaveChange` from `src/ui/worker/protocol.ts`.
- Produces, in `src/ui/calendar/range.ts`:
  - `export function whollyFree(day: Pick<DayResult, "required" | "leave">): boolean` — the work block is all covered by leave of any kind (true when `required.value` is 0).
  - `export function workLeft(day: Pick<DayResult, "required" | "leave">): readonly [from: Units, to: Units][]` — the work block minus mandatory and other-plan spans, sorted, in day positions.
  - `export function changeFor(day: Pick<DayResult, "day" | "inPeriod" | "required" | "leave">, action: RangeAction): LeaveChange | undefined` (wider parameter type, same results where the design keeps them):
    - remove: as today;
    - no required work, outside the period: `undefined` as today;
    - full on a day that is `whollyFree` with own leave on it: `undefined` (counts as set);
    - no mandatory or other-plan leave covers work: full → `{ day, take: 480 }`; half → `{ take: 240, part: "end" }` when the end half `[240, 480)` overlaps the work block, else `{ take: 240, part: "start" }`;
    - otherwise `workLeft` must be one stretch `[f, t)` touching the work block's start (edge "start") or end (edge "end"), else `undefined`. Full: edge start → `take = t`, part "start"; edge end → `take = 480 − f`, part "end". Half: edge start → `take = Math.min(t, f + 240)`; edge end → `take = 480 − Math.max(f, t − 240)`. A take of 480 is written without a part;
    - unchanged own leave → `undefined` as today.
- Produces, in `src/ui/calendar/leave-switch.ts`:
  - `export function partCount(minUnit: Units): number` — the largest divisor of `480 / minUnit` that is at most 32 (`480 → 1`, `240 → 2`, `120 → 4`, `30 → 16`, `160 → 3`, `10 → 24`, `1 → 32`).
  - `export type PartName = { readonly kind: "day" } | { readonly kind: "half"; readonly half: "morning" | "afternoon" } | { readonly kind: "part"; readonly index: number; readonly count: number }` (`index` 1-based; "day" when there is one part, "half" when two).
  - `export type LeaveSegment =`
    - `| { readonly kind: "switch"; readonly from: Units; readonly to: Units; readonly name: PartName; readonly pressed: Pressed; readonly fills: readonly Fill[]; readonly change?: LeaveChange }` — `from`/`to` is the drawn span: the part cut to its working time (the whole part for a pressed switch over free time, below);
    - `| { readonly kind: "free" | "mandatory" | "otherPlan"; readonly from: Units; readonly to: Units; readonly first: PartName; readonly last: PartName }` — a fixed block and the first and last part it lies in; neighbouring blocks of one kind merge.
  - `LeaveSwitch` gains `readonly parts: number` (`partCount(minUnit)`); `amount` and `fullDay` keep their types.
  - `export function reach(day: DayResult, minUnit: Units, edge: Part, index: number): LeaveChange | undefined` — own leave from `edge` through part `index` (0-based), with the same guards as a press; for dragging in Task 6.
  - `export function withOwnLeave(day: DayResult, change: LeaveChange): DayResult` — the day with its own piece replaced by the change (none for take 0), for drawing a preview in Task 6.
- Rules of `leaveSwitch(day, minUnit)` (the design's "The leave bar in the plan's unit"):
  - parts of size `480 / parts`; a part wholly covered by mandatory or another plan's leave (the whole part) is a fixed block of that kind (mandatory when it covers at least as much as the other plan, as today);
  - a part without work: a fixed `"free"` block; but when own leave lies on the day and overlaps no work (the problem case, also on a day without work), a part own leave covers is a pressed switch whose change removes the own leave;
  - a part with work: a switch drawn over its working time, and a `"free"` block (or mandatory/other-plan block if they cover it) for the rest of the part;
  - a press follows today's extend/shrink/nearer-edge logic over part indices; a resulting change whose leave would overlap no work becomes the removal;
  - `fullDay` only when `parts > 1` and there is at least one switch; `checked`: `"true"` when `whollyFree(day)` and the day has leave of any kind, `"false"` when it has none, else `"mixed"`; `change`: `"true"` → removal (undefined without own leave); otherwise `changeFor(day, "full")` when own leave can be set (in the period, required work > 0), else removal.

- [ ] **Step 1: Write the failing range tests** in `tests/ui/calendar/range.test.ts` (use the file's existing stubs and helpers):
  - `it("puts H on 24 December in the morning, where the work is", …)`: `changeFor(christmasEve, "half")` → `{ day, take: 240, part: "start" }`.
  - `it("keeps H in the afternoon of a ¾ day, which has work there", …)`: required 360, freePart "end" → `{ take: 240, part: "end" }`.
  - `it("reaches the work left across free time", …)`: required 240 (end free), mandatory 120 at the start → full `{ take: 360, part: "end" }`, half `{ take: 360, part: "end" }`.
  - `it("books the morning beside mandatory leave in the last quarter", …)`: required 480, mandatory 120 at the end → half `{ take: 240, part: "start" }`.
  - `it("leaves a day alone whose work left lies on both sides of another plan's leave", …)`: other plan `[300, 420)` → half and full `undefined`.
  - `it("counts a day made wholly free by own leave as set", …)`: 24 December with own `{ take: 240, part: "start" }` → full `undefined`; `weekChanges` over a week whose days are all set removes the week.
  - `whollyFree` and `workLeft` on 24 December with and without own leave.

- [ ] **Step 2: Write the failing leave bar tests** in `tests/ui/calendar/leave-switch.test.ts`. Give the `stub` a `freePart` (default `"end"`). Rewrite `short()` to `[name, pressed, change]` for switches (name as `PartName`) and `[kind, from, to]` for fixed blocks. Tests:
  - `partCount` for 480, 240, 120, 30, 160, 10, 1 → 1, 2, 4, 16, 3, 24, 32.
  - `it("shows the free afternoon of 24 December as a fixed block", …)`: `stub({ required: 240 })`, unit 240 → `[[half morning, "false", { take: 240, part: "start" }], ["free", 240, 480]]`, `fullDay` `{ checked: "false", change: full }`.
  - `it("ticks Ganzer Tag after H on 24 December", …)`: own 240 start → morning `"true"` with removal, `fullDay` `{ checked: "true", change: remove }`.
  - `it("keeps the free afternoon fixed under a full day", …)`: own 480 on 24 December → `[[morning, "true", remove], ["free", 240, 480]]`.
  - `it("makes the free afternoon a switch for leave lying only there", …)` (problem case): own 240 end on 24 December → `[[morning, "false", full], [afternoon, "true", remove]]`, `fullDay.checked` `"mixed"`.
  - `it("cuts the afternoon of a ¾ day to its work", …)`: required 360 → switches `morning [0,240)` and `afternoon [240,360)`, then `["free", 360, 480]`.
  - `it("splits the day into quarters", …)`: unit 120, full working day → four switches named `{ kind: "part", index: 1…4, count: 4 }`.
  - `it("splits the day into thirds", …)` (Review Focus): unit 160 → three switches `index 1…3, count 3`, and a `fullDay`.
  - `it("merges the free parts of 24 December in sixteenths", …)`: unit 30, required 240 → eight switches, then one `["free", 240, 480]` with `first` `{ part 9 of 16 }` and `last` `{ part 16 of 16 }`.
  - `it("shows mandatory leave on free time as its block", …)`: required 240, mandatory 480 → `[["mandatory", 0, 480]]`.
  - `it("takes own leave away instead of moving it onto free time", …)`: required 240 with the free time at the start, own 480 → the afternoon switch's change is the removal.
  - Keep the existing tests that the design doesn't change (beside mandatory leave and another plan's leave; outside the period), adjusted to the new `short()`. On a day without required work, the part own leave doesn't cover becomes `["free", …]` instead of a disabled switch.
  - `reach` and `withOwnLeave`: `reach(normalDay, 30, "end", 12)` → `{ day, take: 120, part: "end" }`; on 24 December, `reach(christmasEve, 30, "end", 12)` would lie only on free time, so it is `undefined` without own leave and `{ day, take: 0 }` with own leave; `withOwnLeave(day, { day, take: 0 })` has no own piece, `withOwnLeave(day, { day, take: 240, part: "start" })` has exactly one own piece with those values.

- [ ] **Step 3: Run and see them fail**

  Run: `npm test -- tests/ui/calendar/range.test.ts tests/ui/calendar/leave-switch.test.ts`
  Expected: FAIL (H on 24 December gives `part: "end"`; no `partCount`, no fixed `"free"` blocks).

- [ ] **Step 4: Implement** `range.ts` and `leave-switch.ts` per the Interfaces block. Keep `leave-switch.ts` focused on the bar; the range rules stay in `range.ts`.

- [ ] **Step 5: Run the UI unit tests**

  Run: `npm test`
  Expected: PASS. If `tests/ui/calendar/day-leave.test.ts` changes because placed spans now also lie on free time (a day without work with both own and mandatory leave now shows mandatory, as on working days), update that expectation, say so in the commit body and fix `day-leave.ts`'s doc comment.

- [ ] **Step 6: Update the `DayDetail.svelte` markup just enough to compile** with the new `LeaveSegment` (render `"free"` blocks as `.locked.free` with the text `detail.off`; names as before for halves and the whole day, a placeholder of the part's ordinal for smaller parts); Task 5 does the real rendering.

- [ ] **Step 7: Run the affected e2e specs**

  Run: `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/keyboard.spec.ts e2e/detail.spec.ts e2e/allowance.spec.ts e2e/touch.spec.ts e2e/min-unit.spec.ts`
  Add to `e2e/keyboard.spec.ts`: `test("H on 24 December books the morning", …)` — the cell's `aria-label` contains `leave half, morning` and the hint line `24 Dec: leave half, morning.` Fix expectations the design changes (24 December, 23 November in the gallery), nothing else.

- [ ] **Step 8: Update `docs/SPEC.md` "Calendar interaction"**, run `npm run check`, commit: subject `Book leave only where it frees work, in the range rules and the leave bar`.

---

### Task 5: Render the leave bar: fixed blocks, names, widths, one Tab stop

**Files:**
- Modify: `src/ui/calendar/DayDetail.svelte` (the switches bar, its CSS, keyboard)
- Modify: `src/ui/i18n/de.json`, `src/ui/i18n/en.json` (part names, fixed block names)
- Modify: `src/gallery/sections/detail-situations.ts`, `src/gallery/sections/DayDetailSection.svelte` (finer situations), gallery catalog keys
- Modify: `e2e/helpers.ts` (`axeViolations` gains an `exclude` list), `e2e/gallery.spec.ts`
- Modify: `docs/SPEC.md` (detail view paragraph; "Finer granularity", Operation row and "What is still missing later"; "Accessibility" if the bar's keyboard is listed), `AGENTS.md` (hard rule: "UI v1 offers only full and half days" → the detail's leave bar offers the plan's unit, H and ranges half and full days)
- Test: `e2e/detail.spec.ts`, `e2e/screen-reader.spec.ts`, `e2e/gallery.spec.ts`

**Interfaces:**
- Consumes: `LeaveSwitch`, `LeaveSegment`, `PartName`, `partCount` (Task 4); `DayDetailData.required.off` (`OffKind`, `src/ui/calendar/detail.ts`).
- Produces:
  - Catalog keys (both languages):
    - `detail.part`: de `"{index}. {count, plural, =3 {Drittel} =4 {Viertel} =5 {Fünftel} =6 {Sechstel} =8 {Achtel} =10 {Zehntel} =12 {Zwölftel} =15 {Fünfzehntel} =16 {Sechzehntel} =20 {Zwanzigstel} =24 {Vierundzwanzigstel} =30 {Dreißigstel} other {Zweiunddreißigstel}}"`; en `"{index, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} {count, plural, =3 {third} =4 {quarter} =5 {fifth} =6 {sixth} =8 {eighth} =10 {tenth} =12 {twelfth} =15 {fifteenth} =16 {sixteenth} =20 {twentieth} =24 {twenty-fourth} =30 {thirtieth} other {thirty-second}}"`.
    - `detail.partRange`: de `"{first} bis {last}"`, en `"{first} to {last}"` (for a block over several parts; a block over one part uses that part's name; halves use `detail.segment`).
    - `detail.fixed`: de `"{where}: {kind, select, free {frei} mandatory {Pflichturlaub} other {aus anderem Plan}}"`, en `"{where}: {kind, select, free {off} mandatory {mandatory leave} other {from another plan}}"`.
  - `axeViolations(page, exclude?: readonly string[])` in `e2e/helpers.ts`: passes `{ include: [document], exclude }` to `axe.run`.
  - Gallery: a group "Leave in quarters" (plan with `minUnit` `"1/4"`: a normal day, a ¾ day, 24 December) and a group "Leave in sixteenths" (`minUnit` `"1/16"`: a normal day with `take "3/16"` at the end, a `"9/16"` work-week day, 24 December) in the day detail section; the sixteenths group's wrapper carries `data-axe-skip`, with a comment naming the new issue (parts below ¼ under the target size).
- Rendering rules (design, "The leave bar in the plan's unit"):
  - a `"free"` block uses the Soll bar's fill for `detail.required.off` (reuse the `off-*` rules: `.locked.free.off-holiday` etc.) and shows `detail.off`;
  - fixed blocks: visible text `aria-hidden="true"`, the name from `detail.fixed` in a `.spoken` span;
  - a switch's accessible name is its part name (`detail.segment` for halves and the whole day, `detail.part` otherwise); its visible text is the same and is hidden when the part is narrower than about 2.5rem (a container query on the segment);
  - with `parts ≤ 4` a switch has `min-inline-size: 2.75rem`;
  - the bar is one Tab stop: switches have `tabindex="-1"` except the current one (`0`), the first switch until another gets the focus; ArrowRight/ArrowDown and ArrowLeft/ArrowUp move to the next/previous switch, Home/End to the first/last, Space and Enter press; fixed blocks are skipped; after a press, the focus stays on the pressed switch if it still exists, else on the switch nearest to it, never on `<body>`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/detail.spec.ts` (English locale, viewport 1280×800; open the detail with the context-menu key on the cell as the existing tests do):
  - `test("the free afternoon of 24 December is a fixed block", …)`: in the detail of 24 December the group "Leave on this day" has one button `Morning` and the text `Afternoon: off` (the `.spoken` name), no button `Afternoon`.
  - `test("the leave bar is one Tab stop", …)` with `openEditedExample(page, { contract: { minUnit: "1/16" } })` on 14 June: from the focused "Full day" checkbox, Tab reaches `1st sixteenth`; ArrowRight reaches `2nd sixteenth`; End reaches `16th sixteenth`; Home goes back to `1st sixteenth`; one more Tab leaves the bar; Shift+Tab comes back to `1st sixteenth`; ArrowRight to `13th sixteenth` and Space sets the leave, and the status line starts with `14 Jun: leave ¼, at the end of the day.`
  - `test("the focus stays in the bar when the pressed switch goes", …)` (Review Focus): `openEditedExample` with own `{ date: "2027-12-24", take: "1/2", part: "end" }`; focus `Afternoon`, Space → the leave is gone, `Afternoon` is no longer a button, and the focused element is the `Morning` button.
  - `e2e/screen-reader.spec.ts`: ARIA snapshots of the leave group on 24 December (unit ½: `button "Morning" [pressed=false]`, `text: "Afternoon: off"`) and on 14 June with unit 1/16 (16 buttons `1st sixteenth` … `16th sixteenth`, in contain mode).
  - `e2e/gallery.spec.ts`: the axe run of the day detail section passes with `exclude: ["[data-axe-skip]"]`; the quarters group is inside the checked part.

- [ ] **Step 2: Run and see them fail**

  Run: `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/detail.spec.ts e2e/screen-reader.spec.ts`
  Expected: FAIL (no `afternoon: off`, several Tab stops).

- [ ] **Step 3: Implement** the catalog keys (`ui-texts` skill), the rendering rules and the keyboard in `DayDetail.svelte`, the gallery groups, `axeViolations`' `exclude`. Run the Svelte autofixer on `DayDetail.svelte` and `DayDetailSection.svelte`.

- [ ] **Step 4: Run the e2e specs and update screenshots**

  Run: `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/detail.spec.ts e2e/screen-reader.spec.ts e2e/gallery.spec.ts e2e/a11y.spec.ts e2e/narrow.spec.ts`, then with `--update-snapshots=changed` for the gallery and detail screenshots the design changes. Look at each changed PNG: only the leave bar (and the new gallery groups) may differ.
  Expected: PASS, axe clean on everything but `[data-axe-skip]`.

- [ ] **Step 5: Update `docs/SPEC.md` and `AGENTS.md`** as listed under Files (the detail view paragraph describes parts in the plan's unit, fixed blocks in the Soll bar's look, names, widths, one Tab stop; the sentence "until issue 0031 … is done" goes).

- [ ] **Step 6: Run the check and commit**

  `npm run check`, then commit: subject `Show the leave bar in the plan's unit, with fixed blocks for time without work and one Tab stop`.

---

### Task 6: Drag along the leave bar with a preview in the detail

**Files:**
- Modify: `src/ui/worker/protocol.ts` (`Hint`), `src/ui/worker/session.ts` (`preview`)
- Modify: `src/ui/state/app.svelte.ts` (a preview that leaves the hint line alone)
- Modify: `src/ui/calendar/DayDetail.svelte` (pointer handling, preview drawing)
- Modify: `docs/SPEC.md` (detail view: tap and drag on the bar, the preview in the detail)
- Test: `tests/ui/worker/session.test.ts`, `tests/ui/calendar/leave-switch.test.ts` (if `reach` needs more cases), `e2e/detail.spec.ts`, `e2e/touch.spec.ts`

**Interfaces:**
- Consumes: `reach`, `withOwnLeave` (Task 4); the rendering of Task 5.
- Produces:
  - `Hint` gains `readonly day?: { readonly cost: Units; readonly remaining: Units }` — when exactly one day changes, that day's cost and remaining work after the change.
  - `app.previewDay(change: LeaveChange): Promise<Hint | undefined>` in `src/ui/state/app.svelte.ts` — asks the worker, returns the hint and changes neither `app.hint` nor `app.status`.
- Behaviour (design, "Touch and mouse"): `pointerdown` on a switch captures the pointer; the edge is own leave's `part` when it has one, else the nearer edge of the pressed part; `pointermove` maps the pointer's x to a part index (clamped to the switches) and, when the index changes, draws `leaveSwitch(withOwnLeave(day, change), minUnit)` with `change = reach(day, minUnit, edge, index)` and shows `hint.day.cost` and `hint.day.remaining` in the "Kostet" and "Restarbeitszeit" lines once `previewDay` answers (a stale answer is dropped); `pointerup` on the bar applies the change through `onapply` as one change (a plain tap without moving to another part is a press, as in Task 5); `pointercancel`, Escape or `pointerup` outside the bar drop the preview without a change. Nothing is announced during the drag.

- [ ] **Step 1: Write the failing tests**
  - `tests/ui/worker/session.test.ts`, `it("gives the day's cost and work left for a one-day preview", …)`: previewing `{ day: 24 Dec, take: 240, part: "start" }` on the example gives `day: { cost: 240, remaining: 0 }`; previewing two days gives no `day`.
  - `e2e/detail.spec.ts`, `test("dragging along the bar previews and applies the leave", …)` with `openEditedExample(page, { contract: { minUnit: "1/16" } })` on 14 June (mouse): press on `13th sixteenth`, move to `9th sixteenth`; while held, the detail's "Costs" line reads `½ day` and no change is applied (the cell's label still says `no leave`); release → the cell's label says `leave half, afternoon` and one undo step exists.
  - Same file, `test("a cancelled drag changes nothing", …)` (Review Focus): press, move, press Escape (and, in a second case, release outside the detail) → the "Costs" line goes back to `–`, the cell's label still says `no leave`, Undo stays disabled.
  - `e2e/touch.spec.ts`: the same drag with touch at 375 px in the bottom sheet (the preview shows in the sheet's "Costs" line).

- [ ] **Step 2: Run and see them fail**

  Run: `npm test -- tests/ui/worker/session.test.ts` and `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e:file -- --project=chromium --project=firefox e2e/detail.spec.ts e2e/touch.spec.ts`
  Expected: FAIL (no `day` in the hint; dragging does nothing).

- [ ] **Step 3: Implement** the hint field, `app.previewDay` and the pointer handling. Run the Svelte autofixer on `DayDetail.svelte`.

- [ ] **Step 4: Run the tests again**

  Same commands. Expected: PASS.

- [ ] **Step 5: Update `docs/SPEC.md`** (detail view: tap and drag, the preview in the detail, the result said once after release).

- [ ] **Step 6: Run the check and commit**

  `npm run check`, then commit: subject `Drag along the leave bar, with the preview in the detail`.

---

### Task 7: Close the issue, file the follow-ups, full run

**Files:**
- Modify: `issues/0031-charge-leave-only-where-it-overlaps-working-time.md` (tick its criteria; `status: done`, `closed: 2026-11-08`, `branch: leave-on-working-time`)
- Create: three issues from `issues/_template.md`, numbered from the highest existing number + 1 (0047 to 0049 if nothing else came in), `status: open`, with SPDX headers:
  - a `part` for work-week entries, so a part-time day can have its work in the afternoon;
  - a calendar key for finer steps and the `minUnit` setting in the contract dialog (`docs/SPEC.md`, "Finer granularity", now points to it instead of "one more key");
  - leave bar parts below ¼ under the target size of WCAG 2.5.8 (24 px) and the spec's touch size: an equivalent full-size control (for example "−" / "+" buttons that shorten or lengthen the leave by one part), and axe on the finer units (`data-axe-skip` in the gallery points to this issue by number and description).
- Modify: `CHANGELOG.md` (Unreleased: leave costs only where it overlaps the working time; the leave bar in the plan's unit; the new problem)
- Modify: `src/gallery/sections/detail-situations.ts` comment (the issue number of the target-size issue next to `data-axe-skip`)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Write the issues and the changelog entry**, close 0031, put the target-size issue's number and description next to `data-axe-skip`.

- [ ] **Step 2: Run the full e2e suite once**

  Run: `ulimit -c 0 && nice -n 19 taskset -c 0-3 npm run test:e2e`
  Expected: all green in Chromium, Firefox and WebKit.

- [ ] **Step 3: Run the check and commit**

  `npm run check`, then commit: subject `Close issue 0031 and file the follow-ups of the finer leave bar`.
