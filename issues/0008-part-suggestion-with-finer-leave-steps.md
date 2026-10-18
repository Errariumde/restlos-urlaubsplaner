---
status: open
priority:
area: counting model
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Part suggestion with finer leave steps

## Problem

With mandatory leave of ½ at the `end` on a day and own leave of ¼, `suggestPart` suggests `"end"`, where the own leave is fully covered by the mandatory leave (cost 0, nothing freed). Choosing `"start"` would cost ¼ and free time. This cannot happen with v1's full and half choices.

## Context

- `src/engine/counting/suggest.ts` and `tests/engine/counting/suggest.test.ts`.

## Acceptance criteria

- When finer leave steps are added to the UI, `suggestPart` prefers the part where own leave isn't covered by mandatory leave, or the behaviour is documented as intended.
- A test with mandatory ½ `end` and own ¼.

## Notes

Revisit together with the finer leave steps (see the 1/32 goal in `docs/SPEC.md`).
