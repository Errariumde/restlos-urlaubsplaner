---
name: triage
description: Triage open issues in issues/ and propose which ones to do on the next branch.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
disable-model-invocation: true
argument-hint: "[branch-name] [focus]"
allowed-tools: Read Grep Glob
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

Triage the file-based issues in `issues/` (conventions in `issues/README.md`).
Target branch and optional focus: $ARGUMENTS

1. Read every issue with status `open`, `next` or `in-progress`.
2. For each, check against the current code whether it is still valid, already fixed, or obsolete.
3. Propose a plan for the target branch as a table: issue, priority, still valid?, recommendation (do now / later / close as done / close as wontfix), one-line reason. Prefer issues that touch the same area or depend on each other; keep the branch scope small.
4. Point out duplicates and issues that block others.
5. Stop and wait for my confirmation. Only after I confirm: set `status: next` and `branch:` on the chosen issues, and `done`/`wontfix` with `closed:` on the ones I agree to close. Do not commit.
