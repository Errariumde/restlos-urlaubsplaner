---
status: open
priority: 3
area: holiday data
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Improve the remaining German holiday sources

## Problem

The German holiday data is correct (both reference models agree for 2000–2100), but a few sources are weaker than the rest or don't follow the title convention in `docs/holiday-data-format.md` ("Sources").

## Context

- `src/data/holidays/de.json`, `sources` map.
- Noticed in the task and final reviews of branch `holiday-engine`.

## Acceptance criteria

- [ ] Lower Saxony: `reformation-day-north` from 2018 rests for NI only on `ni-law`, a ministry page. Cite the 2018 amending law, or a consolidated text with its amendment record, like the other three northern states.
- [ ] `hh-reformation-2017` points to a publisher's WordPress upload path (luewu.de) that is likely to break. Replace it with a portal permalink if one exists; the rule also cites `hh-law`.
- [ ] `ni-law` and `ni-reformation-2017` are ministry pages but their titles name the law; give issuer and title instead.
- [ ] The titles of `st-law`, `bw-law` and `mv-law` shorten "in der Fassung der Bekanntmachung vom"; write them out.
- [ ] `checked` dates are updated for every source that was reopened; `npm run check` passes.

## Notes

Follow the `holiday-data` skill. Only official documents that were actually opened count as sources.
