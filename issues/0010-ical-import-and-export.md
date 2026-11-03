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

### Feasibility branch, 2026-10-24

Source: `docs/superpowers/specs/2026-10-24-feasibility-tests-design.md` on the `feasibility` branch (decisions 5 and 6, "Research", "Review of the `UID` concept"). The "Export" criterion above must follow decision 5 below: the `UID` is not the contract ID with the date.

**Decision 5: the `.ics` `UID`.** It is a one-way hash of the plan's random `id` and everything the exported event says. Colleagues who use the same rule set share the contract ID, so their leave on the same day would collide in a shared calendar, and RFC 7986 asks for `UID`s that identify nothing.

- **What goes in:** the plan's `id`, what the event is (own leave, mandatory leave, a holiday exported along, a source's entry), the source or rule it comes from (by `id`), its date or dates or repeat rule, its share and part, and later option B's times. Never an element's position in the file, which shifts when an earlier entry is added.
- **What follows:** only an exact copy gives the same `UID`, and an exact copy says nothing new, so the export writes it once. An edit the event doesn't show (a source's colour, a note) keeps the `UID`; any edit it shows (full ↔ half day, another part, a moved day) gives a new one; "Save as" (a new `id`) gives all new ones. An event never changes under its `UID`. The `UID` looks random and shows no date.
- **The trade-off, accepted:** apps that update events by `UID` (Google's re-import reportedly does, and Nextcloud's coming "replace" import should) show a changed day twice, old and new, instead of updating it. The workflows the help recommends (empty and import, subscription) aren't affected.
- **The hash is the browser's built-in WebCrypto** (`crypto.subtle.digest`, SHA-256; Node has it for the tests), called in the export step, which is asynchronous anyway; the engine supplies only the text to hash. No hash or crypto code of the project's own. The hash isn't a security feature: it only makes the `UID` opaque and repeatable.
- **Fallback without WebCrypto** (it needs a secure context; the feasibility tests check whether `crypto.subtle` exists on a page opened from `file://`): random `UID`s for that export, from `crypto.getRandomValues`, which works without one. The export dialog then says why and what it means for the user, for example: "This browser doesn't offer the function restlos uses to give calendar events fixed IDs, so this export gets new ones. If you import it into a calendar that still holds an earlier export, every event appears twice: empty the calendar first, or subscribe to the file." (Wording through the catalogs in the UI branch.)
- The exact form (encoding of the hashed text, UUID layout) is this issue's, with the findings below.

**Decision 6: workflows for the help.** The export's design and the help's calendar workflows belong to this issue. For CalDAV calendars such as Nextcloud the maintainer chose:

1. A separate calendar for restlos, emptied and filled again after a change.
2. As an option, subscribing to the exported file through a share link of a synced Nextcloud folder. The link is public; the help says so.

**Findings of the `UID` review** (findings 2 to 8; finding 1 led to decision 5):

