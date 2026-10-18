<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Day rules

Reference for people who write day rules by hand, for example in the `rules` list of a plan file or a rule set. A day rule says that on certain days the required work is lower, is a fixed value, or that part of the day is taken as leave automatically. The TypeScript shape is `DayRule` in `src/engine/counting/types.ts`; `ruleDays` in `src/engine/counting/match.ts` finds the days a rule matches, and `dayRuleWarnings` in `src/engine/counting/warnings.ts` reports likely mistakes. Dates are always written as ISO dates (`"2027-03-13"`) and fields have names; there is no text syntax such as `"12-31"`.

## Top level

| Key | Meaning |
| --- | --- |
| `id` | Unique rule ID within the file (`"christmas-eve"`). Appears in warnings and in the detail view as the source of a value. |
| `match` | Which days the rule applies to, see [Match](#match). |
| `validFrom`, `validUntil` | Optional years, both inclusive. Outside this range the rule produces nothing. For a range, the year in which it starts counts. |
| `requiredAtMost`, `requiredExactly`, `mandatory` | The effect. Exactly one of the three, see [Effects](#effects). |
| `part` | Optional `"start"` or `"end"`, see [Part](#part). |
| `label` | Optional name of the rule, `{ "de": "Silvester", "en": "New Year's Eve" }`. Only shown, never interpreted. |
| `origin` | Optional ID of the rule set the rule was copied from. Set by the app; "Update rules from rule set" uses it to tell copied rules from your own. Leave it out when writing a rule by hand. |

## Match

A `match` is either one of the six date rules of the holiday data or a range. The date rules (`fixed`, `easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`, `once`) are written exactly as described in [Date rules](holiday-data-format.md#date-rules) and match one day per year (`once` only in its own year).

A range matches several consecutive days:

| Key | Meaning |
| --- | --- |
| `type` | `"range"`. |
| `from` | First day, any date rule. A range never contains another range. |
| `to` | Last day, any date rule. Exactly one of `to` and `days`. |
| `days` | Length in days, a whole number from 1 to 366. Exactly one of `to` and `days`. |
| `weekdays` | Optional non-empty list of `mon` … `sun`. Only these weekdays of the range are matched. |

For each year in which `from` gives a day, the range starts on that day. With `days` it covers the start and the following `days − 1` days. With `to` it ends on the first day on or after the start that `to` gives, looked for in the start year and then in the following year. So `27 December to 2 January` crosses New Year without a special case, and a `once` end exists only in its own year. If `to` gives no such day, the range does not occur that year. A day matched twice by the same rule (overlapping occurrences) counts once.

## Effects

Each value is a share of a day, written as a weight string: `"1"`, `"1/2"`, `"0"`. Decimal strings such as `"0.5"` are accepted when reading; the app writes fractions. The value must be exact in 1/480 day.

| Effect | Meaning |
| --- | --- |
| `requiredAtMost` | Lowers the required work to at most this value. A day that already needs less is left alone. |
| `requiredExactly` | Forces the required work to exactly this value, after all lowering effects (public holidays, calendar sources, `requiredAtMost` rules). Only a manual change of a single date comes later. If several `requiredExactly` rules match one day with different values, the lower value wins and the day is reported as a problem. |
| `mandatory` | Mandatory leave: this share of the day is taken automatically and charges the allowance. |

The two required-work effects accept `"0"` (no work on that day). `mandatory` must be above 0, from `"1/480"` to `"1"`.

## Part

`part` states where the free time lies when the value is below a full day. `"end"` (the default) means the work comes first and the free time is at the end, as on 24 December when the work stops at noon. `"start"` means the free time is at the start of the day. It matters for stretches (which days off form an unbroken block), and for cost only where own and mandatory leave overlap on the same part of the day, which counts once.

When several layers give the same lowest required value on a day, the free time lies where the first layer of the deciding stage with an explicit `part` says; if none has one, where the first layer says; if that has no `part` either, at the end.

## Warnings

`dayRuleWarnings(rule)` returns codes with the rule ID; the rule dialog shows them as warnings, not errors. A rule with a warning is still valid.

| Code | When | What to do |
| --- | --- | --- |
| `leapYearLength` | A range with `days` and a `fixed` start whose last day moves between years because of 29 February. Example: `from` 27 February, `days` 4 ends on 1 March in leap years and on 2 March otherwise. | Use `to` instead of `days`, so the end is the same calendar day every year. |
| `mixedRangeEnds` | A range with `to` where exactly one end is a fixed date (`fixed` or `once`) and the other moves (`easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`), in either direction. Example: from Weiberfastnacht (`easter` offset −52) to 1 March. In some years the end can jump into the next year. | Check the dates in the preview for the years that matter, or make both ends move the same way. |
| `neverApplies` | The rule produces no day in any year of its validity. Example: a `once` date outside `validFrom`/`validUntil`, or `weekdays: ["mon"]` on a range that only ever covers Easter Sunday. | Check the dates in the preview; remove the rule or correct the validity or filter. |

A rule that matches nothing within the period of one plan, or one that changes nothing on a matched day ("at most ½" on a Sunday), is not reported: rule sets span many years.

## Examples

24 and 31 December at most half a day of work:

```json
{ "id": "christmas-eve", "match": { "type": "fixed", "month": 12, "day": 24 }, "requiredAtMost": "1/2" }
{ "id": "new-years-eve", "match": { "type": "fixed", "month": 12, "day": 31 }, "requiredAtMost": "1/2" }
```

A working Saturday, 13 March 2027, on which a full day is required:

```json
{ "id": "working-saturday", "match": { "type": "once", "date": "2027-03-13" }, "requiredExactly": "1" }
```

Company closure from 27 December for 4 days as mandatory leave (`days` with a `fixed` start triggers `leapYearLength` only when the range can cover the end of February, which it cannot here):

```json
{ "id": "closure", "match": { "type": "range", "from": { "type": "fixed", "month": 12, "day": 27 }, "days": 4 }, "mandatory": "1" }
```

The company closes at noon on 24 December, so half a day is taken as leave at the end of the day:

```json
{ "id": "christmas-eve-noon", "match": { "type": "fixed", "month": 12, "day": 24 }, "mandatory": "1/2", "part": "end" }
```

Range matches:

```json
{ "type": "range", "from": { "type": "fixed", "month": 12, "day": 27 }, "to": { "type": "fixed", "month": 1, "day": 2 } }
{ "type": "range", "from": { "type": "once", "date": "2028-03-20" }, "to": { "type": "easter", "offset": 1 } }
{ "type": "range", "from": { "type": "easter", "offset": -52 }, "days": 6 }
{ "type": "range", "from": { "type": "fixed", "month": 12, "day": 1 }, "to": { "type": "fixed", "month": 12, "day": 31 }, "weekdays": ["sat"] }
```

The first runs from 27 December to 2 January of the following year. The second runs from 20 March 2028 to Easter Monday 2028 (a `once` start with a moving end triggers `mixedRangeEnds`). The third covers six days from Weiberfastnacht (52 days before Easter Sunday). The fourth matches every Saturday in December.

## Weekly patterns

A pattern that holds all year, such as "Sundays are never worked", belongs in the work week, not in a day rule. A `requiredExactly` rule for every Sunday would also win over Easter Sunday, whereas a work-week value lets the holiday lower it.
