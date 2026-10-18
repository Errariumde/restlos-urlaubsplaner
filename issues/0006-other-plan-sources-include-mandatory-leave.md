---
status: done
priority: 1
area: calendar sources, file format
branch: file-format
created: 2026-10-18
closed: 2026-10-18
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Include the other plan's mandatory leave in "Leave from another plan"

## Problem

The counting model does not charge mandatory leave on the part of a day that leave from another plan already covers, because the other plan counted it (decided on 2026-10-18 for the counting-model branch). Plans that share a month ("Year + January", then "New → Based on the current file") carry copies of the same day rules, so without this a company closure over the turn of the year is charged in both plans. The rule only works if a source "Leave from another plan" delivers every day that plan charged: its own leave and its mandatory leave, each with share and part.

## Context

- `docs/superpowers/specs/2026-10-18-counting-model-design.md`, "Leave and cost" and "Inputs and outputs".
- `docs/SPEC.md`, "Counting model", paragraph on mandatory leave, and the source type table ("they are counted there (own and mandatory leave of that plan)").

## Acceptance criteria

- A source of type "Leave from another plan" read from a `.urlaub.json` yields that plan's own leave days and its mandatory leave days (from its day rules and its mandatory-leave sources), with share and part.
- The `.ics` export marks mandatory leave days so that re-importing the `.ics` as "Leave from another plan" yields them too, or the help states that only a `.urlaub.json` source covers mandatory leave.
- A test: plan 2027 (January 2027 to January 2028) and plan 2028 (January 2028 to January 2029, with plan 2027 as source) with a closure from 27 December 2027 to 4 January 2028; 3 and 4 January 2028 are charged only in plan 2027.

## Notes

The other plan's mandatory days are computed from its own contract without its own "Leave from another plan" sources, so two plans that reference each other don't depend on each other recursively. Whether such mutual references should then charge a shared day in neither plan, or need a tie-break, is open.

The `.urlaub.json` part is done (charged spans, design 2026-10-18-file-format); the `.ics` criterion moved to issue 0010. Mutual references charge a shared day once because each plan stores what the other actually charged.
