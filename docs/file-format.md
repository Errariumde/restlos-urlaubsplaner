<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Plan files and rule sets

Reference for people who write plan files (`.urlaub.json`) and rule sets (`.regeln.json`) by hand, or who want to check what the app wrote. The TypeScript shape of a checked file is `AnyFile` in `src/engine/file/types.ts`. `readFile` in `src/engine/file/read.ts` reads untrusted text and returns either a refusal or the file with a report of everything it dropped, changed or noticed; `writeFile` in `src/engine/file/write.ts` writes a file in the canonical form described here. `npm run plan -- <file>` prints what the engine reads and computes for a plan file or rule set. Day rules have their own reference, [Day rules](day-rules-format.md).

A file holds only language-neutral values (IDs, ISO dates, weights with a slash or a decimal point) and is self-contained: it never refers to another file. It carries no timestamp, no time zone, no working hours and nothing about the device or the person that saved it.

## Kinds and versions

| `kind` | File | Content |
| --- | --- | --- |
| `"plan"` | `Name.urlaub.json` | a contract, calendar sources, templates and a color scheme, plus exactly one plan |
| `"ruleSet"` | `Name.regeln.json` | the same without the plan and without anything personal, see [Rule sets](#rule-sets) |
| `"settings"` | `restlos.einstellungen.json` | device settings; not described here yet, and refused by the reader (`settingsNotSupported`) until the UI exists |

The app recognizes a file by `schema` and `kind`, not by its name.

`schema` is `"restlos/1"`. Every change of the format gets a new schema number. A release reads every schema written by any release of its own major version, migrates older ones on load and always saves its own; a new major version still reads the last schema of the previous major version. A file with a newer schema is refused (`newerSchema`). Nothing is promised before version 1.0.0: schema 1 may still change without migration.

## Values

- **Weights** are shares of a day, written as strings: `"1"`, `"1/2"`, `"0"`, `"3/32"`. Readers accept fractions and decimal strings with a decimal point (`"0.5"`); the app writes reduced fractions. A weight lies between 0 and 1 and must be exact in 1/480 day: `"1/7"` and `"0.33"` are invalid (`"0.3"` is 144/480 and valid).
- **Amounts** (only `plan.allowance`) are written like weights but go from 0 to 10,000 days: `"30"`, `"30.5"`, `"61/2"`.
- **Dates** are ISO dates (`"2027-05-07"`), **months** are `"YYYY-MM"`, **years** are whole numbers; all lie between 1583 and 9999.
- **IDs** are non-empty strings of at most 200 characters (`"christmas-eve"`). Rule, source and template IDs are unique within their list.
- **Characters** are counted as Unicode code points.
- **Keys** a file chooses itself (reference keys, language codes, option names, keys inside `theme`) are never `__proto__`, `constructor` or `prototype`; an entry with such a key is invalid.

### Texts

Every free text is either a plain string or a map from language code to string: `contract.name` and `description`, a rule's `label` and `note`, a source's and an entry's `name`, a reference's `title` and `version`, a template's `name`, and the `name` of a [plan reference](#plan-references).

```json
"label": { "de": "Heiligabend", "en": "Christmas Eve" }
```

A language code is two or three lowercase letters, optionally followed by lowercase subtags (`pt-br`); any language can be added without a format change. A map has at least one entry and only string values. The app shows the UI language, otherwise `en`, otherwise the first entry; a plain string is shown as it is. Texts typed in the app are plain strings, and the `text` of a plan note is always a plain string.

## Top level

Keys in the order the app writes them:

| Key | Meaning |
| --- | --- |
| `schema` | `"restlos/1"`. |
| `kind` | `"plan"` or `"ruleSet"`. |
| `id` | The file's identity, an ID. The app creates a random UUID version 4 at "New"; "Save as" and "New → Based on the current file" create a new one. |
| `revision` | Whole number from 1, raised by 1 on every save; a new `id` starts at 1. It stays at 9,007,199,254,740,991, the largest whole number a reader accepts, once it gets there. |
| `ruleSet` | Plan files only, optional: the rule set the plan was created from or last updated from, as a [plan reference](#plan-references). |
| `contract` | Required, see [Contract](#contract). |
| `sources` | Calendar sources, see [Calendar sources](#calendar-sources). Missing reads as `[]`. |
| `templates` | Own PDF templates, see [Templates](#templates). Missing reads as `[]`. |
| `theme` | A color scheme or `null`, see [Color scheme](#color-scheme). Missing reads as `null`. |
| `plan` | Plan files only, required, see [Plan](#plan). |

### Plan references

`ruleSet` and the `plan` of an `otherPlan` source name another file without pointing to it:

| Key | Meaning |
| --- | --- |
| `id` | That file's `id`. |
| `name` | A text up to 200 characters, for display: that file's `contract.name`. |
| `revision` | That file's `revision` when it was read. |

## Contract

| Key | Meaning |
| --- | --- |
| `name` | Optional text up to 200 characters: what the contract is (`"Beispiel GmbH (ohne Tarifvertrag, Stand 2026)"`). |
| `description` | Optional text up to 2000 characters: who it is for, what it can't express, and what the user must check. |
| `references` | Optional map from a key (an ID) to a [reference](#references): what the contract is based on. Rules cite the keys. At most 100; left out when empty. |
| `region` | Required, see [Region](#region). |
| `minUnit` | Optional weight, the smallest leave unit; default `"1/2"`, see [Smallest leave unit](#smallest-leave-unit). |
| `week` | Required: the work week with validity, see [Work week](#work-week). |
| `rules` | Required list of day rules, may be empty, see [Day rules](#day-rules). |

`name`, `description` and `references` say what the file is about and what it is based on. Files written by hand may leave them out; the rule sets that come with restlos have all three, and every one of their rules cites a reference (a test enforces it).

### References

| Key | Meaning |
| --- | --- |
| `title` | Text up to 200 characters: what the document is, including the paragraph (`"Betriebsverfassungsgesetz (BetrVG), § 87 Abs. 1 Nr. 5"`). |
| `version` | Text up to 200 characters: which version of the document was read (`"in der Fassung vom …"`). |
| `url` | Link starting with `https://`, up to 2000 characters. |
| `checked` | ISO date on which the link was last opened and read. |

### Region

| Key | Meaning |
| --- | --- |
| `country` | Required: a country code of the holiday data (`"DE"`). |
| `state` | A region ID of that country (`"BY"`). Required in a plan file when the country's data has regions; optional in a rule set. |
| `options` | Optional map from a local-rule ID of the selected `state` to `true` or `false` (`{ "assumption": true, "augsburg": false }`). A missing switch is off. Written with the keys sorted. |

A rule set fixes as much of the region as it knows: an agreement valid everywhere gives only the country, a company site gives everything; "New → From rule set" asks for the rest. Local rules are described in [Holiday data format](holiday-data-format.md#local-rules).

### Smallest leave unit

`minUnit` is a weight that divides one day into whole units: `"1"`, `"1/2"`, `"1/4"`, … `"1/32"`, or any other `1/n` where `n` divides 480. Version 1 of the app offers only `"1"` and `"1/2"`. Leave and overrides that are not a multiple of it are kept and reported (`notMultipleOfMinUnit`).

### Work week

`week` is a non-empty list of at most 100 entries with strictly increasing `from`:

| Key | Meaning |
| --- | --- |
| `from` | ISO date from which the entry applies. The first entry also applies before its date. |
| `required` | The required work of each weekday as a weight, all seven in the order `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. |

```json
"week": [
  { "from": "2026-01-01", "required": { "mon": "1", "tue": "1", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } },
  { "from": "2027-09-01", "required": { "mon": "1", "tue": "1/2", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } }
]
```

### Day rules

`rules` holds at most 1000 day rules, written as described in [Day rules](day-rules-format.md). The app writes their keys in this order: `id`, `origin`, `label`, `match`, `validFrom`, `validUntil`, the effect (`requiredAtMost`, `requiredExactly` or `mandatory`), `part`, `note`, `references`. Besides the counting model's fields a rule in a file has:

| Key | Meaning |
| --- | --- |
| `label` | Optional text up to 200 characters, the rule's name. |
| `note` | Optional text up to 2000 characters, shown with the rule: for example what its basis says that the rule can't express. |
| `references` | Optional list of keys of `contract.references` that the rule is based on. |
| `origin` | Plan files only, optional: the `id` of the rule set the rule was copied from. |

## Calendar sources

`sources` holds at most 50 sources; the list order is the display priority. A source is imported once (from iCal or from another plan file) or created by hand, and is stored only as its entries: no iCal text, no file content.

| Key | Meaning |
| --- | --- |
| `id` | Unique source ID. |
| `origin` | Plan files only, optional: the `id` of the rule set the source was copied from. |
| `name` | Text up to 200 characters (`"Kita"`). |
| `type` | One of the types below. |
| `color` | A slot of the color palette, `{ "slot": "accent-3" }` (lowercase words joined by hyphens), or an own color, `{ "rgb": "#1a7f37" }` (`#` and six hexadecimal digits). |
| `visible` | `true` or `false`. |
| `plan` | Type `otherPlan` only: a [plan reference](#plan-references) to the other plan. |
| `entries` | List of at most 2000 [entries](#entries). |

### Types

| `type` | Meaning | Entry fields | Effect |
| --- | --- | --- | --- |
| `holiday` | lowers the required work | `required` (`"0"` … `"1"`, default `"0"`), `part` | lowering layer: the required work is at most `required` |
| `paidClosure` | paid closure | – | required work 0 |
| `mandatory` | mandatory leave | `take` (`"1/480"` … `"1"`, default `"1"`), `part` | that share of the day is taken and charged, like a `mandatory` day rule |
| `info` | background band, e.g. school holidays | – | none |
| `needed` | time off needed: the user must be free, e.g. the Kita closes | `take` (`"1/480"` … `"1"`, default `"1"`), `part` | never costs; a problem on every day of the plan period where that much time is not free, see [Time off needed](#time-off-needed) |
| `otherPlan` | leave from another plan | `from`, `to`, `kind` | never costs; see [Leave from another plan](#leave-from-another-plan) |

`part` means the same in leave, overrides, rules and source entries: where in the day the free time lies, `"start"` or `"end"` of the working time. It is optional and defaults to `"end"`. A rule set never contains `otherPlan` or `needed` sources: both are personal.

### Entries

An entry covers one date or the days of a repeating `match`. Keys in the order the app writes them:

| Key | Meaning |
| --- | --- |
| `date` | ISO date: the entry covers this one day. |
| `match` | A match as in [Day rules](day-rules-format.md#match): the entry covers every day it matches. Exactly one of `date` and `match`. |
| `validFrom`, `validUntil` | Match entries only: optional years, both inclusive, as for day rules. |
| `except` | Match entries only: optional list of at most 400 ISO dates that the match skips, such as an exception of an iCal series or a need dismissed for one day. |
| `name` | Optional text up to 200 characters: the event's title, for display and duplicate detection. |
| `required` or `take` | The type's share, see [Types](#types). |
| `part` | Optional, see [Types](#types). |

An `otherPlan` entry is always a date entry, written as `date`, `name`, `from`, `to`, `kind`.

Entries are kept in a fixed order: date entries by date (other-plan entries on the same date by `from`), then match entries in their list order. The reader and the writer sort them this way, so files written by hand may list them in any order.

To compute a plan, match entries are expanded over the computation window (the plan period and 60 days on either side), without the `except` dates; date entries are taken as they are. All sources of a plan together may give at most 50,000 days.

```json
{ "id": "kita", "name": "Kita", "type": "needed", "color": { "slot": "accent-4" }, "visible": true,
  "entries": [
    { "date": "2027-11-12", "name": "Pädagogischer Tag" },
    { "match": { "type": "range", "from": { "type": "fixed", "month": 9, "day": 1 }, "to": { "type": "fixed", "month": 8, "day": 31 }, "weekdays": ["tue"] },
      "validFrom": 2027, "validUntil": 2027, "except": ["2027-12-28"], "name": "Abholen", "take": "1/2", "part": "end" } ] }
```

The Kita closes on 12 November 2027, and from September 2027 to August 2028 the child must be picked up on Tuesday afternoons, except on 28 December 2027.

### Time off needed

A need of `take` at the `"end"` is covered on a day that is entirely free or whose free time at the end is at least `take`; at the `"start"` the same with the free time at the start. The whole day counts, not only its working time, and so does whatever made the time free: own leave, mandatory leave, leave from another plan, a public holiday, a source or rule that lowers the required work, or the work week. On a day of the plan period where a need is not covered, the plan reports the problem `uncoveredNeed` with the source. A need never costs anything; covering it is ordinary own leave. To dismiss it for one day, add the date to the entry's `except`, or remove a single-date entry.

### Leave from another plan

An `otherPlan` source holds the days another plan charged, as spans of its working time:

| Key | Meaning |
| --- | --- |
| `date` | The day. |
| `name` | Optional text up to 200 characters. |
| `from`, `to` | Weights: shares of a full day measured from the start of the working time, `from` < `to`. `"0"` to `"1/2"` is the morning, `"1/2"` to `"1"` the afternoon, `"0"` to `"1"` the whole day. |
| `kind` | `"leave"` or `"mandatory"`: what the other plan charged it as, for display only. |

A day can have several entries, one per span. A span can lie in the middle of the working time once steps are finer than ½ (`"1/4"` to `"2/4"`), which a `take` with a `part` can't express. The app writes both ends with their smallest shared denominator (`"1/4"` and `"2/4"`, `"2/8"` and `"3/8"`), so the length can be read off; `"0"` and `"1"` stay as they are. The reader accepts any weights.

In the plan that holds the source, a span is free time that never costs. Mandatory leave on it is not charged, because the other plan charged it; own leave on it is charged and reported (`leaveTakenInOtherPlan`).

**Import.** `importOtherPlan` in `src/engine/file/other-plan.ts` reads a `.urlaub.json` with the same reader, computes it with its own stored sources, and keeps only:

- `plan`: its `id`, its `contract.name` (its `id` when it has no name) and its `revision`;
- `entries`: for every day of its period with a cost above 0, one entry per span it charged. A span is `"mandatory"` where mandatory leave was charged, also where own leave lies on the same part of the day, and `"leave"` for the rest of the charged own leave.

Nothing else of the other plan is stored: no notes, contract or allowance. Because each plan stores what the other actually charged, a shared day is charged in exactly one plan, also when two plans import each other. The import is refused with the reader's refusal, with `notAPlan` for a rule set, and with `limitExceeded` (`entriesPerSource`) when the plan charged more than 2000 spans. For "Update source" it gives notices: `differentPlan` when the file has another `id` than the plan imported before, `olderRevision` when its `revision` is lower than before, and `outdatedCopyOfCurrent` when it contains an older copy of the current plan as a source of its own.

## Templates

`templates` holds at most 20 own PDF templates:

| Key | Meaning |
| --- | --- |
| `id` | Unique template ID. |
| `origin` | Plan files only, optional: the `id` of the rule set the template was copied from. |
| `name` | Text up to 200 characters. |
| `api` | Whole number from 1: the version of the template data interface. |
| `typst` | The Typst versions the template needs (`">=0.13"`), up to 200 characters. |
| `typ` | The template's Typst source, at most 512 KB in UTF-8. |
| `images` | Optional list of images, each `name` (up to 200 characters), `type` (`"image/png"`, `"image/jpeg"` or `"image/svg+xml"`) and `data` (Base64); at most 1 MB per image and 2 MB per template, decoded. |

The reader checks only the shape and the limits; what a template contains is defined with the templates. Images go only to Typst or into an `<img>` element; an SVG is never inserted as markup.

## Color scheme

`theme` is `null` or an object, stored and written back unchanged; it may nest at most 32 levels, none of its objects may have a key `__proto__`, `constructor` or `prototype`, and it counts towards the file size. What a color scheme contains is defined with the color editor.

## Plan

Plan files only. Keys in the order the app writes them:

| Key | Meaning |
| --- | --- |
| `range` | The plan period: `from` and `to` as months, both inclusive, `from` ≤ `to`, at most 36 months (`{ "from": "2027-01", "to": "2028-01" }`). |
| `allowance` | The allowance as an amount (`"30"`). Remaining days from the previous year are entered here; there is no carry-over. |
| `days` | Own leave, at most 2000 entries: `date`, `take` (`"1/480"` … `"1"`), `part` (required when `take` is below `"1"`). |
| `overrides` | Manual changes of the required work on single dates, at most 2000 entries: `date`, `required` (`"0"` … `"1"`), `part` (where the free time lies). |
| `notes` | Notes, at most 2000 entries: `date`, `text` (a plain string of 1 to 2000 characters). |

Each list has at most one entry per date and is sorted by date; a missing list reads as `[]`. The three lists are independent: removing leave never removes a note. Overrides are personal and therefore in the plan, never in the contract; a company-wide single date is a day rule with a `once` date.

```json
"plan": {
  "range": { "from": "2027-01", "to": "2028-01" },
  "allowance": "30",
  "days": [ { "date": "2027-05-07", "take": "1" }, { "date": "2027-12-23", "take": "1/2", "part": "start" } ],
  "overrides": [ { "date": "2027-11-11", "required": "1/2", "part": "end" } ],
  "notes": [ { "date": "2027-05-07", "text": "Brückentag" } ]
}
```

## Rule sets

A rule set has the same structure with `"kind": "ruleSet"`, and:

- no `ruleSet` and no `plan` (a rule set with either is refused, `kindMismatch`);
- no `origin` on rules, sources or templates (reported as an unknown field and dropped);
- no `otherPlan` or `needed` sources (dropped and reported, `personalSourceInRuleSet`);
- `contract.region` may leave out `state` and `options`.

A rule set alone can't be computed: it has no period. "Save as rule set" writes the contract, the sources other than `otherPlan` and `needed`, the templates and the color scheme of a plan file as a new rule set with a new `id` and `revision` 1.

## Reading

`readFile(text)` checks the size (the UTF-8 length; a leading byte-order mark is skipped), parses the JSON, checks `schema` and `kind`, migrates older schemas (there are none yet) and then validates every value. It returns either a refusal, and nothing is loaded, or the file with a report. Unknown keys are reported but never looked into, so a deeply nested value costs no more than parsing it.

A report entry has a `code`, the `path` of the affected value (`"contract.rules[2].label"`, `"plan.days[0].take"`) and, for some codes, `data` with what the message needs. The report carries no sentences; the app writes them in the UI language. A refusal has a `code`, and a `path` and `data` where they apply.

`readFile` also returns `positions`: for every kept rule, source, source entry, template, leave day, override and note, its index in the list in the text that was read. Report entries and hints use paths in that text; `textPath` in `src/engine/file/positions.ts` turns a path in the loaded file into one in the text.

### Refused

| Code | When |
| --- | --- |
| `tooLarge` | The text is larger than 10 MB in UTF-8. Checked before parsing. |
| `notJson` | The text is not JSON. |
| `unknownSchema` | The text is not a JSON object with a `schema` of the form `"restlos/N"`. |
| `newerSchema` | The schema number is higher than 1: the file was made with a newer version of restlos. |
| `unknownKind` | `kind` is not `"plan"`, `"ruleSet"` or `"settings"`. |
| `settingsNotSupported` | `kind` is `"settings"`. |
| `kindMismatch` | A rule set has `plan` or `ruleSet`. |
| `invalidCore` | A core value is missing or invalid: `id`, `revision`, `contract`, `contract.region` or its `country`, a plan file's `state` where the country's data has regions, `week` or any of its entries, `contract.rules` if it is not a list, `plan`, `plan.range`, `plan.allowance`; or one of the lists `sources`, `templates`, `days`, `overrides` and `notes` is present but not a list. |
| `limitExceeded` | A list is longer than its limit, the plan period is longer than 36 months, or the sources of a plan give more than 50,000 days. `data.limit` names the limit: `rules`, `sources`, `templates`, `weekEntries`, `references`, `planDays`, `overrides`, `notes`, `periodMonths` or `sourceDays`. |

### Loaded with a report

| Code | Situation | What happens |
| --- | --- | --- |
| `unknownField` | A key the format doesn't define, including `origin` in a rule set and `validFrom`, `validUntil` or `except` on a date entry | dropped; saving writes only known keys |
| `invalidEntry` | An invalid entry of a list: rule, reference, source, source entry, `except` date, template, image, leave day, override, note. Also an invalid `ruleSet` reference, a rule set's invalid `state`, invalid `options` or a single option that is not `true` or `false`, a `references` or `theme` value of the wrong kind | that entry dropped, the rest loads; an invalid image drops its template; an invalid `theme` reads as `null`. For rules, source entries, leave days, overrides and notes, `data.field` names the first invalid field (`{ "field": "take" }`) |
| `duplicateDate` | The same date twice in `days`, `overrides` or `notes` | the first valid one kept, later ones dropped without being read any further |
| `duplicateId` | The same ID twice among rules, sources or templates | the first kept, later ones dropped |
| `unknownReference` | A rule cites a key that `contract.references` doesn't have (`data.reference`) | the citation dropped, the rule kept |
| `textTooLong` | A text over its limit (`data.limit`; `data.language` for a language map) | the entry that holds the text dropped: a rule with an over-long `label` or `note` as a whole, reported also as `invalidEntry` of the rule with `data.field`; likewise a reference, a source, a source entry, a template, a note, the `ruleSet` reference; an over-long `contract.name` or `description` is left out |
| `sourceTooLarge` | A source with more than 2000 entries, or one of its entries with more than 400 `except` dates (`data.limit`: `entriesPerSource` or `exceptPerEntry`) | that source dropped |
| `templateTooLarge` | A `typ` over 512 KB, an image over 1 MB or a template's images over 2 MB together (`data.limit`: `typBytes`, `imageBytes` or `templateImageBytes`) | that template dropped |
| `unknownLocalRule` | An option the holiday data doesn't define for the selected state, for example after a local rule was renamed or removed, or any option in a rule set without `state` | the option dropped |
| `personalSourceInRuleSet` | An `otherPlan` or `needed` source in a rule set (`data.type`) | that source dropped |
| `invalidMinUnit` | `minUnit` present but invalid | `"1/2"` used |
| `notMultipleOfMinUnit` | A leave `take` or an override's `required` that is not a multiple of `minUnit` | kept; the engine computes it exactly |
| `partSuggested` | Partial own leave without `part` (`data.part`) | kept with a part: inside the plan period the one the neighbouring days suggest, computed once for the whole plan, otherwise `"end"`; outside the period always `"end"`, without a computation |
| `outsidePeriod` | Leave, an override or a note outside the plan period | kept; the calendar doesn't show it |

Example: a leave day `{ "date": "2027-06-01", "take": "1/4" }` without other leave around it, in a plan with `minUnit` `"1/2"`, loads with two entries, `notMultipleOfMinUnit` at `plan.days[0].take` and `partSuggested` at `plan.days[0]` with `{ "part": "end" }`.

### Checking

`checkRules(file, positions, onProgress)` runs on a loaded file and never changes it. It checks the contract rules, then each source's match entries, and gives hints with the codes `neverApplies`, `leapYearLength` and `mixedRangeEnds` (see [Day rules](day-rules-format.md#warnings)). Hints are not part of the read report. Their paths are positions in the text that was read, like the paths of the read report (see `positions`), so a hint and a report entry about the same rule have the same path.

Progress: `onProgress` is called with `(0, N)` first and then once per rule or match entry. `checkCount(file)` gives N.

### Missing optional parts

A missing optional part is not a repair and gets no report entry. It reads as its default:

| Missing | Reads as |
| --- | --- |
| `contract.name`, `contract.description` | no name, no description |
| `contract.references` | `{}` |
| `contract.minUnit` | `"1/2"` |
| `sources`, `templates` | `[]` |
| `theme` | `null` |
| `plan.days`, `plan.overrides`, `plan.notes` | `[]` |
| `required` of a `holiday` entry | `"0"` |
| `take` of a `mandatory` or `needed` entry | `"1"` |
| `part` of an override, a rule or a source entry | means `"end"`; written back missing |

`contract.week` and `contract.rules` are required; `rules` may be the empty list.

## Limits

| What | Limit | Exceeded |
| --- | --- | --- |
| Whole file | 10 MB (UTF-8), checked before parsing | refused (`tooLarge`) |
| Day rules / sources / templates / work-week entries / references | 1000 / 50 / 20 / 100 / 100 | refused (`limitExceeded`) |
| `days`, `overrides`, `notes` | 2000 each | refused (`limitExceeded`) |
| Entries of one source / `except` dates of one entry | 2000 / 400 | that source dropped (`sourceTooLarge`) |
| Source days after expanding all entries over the computation window | 50,000 in total | refused (`limitExceeded`) |
| Plan period | 36 months | refused (`limitExceeded`) |
| `typ` of one template | 512 KB | that template dropped (`templateTooLarge`) |
| One image / all images of a template | 1 MB / 2 MB decoded | that template dropped (`templateTooLarge`) |
| Names, labels, reference titles and versions / descriptions, notes | 200 / 2000 characters | that entry dropped (`textTooLong`) |
| IDs and reference keys / URLs | 200 / 2000 characters | invalid: that entry dropped (`invalidEntry`), an over-long file `id` refused (`invalidCore`) |
| Files inside files | none: another plan is stored as entries, never embedded | |

KB and MB are binary: 1 MB is 1,048,576 bytes. Reading and computing any file within these limits takes well under a second.

## Writing

`writeFile` writes canonical JSON: two-space indentation, UTF-8 without a byte-order mark, a final line break, and keys in this order (optional keys that are absent are left out):

| Object | Key order |
| --- | --- |
| file | `schema`, `kind`, `id`, `revision`, `ruleSet`, `contract`, `sources`, `templates`, `theme`, `plan` |
| plan reference | `id`, `name`, `revision` |
| contract | `name`, `description`, `references`, `region`, `minUnit`, `week`, `rules` |
| reference | `title`, `version`, `url`, `checked` |
| region | `country`, `state`, `options` (keys sorted) |
| work-week entry | `from`, `required` (`mon` … `sun`) |
| rule | `id`, `origin`, `label`, `match`, `validFrom`, `validUntil`, the effect, `part`, `note`, `references` |
| match | `type`, then the fields in the order of [Date rules](holiday-data-format.md#date-rules) and [Match](day-rules-format.md#match) |
| source | `id`, `origin`, `name`, `type`, `color`, `visible`, `plan`, `entries` |
| entry | `date` or `match`, `validFrom`, `validUntil`, `except`, `name`, `required` or `take`, `part`; other-plan entries `date`, `name`, `from`, `to`, `kind` |
| template | `id`, `origin`, `name`, `api`, `typst`, `typ`, `images` (`name`, `type`, `data`) |
| plan | `range` (`from`, `to`), `allowance`, `days` (`date`, `take`, `part`), `overrides` (`date`, `required`, `part`), `notes` (`date`, `text`) |

Weights are written as reduced fractions (`"1/2"`, never `"0.5"`), the allowance too (`"61/2"` for 30½ days), other-plan spans with a shared denominator. `days`, `overrides` and `notes` are written sorted by date and source entries as described under [Entries](#entries), whatever the order in the model. The lists `rules`, `sources`, `entries`, `templates`, `days`, `overrides` and `notes` are always written, also when empty, and so is `theme`; `references` only when it has entries. Reading a file the app wrote gives the same file again; its report then holds only notices that still apply, such as leave outside the period.

`writeFile` writes the model as it is, except that it sorts those lists the way the reader does. Saving first raises `revision` by 1; "Save as" gives a new `id` and `revision` 1. A rule set is always written without `plan`, `ruleSet`, `origin` and `otherPlan` or `needed` sources.

## Example

The rule set `examples/rules/beispiel-gmbh.regeln.json` in a compact layout, with the description and the rule notes shortened (`…`):

```json
{
  "schema": "restlos/1",
  "kind": "ruleSet",
  "id": "9491dab8-261f-4a8e-b0d1-f92e22673b98",
  "revision": 1,
  "contract": {
    "name": { "de": "Beispiel GmbH (ohne Tarifvertrag, Stand 2026)", "en": "Beispiel GmbH (no collective agreement, as of 2026)" },
    "description": {
      "de": "Fiktives Beispiel: eine Firma ohne Tarifvertrag in einer bayerischen Gemeinde, in der Mariä Himmelfahrt ein Feiertag ist (nicht Augsburg). … Prüfe alles an deinem eigenen Arbeitsvertrag und Tarifvertrag. Es gibt keine Gewähr, dass die Regeln stimmen, vollständig oder aktuell sind.",
      "en": "A fictional example: a company without a collective agreement in a Bavarian municipality where Assumption Day is a public holiday (not Augsburg). … Check everything against your own employment contract and collective agreement. There is no guarantee that these rules are correct, complete or up to date."
    },
    "references": {
      "cms": {
        "title": "CMS: „Alle Jahre wieder“: Freistellung von der Arbeitspflicht an Weihnachten und Silvester",
        "version": { "de": "Beitrag vom 3. Dezember 2022, zuletzt geändert am 5. Juni 2026", "en": "article of 3 December 2022, last modified on 5 June 2026" },
        "url": "https://cms.law/de/deu/legal-updates/Alle-Jahre-wieder-Freistellung-von-der-Arbeitspflicht-an-Weihnachten-und-Silvester",
        "checked": "2026-10-18"
      },
      "betrvg": {
        "title": "Betriebsverfassungsgesetz (BetrVG), § 87 Abs. 1 Nr. 5",
        "version": {
          "de": "in der Fassung der Bekanntmachung vom 25. September 2001, zuletzt geändert durch Art. 1 des Gesetzes vom 19. Juli 2024 (BGBl. 2024 I Nr. 248)",
          "en": "as published on 25 September 2001, last amended by Art. 1 of the Act of 19 July 2024 (BGBl. 2024 I No. 248)"
        },
        "url": "https://www.gesetze-im-internet.de/betrvg/__87.html",
        "checked": "2026-10-18"
      }
    },
    "region": { "country": "DE", "state": "BY", "options": { "assumption": true, "augsburg": false } },
    "minUnit": "1/2",
    "week": [ { "from": "2026-01-01", "required": { "mon": "1", "tue": "1", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } } ],
    "rules": [
      { "id": "christmas-eve", "label": { "de": "Heiligabend: nachmittags frei", "en": "Christmas Eve: afternoon off" },
        "match": { "type": "fixed", "month": 12, "day": 24 }, "requiredAtMost": "1/2", "part": "end",
        "note": { "de": "In dieser fiktiven Firma gibt es am 24. Dezember den Nachmittag frei. …", "en": "In this fictional company the afternoon of 24 December is off. …" },
        "references": ["cms"] },
      { "id": "new-years-eve", "label": { "de": "Silvester: nachmittags frei", "en": "New Year's Eve: afternoon off" },
        "match": { "type": "fixed", "month": 12, "day": 31 }, "requiredAtMost": "1/2", "part": "end",
        "note": { "de": "In dieser fiktiven Firma gibt es am 31. Dezember den Nachmittag frei. …", "en": "In this fictional company the afternoon of 31 December is off. …" },
        "references": ["cms"] },
      { "id": "company-closure", "label": { "de": "Betriebsruhe 27. bis 30. Dezember", "en": "Company closure 27 to 30 December" },
        "match": { "type": "range", "from": { "type": "fixed", "month": 12, "day": 27 }, "to": { "type": "fixed", "month": 12, "day": 30 },
                   "weekdays": ["mon", "tue", "wed", "thu", "fri"] },
        "mandatory": "1",
        "note": { "de": "Pflichturlaub: Die Tage von Montag bis Freitag kosten Urlaub. …", "en": "Mandatory leave: the days from Monday to Friday cost leave. …" },
        "references": ["betrvg"] }
    ]
  },
  "sources": [],
  "templates": [],
  "theme": null
}
```

More examples: the seven rule sets in `examples/rules/` and the three plan files in `examples/plans/`; `muster-ag-2027.urlaub.json` and `muster-ag-2028.urlaub.json` together use every source type a plan may hold.
