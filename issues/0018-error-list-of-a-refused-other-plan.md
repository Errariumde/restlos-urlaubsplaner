---
status: open
priority: 3
area: engine (file format, other plans)
branch:
created: 2026-10-23
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# The Error list of a refused other plan

## Problem

`readFile` now refuses a file whose own parts are broken with `invalidCore` together with every Error it found, so the open dialog can list them all. `importOtherPlan` passes on only the refusal, not that list: importing a hand-written plan as "Leave from another plan" can say only that the file is refused, not where.

## Context

`src/engine/file/other-plan.ts`, `importOtherPlan`: `if (!read.ok) return { ok: false, refusal: read.refusal };`. Noticed in Task 5 of the plan `docs/superpowers/plans/2026-10-20-open-check-and-perf-gate.md` ("A refused file lists every Error"), which changed `ReadResult` but not `OtherPlanImport`.

## Acceptance criteria

- [ ] It is decided whether the import shows the Error list of a refused plan, or only says that the plan can't be read and should be opened to fix it.
- [ ] If it shows the list: the refused branch of `OtherPlanImport` carries the reader's `report`, `docs/file-format.md` (Leave from another plan) says so, and a test covers it.

## Notes
