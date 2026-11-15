<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Files

The files restlos reads and writes, and what each one is for. The kinds, their file names and the `kind` field, the ban on references between files and the sources a rule set never holds are stated in the "File formats" [hard rule](../../../../AGENTS.md#hard-rules). Every key and value is in [Plan files and rule sets](file-format.md). The reasons are in [File kinds](../explanation/file-kinds.md).

## Use

| File | Use |
| --- | --- |
| plan file | one person's leave planning for one period, for example 2027 |
| rule set | the starting point for the plan files of a company or a collective agreement, shared with colleagues |

## What is stored where

Plans and rule sets are stored only in their files; [Kinds and versions](file-format.md#kinds-and-versions) lists what each file holds. The app stores nothing in the browser: it uses no IndexedDB, no `localStorage`, no `sessionStorage` and no cookies.
