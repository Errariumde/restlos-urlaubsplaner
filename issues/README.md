<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Issues

A file-based issue tracker: follow-ups, open decisions and known problems live here as Markdown files, versioned with the code. This is the project's internal backlog; bug reports and ideas from users go through GitHub issues (see [`SUPPORT.md`](../SUPPORT.md)).

## Files

- One file per issue: `issues/NNNN-short-kebab-title.md`, where `NNNN` is the highest existing number + 1, zero-padded to four digits (`0001`, `0002`, …).
- Start from [`_template.md`](_template.md).
- Every issue file carries the SPDX header (CC-BY-4.0) after its frontmatter, so `reuse lint` keeps passing.

## Frontmatter

| Field | Values |
| --- | --- |
| `status` | `open`, `next`, `in-progress`, `done` or `wontfix` |
| `priority` | `1` (high) … `3` (low) |
| `area` | Free text: the module or component. |
| `branch` | The branch the issue is planned for or fixed on; empty while `open`. |
| `created` | `YYYY-MM-DD` |
| `closed` | `YYYY-MM-DD`; empty until `done` or `wontfix`. |

## Body

- `## Problem`: what is wrong or missing.
- `## Context`: where it was noticed (file, function, commit).
- `## Acceptance criteria`: what must be true for the issue to be done.
- `## Notes`: anything else, such as options, links or decisions.

## Workflow

- An issue is closed by setting `status: done` and `closed:` in the same commit as the fix.
- Issue files are never deleted.
- Agents may edit issue files (rules in `AGENTS.md`). Changing `status` from `open` to `next` requires the user's confirmation.
