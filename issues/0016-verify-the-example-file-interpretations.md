---
status: open
priority: 3
area: examples
branch:
created: 2026-10-23
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Verify the interpretations in the example files

## Problem

Five points in the example files rest on our own reading or on a source we couldn't open. On 2026-10-23 the maintainer kept them as they are, without having verified them.

## Context

- The final report of branch `file-format` (2026-10-19).
- Decision 2d of the design of 2026-10-23.

## Acceptance criteria

- [ ] **Metall-Elektro BW** (`examples/rules/metall-elektro-bw.regeln.json`), § 27: when 24 or 31 December falls on a Sunday, the file treats Saturday 23 or 30 December as the day "immediately before". Confirmed or corrected.
- [ ] **Versicherungen** (`examples/rules/versicherungen.regeln.json`): the description recommends setting Saturday to 0 required work, citing MTV § 13. Confirmed or corrected.
- [ ] **Karneval Rheinland** (`examples/rules/karneval-rheinland.regeln.json`) keeps "Vorschlag 2026" in its name. Confirmed or changed.
- [ ] **The Muster AG plans** (City of Augsburg) set `assumption: true`. Checked against the city's official list, which can only be searched through a form.
- [ ] **IHK Köln:** its page couldn't be opened, so it isn't cited. Either cited from a page that opens, or left out for good.
- [ ] All of the above are done before the app offers the examples as templates ("New → From rule set").

## Notes
