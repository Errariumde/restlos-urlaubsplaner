---
status: open
priority: 1
area: calendar sources, iCal
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# iCal import and export of calendar sources

## Problem

The file-format branch stores calendar sources as entries (a date or a repeating `match`) and no longer keeps iCal text. Reading `.ics` files into such entries and writing sources and plans back to `.ics` is still missing. The maintainer decided how it should work on 2026-10-18; this issue keeps those decisions until the iCal branch builds them.

## Context

- `docs/superpowers/specs/2026-10-18-file-format-design.md`, "Calendar sources" and "Calendar sources: import and export later".
- `docs/SPEC.md`, "Multiple calendar sources (iCal)" and ".ics export" (updated in the file-format branch).
- Issue 0006: its `.ics` criterion moved here.

## Acceptance criteria

- **Import once.** The user chooses which events to keep; the result is stored as entries; the `.ics` file is not kept. "Update source" imports again; its preview shows the differences with checkboxes, marks entries the user changed and doesn't preselect those for replacement.
- **The user chooses the meaning, as easily as possible.** The preview groups events by name (twelve "Schulferien" events or a repeating "Elternabend" are one decision) and offers every source type, including "Time off needed". Nothing is guessed silently; events that don't fit (for example 10:00–14:00, or shorter than `minUnit`) are the user's decision.
- **Defaults without working hours.** All-day events become full days; an event that ends by 12:00 suggests "½ start"; one that starts at 12:00 or later suggests "½ end"; one that spans noon gets no suggestion.
- **Time zone only during the import:** the browser's by default, changeable in the import dialog, never stored.
- **Repeats.** Simple repeats (weekly on weekdays, yearly on a date, with an end) become a `match`; anything else (exceptions, complex rules) is expanded to dates for a period chosen at import, and the preview says so; iCal exceptions become `except`.
- **Export.** Every source can be exported as `.ics`, so the user doesn't maintain it in several programs: a `match` becomes a repeating event where iCal can express it, otherwise dates for a chosen period. Partial days are all-day events with share and part in the title, plus `X-RESTLOS-TAKE`, `X-RESTLOS-PART` and `X-RESTLOS-TYPE`, so restlos reads its own export back exactly. This marks mandatory leave for re-import as "Leave from another plan" (0006's `.ics` criterion).
- **Limits** for the import: file size and number of events, refused or skipped with a message.
- Tests with real example files from Google, Outlook and Thunderbird (spec, "Test strategy").

## Notes

Later, the maintainer's extended option B: the user decides how partial days are converted in both directions (for example "½ start" ↔ "08:00–12:00"), with the browser's time zone as default and changeable. Points to solve then:

- one working-day layout (time blocks) serves both directions and finer steps better than a table per share;
- it is a device setting for export and an import-dialog setting, never stored in the plan;
- events that don't fit go to the preview.
