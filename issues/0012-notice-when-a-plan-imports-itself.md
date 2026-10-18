---
status: open
priority: 2
area: calendar sources, file format, UI
branch:
created: 2026-10-19
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Notice when a plan imports itself as leave from another plan

## Problem

Importing a plan file with the same `id` as the current plan as "Leave from another plan" gives no notice today. This happens when the user picks the plan's own file or an older copy of it. The plan then holds its own charged days as another plan's leave: mandatory leave on those days is no longer charged, and own leave there is charged and reported as `leaveTakenInOtherPlan`.

## Context

- `importOtherPlan` in `src/engine/file/other-plan.ts`: its notices cover a different `id` than the plan imported before (`differentPlan`), a lower `revision` (`olderRevision`) and an older copy of the current plan inside the imported one (`outdatedCopyOfCurrent`), but not the imported file being the current plan itself.
- Noticed in the review of Task 8 of the file-format branch (`docs/superpowers/plans/2026-10-18-file-format.md`).

## Acceptance criteria

- Importing a file whose `id` is the current plan's `id` is refused or warned about; which one is decided in the UI branch.
- The UI shows it before the source is added.
- A test imports a plan into itself and checks the refusal or the notice.

## Notes

The engine could refuse it with its own code, or return a notice and leave the refusal to the UI; `importOtherPlan` already receives the current plan's `id`.
