<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: counting model

As of: 2026-10-18. Branch: `counting-model` (from `main` after #1, the holiday engine).

## Intent

The second engine branch. The holiday engine (#1) knows which days are public holidays; the counting model turns a contract, calendar-source days and a plan into what the user actually sees: the required work of every day, what each leave day costs, the allowance totals and the stretches of time off. The spec says "All outputs (UI, .ics, PDF, JSON) read the same computed state; no output recalculates costs itself", so everything after this branch builds on its output.

`docs/SPEC.md` is authoritative. This document cuts out the part built now and records the decisions made for it on 2026-10-18; several of them changed the spec in this branch (see "Documentation updates"). Relevant spec sections: "Counting model (weights)", "Work week with validity", "Multiple calendar sources (iCal)" (types and their effect), "Format" (plan file sketch and the bullet on day rules), "Allowance display", "Test strategy" (rows "Counting model" and "Plans").

The order after this branch is fixed: file format next (reading, validating and writing `.urlaub.json`, `.regeln.json`, `.einstellungen.json`), then the UI. The in-memory types built here follow the spec's file sketch, so the file-format branch is mostly parsing, validation and writing.

## Goals

1. **Day rules**: matching days (single-day date rules and ranges) and their three effects.
2. **Required work per day** from the work week (with validity), the lowering layers, forced rules and manual overrides, with a record of where the value comes from.
3. **Leave and cost per day**: own leave, mandatory leave (from day rules and calendar sources), leave from another plan; cost = min(taken, required work) generalised to positions within the day (below).
4. **Plan totals**: planned, remaining, totals per calendar year.
5. **Stretches** as defined by the maintainer: unbroken time off with partial first and last days.
6. **Helpers the UI will need and that belong to the engine**: a suggestion for where partial own leave lies, warnings for day rules at creation, a writer for weight strings.
7. **Tests** before or with every engine function, including the spec's property tests with random multiples of 1/32.
8. **Documentation**: the spec changes listed below, and a reference for people who write day rules by hand.

## Non-goals (this branch)

- Reading, validating or writing JSON files; unknown keys, size limits, `minUnit` checks, migration, `revision`, autosave. All of that is the file-format branch, together with issues 0001 (stored local-rule options that the data no longer defines) and 0005 (work hours as named fields).
- Parsing iCal files (ical.js) and deciding which events become which days; calendar sources arrive here as already resolved days.
- UI, display formatting of shares (`12 ¾`, decimals, `Intl`), message catalogs, `.ics`, `.typ`, print.
- Bridge-day hints (version 3), duplicate detection between sources, school holidays.
- Issue 0002 (Sundays as statutory holidays in Berlin and Hesse): it stays open; the counting model works with whatever the holiday data says.
- New packages. Everything here is plain TypeScript with the existing dev dependencies (fast-check is already there).

## Anti-goals

The branch fails even if tests pass when any of these is true:

- Floats, JavaScript `Date` or the local time zone anywhere in the engine.
- Special cases for ½: every multiple of 1/480 must work, even though the UI will offer only full and half days.
- A text mini-syntax for rules, or a date written as `"12-31"`; dates are ISO `YYYY-MM-DD`, days without a year are `month` and `day`.
- Any amount of remaining work, even one unit (1/480 day), inside a stretch.
- A problem that is silently ignored (a rule that can never produce a day, leave outside the plan period, conflicting forced rules): it is reported.
- A second place that computes costs, totals or stretches outside the engine's result.

## Constraints

From `AGENTS.md` and the spec; not negotiable here:

- 1 day = 480 integer units (`src/engine/weight.ts`); days are integer day numbers (`src/engine/days.ts`); ESLint forbids `Date` in the engine.
- Pure functions without DOM and without runtime dependencies; country data comes through `src/data/holidays/index.ts`, never by reading files.
- Code, identifiers and comments in English; domain terms from the glossary (required work, taken, allowance, plan, contract, work week, day rule, calendar source, mandatory leave, paid closure, leave from another plan, stretch).
- Writers write weights as fraction strings (`"1/2"`); readers accept fraction and decimal strings.
- REUSE headers on every new file; `npm run check` passes after every task; commits on `counting-model`, unsigned, never pushed.

## What gets built

### Day rules

A day rule has an `id`, a `match`, optional `validFrom`/`validUntil` (years, inclusive), exactly one effect, an optional `part`, and data the engine only passes through (`label`, `origin`).

**Match.** Either one of the six date rules of the holiday data, unchanged (`fixed`, `easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`, `once`; see `docs/holiday-data-format.md`), or a range:

```json
{ "type": "range", "from": { "type": "fixed", "month": 12, "day": 27 }, "to": { "type": "fixed", "month": 1, "day": 2 } }
{ "type": "range", "from": { "type": "once", "date": "2028-03-20" }, "to": { "type": "easter", "offset": 1 } }
{ "type": "range", "from": { "type": "easter", "offset": -52 }, "days": 6 }
{ "type": "range", "from": { "type": "fixed", "month": 12, "day": 1 }, "to": { "type": "fixed", "month": 12, "day": 31 }, "weekdays": ["sat"] }
```

- `from` is any date rule; then exactly one of `to` (any date rule) or `days` (a whole number of days, at least 1). A range never contains another range.
- For each year Y in which `from` gives a day: with `days`, the range is that day and the following `days − 1` days; with `to`, it ends on the first day that `to` gives on or after the start, looking in Y and then in Y + 1. So "27 December to 2 January" crosses New Year without a special case, and a `once` end exists only in its own year. If `to` gives no such day, the range doesn't occur that year.
- `weekdays` (optional, non-empty, `mon` … `sun`) keeps only those weekdays of the range.
- `validFrom`/`validUntil` refer to the year in which a range starts.
- A day matched twice by the same rule (overlapping occurrences) counts once.
- Weekly patterns that hold all year belong in the work week, not in day rules: a forced rule "every Sunday" would also beat Easter Sunday, a work-week value lets the holiday lower it.

**Effects** (exactly one per rule; the value is a share of the day in units, written as a weight string in files):

| Effect | Meaning |
| --- | --- |
| `requiredAtMost` | a lowering layer: required work at most this value |
| `requiredExactly` | forced: required work exactly this value, applied after all lowering layers |
| `mandatory` | mandatory leave: this share of the day is taken automatically and charges the allowance |

**Warnings at rule creation.** The engine provides a check that the rule dialog (and later the file loader) shows as warnings, not errors:

- A range with `days` and a `fixed` start that covers the end of February: in leap years it ends one day earlier; suggest `to` instead. (Research on 2026-10-18 over python-holidays 0.97 and date-holidays 3.37.0, all countries, subdivisions and categories, 2000–2040: no fixed-date multi-day holiday crosses the end of February anywhere; everything on 29 February is Easter-based, lunar or a substitute day. A warning is therefore enough.)
- A range where one end is a fixed date (`fixed` or `once`) and the other moves (`easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`), in either direction: in some years the end can jump into the next year ("from Weiberfastnacht to 1 March").
- A rule that produces no day in any year of its validity, e.g. a `once` date outside `validFrom`/`validUntil` or a `weekdays` filter that empties every occurrence. Not a problem, and not reported: a rule that matches nothing within one plan's period (rule sets span many years), or a rule that changes nothing on a matched day ("at most ½" on a Sunday).

### Required work of a day

1. **Base value** from the work week: a list of entries `{ from, required }`, each valid from its `from` until the next entry; `required` has a value for each weekday. The first entry also applies before its `from`. (Part-year work is expressed with an entry whose values are all `"0"`, or a day rule; those days count as off.)
2. **Lowering layers**, the minimum of all that apply: built-in public holidays from the holiday engine (0), calendar-source days of type Holiday (their share, 0 or ½ today), Paid closure (0), day rules with `requiredAtMost`.
3. **Forced**: day rules with `requiredExactly`.
4. **Manual override** of a single date, last.

The result records every contribution (base entry, each lowering layer with its source, forced rule, override), so the detail view can show "where it comes from" without recomputing.

### Positions within a day

A day's working time is normalised to the units 0 … 480. Where the work and the free time lie matters for stretches, never for cost.

- **Required work below a full day** lies in one block. By default the work comes first and the free time is at the end (24 December: work until noon). The layer that decides the final value may state the opposite with `part: "start"` (free time at the start).
- **Leave pieces** have a share and a `part`, `"start"` or `"end"`. A piece takes its share from the start or from the end of the remaining work block, not of the clock day, so ½ leave on a day with required work ½ frees the whole day, as the spec's cost table requires. A piece of a full day or more covers all work.
  - Own leave: `part` is required for partial leave (below one full day). The UI gets it from the suggestion below; the user chooses when there is no good default.
  - Mandatory leave (day rules and sources) and the free part of required work below a full day: `part` defaults to `"end"`, and the rule or source can state `"start"`.
  - Leave from another plan: share and part as delivered by the source.
- **Overlap:** pieces on the same part of the day overlap (the larger counts); pieces on different parts add up, until all work is covered.

### Leave and cost

- **Cost of a day** = the work removed by the charged leave pieces: min(required work, start share + end share), where each share is the largest charged piece on that side. With a single piece this is the spec's min(taken, required work). Charged are own leave and mandatory leave, except the part of mandatory leave that leave from another plan covers (next points).
- **Leave from another plan** frees time for stretches but never costs anything in this plan.
- **Mandatory leave already counted elsewhere:** mandatory leave is not charged on the part of a day that leave from another plan already covers, because it was counted there (spec: "they are counted there"). This matters for plans that share a month ("Year + January", then "New → Based on the current file"): a company closure from 27 December 2027 to 4 January 2028 is charged in plan 2027 and not again in plan 2028. Own leave on such a day is charged as usual and reported as already taken in another plan; the user set it and can remove it.
- Days outside the plan period never cost anything here. Own leave outside the plan period, and own leave on a day with required work 0, are reported.

Examples (2027; the 24th is a Friday, the 26th a Sunday, the 28th a Tuesday; no "at most ½" rule unless stated):

| Day | Required work | Mandatory | Own leave | Cost | Free time |
| --- | --- | --- | --- | --- | --- |
| Tue 28 Dec, company closure | 1 | 1 | – | 1 | whole day |
| Sun 26 Dec, public holiday | 0 | 1 | – | 0 | whole day |
| Fri 24 Dec, company closes at noon | 1 | ½ `end` | – | ½ | from noon |
| Fri 24 Dec, same, plus own ½ `start` (maintainer's example) | 1 | ½ `end` | ½ `start` | 1 | whole day: own ½ in the morning and mandatory ½ in the afternoon add up |
| Fri 24 Dec, same, plus own ½ `end` | 1 | ½ `end` | ½ `end` | ½ | from noon: both on the same half, counted once |
| Fri 24 Dec with "at most ½" | ½ | ½ `end` | – | ½ | whole day |

### Totals

- Planned = the sum of the costs of all days in the plan period (own and mandatory leave).
- Remaining = allowance − planned; may be negative (overdraft is only marked, never blocked).
- Totals per calendar year: the sum of costs by the calendar year of the day, within the plan period.
- The allowance comes in as units (it can be larger than one day); reading it from the file is the file-format branch.

### Stretches

As defined by the maintainer: a stretch is unbroken time off; the cost is the leave it takes; the days off count the time from its start to its end, so starting at lunch counts ½ for that day; any amount of work, even 15 minutes, breaks it; it must work for increments finer than ½ later.

- Laid end to end, the days' working times form one timeline. A stretch is a maximal interval on it without remaining work. Inside a stretch every day is completely free; the first day contributes its free time at the end, the last day its free time at the start.
- Days off = the length of that interval, in units.
- Cost = the cost inside it. Every unit of cost lies in exactly one stretch, so the costs of all stretches add up to planned.
- A stretch is **listed** when it contains cost > 0 or a paid closure: a calendar-source day of type Paid closure, or a day that a day rule makes completely free although its base value is above 0. A paid closure without leave appears with cost 0. Stretches of only weekends, public holidays, Holiday-type sources or leave from another plan are not listed.
- A stretch may extend beyond the plan period in both directions, over the days that are free there, so the stretch at the end of December shows its real length into January.

Examples (2027; Ascension is Thursday 6 May; 24 and 31 December have `requiredAtMost` ½):

| Leave | Stretch | Cost → days off |
| --- | --- | --- |
| ½ on Fri 7 May, `start` | Thu 6 May to Fri 7 May noon | ½ → 1 ½ |
| ½ on Fri 7 May, `end` | Fri 7 May noon to Sun 9 May (Thursday is a separate, unlisted stretch) | ½ → 2 ½ |
| full Mon 27 to Thu 30 Dec, ½ on Fri 31 Dec | Fri 24 Dec noon to Sun 2 Jan 2028 | 4 ½ → 9 ½ |
| ½ on Fri 24 Dec as well | Fri 24 Dec to Sun 2 Jan 2028 | 5 → 10 |

And without the "at most ½" rule on 24 December, with mandatory ½ `end` on Fri 24 Dec (the company closes at noon) and own ½ `start` that day, and no other leave around it: the stretch runs from Fri 24 Dec to Sun 26 Dec, cost 1 → 3 days off. With own ½ `end` instead, it runs from Fri 24 Dec noon to Sun 26 Dec, cost ½ → 2 ½.

### Where partial own leave lies: suggestion

A function the UI calls when the user sets partial own leave. If the leave covers all work of the day, the part doesn't matter and the suggestion is `"end"`. Otherwise, if free time borders the day on exactly one side (the end of the previous day or the start of the next day, taking the day's other leave into account), the suggestion is that side, so the leave joins the free time. If free time borders on both sides or on neither, there is no suggestion and the UI asks.

### Weight writer

A function from units to the fraction string that files contain: `"0"`, `"1"`, `"1/2"`, `"3/32"`, reduced, round-tripping with `parseWeight`. Display formatting for people comes with the UI.

## Inputs and outputs

**Inputs** (typed, already parsed; the file-format branch produces them from JSON):

- Contract: the region selection for the holiday engine, the work week entries, the day rules.
- Calendar-source days: for each day, the source ID, the type (`holiday`, `paidClosure`, `mandatory`, `info`, `otherPlan`) and, depending on the type, a share and a part. A source "Leave from another plan" carries all leave that plan charged, its own and its mandatory leave; building that list from a `.urlaub.json` or `.ics` is the job of the branch that reads sources (issue 0006).
- Plan: the period (start and end month), the allowance in units, own leave days (`date`, `take`, `part`, `note`), manual overrides per date.

**Output** (one result object for the UI, `.ics`, PDF and JSON exports):

- For every day of the plan period and of the stretches reaching beyond it: required work and its contributions, the leave pieces with their sources, the cost, the free time at the start and the end, and every source of the day (including Info, which has no effect).
- Totals: allowance, planned, remaining, per calendar year.
- Stretches: start (day and position), end, cost, days off, listed or not.
- Problems: leave outside the plan period, leave on a day without required work, own leave on a day already taken in another plan, conflicting forced rules. Each names the rule, source or day it concerns. Rules that never produce a day are reported by the rule check above, not per plan.

## Tests

| Level | What |
| --- | --- |
| Day-rule matching | single-day rules through the existing `ruleDate`; ranges with `to` and with `days`, across New Year, `once` start with an Easter end, `once` end only in its year, a `to` that gives no day; `weekdays` filter; validity by start year; 29 February with `days` and with `to` |
| Warnings | leap-year warning for `days` with a fixed start across the end of February, not for `once` or Easter starts; mixed fixed/moving ends in both directions |
| Required work | the spec's row "minimum of the lowering layers"; 24/31 December on a weekend costs 0; a ½ holiday source on a public holiday stays 0; forced rule beats a holiday; conflicting forced rules; override last; work week with a change; days before the first entry; an all-zero entry |
| Cost | cost = min(taken, required work) for random multiples of 1/32 (fast-check); mandatory leave, also partial; the cost examples above as a table-driven test, including the maintainer's example (own ½ `start` plus mandatory ½ `end` on a working day: whole day free, cost 1); own and mandatory on the same part (counted once) and on different parts (added); leave from another plan never costs; mandatory leave covered by leave from another plan is not charged, own leave there is charged and reported |
| Totals | the sum is correct; per calendar year across a year boundary; remaining below 0 |
| Stretches | the examples above, including 24 December with own ½ `start` and mandatory ½ `end` (Fri 24 Dec to Sun 26 Dec, 1 → 3); 10 units (15 minutes) of remaining work break a stretch; the first and last day partial; a standalone paid closure listed with cost 0; ordinary weekends not listed; extension beyond the plan period; property: the costs of all stretches add up to planned |
| Positions | the suggestion: free on one side, both sides, neither side; leave that covers all work |
| Weight writer | round trip with `parseWeight` for every multiple of 1/480 between 0 and 1 |

## Documentation updates in this branch

Already applied to `docs/SPEC.md` during the design conversation (maintainer decisions of 2026-10-18):

- Plan file sketch: `"match": { "type": "fixed", "month": 12, "day": 31 }, "requiredAtMost": "1/2"` instead of `"match": { "fixed": "12-31" }, "max": "1/2"`.
- A bullet after the sketch: day-rule `match` with named fields, `range` (`from`, `to` or `days`, `weekdays`), the three effects.
- Mandatory leave: a share of the day; leave on the same part of the day counts once, on different parts it adds up.
- `part`: `"start"` or `"end"` of the working time, required for partial leave; it decides whether a day joins a stretch and doesn't change the cost.
- Work week: the first entry also applies before its start date.
- Stretches: the definition above, including listing standalone paid closures with cost 0.
- Glossary, day rule: "lowers or fixes the required work (`requiredAtMost`, `requiredExactly`) or marks mandatory leave (`mandatory`)".
- Mandatory leave is not charged where leave from another plan already covers it; a source "Leave from another plan" includes that plan's mandatory leave.

To do in the branch:

- A reference for people who write day rules by hand (fields, the examples above, the warnings), in the style of `docs/holiday-data-format.md`.
- `issues/0005-work-hours-as-named-fields.md` and `issues/0006-other-plan-sources-include-mandatory-leave.md` (created during the design) are committed with this document.

## Decisions

**By the maintainer** (2026-10-18):

- The counting model is the next branch, the file format the one after.
- One notation: named JSON fields, ISO dates, no text syntax like `"12-31"`; the spec sketch is changed accordingly.
- Day rules match through the holiday data's date rules plus `range`, with both `to` and `days`, and an optional `weekdays` filter.
- `days` keeps the length in leap years; a warning is enough because no country is affected (research above).
- The rule dialog warns when a range mixes a fixed and a moving end.
- Day rules can describe mandatory leave, with a share such as ½.
- Effect names: `requiredAtMost`, `requiredExactly`, `mandatory`.
- Stretches: unbroken time off, partial first and last day, any work breaks it, finer increments must work.
- Positions within the day: good defaults where possible, otherwise the user must choose.
- Standalone paid closures are listed as stretches with cost 0.
- No special state before the first work-week entry: the rules describe ongoing employment; the first entry applies backwards.
- Mandatory leave is not charged where leave from another plan already covers that part of the day; own leave there is charged and reported.

**Designer's calls (check these):**

- Defaults for positions: free time at the end for rules and sources; own leave from the neighbouring days or the user's choice.
- Positions are relative to the work block, not to the clock day (so ½ leave on a ½ day frees the whole day).
- Two forced rules with different values on the same day: the lower value wins, and it is reported as a conflict (in line with "a rule can never make a day more expensive" for the lowering layers).
- A "paid closure" for listing stretches is a Paid-closure source or a day rule that frees a whole day whose base value is above 0; Holiday-type sources count like public holidays.
- Stretches extend beyond the plan period in both directions; costs and totals stay inside it.
- Calendar sources come in as resolved days; reading iCal stays in the iCal branch.
- Issue 0002 stays out of this branch.
- "A rule that can't apply" means a rule that produces no day in any year of its validity; it is a rule warning, not a per-plan problem.

## Left to the builder

- Module layout under `src/engine/` and `tests/`, function and type names, the shape of the result object, as long as it carries what "Inputs and outputs" lists.
- How the work-week lookup, the per-day evaluation and the stretch search are implemented; the whole plan (13 months, a few dozen rules and sources) must be cheap enough to recompute on every change in the browser.
- The bounded range of years over which the rule check looks for a rule that never produces a day.
- The upper limit for `days` and how far stretches are followed beyond the plan period (both bounded; at least long enough for real company closures and the turn of the year).
- How cost on a day with both own and mandatory leave is split between them in the result (if at all); totals don't depend on it.
- Which layer decides the position when several lowering layers give the same lowest value; deterministic and documented.
- Whether invalid typed input (a share above one day, partial own leave without `part`) is reported or thrown as a programming error; untrusted JSON never reaches the engine unvalidated.
- The wording of problems and warnings: codes plus the data needed for message catalogs, no sentences in the engine.
