---
status: open
priority:
area: ui, accessibility
branch:
created: 2026-11-07
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Off switch for single-letter shortcuts

## Problem

V (switch view), W (align by weekday) and K (calendar weeks) work from anywhere on the main screen except text fields: with nothing focused, and with the focus on a toolbar button. WCAG 2.1.4 (Character Key Shortcuts) asks that shortcuts of a single printable key can be turned off or remapped, unless they work only while a component has the focus. Speech input users, for example, can trigger them by accident when a spoken word starts with one of these letters. The help key `?` from the spec's shortcut table will be one more.

## Context

- `src/ui/state/keys.ts` (`shortcut`) and the key handler in `src/ui/screens/MainScreen.svelte`, which skips text fields only.
- `docs/SPEC.md`, "Built-in help" (shortcut table) and "What is stored where" (device settings).
- Kept global on purpose: they only change the display, never the plan, and they work wherever the user is on the main screen.

## Acceptance criteria

- [ ] The device settings have a switch "Single-letter shortcuts" (on by default), stored and exported like the other device settings.
- [ ] With it off, V, W, K and `?` do nothing; Ctrl and Cmd shortcuts and the keys inside the calendar (Space, H, Delete, arrows) still work.
- [ ] The help's shortcut overview mentions the switch.
- [ ] An e2e test turns it off and checks that V changes nothing.

## Notes

Decided on 2026-11-07, when the UI was reviewed: keep the keys global and add the switch with the device settings, rather than limiting them to the calendar's focus.
