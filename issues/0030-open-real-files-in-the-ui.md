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
- `docs/SPEC.md`, file operations; `docs/dev/en/reference/file-format.md`, the report codes and severities.

## Acceptance criteria

- [ ] Opening a rule set follows the spec's flow instead of the refusal `notAPlan`.
- [ ] The worker passes the read report to the UI with the opened state, and the open dialog shows it.
- [ ] Tests cover a rule set, a plan with read warnings and a refused file.

## Notes

Found while closing the `ui` branch.

Opening real files is what lets users reach plans and rule sets the example doesn't show: another smallest leave unit (below ½, or whole days) and other working time (a part-time day, a day rule with the free time at the start, a `mandatory` rule beside lowered work). With them, these follow-ups of the leave bar become visible, so decide whether they come before this issue or with it:

- issue 0047 (a part for work-week entries): a part-time day always has its work at the start of the day;
- issue 0048 (a calendar key for finer leave steps, and the smallest leave unit in the contract dialog): a press in parts below ½ can remove a whole booking, which its last criterion says must be fixed before finer steps become reachable;
- issue 0049 (leave bar parts below ¼ are under the target size);
- issue 0050 (leave bar names in whole days on a partly free day);
- issue 0051 (mandatory leave that lies wholly on time without work is silent).