- **Deleted events may block the same `UID`s.** Nextcloud keeps deleted events in a trash bin, and Google reportedly skips re-imported `UID`s it deleted before. The research found that Nextcloud handles a deleted and re-imported event; Google is documentation only. The feasibility tests check it in the maintainer's setup: a re-import after deleting every event in Thunderbird (the deleted events sit in Nextcloud's trash bin). If that fails, the help says "delete the calendar, not its events".
- **The plan's `id` isn't always unique.** A plan file copied in the file manager, or handed to a colleague and saved, keeps its `id`, so two people's leave can share `UID`s in a team calendar. Mitigation: the help says to share rule sets, not plan files (as the spec already does); the bundled examples are saved under a new `id`.
- **Consecutive plans overlap.** Plan 2027 (January 2027 to January 2028) and plan 2028 both contain the closure around New Year. Fix: a plan's export writes only what this plan charges, never the days of a "Leave from another plan" source, as the counting model does.
- **The key must be encoded unambiguously and never change.** IDs may contain any character, so fields are joined as a JSON array with a version tag, a `match` gets a fixed form for the key, and test vectors pin the result.
- **The engine is synchronous, WebCrypto isn't, and WebCrypto needs a secure context.** Decision 5 calls WebCrypto in the export step, with random `UID`s as the fallback.
- **A repeating entry is written in one form only** (`RRULE` or dates), or its `UID`s change between exports. An event never changes under its `UID`, so a rising `SEQUENCE` isn't needed.
- **What goes into the hashed text needs a fixed list per kind of event:** a holiday exported along (its rule's `id` and the date), a stretch exported as one event (its dates), a source exported on its own (its own scope, so it can't match the same days in a plan's export), option B's time blocks.
- The exporter checks that every `UID` in a file is unique, with a property test over random plans (finding 1: the format allows several entries of one source on the same date, for example `examples/plans/muster-ag-2028.urlaub.json` on 2027-12-24).

Fine as designed: several events on one day, since their kind and content differ; colleagues' plans with their own random `id`s; rule `id`s, which "Update rules from rule set" keeps; "Save as", where subscriptions and the empty-and-import workflow come out right and only a re-import over the old events duplicates them (a help note); privacy, since a `UID` reveals nothing the event's date doesn't.

**Calendar research** (24 October 2026; source code, bug trackers, specs and vendor documentation read, nothing run):

- **Thunderbird** never updates an existing event on import. The import refuses an existing `UID`, and according to its code (`CalendarFileImporter.sys.mjs`) it stops at the first refused event. `SEQUENCE` makes no difference. [Bug 325449](https://bugzilla.mozilla.org/show_bug.cgi?id=325449) has been open since 2006.
- **Nextcloud's web import** refuses existing `UID`s and adds only new ones. A "replace existing events" option (`supersede`) was approved on 2026-10-22 (calendar PR #8483) but isn't released. See also [calendar #1508](https://github.com/nextcloud/calendar/issues/1508).
- **Nextcloud subscriptions** to a share link (`/download`): read-only, refreshed daily by default. On Android, DAVx5 hands them to ICSx5; in Thunderbird the user adds them by hand. Private addresses are blocked unless `webcalAllowLocalAccess` is set.
- **Google** reportedly updates by `UID` on re-import (documentation only) but doesn't remove deleted days; import limit 1 MB ([Google Calendar import](https://support.google.com/calendar/answer/37118)).
- **Outlook:** classic Outlook duplicates on import into an existing calendar and opens a file with `X-WR-CALNAME` as a new calendar ([MS-STANOICAL](https://learn.microsoft.com/en-us/openspecs/exchange_standards/ms-stanoical/2637212b-2ddc-4706-8202-c796fb3f748b)). Outlook.com refreshes subscriptions about every 3 hours.
- **Apple** doesn't update on import.
- **iTIP** (RFC 5546) only covers mail invitations.
- **RFC points** ([RFC 7986](https://www.rfc-editor.org/rfc/rfc7986), RFC 5545, RFC 5546): a stable, unique `UID` that identifies nothing; `METHOD:PUBLISH` without `ORGANIZER` and `ATTENDEE`; `NAME` / `X-WR-CALNAME`; `REFRESH-INTERVAL` for subscriptions.
- **The only workflow that works in every app:** a separate calendar, deleted and imported again after a change.

### Feasibility results, 2026-11-02

- The calendar test (T4 in Thunderbird and Nextcloud) was dropped by the maintainer; nothing about calendars was tested. So whether `UID`s in Nextcloud's trash bin block a re-import is still open.
- Until that is checked, the spec's help text recommends workflow 1 in its safe form: **delete the restlos calendar and create it again** before importing a new export, instead of emptying it. If the trash bin turns out not to block re-imports, emptying is enough again.
- `crypto.subtle` exists on `file://` in Firefox ESR 153, Firefox 159 and Chromium 147 (a SHA-256 digest works), so the random-`UID` fallback isn't needed in these browsers; it stays for browsers without a secure context.
