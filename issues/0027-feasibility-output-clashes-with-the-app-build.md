---
status: open
priority:
area: build
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Feasibility output clashes with the app build

## Problem

Vite's `emptyOutDir` wipes `dist/` on every `npm run build`, while the feasibility branch writes its test pages to `dist/feasibility/`. Building the app deletes the feasibility pages, and a feasibility run puts files into the app's output directory.

## Context

Found when the UI branch added the single-file build (into `dist/restlos-urlaubsplaner.html`, `vite.config.ts`). The first build on the `ui` branch deleted an existing `dist/feasibility/`.

## Acceptance criteria

- The app build and the feasibility pages use separate output directories, for example `dist-feasibility/` for the feasibility pages, decided before the branches meet.
- `npm run build` no longer deletes the feasibility output, and the feasibility scripts don't write into `dist/`.
- `.gitignore` and the ESLint ignores list the chosen directory.

## Notes
