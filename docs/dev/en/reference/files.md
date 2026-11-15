<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Files

## File kinds

| File | Kind | Content | Typical use |
| --- | --- | --- | --- |
| `Name.urlaub.json` | plan file | a copy of a rule set (contract, calendar sources, templates, optional color scheme), personal changes to it and **exactly one plan** | one person's leave planning for one period, for example 2027 |
| `Name.regeln.json` | rule set | the same content **without a plan** | shared per company or collective agreement as the starting point for colleagues' plan files |

A rule set is never referenced, only copied: a plan file stays usable on its own. There is no separate color scheme file; color schemes can be embedded in plan files and rule sets.

## What is stored where

| Content | Location |
| --- | --- |
| Contract, calendar sources, templates, color scheme (optional), plan | plan file `.urlaub.json` |
| Contract, calendar sources, templates, color scheme (optional), without plan | rule set `.regeln.json` |

Calendar sources store a **color slot** of the palette (for example "Accent 3"), not a fixed color; a fixed color is possible as an exception.
