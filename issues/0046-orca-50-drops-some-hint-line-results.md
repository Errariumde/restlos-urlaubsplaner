---
status: open
priority: 3
area: UI accessibility (hint line), Orca
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Orca 50 drops some hint line results

## Problem

Orca 50.2 says most results of a change in the hint line, but drops some at random: in two runs of the key sequence of `npm run orca` with the Firefox ESR 153.5.0, it said five of seven each time, and the two it dropped were different results in each run (undo and redo after Delete in one, redo and the detail's "Full day" in the other).

## Context

- The app gives Orca every result: a key log taken in the browser during one of the runs showed each key handled and the live region's text changed 35 to 50 ms later, and Orca's debug log has every text arriving from Firefox as `object:text-changed:insert` from the live region.
- A change updates many texts at once (the day's label, the figures, the stretches, the hint line). Orca's event manager drops events of a kind that come within 0.1 s of each other from one application ("multiple instances in short time"), and system text events while the focus is on a selectable object, as a grid cell is ("suspected spam"). It makes an exception for a text insertion from a live region that is a section (`_ignore_by_focus_state` in Orca's `event_manager.py`); that is why the live regions are divs.
- For the dropped results that exception didn't apply, although the element and the event were the same as for the results it let through. A likely cause: Orca caches object attributes and dead objects under `hash()` of short-lived AT-SPI proxy objects and clears the caches only every 60 s (`ax_object.py`), so a stale entry of another object can make the live check fail. The log can't confirm it.
- `npm run orca` lists results Orca received but didn't say apart from the rest, and fails only when the app didn't give Orca a result, when fewer than half were said, or when a text was said twice in a row.

## Acceptance criteria

- [ ] Reported to Orca with the evidence above (the maintainer decides), or a newer Orca checked with `npm run orca`.
- [ ] If a later Orca says all results, `npm run orca` no longer needs the tolerance, and this issue says so.

## Notes

- Ruled out: `role="alert"` would pass Orca's filters, but it interrupts speech and is the wrong role for the quiet result of a change; delaying the result past the burst of changes would get it past the first filter only, not the second.
