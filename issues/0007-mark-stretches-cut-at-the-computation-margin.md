---
status: open
priority:
area: counting model, UI
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Mark stretches cut at the computation margin

## Problem

`computePlan` calculates the days of the period plus `STRETCH_MARGIN_DAYS` (60) on each side. A stretch that continues beyond that margin is cut there and looks like a real end. Example: part-year work with an all-zero work-week entry from 1 October and leave on 30 September gives "2027-09-30 – 2028-02-29, 153 days off", although the time off continues.

## Context

- `src/engine/counting/plan.ts` (`STRETCH_MARGIN_DAYS`), `src/engine/counting/stretches.ts`.
- `docs/superpowers/specs/2026-10-18-counting-model-design.md`, stretches.

## Acceptance criteria

- `Stretch` carries `openStart` / `openEnd` flags (or an equivalent) that are true when the stretch touches the first or last computed day, or it is decided and documented how the UI shows such stretches.
- A test with the all-zero work-week example above.

## Notes

Only matters for stretches longer than the margin; ordinary plans never reach it.
