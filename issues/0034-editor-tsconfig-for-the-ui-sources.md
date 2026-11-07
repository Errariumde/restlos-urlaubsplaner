---
status: open
priority: 2
area: tooling (TypeScript and Svelte language servers)
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Give the editors a tsconfig for the UI sources

## Problem

The TypeScript and Svelte language servers look for the nearest `tsconfig.json`. For `src/ui` and `src/gallery` that is the root `tsconfig.json`, which excludes both folders, so the servers fall back to defaults: every `.svelte` file shows false errors such as "An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled" and unknown `$state`. `npm run typecheck` (svelte-check with `tsconfig.ui.json`) is clean, so the errors are false.

This misleads every UI task: `CLAUDE.md` tells agents to use the language server diagnostics after edits and fix the reported errors.

## Context

- `tsconfig.json` (`exclude: ["src/ui", "src/gallery", "e2e"]`), `tsconfig.ui.json`.
- Seen throughout the `ui` branch and filed by its final review (`final-review.md`, parked items).

## Acceptance criteria

- [ ] `src/ui/tsconfig.json` and `src/gallery/tsconfig.json` extend `../../tsconfig.ui.json` (paths adjusted so they cover the same files), with REUSE headers or a `REUSE.toml` entry.
- [ ] The Svelte and TypeScript language servers report no errors in a clean `.svelte` file of `src/ui` and `src/gallery`, and still report a real type error.
- [ ] svelte-check and ESLint keep using their explicit configs (`npm run typecheck`, `npm run lint` unchanged in effect).
- [ ] `npm run check` passes.

## Notes

Check whether `e2e` needs the same: its files are typed through `tsconfig.ui.json` too.
