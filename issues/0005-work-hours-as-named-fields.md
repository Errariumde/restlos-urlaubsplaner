---
status: wontfix
priority: 3
area: file format
branch: file-format
created: 2026-10-18
closed: 2026-10-19
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Write work hours as named fields instead of a hyphen range

## Problem

The plan file sketch in `docs/SPEC.md` writes the working hours for half days as a text range: `"workHours": { "am": "08:00-12:00", "pm": "13:00-17:00" }`. A hyphen between two times is not a standard notation (ISO 8601 uses `/` for intervals), and it needs its own little parser. Day rules were changed to named fields for the same reason (`"match": { "type": "fixed", "month": 12, "day": 31 }` instead of `"12-31"`).

## Context

- `docs/SPEC.md`, "Format", plan file sketch, `contract.workHours`.
- Noticed while brainstorming the counting-model branch, when the maintainer asked for one consistent date notation without text mini-syntaxes.

## Acceptance criteria

- `workHours` is written with named fields, for example `"am": { "from": "08:00", "to": "12:00" }`, in the spec sketch and in the file format.
- The file format validates both times (`HH:MM`, 24-hour clock) and `from` < `to`.

## Notes

Belongs to the file-format branch; the counting model doesn't use working hours (they only matter for half days exported as `.ics` appointments).

Decided on 2026-10-18: the contract has no working hours; partial days go into `.ics` as all-day events. A user-defined conversion of partial days (import and export) is noted in issue 0010.
