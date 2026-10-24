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

# The growth check of the performance gate is not sensitive enough

## Problem

The approved growth check (`work16 / work8 <= 2.2`) assumed that linear code measures about 1.95x. At the plan's base sizes it measures less, because V8's fixed JIT and compile cost weighs on small inputs.

- `read:earlyEasterRanges` at base 1000 grows 1.69x (801.0 M instructions at 8x, 1,355.0 M at 16x, in the Task 10 run).
- A planted quadratic `indexOf` loop in a new scenario reached about 2.08 and passed. A quadratic step must be over roughly 22 % of a scenario's 8x work to fail growth.
- The 5 % budget still catches such a regression in an existing scenario.
- Growth of all seven scenarios in the final run of Task 11: `read:earlyEasterRanges` 1.67, `read:easterRangesJustOutOfReach` 1.65, `read:calendarRangesOffWeekday` 1.69, `readAndCompute:limitsPlan` 1.41, `check:earlyEasterRanges` 1.70, `check:calendarRangesOffWeekday` 1.54, `write:limitsPlan` 1.52.

## Context

Branch `file-format`, Task 10 of `docs/superpowers/plans/2026-10-20-open-check-and-perf-gate.md`, and the decisions in issue 0015.

## Acceptance criteria

- [ ] The maintainer has chosen how the growth check is made sensitive enough to catch a quadratic step in a new scenario.
- [ ] The gate and its docs (SPEC test strategy, AGENTS.md) follow the choice.

## Notes

Two options; the maintainer decides, because this changes approved parameters:

1. **Larger base sizes,** so that linear code measures close to 2x. This makes the gate slower.
2. **Measure growth on the increments between 4x, 8x and 16x,** e.g. (work16 - work8) / (work8 - work4), which cancels the fixed cost. Earlier scratch measurements (2026-10-19, with hints in reading) gave increment ratios of about 2.15-2.22 for linear reading; a quadratic step would give about 4. This needs one more run per scenario and a new limit.
