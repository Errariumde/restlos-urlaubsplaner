---
status: open
priority: 2
area: UI state (src/ui/state/app.svelte.ts), main screen
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Engine failures are silent on the main screen

## Problem

When the engine worker answers an apply, undo, redo or preview with `failed` (an engine exception on some edit), or the worker has died, the promise rejects and nobody catches it: the calls are `void app.apply(…)`. The result is an unhandled rejection; the calendar just doesn't change, and only the console says why. Only the start screen has an error state (`app.openFailed`).

## Context

- `src/ui/state/app.svelte.ts`, `#change` and `preview`.
- The `void app.apply(…)` / `void app.preview(…)` calls in `gestures.svelte.ts`, `keyboard.svelte.ts`, `MonthTiles.svelte`, `MonthColumns.svelte`, `SelectionBar.svelte`, `MainScreen.svelte` and `app.select`.
- Found by the final review of branch `ui` (`final-review.md`, Minor 1). Acceptable for a slice that opens only the example, but later branches will copy the pattern.

## Acceptance criteria

- [ ] `#change` (and `preview`) catch the failure and set an error state on `app` (for example `app.engineError`); no unhandled rejection is left.
- [ ] The main screen shows the error in a `role="alert"` line with a text from both catalogs; it goes away with the next successful change.
- [ ] `applying` is reset after a failure, so the calendar takes input again.
- [ ] An e2e test makes the worker fail (e.g. by intercepting `postMessage`, as `e2e/tiles.spec.ts` does) and checks the alert and that `expectNoPageProblems` sees no page error.
- [ ] `npm run check` and `npm run test:e2e` pass.

## Notes

Decide whether a dead worker is restarted from the last state or the page asks to reload.
