---
status: open
priority:
area: dependencies
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# TypeScript 7 waits for typescript-eslint and svelte-check

## Problem

TypeScript 7.0.2 has been out since 2026-07-08, and Dependabot offered it in its npm group. It can't be installed with our tools: on 2026-11-08 every typescript-eslint release up to 8.72.1 declares the peer range `typescript >=4.8.4 <6.1.0`, and svelte-check 4.7.7 declares `^5.0.0 || ^6.0.0`. So `typescript` stays at 6.0.3, the newest 6.x.

So the monthly group pull request stays mergeable, `.github/dependabot.yml` ignores major updates of `typescript`. That also hides any later major, so this issue keeps it in view.

## Context

- `.github/dependabot.yml`, the `ignore` entry for `typescript`.
- `.claude/skills/dependency-update/SKILL.md`: for a major, read the changelog and summarize the breaking changes first.
- `npm run typecheck` runs `tsc` and `svelte-check`; `npm run lint` uses typescript-eslint with type information.

## Acceptance criteria

- [ ] typescript-eslint and svelte-check both declare a peer range that includes TypeScript 7 (check with `npm view typescript-eslint peerDependencies` and `npm view svelte-check peerDependencies`).
- [ ] The breaking changes of TypeScript 7 are summarized and the tsconfig files adjusted where needed.
- [ ] `typescript` is updated, the ignore entry in `.github/dependabot.yml` is removed, and `npm run check` and `npm run build` pass.

## Notes
