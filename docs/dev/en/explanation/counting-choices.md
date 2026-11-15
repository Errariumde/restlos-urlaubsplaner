<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Counting choices

Every day has a required work value: how much work is owed. The user takes a share of the day off, and the cost is how much of that leave overlaps the day's working time. The engine calculates in integer units, 480 to a day. Version 1 sets full and half days with the calendar's clicks, keys and ranges; the day detail's leave bar offers the plan's smallest leave unit. The rules are in [Counting model](../reference/counting-model.md).

## Why

- **Integer units:** sums of shares stay exact, however many days a plan adds up.
- **480 to a day:** 480 = 2⁵ · 3 · 5, so halves, quarters and every further halving down to 1/32 day are whole numbers of units, and so are thirds and fifths. Planning down to 1/32 day works without changing the file format or the calculation, and without migrating data.
- **Cost as the overlap with the working time:** leave on time that is free anyway costs nothing, such as half a day on the afternoon of 24 December when work ends at noon. A day never costs more than the work it frees.
- **A work week with start dates:** a contract with a switch to part-time stays one file.

## Rejected alternatives

- **Floats for shares of a day:** sums of fractions such as ⅓ or 1/10 are not exact in binary floating point, so totals would drift.
- **A fixed set of "only 0, ½, 1":** finer leave, a ¾ day or a part-time weekday could not be expressed, and adding them later would change the file format and the calculation.
- **`"full"` and `"half"` as values:** a word names only the shares it was made for. Every finer share would need a new word and a new case in the engine, where a weight string such as `"1/4"` covers any share.
