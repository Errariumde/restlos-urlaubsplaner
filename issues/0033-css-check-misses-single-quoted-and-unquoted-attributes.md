---
status: open
priority: 2
area: CSS check (scripts/css-rules.ts)
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# The CSS check misses single-quoted and unquoted attributes

## Problem

The markup scan of the CSS check finds `style` and colour attributes (`fill`, `stroke`, `color`, `stop-color`, `flood-color`) only in double quotes. `style='color: red'`, `fill='#f00'` and `fill=red` pass the check unseen, so a literal colour or a physical property can get into a Svelte component's markup.

## Context

- `scripts/css-rules.ts`, `COLOR_ATTRIBUTE` and `STYLE_ATTRIBUTE` (both match only `="…"`). `STYLE_DIRECTIVE` already handles `"…"`, `'…'` and `{…}`.
- Parked during the `ui` branch and filed by its final review (`final-review.md`, parked items).

## Acceptance criteria

- [ ] `style` and the colour attributes are checked in double quotes, single quotes and unquoted.
- [ ] A value in braces (`fill={colour}`) stays unchecked, as now: it is data, not a literal.
- [ ] `tests/scripts/` has a test for each quoting form, failing before the change.
- [ ] `npm run check` passes.

## Notes

Likely a two-line regex change: `="([^"]*)"|='([^']*)'|=([^\s>"'{}]+)`, reading whichever group matched.
