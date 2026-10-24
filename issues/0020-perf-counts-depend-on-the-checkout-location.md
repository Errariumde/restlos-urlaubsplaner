---
status: done
priority: 2
area: tests (performance gate)
branch: ci
created: 2026-10-23
closed: 2026-10-24
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

- [x] The cause is narrowed down: path length, path text, symlinked `node_modules`, or something else.
- [x] The maintainer has chosen how the gate handles it, for example:
  - make the counts independent of the location (if the cause allows it);
  - record what matters in the baseline next to Node and Valgrind, so another location counts as `otherEnvironment`;
  - compare against a base commit measured in the same run instead of a checked-in baseline, as issue 0011 proposes for CI.
- [x] The gate, `tests/perf/baseline.json` and the docs (SPEC test strategy, AGENTS.md) follow the choice.

## Notes

- The baseline was not changed when this issue was opened.

### Cause (2026-10-24)

Measured with Node v24.21.0 and valgrind-3.26.0 on exported checkouts at paths of 19, 39 (two different texts, and one with the repository's number of components) and 101 characters, with the same input files for every run.

- **The garbage collector.** During startup, Node keeps strings that contain the checkout's path: module URLs, and the cache of path prefixes that resolving a module fills. Their size depends on the path's length and its number of components. The letters don't matter: two 39-character paths with different letters gave identical `--trace-gc` traces. That size shifts the moments at which a scenario's own allocations start a collection. Collection was 13–35 % of every scenario's work, so the work moved by a few percent, by chance, in either direction.
- The same mechanism would move the counts for any change that makes startup allocate a little more or less, such as one more engine module. It would have hit CI's comparison of a pull request with its merge base too (issue 0011).
- **Run-to-run noise at the same location** had two more causes. V8 optimizes the WebAssembly code of Node's TypeScript stripper at moments that depend on timing: startup varied by ±0.7 M instructions, and one run in 32 was 38 M lower. V8 also starts incremental marking from a timed task.
- Not the cause: the symlinked `node_modules` (the measured child imports no package), the missing `.git`, the input files' paths, and the size of the environment.

### Decision and fix

The maintainer chose to measure without garbage collection. `scripts/perf.js` runs the child with `--liftoff-only`, `--no-incremental-marking` and a young generation of 1 GB (`--min-semi-space-size=1024 --max-semi-space-size=1024`), next to `--predictable`. With `--trace-gc` the gate fails a run that reports a collection, so a scenario that outgrows the young generation can't quietly bring the effect back. `tests/scripts/perf-trace-gc.test.ts` pins that V8 reports collections on stdout.

- Result: startup counts agree to within 10,000 instructions. The gate passed at three locations, run at the same time, against the baseline written at the usual checkout. Every scenario was within 0.1 %, except `write:limitsPlan` (56 M instructions at 8×), which was within 1.0 %; the cause of that last half million instructions was not found.
- The gate no longer counts the collector's work; allocating still costs instructions. All counts dropped by 13–35 %. The maintainer approved the new baseline. Peak memory of a measured run is at most 230 MB (147 MB before).
