<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: file format

As of: 2026-10-18. Branch: `file-format` (from `main` after #2/#3, the counting model).

## Intent

The third engine branch. The holiday engine knows the public holidays, the counting model turns typed input into required work, cost, totals and stretches; this branch makes that input come from files people keep, share and edit by hand. After it, a plan file (`.urlaub.json`) or a rule set (`.regeln.json`) can be read with a report of everything that was wrong, written back in a stable form, and computed. The UI branch then adds screens, browser storage and dialogs; the iCal branch adds reading and writing `.ics`.

The branch also ships the first **example files**. The maintainer wants the rule sets to become templates users can start from ("New → From rule set"), so they are researched against the actual collective agreements, cite their basis with its version, and carry the warning that users must check them against their own contract and that there is no guarantee. Every example is computed in a test whose expected values are worked out by hand.

There is still no screen. A small developer command, `npm run plan -- file.urlaub.json`, prints what the engine computes for a file, so the examples and hand-written files can be tried in a terminal.

The design conversation also settled how calendar sources work (imported once, stored as entries, editable, exportable). This branch builds their storage and their effect on the counting model; the import and export of `.ics` are recorded for the iCal branch.

`docs/SPEC.md` is authoritative. This document cuts out the part built now and records the decisions made for it on 2026-10-18; several of them change the spec in this branch (see "Documentation updates"). Relevant spec sections: "Files: plan file, rule set and settings" (all subsections), "Multiple calendar sources (iCal)", "Counting model" (mandatory leave), "First start", "Finer granularity", ".ics export", "Built-in help" (View example), "Risks", "Test strategy" (row "Files"), and the glossary.

## Goals

1. **Read** plan files and rule sets: size check, JSON, schema and `kind`, validation, a report of every problem; invalid entries dropped one by one, the file refused only when its core is unusable.
2. **Write** them back canonically (fixed key order, sorted lists, fraction strings), raising `revision` on every save.
3. **Calendar sources as lists of entries** (a date or a repeating `match`), for all source types, including the new type "Time off needed".
4. **Counting model additions** for that type: no effect on cost, and a problem for needed time that isn't free.
5. **Turn a loaded file into counting-model input** (`PlanInput`), so `computePlan` runs on it.
6. **Import "Leave from another plan" from a `.urlaub.json`** by storing only the days that plan charged (issue 0006).
7. **Close issues 0001 and 0005** (0005 as `wontfix`).
8. **Size limits** on everything that is read.
9. **Example files**: seven rule sets and three plan files, with tests that compute them.
10. **`npm run plan`**: a terminal view of a plan file.
11. **Documentation**: the spec changes below, a format reference for people who write files by hand, two new issues.

## Non-goals (this branch)

- Reading or writing `.ics` (ical.js), the import preview, the export of plans and sources: iCal branch (see "Calendar sources: import and export later").
- The settings export `.einstellungen.json`: what it holds (language, view, colour schemes) doesn't exist before the UI. `kind: "settings"` is recognised and refused as not supported yet.
- Autosave, the browser memory behind the revision warning, "Update rules from rule set", editing sources, "Take leave on these days", the list of notes and manual changes, the dialogs ("apply partially or cancel"): UI branch.
- What PDF templates and colour schemes contain: stored and written back unchanged with a basic shape check; their branches define them.
- Migration code: only schema 1 exists, and nothing is promised before 1.0.0.
- New packages, including JSON-schema or validation libraries.

## Anti-goals

The branch fails even if tests pass when any of these is true:

- Anything is dropped, changed or defaulted while reading without an entry in the report.
- A file contains a timestamp, a time zone, working hours, or anything else about when, where or by whom it was saved. `id` is a random UUID version 4.
- Untrusted JSON reaches the counting model without validation, or reading can be made to hang or exhaust memory within the limits below.
- A rule set written by the app contains a plan, an `origin`, a `ruleSet` reference, or a source of type "Leave from another plan" or "Time off needed".
- A text mini-syntax (`"12-31"`, `"08:00-12:00"`), floats for shares, or JavaScript `Date` anywhere in the engine.
- An example rule set without its basis (agreement, version, link, date checked), or with a rule its basis doesn't support.
- Sentences in the engine: the report carries codes and data, the UI writes the sentences.

## Constraints

From `AGENTS.md` and the spec; not negotiable here:

- 1 day = 480 integer units; weights are written as fraction strings (`"1/2"`), decimal strings (`"0.5"`) are accepted on read; values not exact in 1/480 are rejected.
- ISO dates (`YYYY-MM-DD`), months as `YYYY-MM`, years 1583–9999 (`src/engine/days.ts`); no `Date` (ESLint).
- Pure TypeScript without DOM and runtime dependencies; country data only through `src/data/holidays/index.ts`.
- Language-neutral values in files; keys in English following the glossary; a `kind` field identifies the file; no references between files.
- Security: no `eval`/`new Function`, size limits on all imports; data from files is never inserted as markup.
- REUSE: examples are MIT-0 through `REUSE.toml` (the spec's licensing table already lists "example plan file and rule set"); new code EUPL-1.2, new documentation CC-BY-4.0.
- Commits on `file-format`, unsigned, never pushed; `npm run check` passes after every task; tools only through npm scripts.

## What gets built

### Files and versions

- **Schema string** `"restlos/1"` (was `"urlaubsplaner/1"` in the sketch; the generic word is used by many other products). `kind` is `"plan"`, `"ruleSet"` or `"settings"`.
- **Version policy** (maintainer): every change of the format gets a new schema number. The app reads every schema written by any release of its own major version, migrates older ones on load and always saves its own. A new major version (2.0.0) must still read the last schema of the previous major version and may drop older ones; the release notes say so. Files with a newer schema are refused ("made with a newer version of restlos"); files too old for this version are refused with the way out ("open it once with restlos 1.x and save it"). A minor release that introduces a new schema says in its release notes that older 1.x copies can't open its files. Nothing is promised before 1.0.0: schema 1 may still change in the iCal and UI branches without migration.
- **Identity:** `id` (random UUID v4, created at "New"; "Save as" and "New → Based on the current file" create a new one) and `revision` (integer ≥ 1, raised by 1 on every save; a new `id` starts at 1). No `savedAt`.
- **File names** (UI branch, recorded in the spec): where Save is a download (Firefox, Safari), the app suggests `Name.revN.urlaub.json`, replacing an existing `.revN`; where it writes back into the same file (Chrome, Edge), the name stays. The revision inside the file decides; the name is only a hint.

### Texts in several languages

Every free text (`description`, `label`, `note`, reference titles, template names) is either a plain string or a map from language code to text: `{ "de": "Heiligabend", "en": "Christmas Eve" }`. Any lowercase language code is allowed, so `fr` or `es` can be added without a format change. The app shows the UI language, otherwise `en`, otherwise the first entry; a plain string is shown as is. Notes and names typed in the app are plain strings.

### Plan file

A sketch showing every part (illustrative; not one of the example files):

```json
{
  "schema": "restlos/1", "kind": "plan",
  "id": "6f1c…-uuid", "revision": 7,
  "ruleSet": { "id": "a93e…-uuid", "name": "Beispiel GmbH (ohne Tarifvertrag)", "revision": 3 },
  "contract": {
    "name": "Beispiel GmbH (ohne Tarifvertrag)",
    "description": { "de": "…", "en": "…" },
    "references": {
      "betrvg-87": { "title": "Betriebsverfassungsgesetz, § 87 Abs. 1 Nr. 5", "version": "…", "url": "https://…", "checked": "2026-10-18" } },
    "region": { "country": "DE", "state": "BY", "options": { "assumption": true, "augsburg": false } },
    "minUnit": "1/2",
    "week": [ { "from": "2020-01-01", "required": { "mon": "1", "tue": "1", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } } ],
    "rules": [ { "id": "new-years-eve", "origin": "a93e…-uuid", "match": { "type": "fixed", "month": 12, "day": 31 },
                 "requiredAtMost": "1/2", "label": { "de": "Silvester", "en": "New Year's Eve" },
                 "note": { "de": "…", "en": "…" }, "references": ["betrvg-87"] } ] },
  "sources": [
    { "id": "project", "name": "Projektphase", "type": "info", "color": { "slot": "accent-2" }, "visible": true,
      "entries": [ { "match": { "type": "range", "from": { "type": "once", "date": "2027-09-06" },
                                "to": { "type": "once", "date": "2027-10-29" } }, "name": "Release 3" } ] },
    { "id": "kita", "name": "Kita", "type": "needed", "color": { "slot": "accent-4" }, "visible": true,
      "entries": [
        { "date": "2027-11-12", "name": "Pädagogischer Tag" },
        { "match": { "type": "range", "from": { "type": "fixed", "month": 9, "day": 1 },
                     "to": { "type": "fixed", "month": 8, "day": 31 }, "weekdays": ["tue"] },
          "validFrom": 2027, "validUntil": 2027, "take": "1/2", "part": "end", "name": "Abholen",
          "except": ["2027-12-28"] } ] },
    { "id": "previous-year", "name": "Urlaub 2026", "type": "otherPlan", "color": { "slot": "accent-3" }, "visible": true,
      "plan": { "id": "51b0…-uuid", "name": "Beispiel GmbH (ohne Tarifvertrag)", "revision": 9 },
      "entries": [ { "date": "2027-01-04", "from": "0", "to": "1", "kind": "leave" },
                   { "date": "2027-01-05", "from": "0", "to": "1/2", "kind": "leave" },
                   { "date": "2027-01-08", "from": "1/4", "to": "2/4", "kind": "mandatory" } ] } ],
  "templates": [ { "id": "my-band", "name": "My year band", "api": 1, "typst": ">=0.13", "typ": "…",
                   "images": [ { "name": "logo.png", "type": "image/png", "data": "iVBOR…" } ] } ],
  "theme": null,
  "plan": {
    "range": { "from": "2027-01", "to": "2028-01" },
    "allowance": "30",
    "days":      [ { "date": "2027-05-07", "take": "1" },
                   { "date": "2027-12-23", "take": "1/2", "part": "start" } ],
    "overrides": [ { "date": "2027-11-11", "required": "1/2", "part": "end" } ],
    "notes":     [ { "date": "2027-05-07", "text": "Brückentag" } ]
  }
}
```

- **Removed from the spec sketch:** `savedAt`, `contract.timeZone`, `contract.workHours`, and the stored file content of sources (`format`, `content`).
- **`contract.name`, `description`, `references`:** what the contract is and what it is based on. The maintainer asked that this be documented as needed, so a file says what it is about. `references` is a map from a key to `{ title, version, url, checked }`, modelled on the holiday data's `sources` (that name is taken here by calendar sources); a rule cites keys in its `references`. All three are optional in files people write themselves and required for the bundled rule sets (a test enforces it).
- **`region`:** `country` required and known to `src/data/holidays/index.ts`; `state` required in a plan file wherever the country's data has states; `options` only for local rules of that state. In a rule set `state` and `options` are optional (see "Rule set").
- **`minUnit`:** a weight that divides one day into whole units (`"1"`, `"1/2"`, … `"1/32"`); default `"1/2"` when missing (the spec's default).
- **`week`:** as the counting model's `WorkWeekEntry`, with ISO `from` and weight strings for all seven weekdays.
- **`rules`:** the counting model's `DayRule` plus the file-only fields `label`, `note`, `references`, `origin`. The format of `match` and the effects is `docs/day-rules-format.md`.
- **`sources`:** see "Calendar sources" below.
- **`templates`:** `id`, `name`, `api` (integer), `typst` (version range), `typ` (text), optional `images` (`name`, `type` one of `image/png`, `image/jpeg`, `image/svg+xml`, `data` Base64), `origin`. Checked only for shape and limits; images go only to Typst or into `<img>`, an SVG is never inserted as markup.
- **`theme`:** `null` or an object, stored and written back unchanged (it counts towards the file size).
- **`plan`:** `range` (`YYYY-MM` months, both inclusive, `from` ≤ `to`, at most 36 months), `allowance` (weight string ≥ 0, may be far above one day), and three lists, each with at most one entry per date:
  - `days`: own leave, `take` (1/480 … 1) and `part` (required when `take` < 1);
  - `overrides`: manual changes of the required work, `required` (0 … 1) and `part` (where the free time lies, default `"end"`); they are personal and therefore in the plan, never in the contract (a company-wide single date is a day rule with a `once` date, so changing a date in a rule set creates such a rule);
  - `notes`: `text` on any date, independent of leave, so removing leave never deletes a note.
- **`part`** means the same everywhere (leave, overrides, rules, source entries): where in the day the free time lies, `"start"` or `"end"` of the working time.

### Calendar sources

A source is `id`, `name`, `type`, `color` (`{ "slot": "accent-3" }` or an own colour `{ "rgb": "#1a7f37" }`), `visible`, optional `origin`, and `entries`; list order is the display priority. Sources are imported once (iCal branch) or created by hand, and stored only as entries; no iCal text is kept (privacy: calendar exports carry descriptions, attendees and locations; and nothing has to be interpreted again on load, so no time zone is stored).

**An entry** is a `date`, or a `match` in the day-rule format (`docs/day-rules-format.md`) with optional `validFrom`/`validUntil` and optional `except` (ISO dates the match skips; used for iCal exceptions and for dismissing a need on one day). Every entry may have a `name` (the event's title, for display and the spec's duplicate detection). Fields by type:

| Type | Meaning | Entry fields | Effect in the counting model |
| --- | --- | --- | --- |
| `holiday` | lowers the required work | `required` (`"0"` … `"1"`, default `"0"`), `part` | lowering layer (exists) |
| `paidClosure` | paid closure | – | required work 0 (exists) |
| `mandatory` | mandatory leave | `take` (default `"1"`), `part` | mandatory leave (exists) |
| `info` | background band, e.g. school holidays | – | none (exists) |
| `otherPlan` | leave from another plan | `from`, `to`, `kind` (`"leave"` or `"mandatory"`); dates only (see "Leave from another plan") | covers leave, never costs (exists; the piece now carries its position) |
| `needed` | **Time off needed** (new): the user must be free, e.g. the Kita closes on Tuesday afternoons or on its closure days | `take` (default `"1"`), `part` | none on cost; a problem for every day where the needed piece is not free time (below) |

`otherPlan` sources additionally carry `plan` (`id`, `name`, `revision` of the other plan). A rule set may contain `holiday`, `paidClosure`, `mandatory` and `info` sources, never `otherPlan` or `needed` (both personal).

**"Time off needed" in the counting model** (new in this branch): `SourceDay` gains the type `needed` with `take` and `part`. Unlike leave pieces, a need is measured on the whole day (480 units), not inside the work block, because free time from lowered required work covers it too: a need of `take` at `"end"` is covered when the day is entirely free or its free time at the end (`freeEnd` of the counting model's day result, after all layers and all leave: own, mandatory, other plan) is at least `take`; at `"start"` the same with `freeStart`. Otherwise `computePlan` reports a problem for that day and source (for example code `uncoveredNeed`). Covering it is ordinary own leave; the UI's "Take leave on these days" creates such leave entries; the problem disappears when the time is free for any reason (leave, a holiday, a ½ work-week day). Dismissing it for one day adds the date to the entry's `except` (or removes a single-date entry). It is never charged by itself, unlike mandatory leave.

**From entries to days:** `match` entries are expanded over the counting model's computation window (the plan period ± `STRETCH_MARGIN_DAYS`) with the existing `ruleDays`, minus `except`; date entries are taken as they are. The result is the `SourceDay` list the counting model already takes.

### Rule set

The same structure with `"kind": "ruleSet"`, without `ruleSet`, `plan` and `origin`, and never with an `otherPlan` or `needed` source. `contract.region` may leave out `state` and `options`: a rule set fixes as much of the region as it knows (an agreement valid everywhere: only the country; a company site: everything), and "New → From rule set" asks for the rest (spec change in "First start").

### Reading

`readFile(text)` (name left to the builder) returns either a refusal with its reasons or the loaded file with a report. Order: size check (on the UTF-8 length) → `JSON.parse` → `schema` and `kind` → (migration, none yet) → validation → model + report.

**Refused** (nothing is loaded): not JSON; too large or over a count limit; unknown or newer schema; `kind` unknown or `settings`; content that doesn't match `kind` (a rule set with `plan` or `ruleSet`); an invalid core value: `id`, `revision`, `contract.region.country`, a plan file's `state`, `week`, `plan.range`, `plan.allowance`.

**Loaded with report entries** (each entry: a code, the path of the affected value, and the data the message needs):

| Situation | What happens |
| --- | --- |
| Unknown field | dropped; saving writes only known fields |
| Invalid entry in a list (rule, source, source entry, `except` date, template, image, leave day, override, note, reference) | that entry dropped, the rest loads |
| Same date twice in `days`, `overrides` or `notes`; same ID twice among rules, sources or templates | the first kept, later ones dropped |
| A rule cites an unknown `references` key | the citation dropped |
| Text over its length limit | that entry dropped |
| A source over its entry limit, a template over its limits | that source or template dropped |
| Local-rule option the holiday data doesn't define (0001) | dropped; a table of renamed options waits until a rename happens |
| `otherPlan` or `needed` source in a rule set | dropped (the app never writes one; only hand edits can cause it) |
| `minUnit` present but invalid | `"1/2"` used |
| `take` or `required` not a multiple of `minUnit` | kept (the engine computes it exactly; dropping someone's leave would be worse) |
| Partial own leave without `part` | kept; `part` set from `suggestPart`, otherwise `"end"` |
| Leave, override or note outside the plan period | kept (the calendar never shows them) |

Day rules and `match` entries are also run through `dayRuleWarnings`; its warnings go into the report unchanged.

### Limits

| What | Limit | Exceeded |
| --- | --- | --- |
| Whole file | 10 MB (UTF-8), checked before parsing | refused |
| Day rules / sources / templates / work-week entries / references | 1000 / 50 / 20 / 100 / 100 | refused |
| `days`, `overrides`, `notes` | 2000 each | refused |
| Entries of one source / `except` dates of one entry | 2000 / 400 | that source dropped |
| Source days after expanding all entries over the computation window | 50,000 in total | refused |
| Plan period | 36 months | refused |
| `typ` of one template | 512 KB | that template dropped |
| One image / all images of a template | 1 MB / 2 MB decoded | that template dropped |
| Names, labels, reference titles and versions / descriptions, notes | 200 / 2000 characters | that entry dropped |
| Files inside files | none: another plan is stored as entries, never embedded | |

Reading never recurses into unknown structures (they are only reported), so deeply nested JSON costs no more than `JSON.parse`. Reading and computing any file within these limits takes well under a second in the browser; in particular, suggested parts for partial leave without `part` come from one computation of the plan, not one per day, and expansion stops as soon as the source-day limit is reached. A test reads a file at the limits and checks the time.

### Writing

`writeFile(file)` returns the JSON text: two-space indentation, keys in the order of the format reference, `days`, `overrides` and `notes` sorted by date, source entries in a fixed order (dates by date, then matches in their list order), weights as fraction strings (other-plan spans with a shared denominator), UTF-8 without a byte-order mark, a final line break. `writeFile` writes the model as it is; saving is a separate step that raises `revision` by 1 before writing (and the caller passes a new `id` for "Save as"). A rule set is written without `plan`, `ruleSet`, `origin`, `otherPlan` and `needed` sources whatever the model contains. `read(write(x))` gives `x` with an empty report for every valid model.

### From file to counting model

`planInput(file)` builds the counting model's `PlanInput`: country data from `countries[region.country]`; the contract (region, work week, rules without the file-only fields); the source entries expanded to `SourceDay`s; period, allowance, leave and overrides as units and day numbers. A rule set alone can't be computed; the tests and the command combine it with a plan.

### Leave from another plan

Importing a `.urlaub.json` as a source reads it with the same reader, computes it with `computePlan` (with its own stored sources, which are themselves stored entries), and keeps:

- `plan`: its `id`, `contract.name` and `revision`, for display and "Update source";
- `entries`: for every day of its period with a cost above 0, each span of working time it charged, with `from`, `to` and `kind`.

**Spans, not `take` plus `part`** (maintainer, option A): `from` and `to` are shares of a full day measured from the start of the working time (`"0"` to `"1/2"` is the morning, `"1/2"` to `"1"` the afternoon, `"0"` to `"1"` the whole day). They are needed because what another plan charged can lie in the middle of the working time once steps are finer than ½: if the company's mandatory morning (½ `start`) is partly covered by that plan's own "Leave from another plan" for the first quarter, it charges only the second quarter, which `take` plus `part` can't express; storing it at an edge would charge time twice or flag leave falsely. Everything people enter (own leave, rules, other sources) keeps `take` plus `part`, because it always touches the start or the end.

- The counting model's day result gains the charged spans of a day (own leave united with mandatory leave not covered by another plan), from which the entries are taken; a day can have more than one span. The `kind` of a span where own and mandatory leave overlap is the builder's call (display only).
- Other-plan pieces enter the counting model with their position instead of `take` plus `part`; inside the work block of the receiving plan they are clipped to its required work.
- Writing a span uses the smallest shared denominator for both ends (`"1/4"` to `"2/4"`, `"2/8"` to `"3/8"`), so its length can be read off (maintainer); `0` and `1` stay `"0"` and `"1"`. Reading accepts any fraction or decimal; `from` < `to`, both between 0 and 1.

Nothing else of the other plan is stored: no notes, contract or allowance (privacy, size), and nothing has to be migrated. Because each plan stores what the other actually charged, a shared day is charged in exactly one plan, also when two plans import each other. "Update source" re-reads a newer file and reports a different `id` or a lower `revision`. If the imported plan itself contains a copy of the current plan (same `id`) with a lower `revision`, the import reports it ("plan 2028 contains an older copy of this plan; update it there"). The `.ics` form of this source stays with the iCal branch.

### Example files

Seven rule sets in `examples/rules/` and three plan files in `examples/plans/`, file names in German like the extensions.

**Rule sets.** Each has a German and English `description` that names who it is for, what the model can't express, and that the user must check it against their own contract and that there is no guarantee; `references` with title (including the paragraph), version, link and the date the link was opened; the version year in `contract.name`. The research behind them is summarised in the appendix; before writing a file, every link is opened again and `checked` is that date. Work weeks Mon–Fri `1`, Sat/Sun `0` unless stated.

| File | Region | Day rules |
| --- | --- | --- |
| `oeffentlicher-dienst.regeln.json` | DE | 24 and 31 Dec `requiredAtMost 0` |
| `metall-elektro-bw.regeln.json` | DE-BW | 24 and 31 Dec on Mon–Sat `requiredAtMost 1/2`, `part: "end"`; Saturday 23 and 30 Dec the same (they are the working day before Christmas and New Year when 24 or 31 Dec is a Sunday) |
| `banken.regeln.json` | DE | 24 and 31 Dec `requiredAtMost 0` |
| `versicherungen.regeln.json` | DE | 24 and 31 Dec `requiredAtMost 0`; Saturday before Easter (`easter −1`) and before Whit Sunday (`easter +48`) `requiredAtMost 0` (matters only for Saturday work) |
| `bauhauptgewerbe.regeln.json` | DE | 24 and 31 Dec `requiredAtMost 0`; the note says the days are unpaid for blue-collar workers but cost no leave |
| `karneval-rheinland.regeln.json` | DE | Weiberfastnacht (`easter −52`) `requiredAtMost 1/2`, `part: "end"`; Rosenmontag (`easter −48`) `requiredAtMost 0`; marked as company practice with suggested values |
| `beispiel-gmbh.regeln.json` | DE-BY, `assumption: true`, `augsburg: false` | fictional company without an agreement: 24 and 31 Dec `requiredAtMost 1/2`, `part: "end"`; company closure 27–30 Dec on Mon–Fri `mandatory 1` |

**Plan files.**

- `beispiel-gmbh-2027.urlaub.json`: the spec's "View example", now possible without iCal: from `beispiel-gmbh.regeln.json` (`ruleSet` and `origin` set as the app would), allowance 30, period 2027-01 to 2027-12; an info source "Projektphase"; a source "Leave from another plan" with January 2027 days of a fictional 2026 plan (stored entries); leave around Easter and on the bridge days after Ascension (7 May) and Corpus Christi (28 May), two summer weeks. It must read like a realistic plan, since users will see it.
- `muster-ag-2027.urlaub.json` and `muster-ag-2028.urlaub.json`: a fictional "Muster AG (Testbeispiel)" whose only purpose is to exercise the format and the counting model in one realistic-looking pair (maintainer: "a new example where you can add whatever you want"). It has no rule set file; its contract lives in the plans. At least:
  - a region with local rules switched on (for example Augsburg in Bavaria);
  - a work week with a change during 2027, Tuesday ½ from 1 September (the Kita pickup is then covered by the work week);
  - 24 Dec `mandatory 1/2`, `part: "end"`, and own ½ `start` on Friday 24 Dec 2027 (the maintainer's example: the whole day free at cost 1);
  - a company closure from 27 Dec to 4 Jan on Mon–Fri, `mandatory 1`, and leave on 5 and 7 Jan 2028, so 2027's period (2027-01 to 2028-01) holds the turn of the year;
  - a working Saturday (`requiredExactly 1`), an override, notes;
  - one source of every type that a plan may hold: `holiday` with a ½ entry, `paidClosure` (a standalone closure, listed as a stretch with cost 0), `info`, `needed` (single dates, a range, the Tuesday `match` with `except`, and one uncovered day so the problem appears), and in 2028 `otherPlan`;
  - the 2028 plan (2028-01 to 2029-01) with the 2027 plan as "Leave from another plan", stored as the import produces it: the closure days 3 and 4 Jan 2028 are charged only in 2027 (0006's test).

Whether the rule sets are later built into the app as templates ("New → From rule set" offering them, with their basis, version, date checked and the warning) is the UI branch's decision; the spec records the requirement.

### `npm run plan`

A developer tool under `scripts/`, not part of the app, so plain English text without message catalogs. Input: a plan file path. Output: the loading report; allowance, planned and remaining; totals per year; the stretches (dates, days off, cost); the problems. For a rule set it prints the loading report and its rules. Node 24 from the dev shell strips TypeScript types itself, but the code base imports without file extensions and imports JSON without import attributes; the builder solves that without new packages (for example a small resolve hook registered with `node:module`).

### Calendar sources: import and export later

Decided in this conversation, built in the iCal branch, recorded in a new issue and in the spec now:

- **Import once.** The user chooses which events to keep; the result is stored as entries; the `.ics` file is not kept. "Update source" imports again; its preview shows the differences with checkboxes, marks entries the user changed and doesn't preselect those for replacement.
- **Meanings chosen by the user, as easily as possible.** The preview groups events by name (twelve "Schulferien" events or a repeating "Elternabend" are one decision) and offers every type, including "Time off needed". Nothing is guessed silently; events that don't fit (10:00–14:00, shorter than `minUnit`) are the user's decision.
- **Defaults without working hours.** All-day events → full days; an event that ends by 12:00 → "½ start"; one that starts at 12:00 or later → "½ end"; one that spans noon → no suggestion.
- **Time zone** only during the import: the browser's by default, changeable in the import dialog, never stored.
- **Repeats.** Simple repeats (weekly on weekdays, yearly on a date, with an end) become a `match`; anything else (exceptions, complex rules) is expanded to dates for a period chosen at import, and the preview says so; iCal exceptions become `except`.
- **Sources are editable and exportable.** Entries can be removed, added (by clicking days), changed (share, part); a source can be renamed or change its type, and it can be created without any file (for example Kita closure days from a PDF). Every source can be exported as `.ics`, so the user doesn't maintain it in several programs: a `match` becomes a repeating event where iCal can express it, otherwise dates for a chosen period.
- **Export of partial days.** All-day events with share and part in the title, plus machine-readable `X-RESTLOS-TAKE`, `X-RESTLOS-PART` and `X-RESTLOS-TYPE`, so restlos reads its own export back exactly; this also marks mandatory leave for re-import as "Leave from another plan" (0006's `.ics` criterion).
- **Later, the maintainer's extended option B:** the user decides how partial days are converted in both directions (for example "½ start" ↔ "08:00–12:00"), with the browser's time zone as default and changeable. Points to solve then: one working-day layout serves both directions and finer steps better than a table per share; it is a device setting for export and an import-dialog setting, never stored in the plan; events that don't fit go to the preview.

## Tests

| Level | What |
| --- | --- |
| Reading | every refusal reason; every report situation in the table above, each with its code and path; a file with several problems; decimal weights accepted; weights not exact in 1/480 rejected; ISO date and month syntax and ranges; 0001 (a plan whose selection has an option the data no longer defines) |
| Limits | each limit just below (loads) and just above (refused or dropped as listed); a deeply nested unknown field |
| Writing | canonical output (key order, sorting, indentation, final line break) for a fixed model; `revision` raised; a rule set never contains plan, `ruleSet`, `origin`, `otherPlan` or `needed`; property (fast-check): `read(write(x))` gives `x` and an empty report for random valid models, with weights as random multiples of 1/32 |
| Texts | plain strings and language maps; the fallback order |
| Sources | each type's entry fields; date and `match` entries with `validFrom`/`validUntil` and `except`; expansion over the window |
| Time off needed | covered by own leave, by a holiday, by a ½ work-week day, by leave from another plan; partly covered (½ needed at the end, ½ own leave at the start) gives the problem; `except` removes it; never any cost |
| File to model | `planInput` of a hand-made file gives the expected `PlanInput` |
| Other plan | the extracted spans of a plan with own and mandatory leave, partial and whole; a span in the middle (the quarter-day case above: charged once, no false flag); the 0006 scenario across the shared month; property (fast-check): two plans importing each other, with random multiples of 1/32, charge every shared unit exactly once; the writer's shared denominator; the report on a different `id`, a lower `revision` and an outdated copy of the current plan |
| Examples | every example loads with an empty report; every rule set has `description`, `references` with all four fields and a year in its name, and every rule cites a reference; for every rule set, plans for 2027 and 2028 with a few leave days, whose costs, totals and stretches are compared with values worked out by hand and written into the test with the reasoning; the three plan files the same, including the maintainer's ½ + ½ example and the turn of the year 2027/28 |
| Command | the output formatter for an example plan (not the process) |

## Documentation updates in this branch

`docs/SPEC.md`:

- Format: the sketch above; `schema` `"restlos/1"`; the version policy; texts as language maps; the `references` fields and that a file must say what it is based on; the rule-set region; sources as entries; "Leave from another plan" stores charged days.
- Content of the files: contract without time zone and working hours, with name, description and references; calendar sources as entries instead of file content; the rule-set reference is ID, name and revision.
- Multiple calendar sources: the type "Time off needed" in both tables; import once with the preview as above (grouping, defaults, time zone only during the import, repeats); sources editable, creatable without a file, and exportable; "Update source" as above; the time zone is never stored.
- File operations: "Save as" and "Based on the current file" create a new `id`; the `.revN` file names; the revision warning (the browser remembers per `id` the highest revision, the local date of saving it and a fingerprint of its content; it warns about an older file and about a different file with the same revision); a list of all notes and manual changes, each to jump to or delete.
- Sharing and validation: what is refused and what is dropped or kept with a report; the limits table.
- First start: a rule set that leaves out the state or the local rules asks for them; offering bundled rule sets as templates shows their basis, version, date checked and the warning.
- Counting model: "Time off needed" never costs; uncovered needed time is reported.
- Finer granularity (row `.ics`) and .ics export: partial days as all-day events with share and part in the title and the `X-RESTLOS-…` fields; no working hours, no `TZID`/`VTIMEZONE`.
- Built-in help, View example: the contents of `beispiel-gmbh-2027.urlaub.json` (company closure as a day rule, "Projektphase" and the 2026 days as stored sources).
- Risks: "Old file versions in the download folder" countered by `revision`, the warning and the file name with the revision.
- Glossary: contract without time zone and working hours; "Time off needed" (DE: "Freizeit nötig" or the UI branch's wording).

New: `docs/file-format.md`, a reference for people who write plan files and rule sets by hand (fields, sources and entries, the refusal and report rules, limits), in the style of `docs/day-rules-format.md`; `docs/day-rules-format.md` gains `note`, `references` and language maps.

Issues:

- 0001 → `done` (dropped and reported).
- 0005 → `wontfix` (no working hours in the contract).
- 0006 → `done` for the `.urlaub.json` part; its `.ics` criterion moves to 0010.
- 0009 (created with this document): template images and the `.typ` export (the standard HTML must then deliver more than one file).
- 0010 (created with this document): the iCal branch, with everything under "Calendar sources: import and export later", plus event-count and file-size limits for the import.

## Decisions

**By the maintainer** (2026-10-18):

- Scope: plan files and rule sets, file-to-model, 0001, 0005, 0006, limits, examples with tests, the command; settings file, autosave and "Update rules from rule set" with the UI; reading and writing `.ics` in its own branch.
- 3–10 example files, a mix of the most used and the most interesting for testing, later offered as templates with a warning that there is no guarantee; versions and years of the agreements visible. The seven rule sets as proposed (including "12:00" written as ½ with a note, the Saturday rules of M+E Baden-Württemberg, carnival as practice with suggested values, and the four left out: M+E Bavaria, retail, chemicals, M+E Küste); Beispiel GmbH as first proposed; a separate test example for everything else.
- Rule sets carry a description and their basis; this is documented as required.
- Leave, overrides and notes in three plan lists; the UI must offer a list of all notes so they can be cleaned up.
- Language maps open to further languages.
- Version policy by program version as above.
- Loading: unknown fields dropped, entries dropped one by one, core refused, minUnit mismatches kept, 0001 dropped, codes with paths; partial leave without `part` kept with a suggested part; personal sources in a rule set dropped.
- No `savedAt` (privacy); `revision` plus `.revN` file names; a new `id` on "Save as".
- Limits as above, 10 MB per file, images in templates.
- "Leave from another plan" stores only the charged days, as spans (`from`, `to`) so finer steps need no migration later; both ends written with a shared denominator.
- Small items: `schema` `"restlos/1"`; canonical writing; the rule-set region; IDs and `origin`; examples under `examples/` with German names; `npm run plan` in English.
- No working hours in files; the time zone only during the iCal import; option B (user-defined conversion of partial days, browser time zone by default) noted for later.
- Calendar sources: imported once and stored as entries; the user chooses the meaning; the new type "Time off needed" (the source says what's needed, covering it is own leave); repeats as `match`; sources editable and exportable; the entry format and the counting-model addition in this branch.

**Designer's calls (check these):**

- A limit of 50,000 source days after expansion (refused when exceeded) and "well under a second" for reading and computing any file within the limits: without them, 50 sources × 2000 repeating entries would expand to about 120 million days.
- The problem for needed time checks the needed piece against all free time of the day, whatever made it free.
- `holiday` entries default to `required` `"0"`, `mandatory` and `needed` entries to `take` `"1"`.
- Beispiel GmbH 2027 covers the calendar year (2027-01 to 2027-12); Muster AG 2027 is the "Year + January" case.
- The spec's View example is replaced by the contents of `beispiel-gmbh-2027.urlaub.json` (closure as a day rule instead of a source).

## Left to the builder

- Module layout (for example `src/engine/file/`), function and type names, the report codes' names, as long as the situations above are distinguishable.
- How validation is written (by hand; no libraries); a parser for amounts above one day (the allowance), since `parseWeight` stops at 1.
- The key order of the canonical output, documented in `docs/file-format.md`.
- The `kind` of an other-plan span where own and mandatory leave overlap (display only); how the charged spans are added to `computePlan`'s day result.
- How `npm run plan` runs TypeScript without new packages.
- The leave days, notes and sources of the example plans beyond what is fixed above, and the hand-worked expected values (with their reasoning in the test).

## Appendix: basis of the example rule sets

Researched on 2026-10-18. Quotes are the agreements' wording; "copy" marks a link that is not the bargaining parties' own publication.

**Öffentlicher Dienst**

- TVöD § 6 Abs. 3 (Bund/VKA): "Soweit es die betrieblichen/dienstlichen Verhältnisse zulassen, wird die/der Beschäftigte am 24. Dezember und am 31. Dezember unter Fortzahlung des Entgelts nach § 21 von der Arbeit freigestellt." Satz 2: Freizeitausgleich innerhalb von drei Monaten, if not possible. Version: "in der Fassung des Änderungstarifvertrags Nr. 22 vom 6. April 2025" (VKA text, Stand 1 Jan 2026, stated to be identical to the federal text). Link (copy): https://www.knappschaft-kliniken.de/karriere/_doc/TVöD-BTK-VKA.pdf — prefer a VKA or BMI link if one can be opened.
- TV-L § 6 Abs. 3, same rule ("unter Fortzahlung des Tabellenentgelts und der sonstigen in Monatsbeträgen festgelegten Entgeltbestandteile"). Version: "in der Fassung des Änderungstarifvertrages Nr. 14 vom 14. Februar 2026". Link: https://www.tdl-online.de/fileadmin/downloads/TV-L/260812_TV-L__i.d.F._des_%C3%84TV_Nr._14_VT_neu.pdf
- TV-H § 6 Abs. 3, same rule. Only the base text of 1 Sep 2009 was found (copy: https://oeffentlicher-dienst.info/pdf/tv-h/tv-h.pdf); the reference says that later amendments were not checked.
- Federal civil servants, AZV § 6 Abs. 1: "Sonnabend, Heiligabend und Silvester sind grundsätzlich dienstfrei." Link: https://www.gesetze-im-internet.de/azv/__6.html (no version on the page).
- Bavarian civil servants, BayAzV § 5 Abs. 2: "Allgemein dienstfrei sind der 24. und 31. Dezember." Read only in a copy (https://gesetze.legal/bayern/bayazv/5); open gesetze-bayern.de before citing.
- Not regulated anywhere in this group: Rosenmontag, Fasching.

**Metall- und Elektroindustrie Baden-Württemberg**

- MTV of 12 Nov 2024 (in force 12 Nov 2024, replaces the MTV of 11 Nov 2021 as amended 22 Oct 2022), § 27: "An Werktagen, die unmittelbar vor dem ersten Weihnachtsfeiertag und vor Neujahr liegen, endet die Arbeitszeit spätestens um 12.00 Uhr. Das Monatsentgelt wird fortgezahlt." A voluntary works agreement may have up to 3.5 hours worked before or after (not modelled; note). Link (union copy): https://igmetall-gaggenau.de/wp-content/uploads/2025/01/ME-8-MTV-Beschaeftigte_2024.pdf

**Banken**

- Private and public banks, MTV Stand August 2024 (in force 1 Dec 2023 / 3 Jul 2024), § 3: "Am 24. Dezember ist dienstfrei (Bankfeiertag)." "Am 31. Dezember ist grundsätzlich dienstfrei." Staff needed for necessary work on 31 Dec get equal time off on another day (note). Link: https://iason.hamburg.de/iason/doc/66f51b4a5575ce25188e728e/27-01_A_2024-08-komprimiert.pdf
- Volksbanken und Raiffeisenbanken, MTV Teil A "in der Fassung vom 18. März 2025", § 3: the same, with an extra proviso on 24 Dec where competing banks stay open (note). Link: https://www.avr.org/Tarifvertraege/Download/Teil-A-Manteltarifvertrag-MTV_05-06-2025

**Versicherungen**

- MTV private Versicherungsgewerbe "in der seit 1. Mai 2026 geltenden Fassung", § 12: "Die Samstage vor Ostern und Pfingsten sind für Angestellte, die … kraft betrieblicher Vereinbarung am Samstag arbeiten, dienstfrei." "Der 24. und 31.12. sind arbeitsfrei." § 13 Ziff. 1: they are no working days for leave. Link: https://www.agv-vers.de/fileadmin/doc/tarifvertraege_downloads/tarifvertraege/MTV_20260501.pdf

**Bauhauptgewerbe**

- BRTV of 28 Sep 2018 as amended 5 Nov 2021 and 10 Nov 2022, in force 1 Jan 2023, § 3 Nr. 1.7: "Der 24. und der 31. Dezember sind arbeitsfrei; der Lohnanspruch entfällt." For salaried staff (RTV Angestellte) the time counts as worked (secondary; note only). Link (copy): https://www.sozialkasse-berlin.de/fileadmin/pdf/tarifvertraege/Baugewerbe/2_BRTV_Bundesrahmentarifvertrag_10_Nov_2022.pdf

**Karneval Rheinland**

- No right to time off: neither a statutory holiday nor customary law; only an agreement, a works agreement, the employment contract or company practice (betriebliche Übung) can grant it. IG Metall guide of 3 Feb 2016: https://www.igmetall.de/service/ratgeber/alaaf-und-helau--karneval-auch-am-arbeitsplatz ; IHK Köln: https://www.ihk.de/koeln/hauptnavigation/recht-steuern/rosenmontag-5204174 ; LAG Köln, 8 Aug 2003, 11 (12) Sa 239/03 (no claim from company practice when the contract requires written changes). No source gives typical times; the values are suggestions.

**Beispiel GmbH**

- Fictional; its description says so and names the legal background: 24 and 31 Dec are ordinary working days without an agreement (CMS, "Alle Jahre wieder", 3 Dec 2022: https://cms.law/de/deu/legal-updates/Alle-Jahre-wieder-Freistellung-von-der-Arbeitspflicht-an-Weihnachten-und-Silvester); a company closure needs the works council (§ 87 Abs. 1 Nr. 5 BetrVG, https://www.gesetze-im-internet.de/betrvg/__87.html).
