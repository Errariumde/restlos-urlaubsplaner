---
status: open
priority:
area: repository, tests
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# "Review Focus" pointers in code and tests

## Problem

Comments and test names still point to "Review Focus 1" to "Review Focus 5", numbered points of a review that isn't in the repository. A reader can't look them up, and `AGENTS.md` ("Text in the repository") forbids pointers to reviews. The reference check (`scripts/reference-rules.ts`) doesn't catch this form, so it passed.

Found on 2026-11-09 with `grep -rn "Review Focus" src tests e2e` in:

- `src/ui/worker/client.ts:7`
- `e2e/narrow.spec.ts:4`
- `tests/engine/file/read-contract.test.ts:52, 233` (test names)
- `tests/engine/file/read-envelope.test.ts:22, 77, 90` (test names), `116`
- `tests/engine/file/read-plan.test.ts:124` (a test name)
- `tests/engine/file/read-sources.test.ts:323` (a test name)
- `tests/engine/file/text.test.ts:44` (a test name)
- `tests/ui/calendar/range.test.ts:119, 128, 142, 194`
- `tests/ui/worker/client.test.ts:88, 105, 232`
- `tests/ui/worker/session.test.ts:52`

## Context

- `scripts/reference-rules.ts` (`FORBIDDEN`) and its test `tests/scripts/reference-rules.test.ts`.
- `AGENTS.md`, "Text in the repository": write the reason or the rule itself.

## Acceptance criteria

- [ ] Each pointer is replaced by the rule or the reason it stands for, or removed where the comment already says it.
- [ ] The reference check fails on "Review Focus" followed by a number, with a test; done issues and `docs/superpowers/` stay exempt as for the other patterns.
- [ ] `npm run check` passes.

## Notes

The one in `src/ui/calendar/gestures.svelte.ts` was removed with the edge autoscroll (its sentence already stated the rule), and the one in a test name of `tests/engine/counting/leave.test.ts` ("places a span by day position, not by work block") was dropped, as the name already says it.
