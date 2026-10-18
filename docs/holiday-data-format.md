<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday data format

Reference for the country data files in `src/data/holidays/` (one JSON file per country, e.g. `de.json`). The TypeScript shape is `CountryData` in `src/engine/holidays/types.ts`; `validateCountryData` in `src/engine/holidays/validate.ts` checks a file and reports every problem it finds, including unknown keys. The procedure for changing holiday data is in [`.claude/skills/holiday-data/SKILL.md`](../.claude/skills/holiday-data/SKILL.md).

## Top level

| Key | Meaning |
| --- | --- |
| `schema` | Format version, always `1`. |
| `country` | Country code, two uppercase letters (`"DE"`). Must match the `country` of a region selection. |
| `nameKey` | Translation key of the country name (`"country.DE"`). |
| `weekStart` | First day of the week shown in the UI: `mon` … `sun`. |
| `weekend` | Non-empty list of distinct weekdays, at most six of them (at least one weekday must stay free). Substitute days skip these days. |
| `workWeek` | Standard required work for each of the seven weekdays, as weight strings (`"1"`, `"0"`, `"1/2"`, `"0.5"`). Every weekday must be present; values must be exact in 1/480 day. |
| `sources` | Map from a source key to `{ title, url, checked }`, see [Sources](#sources). |
| `regions` | Non-empty list of `{ id, nameKey }`; for DE the 16 federal states (`region.DE.BY`). IDs are unique. |
| `localRules` | List of switches, see [Local rules](#local-rules). |
| `holidays` | List of holiday rules, see [Holiday rules](#holiday-rules). |

The German data (`de.json`) is correct from the year 2000 onwards; earlier rules such as Repentance Day as a nationwide holiday until 1994 are not modelled.

## Sources

Every holiday rule and every local rule cites at least one source by key, and every source must be cited somewhere. A source is:

- `title`: what the document at the URL is, in the country's language: for a law, regulation or gazette entry its official name, with the article or section where useful; for a parliamentary paper or an authority page its issuer and title;
- `url`: an official source (law portal, official gazette, parliament documentation, or a page of a government authority), starting with `https://`; never Wikipedia, legal reference collections or holiday websites;
- `checked`: the ISO date on which the text behind the URL was last checked.

A rule cites the law that defines the holiday and, where it matters, the amending law that changed its validity or the regulation behind a one-off date or a local rule. Every URL must be a document that was actually opened and read on the `checked` date; if a law portal cannot be read (some render only with JavaScript), cite the official document that was read instead (gazette, parliament papers, authority page). A rule may cite several sources.

## Holiday rules

| Key | Meaning |
| --- | --- |
| `id` | Stable, unique rule ID (`"reformation-day-2017"`). Appears in results as `ruleId`. |
| `nameKey` | Translation key of the holiday name. Several rules may share one key (`holiday.reformation-day`). |
| `date` | When the holiday falls in a year, see [Date rules](#date-rules). |
| `regions` | `"all"` or a non-empty list of region IDs. |
| `localRule` | Optional ID of a local rule; the holiday then applies only when that switch is on. `regions` must lie within the local rule's regions. |
| `validFrom`, `validUntil` | Optional years, both inclusive, between 1583 and 9999; `validFrom` ≤ `validUntil`. Outside this range the rule produces nothing. |
| `substitute` | Optional `{ when: [...] }`: if the holiday falls on one of the listed weekdays (a non-empty subset of `weekend`), an extra substitute day is added, see [Substitute days](#substitute-days). |
| `sources` | Non-empty list of source keys. |

Two rules may produce the same day (in Germany, 1 May 2008 was both Labour Day and Ascension Day); both are returned.

### Date rules

| `type` | Fields | Day |
| --- | --- | --- |
| `fixed` | `month`, `day`, `nonLeap` | The given calendar day. `nonLeap` is required for 29 February and only allowed there: `drop` (no holiday in common years), `feb28` or `mar1`. |
| `easter` | `offset` | Western (Gregorian) Easter Sunday plus `offset` days, −200 … 200. |
| `orthodoxEaster` | `offset` | Orthodox Easter Sunday (Julian computus, expressed as a Gregorian date) plus `offset` days (`offset` from -200 to 200). |
| `weekdayRelative` | `weekday`, `relation`, `month`, `day` | The `weekday` relative to the reference date `month`/`day` (never 29 February). `before` and `after` are strict: the reference date itself never matches. `onOrBefore` and `onOrAfter` include it. Example: the Day of Repentance and Prayer is `wed` `before` 11-23, so it is 16 November when 23 November is itself a Wednesday. |
| `nthWeekday` | `month`, `weekday`, `n` | The `n`-th `weekday` of the month, `n` = 1 … 4, or `-1` for the last one. |
| `once` | `date` | The ISO date, only in its own year. |

## Local rules

A local rule is a switch for a sub-area of one or more regions that the user turns on explicitly, phrased as "applies at my place of work" (e.g. Augsburg's Peace Festival in Bavaria). Municipality lists are not embedded.

| Key | Meaning |
| --- | --- |
| `id` | Unique switch ID, used as a key in the selection's `options`. |
| `regions` | Non-empty list of region IDs where the switch can be set. |
| `nameKey`, `explanationKey` | Translation keys of the switch label and its explanatory help text. |
| `sources` | Non-empty list of source keys. |

The engine takes a selection `{ country, state, options }`. A switch that is missing or `false` is off. An option whose ID is not a local rule of the selected state, an unknown state or a different country is an error (`RangeError`). Switches are independent of each other.

## Substitute days

`holidaysBetween(data, selection, from, to)` computes the regular holidays of every year from one year before `from` to one year after `to` (clamped to 1583 … 9999), so substitutes of holidays just outside the range are found. Then, in order of day and rule ID, every regular holiday whose rule has `substitute.when` containing its weekday gets one substitute day: the first day after it that is neither a weekend day of the country nor already taken by a regular holiday or an earlier substitute. A substitute keeps the rule's `ruleId` and `nameKey` and has `substitute: true`. The result contains the days from `from` to `to` (both inclusive), sorted by day, then rule ID, regular before substitute.

## Adding a country

1. Find the official legal sources (see the skill above).
2. Create `src/data/holidays/<cc>.json` (lowercase country code); `REUSE.toml` already covers `src/data/**`.
3. Import it in `src/data/holidays/index.ts` and add it to `countries` under its code.
4. Add `tests/data/holidays/<cc>.test.ts` with known dates for at least three years per rule, including the years before and after each rule change. The validity test in `tests/data/holidays/de.test.ts` runs for every entry of `countries`.
5. Add the translation keys used by the file to the message catalogs (`ui-texts` skill).
6. Cross-check against the Python `holidays` package and explain the differences.
