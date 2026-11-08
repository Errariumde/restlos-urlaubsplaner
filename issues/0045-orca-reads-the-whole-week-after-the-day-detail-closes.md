---
status: open
priority: 3
area: UI accessibility (calendar grid, day detail)
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Orca reads the whole week after the day detail closes

## Problem

When the day detail closes with Escape and the focus goes back to the day, Orca 50 reads the day's whole calendar row: "Week 2 Monday, 11 January 2027, working day, no leave Tuesday, 12 January 2027, …", all seven days, instead of the day. Moving with the arrow keys reads only the day, as it should.

## Context

Found in the first Orca run (`npm run orca`), in the Firefox ESR 153.5.0, with the example.

- The detail's first control is the "Ganzer Tag" checkbox. Orca keeps checkboxes and buttons in browse mode, so it switches to browse mode in the detail ("Stöbern-Modus").
- Back in the grid, Orca is still in browse mode for a moment. In browse mode its web script reads a grid cell's full row (`should_read_full_row` in Orca's `scripts/web/script_utilities.py`: in a grid it is `not in_focus_mode`), and only then switches to focus mode.
- The row has no name of its own, so Firefox takes it from the row's content: every cell's label.

## Acceptance criteria

- [ ] Decided whether to change it; if so, the Orca check lists no whole row as a long text after Escape, and the day is still said.

## Notes

- Naming the rows after their week number (`aria-labelledby` on the row header) would make Orca say only "Kalenderwoche 2" after Escape, without the day, which is worse; and the week numbers can be switched off, which leaves no row header to point to.
- What else the first run showed, both from Orca itself:
  - After moving to another row with the arrow keys Orca adds "leer" (blank) after the day. In Orca 50.2, `generate_context` in `speech_generator.py` appends the new ancestors as one list, which is empty when the row changes inside a grid, and `_generate_real_table_cell` then takes the empty first entry for a blank cell. Nothing in the markup changes that; it is a bug to report to Orca.
  - On opening the detail, Orca reads a summary of its texts that aren't attached to a control: "… No leave Full day Afternoon Costs nothing …". "Full day" is the checkbox's label text, and "Morning" is missing while "Afternoon" is there. Worth a look when the detail changes next.
