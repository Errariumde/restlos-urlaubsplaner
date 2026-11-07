---
status: open
priority:
area: docs
branch:
created: 2026-11-07
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Keep what matters from the AI design documents

## Problem

`docs/superpowers/` holds 14 design and plan documents written with AI tools: seven designs and seven plans from 2026-10-17 to 2026-11-04. Nothing in the repository links to them any more, and they may disappear at any time (`AGENTS.md`, "Text in the repository"). Some of them may still hold reasons or results that are written nowhere else.

## Context

- Already moved out: the feasibility results (`docs/feasibility.md`) and the UI rulings that still describe behaviour (`docs/SPEC.md`).
- The designs cover the holiday engine, the counting model, the file format, required and optional parts, CI, the feasibility tests and the UI main screen; the plans are the matching implementation plans.
- Only the maintainer may delete the folder or anything in it.

## Acceptance criteria

- [ ] Each of the 14 files is read, and whatever still matters and isn't in `docs/SPEC.md`, `docs/file-format.md`, `docs/day-rules-format.md`, `docs/ai-tooling.md` or an issue is moved there, with its reason.
- [ ] The maintainer decides whether the folder stays.

## Notes

Places worth a look first: the "Calls made in this design" sections, which list choices the maintainer was asked to check, and the numbered decisions of the CI design, whose outcome is in the spec's "Build and CI" but maybe not every reason.
