---
name: holiday-data
description: Add or change public holiday rules, regional special cases or work-week definitions for a country or region in restlos. Use when editing holiday data or the holiday engine.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday data

1. Read the section "Holiday sources and work week" in `docs/SPEC.md`.
2. Find the **official legal source** (law, state gazette, ministry page). Wikipedia or holiday websites are not sufficient as the only source.
3. Express the rule as data (fixed date, Easter offset, weekday rule, date range of validity) – do not add special-case code if the existing rule types suffice. If a new rule type is needed, stop and ask.
4. Add the source URL and the date you checked it as a comment/field next to the rule.
5. Add tests:
   - known dates for at least three years, including a year before/after a rule change;
   - cross-check against the Python `holidays` package in the dev shell, e.g.
     `python3 -c "import holidays; print(sorted(holidays.country_holidays('DE', subdiv='BY', years=2027).items()))"`.
     Differences must be explained (the package is an oracle, not the authority).
6. Regional sub-areas (e.g. Augsburg, Catholic municipalities in Bavaria) are separate selectable regions, never silently applied.
7. School holidays are **not** built in; they come via iCal import.
8. Run `npm run check` (includes `reuse lint`).
