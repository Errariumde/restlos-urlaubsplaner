---
status: open
priority: 2
area: engine (counting model, problems), day rules
branch:
created: 2026-11-09
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Mandatory leave that lies wholly on time without work is silent

## Problem

A rule set gives 24 December `requiredAtMost: "1/2"` (work at the start of the day, the afternoon free) and `mandatory: "1/2"` without `part`. A `mandatory` rule without `part` lies at the `"end"` of the day (`docs/dev/en/reference/day-rules-format.md`, "Part"), so the mandatory leave lands on the free afternoon: it covers no work, costs nothing, the day keeps ½ day of work left, and no problem is listed.

Before leave was charged by its overlap with the working time (issue 0031, charge leave only where it overlaps the working time), the same rules cost ½ and freed the day. A rule author can't tell that the rule now does nothing on that day.

`npm run plan` on a plan for 2027 (DE, BY, full-time, allowance 30) with only these two rules:

```
Allowance 30, planned 0, remaining 30
2027: 0
Stretches: none
Problems: none
```

The same plan with `"part": "start"` on the `mandatory` rule, where the mandatory leave lies on the morning's work:

```
Allowance 30, planned 1/2, remaining 29 1/2
2027: 1/2
Stretches:
  2027-12-24 – 2027-12-26: 3 days off, cost 1/2
Problems: none
```

## Context

- `src/engine/counting/plan.ts`: `leavePieces` puts mandatory leave without `part` at `"end"`; `computePlan` reports leave on time that is off anyway (`leaveOnFreeTime`) only for own leave (`evaluation.ownWorkOverlap === 0`).
- `src/engine/counting/leave.ts`, `evaluateLeave`: mandatory leave is charged only where it overlaps the work block.
- `docs/SPEC.md`, "Problems": the list of what the plan reports names own leave on time that is off anyway, not mandatory leave on such time. "How a day's required work comes about" (Mandatory leave): it is charged with its overlap with the working time.
- `docs/dev/en/reference/day-rules-format.md`: "Part" gives `"end"` as the default for every effect; "Examples" has both rules of the pair, `christmas-eve` (`requiredAtMost` ½) and `christmas-eve-noon` (`mandatory` ½ at the `"end"`), so a rule set that takes both examples gets this day; "Warnings" doesn't report a rule that changes nothing on a matched day, because rule sets span many years.
- `examples/plans/muster-ag-2027.urlaub.json`, rule `christmas-eve` (mandatory ½, `part: "end"`), has this shape and works only because 24 December 2027 is a full working day there.
- Mandatory leave from a calendar source of type Mandatory leave has the same default (`part` `"end"`) and the same gap.

## Acceptance criteria

- [ ] The behaviour chosen from the options in the notes is built, for mandatory leave from day rules and from calendar sources.
- [ ] A test with exactly this rule pair on 24 December 2027 (`requiredAtMost: "1/2"` and `mandatory: "1/2"`, both without `part`) shows the chosen result: the problem or notice on that day, or a cost of ½ and the whole day free.
- [ ] `docs/SPEC.md` ("Problems", or "How a day's required work comes about") and `docs/dev/en/reference/day-rules-format.md` ("Part", and "Warnings" if the rule check changes) say it.
- [ ] `npm run plan` gives the same results as before for every file in `examples/`, or the change is stated where it differs; `npm run check` passes.

## Notes

Options, not decided:

- **A problem or notice** for mandatory leave that covers no work on a day with required work: the mirror of `leaveOnFreeTime` for own leave. It names the rule or source (as `conflictingForcedRules` names its rules), with one sentence in both languages. Mandatory leave can be changed only in its rule or source, so the sentence says where to look.
- **A `mandatory` rule without `part` lands where the day's work lies:** without `part`, mandatory leave below a full day starts at the edge of the day the work reaches, so this pair costs ½ and frees the day, as before issue 0031 (charge leave only where it overlaps the working time). An explicit `part` keeps its meaning. Files read the same; what they compute changes only on days where mandatory leave without `part` meets lowered work.
- A warning of the rule check (`checkRules`) alone can't see it: whether mandatory leave meets free time depends on the other rules, the sources and the work week of each day.
