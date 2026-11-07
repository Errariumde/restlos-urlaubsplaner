---
status: open
priority: 2
area: UI, engine (file format)
branch:
created: 2026-10-23
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Messages in the open dialog

## Problem

The open dialog writes a sentence for every report entry, but two things are still missing.

- **Naming a dropped part.** A dropped rule, source or entry exists only in the text. The dialog can show its path and `data`, but nothing the user recognizes, unless the entry carries the rule's label or `id`, the source's name, or the entry's date.
- **Where a JSON syntax error is.** The engine reports `notJson` without a position. Browsers put the position into their error text, but each in its own wording.

## Context

- `docs/file-format.md`, "Reading": a report entry has a `code` and the `path` of the key in the text that was read, and `readFile` also returns `positions`, which the UI can use the other way round to find and mark a loaded object.
- When the reading rules were settled on 2026-10-23, the wording and layout of the open dialog and the position of a JSON syntax error were left for the UI on purpose.

## Acceptance criteria

- [ ] It is decided what a report entry carries to name a dropped part, and the engine provides it.
- [ ] It is decided whether and how the dialog shows where a JSON syntax error is.

## Notes
