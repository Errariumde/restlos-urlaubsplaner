---
status: done
priority: 1
area: engine/holidays, file format
branch: file-format
created: 2026-10-18
closed: 2026-10-18
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Handle stored local-rule options that the holiday data no longer defines

## Problem

`holidaysBetween` throws a `RangeError` for every option key in the region selection that is not a local rule of the selected state, even when the option is `false`. A plan file will store the selection (`country`, `state`, `options`). If a later version of the holiday data renames or removes a local rule (for example `assumption` in Bavaria), loading an older plan file would make the engine throw instead of showing holidays.

## Context

- `checkSelection` in `src/engine/holidays/holidays.ts`; the behaviour is documented in `docs/holiday-data-format.md`, section "Local rules".
- Noticed in the final review of branch `holiday-engine`.
- `docs/SPEC.md`, "Sharing and validation": unknown fields and invalid data are reported as a list; older schema versions are migrated.

## Acceptance criteria

- It is decided and documented (spec or `docs/holiday-data-format.md`) what happens to a stored option key that the data no longer defines.
- Loading a plan file with such a key does not crash; the user learns about the dropped option if the decision says so.
- A test covers a plan whose selection contains a dropped or renamed option.

## Notes

Decide before the file-format branch. Possible approaches:

- the loader drops unknown option keys and lists them in the import report (fits "unknown fields are reported as a list");
- the country data keeps a table of renamed switches;
- the engine ignores unknown keys (this loses the error for typos in calling code).

Decided: the reader drops options the holiday data doesn't define and reports them (`unknownLocalRule`); a table of renamed options waits until a rename happens.
