---
status: open
priority: 2
area: engine (file format)
branch:
created: 2026-10-19
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Crafted files at the limits read in about a second

## Problem

The design, `docs/SPEC.md:383` and `docs/file-format.md:349` promise that reading and computing any file within the limits takes "well under a second". For crafted files at the limits this no longer holds.

The worst crafted file found so far stays within every limit:

- 37 sources × 2,000 match entries, 10.47 MB;
- 73,830 distinct entries;
- `readFile` takes 1.0–1.15 s under Node on an i7-8650U.

Each entry looks like this:

```json
{"match":{"type":"range","from":{"type":"easter","offset":k},"to":{"type":"fixed","month":1,"day":k-280},"weekdays":["<(Sunday + k + 6) mod 7>"]},"validFrom":v}
```

- `k` runs from 286 to 338 and `v` from 1600 up, so every entry is distinct and the memo never hits.
- The range exists only in years with an early Easter, for 1–6 days, and never on the filtered weekday. So `neverApplies` has to walk most of the 400 years for each entry.

Realistic files read in a few milliseconds. Reading can no longer hang: before the fix the same kind of file took up to about 28 minutes.

## Context

- Finding C1 of the final review of branch `file-format`, fixed in 2e7e58a, and the re-review of that fix (2026-10-19).
- Base cost: reading 85,000–100,000 entries from 10 MB takes about 0.4 s even when every warning is answered in O(1). The scan over the years adds the rest.
- Times of the tested shapes, under plain Node:
  - shape (a) in `tests/engine/file/read-plan.test.ts`: 0.57 s;
  - shape (b): 0.54–0.56 s;
  - under vitest, 0.6–0.73 s against a 1,000 ms bound (see the note in issue 0011).
- Contract rules are already capped at 1,000, which bounds their part of the scan at about 15 ms. The open cost comes from match entries in sources: 50 sources × 2,000 entries.

## Acceptance criteria

- [ ] The maintainer has chosen one of the options below.
- [ ] A timing test with the shape above (as many distinct entries as the limits allow) reads in under 1,000 ms, or under the bound the chosen option gives.
- [ ] Design, SPEC and `docs/file-format.md` agree with the code.
- [ ] `npm run check` passes.

## Notes

Options:

1. **A limit on match entries per file.** Example: at most 10,000 match entries across all sources, refused as `limitExceeded` with `limit: "matchEntries"`.
   - At about 15 µs per entry in the worst shape, that bounds the scan at about 0.15 s.
   - Date entries and other-plan spans are not match entries and stay at 2,000 per source.
   - This changes the file format's limits table, so it is the maintainer's decision (ruling R16 of the branch).
2. **Another shortcut.** For example, a tighter O(1) bound on the occurrence length for starts with a fixed weekday; with today's slack of 366 days the bound comes out one day too long.
   - This kills this family, but not necessarily the next one.
   - The base cost of about 0.4–0.6 s for 85,000–100,000 entries stays, which is not "well under a second" either.
3. **Reword the promise.** For example: "Realistic files read in milliseconds; a crafted file at the limits takes up to about a second." The code stays as it is.

## Decisions

Agreed with the maintainer on 2026-10-19 and 2026-10-20. The spec texts follow once the open points below are decided.

- Opening runs in two visible steps: reading, then a check that produces the rule hints (`neverApplies`, `leapYearLength`, `mixedRangeEnds`). This replaces options 1–3.
- No check before saving: a hint depends only on the rule, and the rule dialog checks every edit. The editor for source entries with a `match` does the same (UI branch).
- The check counts its progress in rules: day rules plus match entries. The worst case may take up to about 2 s, with feedback.
- The opened file's report is presented with the standard severities Error, Warning and Info.
- Cancel while reading; Skip and Cancel while checking.
- The progress bar shows from the start: indeterminate while reading, "rule n of N" while checking. The UI branch handles files that finish at once.
- Spec changes approved on 2026-10-20:
  - **2:** "well under a second" is replaced by: reading and checking grow at most linearly, gated by `npm run perf`. The target is 2 s for the worst file in Firefox ESR on the i7-8650U, noted at each release.
  - **3:** opening and checking run in a Web Worker, with the progress bar from the start, Cancel while reading, and Skip and Cancel while checking. The version-1 feasibility tests get a row for Web Workers from `file://` with the CSP in `<meta>`.
  - **5:** Valgrind joins the dev shell. `npm run perf` counts instructions with Cachegrind and V8's `--predictable`, with a growth check and a budget check against `perf/baseline.json`. It runs in `npm run check` and in CI. Tests make no wall-clock assertions.
- Approved on 2026-10-20, as proposed:
  - **1:** the read report keeps only what reading did. The check step returns its own list in the same form (code, path, data), with the hint as the code (`neverApplies`, `leapYearLength`, `mixedRangeEnds`). The UI shows both lists together, sorted by severity. Every caller of `readFile` runs the check too: the UI, `npm run plan` and the tests.
  - **4:** each code has a fixed severity.
    - **Error** (not loaded, lost when saving): `invalidEntry`, `duplicateDate`, `duplicateId`, `textTooLong`, `sourceTooLarge`, `templateTooLarge`, `unknownReference`, `unknownLocalRule`, `personalSourceInRuleSet`, `unknownField`.
    - **Warning** (loaded, but changed or probably wrong): `invalidMinUnit`, `partSuggested`, `notMultipleOfMinUnit`, `neverApplies`, `leapYearLength`, `mixedRangeEnds`.
    - **Info** (loaded unchanged): `outsidePeriod`, and `checkSkipped` when the user skips the check.
    - A refusal is not in the list: the file doesn't open, and one error message says why.
    - The buttons: with at least one Error, "Open without these parts" and "Cancel"; otherwise "OK".
  - **`npm run perf`:** each scenario runs at 8× and 16× its base size. The growth check allows at most 2.2× the work for the doubled input; linear code measures 1.95×. The budget check allows at most 5 % above `perf/baseline.json`.

Measurements behind the decisions (scratch runs, 2026-10-19/20, Node 24.21, Valgrind 3.26):

- Cachegrind repeats: without `--predictable` one read varied by 16 %; with it, by 0.003 %.
- A planted quadratic bug (the report searching its own list for duplicates) doubled the instruction count already at 1,000 entries, where it costs only 30 ms natively.
- Linear code grows by 4.1× from 1,000 to 8,000 entries and by 1.95× from 8,000 to 16,000. The bug grows by 23.5× from 1,000 to 8,000 entries.
- Handing the worst model from a worker to the page: 99 ms on the worker side and 172 ms on the page side by structured clone; 45 ms and 92 ms as a JSON string.
