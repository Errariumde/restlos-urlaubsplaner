---
status: open
priority: 2
area: tests (performance gate)
branch:
created: 2026-10-23
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# The performance gate's counts depend on where the repository is checked out

## Problem

`npm run perf` compares instruction counts with `tests/perf/baseline.json` and treats them as comparable when Node and Valgrind are the same. The same commit, with the same Node and Valgrind, counts differently in another directory: enough to fail the 5 % budget.

Measured on 2026-10-23 with Node v24.21.0 and valgrind-3.26.0, commit e1a2322:

- In the repository's usual checkout (a path of 39 characters): startup and imports 1120.3 M instructions; every scenario within 2.3 % of the baseline; passed.
- Exported with `git archive` to a scratch directory, with `node_modules` symlinked to the repository's: startup 1128.7 M. The scenarios moved by −7.5 % (`check:calendarRangesOffWeekday` at 8×) to +5.1 % (`readAndCompute:limitsPlan` at 16×), and growth changed too (`readAndCompute:limitsPlan` 1.56 instead of 1.41). The gate failed.
- Runs at the same location agree within about 0.3 %, except the smallest scenario, `write:limitsPlan` (about 65 M instructions at 8×), which varies by about 1 %.

So a contributor whose clone lives elsewhere, or the maintainer after moving the clone, can see the budget check fail or pass by chance. The growth check is affected less, but not unaffected.

## Context

- Found while fixing the final review of branch `file-format` (gate hardening, `scripts/perf.js`, `scripts/perf-verdict.ts`).
- Not yet known which part of the location matters: the path's length or text (module URLs, stack traces, string hashing and thus heap layout and GC timing), the symlinked `node_modules`, or the missing `.git`.
- Related: issue 0011 (CI) already expects the runner's counts not to match the baseline and proposes measuring the pull request and its merge base in the same job; issue 0019 (growth sensitivity).

## Acceptance criteria

- [ ] The cause is narrowed down: path length, path text, symlinked `node_modules`, or something else.
- [ ] The maintainer has chosen how the gate handles it, for example:
  - make the counts independent of the location (if the cause allows it);
  - record what matters in the baseline next to Node and Valgrind, so another location counts as `otherEnvironment`;
  - compare against a base commit measured in the same run instead of a checked-in baseline, as issue 0011 proposes for CI.
- [ ] The gate, `tests/perf/baseline.json` and the docs (SPEC test strategy, AGENTS.md) follow the choice.

## Notes

- The baseline was not changed for this issue.
