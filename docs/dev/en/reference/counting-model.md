<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Counting model

## The one formula

Cost of a day = the overlap of the leave with the day's working time, both as shares of the day where they lie in it. Leave lies at the start or the end of the day as its `part` says; a full day covers the whole day. The working time is one block as long as the required work: the whole day on a normal working day; on a day with less work it lies beside its free time, which is at the end unless the layer that decides the required work says `part: "start"`. The work week has no `part`, so a part-time day has its work at the start of the day (issue 0047, a part for work-week entries). Leave on time that is off anyway costs nothing, so the cost is never more than min(taken, required work) and equals it on a normal working day.

| Day | Leave | Cost | Result |
| --- | --- | --- | --- |
| normal working day | full | 1 | full day off |
| normal working day | ½, either part | ½ | half day off |
| 24 Dec, work ½ in the morning | ½ afternoon | 0 | nothing changes; a problem |
| 24 Dec, work ½ in the morning | ½ morning | ½ | full day off |
| 24 Dec, work ½ in the morning | full | ½ | full day off |
| Friday ½ from the work week | as on 24 Dec | | |
| ¾ day (free at the end) | ½ afternoon | ¼ | free from noon |
| ¾ day (free at the end) | ½ morning | ½ | ¼ is worked |
| ¾ day (free at the end) | full | ¾ | full day off |
| weekend, holiday | any | 0 | not selectable; a problem when it comes from a file |

Where in the day partial leave lies (at the start or the end of the day, shown as morning or afternoon for half days) decides how much of it overlaps the working time: on a normal working day either part costs the same, on a day with less work only the part that lies on the working time costs. It also decides whether the day joins a stretch (see Allowance display) and whether it overlaps mandatory leave on the same day (see Mandatory leave), and is used for display and .ics.

## Finer granularity

Version 1 sets **full** and **half** days with the calendar's clicks, keys and ranges; only the day detail's leave bar offers the plan's smallest leave unit (see "Detail view"). Engine and file format are built so that planning down to **1/32 day** (15 minutes at 8 hours) works everywhere without data migration and without changing the calculation logic. Anyone working on the code must observe this:

| Area | Requirement from version 1 |
| --- | --- |
| Unit | 1 day = 480 integer units (480 = 2⁵ · 3 · 5); thus ½, ⅓, ¼, ⅕, ⅙, ⅛, 1/16 and 1/32 are exact. Never floats, never the assumption "only 0, ½, 1". |
| Contract | The planning follows the unit of the open plan, also another one from a handwritten file: half days only where ½ is a multiple of it, so none under `"1"`; there H changes nothing and the hint line says so. |
| Engine | Cost = the overlap of the leave with the working time, for arbitrary multiples of 1/32 (exactly in 1/480); no special cases for ½. |
| Display | one central formatting function for shares (mixed fractions like "12 ¾") that handles every denominator up to 32; the day cell draws its fill proportionally to the share, not only "half" or "full". |
| Operation | The choices are generated from `minUnit`, not hard-wired: the detail's leave bar is split into parts of it (at most 32: a finer unit is drawn in the smallest multiple of it that gives at most 32 parts), and H and the range actions offer a half day only where ½ is a multiple of it. |
| Tests | Property tests calculate with random multiples of 1/32 (and exactly in 1/480), although the calendar's keys and ranges offer only ½. |

## How a day's required work comes about

1. **Base value** from the contract's work week (for example Mon–Fri = 1, Sat/Sun = 0; part-time Friday = 0 or ½).
2. **Lowering layers:** built-in holidays (0), calendar sources of type Holiday (0 or ½) and Paid closure (0), own day rules (for example "24 Dec and 31 Dec: at most ½"). The **minimum** of all applicable values applies. A rule can therefore never make a Sunday or holiday more expensive; if New Year's Eve falls on a Sunday, it stays 0.
3. **Force** (rare, explicitly marked): a rule sets the required work to a fixed value, for example working Saturday = 1. Forced rules apply after step 2.
4. **Manual override** of a single date applies last.

**Mandatory leave** (for example company-wide leave 27–30 Dec) is not a required-work value but marks days as taken, by a share of the day (a full day or for example ½); they charge the allowance with their overlap with the working time, like own leave, and can only be changed via their rule or source. If own leave is set on such a day as well, leave on the same part of the day counts once; leave on different parts of the day adds up.

**Time off needed** (a source of that type, for example the Kita closes on Tuesday afternoons) never costs anything and doesn't change the required work.

## Work week with validity

This way a contract with a switch to part-time stays one file. The rules describe ongoing employment, and there is no separate state for days before or after it.
