---
status: open
priority: 2
area: counting model, holiday data
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Sundays as statutory holidays in Berlin and Hesse

## Problem

Brandenburg names Easter Sunday and Whit Sunday as holidays, and `de.json` models them (`easter-sunday`, `whit-sunday`, regions `["BB"]`). Berlin and Hesse instead declare every Sunday a holiday ("Allgemeine Feiertage sind außer den Sonntagen: …", Berlin; "Gesetzliche Feiertage sind die Sonntage sowie …", Hesse), so these two days are not in the data for BE and HE. For someone with contractual Sunday work, Easter Sunday lowers the required work in BB but not in BE or HE, although it is a statutory holiday there too.

## Context

- `src/data/holidays/de.json`: rules `easter-sunday` and `whit-sunday`; sources `be-law`, `he-law`, `bb-law`.
- Noticed in the final review of branch `holiday-engine`; the wording above was checked in the consolidated texts of both laws (sources `be-law`, `he-law`).

## Acceptance criteria

- It is decided how Sundays that are statutory holidays affect required work: a per-region "every Sunday is a holiday" property, named Sunday holidays for BE and HE, or a documented decision that nothing changes.
- The decision is recorded in the spec or `docs/holiday-data-format.md`, with tests for a contract with Sunday work in BB, BE and HE.

## Notes

Belongs to the counting-model branch. Check whether other states have the same wording before choosing a solution.
