---
status: open
priority: 3
area: engine (file format, counting model)
branch:
created: 2026-10-19
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Small code and test gaps left from the file-format branch

## Problem

The task reviews of branch `file-format` found small problems that were left for later. None of them changes what the engine computes for a valid file. They are listed here so they aren't lost with the branch's working notes.

## Context

- Branch `file-format`: the task reviews of Tasks 1–9 (2026-10-18/19) and the re-review of the final fix wave (2026-10-19).
- Fixed on the branch itself, so not listed here:
  - `except` as a `Set`;
  - out-of-period `partSuggested` order;
  - the middle-span property for mutual imports;
  - issue 0006's note.

## Acceptance criteria

Code:

- [ ] `src/engine/counting/types.ts:72`: the doc comment of the `otherPlan` piece says "covers leave here but never costs". Own leave on such a day is still charged. Suggested wording: "Frees the work time it covers and the mandatory leave there; never costs in this plan."
- [ ] `checkSpan` lives in `leave.ts` and is imported by `required.ts`, which inverts the layering. Move it to a shared place, e.g. next to the weight helpers.
- [ ] `src/engine/counting/plan.ts:141-145`: the `uncoveredNeed` filter is a nested ternary that is hard to read. Test `source.type === "needed"` first.
- [ ] When the reader drops a rule, the rule's other report entries (`unknownReference`, `ruleWarning`) stay in the report. Collect per-rule entries in a scratch report and keep only the drop entry.
- [ ] `parseAmount` (`src/engine/weight.ts`) gives `WeightError` "syntax" instead of "range" for an over-long whole part.
- [ ] Source entries on the same date keep their input order. `except` is neither sorted nor de-duplicated. The round trip still holds, but two files with the same content can differ in text.
- [ ] An image with empty `data` is accepted, and duplicate image names within a template aren't checked.
- [ ] Remove the casts:
  - `source as FileSource` in `read-sources.ts`;
  - `entry as {…}` in `model.ts`;
  - in their place, narrow on the source type.
- [ ] `expandSources` checks the 50,000-day limit after each entry, not each day, so it can overshoot by one entry's expansion (about 1,400 days) before stopping.
- [ ] The `if (!country)` check in `planInput` (`model.ts:79`) is redundant, since the reader already refuses an unknown country.
- [ ] `readFile` expands the sources twice: once for the limit check (`read.ts:73`), once in `planInput(draft)`. At 50,000 days this doubles the cost of that step.
- [ ] `warningKey` (`src/engine/counting/warnings.ts:118-125`) collides for malformed ranges, which the reader rejects:
  - `weekdays: []` and absent `weekdays` give the same key, so after the absent variant is memoized, `dayRuleWarningsMemo()` returns `[]` instead of throwing;
  - a range with both `to` and `days` drops `days` from the key.

  Either say "validated rules only" in the doc comment of the exported `dayRuleWarningsMemo`, or include both in the key.
- [ ] `src/engine/counting/match.ts:48-49`: the comment says a range "may start in Y − 1 and end in Y + 1". It can also end in Y + 2, for a `weekdayRelative` "after 12/31" end, which is why the kind skip uses `toYear - 3`. The code is right; fix the comment.

Tests:

- [ ] A `needed` source with part `"start"` (the `freeStart` path).
- [ ] Two `needed` sources on one day, checking de-duplication and order.
- [ ] Problem order next to `conflictingForcedRules`.
- [ ] A range at `MAX_YEAR` that `computationWindow` clamps.
- [ ] The three "1,000 rules" timing tests (`tests/engine/file/read-plan.test.ts:288-297`) use 1,000 identical matches. The memo answers 999 of them, so the tests guard the memo, not the walk. Make the rules distinct, e.g. with their own `validFrom`.
- [ ] Writer key order for the date-rule types, `nonLeap`, `range.days` and `validUntil`, and for `mandatory`, `needed` and `paidClosure` entries. Today the fixed expected text pins the key order only for fixed, easter and range (`to`, `weekdays`).
- [ ] Arbitraries:
  - drop the full-day `take` with part `"end"`;
  - let `plainText` exceed 20 characters, so long notes get generated.
- [ ] `scripts/ts-hooks.js`: the retry chain.
- [ ] `plan-summary.ts`, the remaining formatter branches:
  - a stretch ending mid-day;
  - mixed numbers such as `10 1/2`;
  - problems with `sourceIds`;
  - the refusal data suffix.

  Assert whole lines instead of `toContain`.
- [ ] `npm run check` passes.

## Notes

- Week, period, leave and overrides are passed by reference into `PlanInput`. That is fine as long as the engine never mutates them. Keep it in mind if it ever does.
- A top-level JSON value that isn't an object is refused as `unknownSchema`. The design doesn't say which code to use; this is acceptable.
