---
status: open
priority: 3
area: UI (calendar interaction, contract dialog), range rules
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# A calendar key for finer leave steps, and the smallest leave unit in the contract dialog

## Problem

The day detail's leave bar offers the plan's smallest leave unit (`minUnit`), but everything else sets only full and half days: clicks, Space, H, Delete, drags, Shift-click, week clicks and the selection bar. In a plan in quarters, a quarter can be booked only through the detail, one day at a time. And there is no contract dialog yet, so `minUnit` can be set only by editing a file.

## Context

- `docs/SPEC.md`, "Finer granularity: prepared, offered only in the leave bar": "What is still missing later is only UI: a calendar key and range actions for finer steps, and the `minUnit` setting in the contract dialog." Its Contract row says the contract dialog of version 1 offers only `"1"` and `"1/2"`.
- `docs/SPEC.md`, "Calendar interaction" (keyboard: Space = full, H = half) and the range rules; the keyboard shortcut table of the built-in help.
- `src/ui/calendar/range.ts`: `changeFor` takes the action `"full"`, `"half"` or `"remove"`; `src/ui/calendar/keyboard.svelte.ts` maps the keys.
- `src/ui/calendar/leave-switch.ts`: the leave bar's parts (`partCount`) and the guards of a press, which a finer key could share.

## Acceptance criteria

- [ ] A key, and an action of the selection bar, set leave in steps of the plan's unit through the range rules, which then take a share instead of only "full" and "half"; the hint line says the result, and a step never books leave that lies only on time without work. Decide in a design which key, from which edge, and what pressing it again does.
- [ ] The contract dialog offers the smallest leave unit, with the values its design decides; today `docs/SPEC.md` plans only `"1"` and `"1/2"` for it.
- [ ] `docs/SPEC.md` ("Finer granularity", "Calendar interaction", the shortcut table) and the help's keyboard chapter describe both.
- [ ] e2e tests in a plan with `minUnit` `"1/4"`, in both languages.
- [ ] In parts below ½, a press on the last part with work of a fully booked day keeps the parts with work before it booked (see the notes): in quarters on 24 December with own leave over the whole day, a press on "2. Viertel" leaves own ¼ at the `"start"`. A unit test shows it, and it is fixed before finer steps become reachable.

## Notes

- H already follows the unit in part: in a plan in whole days it changes nothing and the hint line says so (`e2e/min-unit.spec.ts`).
- The contract dialog is not built yet; the key can come first.
- On a fully booked day with time without work, in parts smaller than ½, a press on the last part with work removes the whole booking instead of keeping the parts before it. Case: unit ¼, 24 December (work in the 1st and 2nd quarter, the afternoon free), own leave over the whole day, press "2. Viertel" ("2nd quarter"). `press` in `src/ui/calendar/leave-switch.ts` (line 284) shrinks a full day from the edge nearer to the pressed part, so it asks for `changeTo(2, 4)`, the 3rd and 4th quarter; that covers only time without work, so the change takes the own leave away. Expected: the 1st quarter stays booked. It can't be reached yet, because parts below ½ need a plan file with such a `minUnit`, which the UI can't open yet (issue 0030, open real files in the UI); it must be fixed before finer steps become reachable.
