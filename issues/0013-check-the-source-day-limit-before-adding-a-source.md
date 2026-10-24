---
status: open
priority: 2
area: calendar sources, UI
branch:
created: 2026-10-19
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Check the source-day limit before adding an imported source

## Problem

The reader refuses a plan file whose calendar sources give more than 50,000 days over the computation window (`limitExceeded` with `sourceDays`). Adding a source to a plan near this limit, for example an imported "Leave from another plan" with up to 2000 entries or an iCal import with repeating entries, produces a plan the app can save but then refuses to read.

## Context

- `expandSources` in `src/engine/file/model.ts` and its check in `readFile` (`src/engine/file/read.ts`); the limits are in `src/engine/file/limits.ts` and `docs/file-format.md`, "Limits".
- `importOtherPlan` in `src/engine/file/other-plan.ts` checks only the 2000-entry limit of the one source it creates, not the plan it is added to.
- Noticed in the review of Task 8 of the file-format branch.

## Acceptance criteria

- Before the app adds a source (any type, imported or created by hand), it checks the plan against the reader's limits: source days in total, entries per source, number of sources.
- When the result would exceed a limit, the source is not added and the user gets a message.
- A test adds a source to a plan just below the source-day limit and checks that it is refused.

## Notes

Adding entries to an existing source and lengthening the plan period (a longer computation window) can reach the same limits; the same check fits there.

A second route: a rule set is read without the source-day check, because it has no period and so no computation window. A plan made from it with "New → From rule set" can exceed the limit and become unreadable after saving, so the UI must check the new plan there too.
