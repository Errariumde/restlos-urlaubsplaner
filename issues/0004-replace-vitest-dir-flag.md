---
status: open
priority: 3
area: build, tests
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Replace `vitest run --dir tests` with a test exclude

## Problem

The `test` script in `package.json` runs `vitest run --dir tests`, because plain `vitest run` also collects test files from the git-ignored `.direnv/` (Nix flake inputs). As a side effect, a test file outside `tests/` would be skipped silently.

## Context

- `package.json`, script `test`.
- Chosen in Task 1 of branch `holiday-engine`, when there was no Vite config yet.

## Acceptance criteria

- The Vite/Vitest config sets `test.exclude` to the Vitest defaults plus `.direnv/**`.
- The `test` script is plain `vitest run`.
- `npm test` runs the same tests as before and none from `.direnv/`.

## Notes

Do this when the Vite config arrives with the UI branch. Extend `configDefaults.exclude` from `vitest/config` rather than replacing it.
