---
status: open
priority:
area: UI
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Open real files in the UI: rule sets and the read report

## Problem

The UI's engine worker opens only the bundled example so far. Two gaps show once real files are opened:

- **Rule sets.** `Session.open` (`src/ui/worker/session.ts`) refuses a `.regeln.json` file with the code `notAPlan`, because the session needs a plan. The spec's open flow treats a rule set differently (it becomes the base of a new plan, or updates a plan's rules), so `notAPlan` must not reach the user as an error.
- **The read report.** `PlanState` carries no read warnings. Entries the engine dropped or repaired while reading (`readFile`'s report) never reach the UI, so the open dialog can't show them.

## Context

- Accepted on the `ui` branch for the first slice, which opens only the example.
- Issue 0017 (messages in the open dialog) decides what a report entry carries; this issue makes the report reach the UI at all.
- `docs/SPEC.md`, file operations; `docs/file-format.md`, the report codes and severities.

## Acceptance criteria

- [ ] Opening a rule set follows the spec's flow instead of the refusal `notAPlan`.
- [ ] The worker passes the read report to the UI with the opened state, and the open dialog shows it.
- [ ] Tests cover a rule set, a plan with read warnings and a refused file.

## Notes

Found while closing the `ui` branch.
