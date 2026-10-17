<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: project setup and holiday engine

As of: 2026-10-17. Branch: `holiday-engine`.

## Intent

This is the first implementation branch of restlos. `docs/SPEC.md` is authoritative for everything below; this document only cuts out the part that gets built now and records the decisions made for it.

The maintainer wants to review a branch where `npm ci` and `npm run check` pass and the holiday engine is verified against reference models. The engine is the base that the counting model, the file format and the UI will build on later, so correctness and a clean, country-neutral data model matter more than speed.

Relevant spec sections: "Holiday sources and work week" (rule types, work week per country, region tree, German special cases, reference models), "Date arithmetic", "Test strategy", "Dependencies and supply chain", "License compliance with REUSE". Procedure for holiday data: `.claude/skills/holiday-data/SKILL.md`.

## Goals

1. **Project setup, only what the engine needs** (decided by the maintainer):
   - `package.json` with exact versions, `package-lock.json`, installed with `npm ci`; `"engines"` requires Node 24 and npm ≥ 11.10 (`.npmrc` already has `engine-strict=true`).
   - Dev dependencies only, no runtime dependencies: `typescript`, `vitest`, `fast-check`, `eslint`, `@eslint/js`, `typescript-eslint`, `date-holidays`.
   - npm scripts: `test` (Vitest), `lint` (ESLint), `typecheck` (`tsc --noEmit`), `check` (lint + typecheck + test + `reuse lint`).
   - ESLint flat config with `@eslint/js` recommended and `typescript-eslint` recommended rules, plus `no-restricted-globals` forbidding `Date` in the engine folder.
   - `tsconfig.json` in strict mode.
2. **Holiday engine** as a pure TypeScript module: no DOM, no runtime dependencies, no `Date`, calendar days as integer day numbers.
3. **German holiday data** as a data file, correct from 2000 onwards for all 16 federal states, with local rules as explicit switches.
4. **Tests** that pass: table-driven rule-type tests, property tests for date arithmetic, comparison with date-holidays and with a checked-in python-holidays reference for all 16 states, 2000–2100.
5. **Documentation updates in the same branch:**
   - `docs/SPEC.md`, table "Dependencies": add rows for `typescript-eslint` (ESLint parser and rules for TypeScript; dev only) and `@eslint/js` (ESLint's recommended rule set; dev only, no dependencies). Approved by the maintainer on 2026-10-17.
   - `docs/SPEC.md`, table "Reference models for tests", python-holidays row: replace "Assumption Day for all of BY, BYP for Protestant municipalities, Augsburg not in BY" with the actual 0.97 behavior described under "Tests" below. Approved by the maintainer on 2026-10-17.
   - `AGENTS.md`, "Environment": replace "Commands (to be completed during setup)" with the scripts that exist after this branch.

## Non-goals (this branch)

- Svelte, Vite, vite-plugin-singlefile, Playwright, ical.js, intl-messageformat; no `build` script, no HTML page.
- GitHub workflows (CI). *Designer's call:* CI setup is not something the engine needs.
- The counting model beyond what the data needs: turning holidays into required work, the minimum of lowering layers, forced rules, manual overrides, cost, stretches.
- File formats (`.urlaub.json`, `.regeln.json`, `.einstellungen.json`), migration, autosave.
- Message catalogs: holiday names are translation keys only; the German and English texts are added when i18n is set up.
- iCal calendar sources.
- The version 1 feasibility tests from the spec (browser storage with `file://`, CSP and keyboard shortcuts, calendar re-import). *Designer's call:* they concern the browser app, not the engine, and come before the UI branch.
- ISO calendar weeks, week-start handling in the UI, bridge-day hints.

## Anti-goals

The branch fails even if tests pass when any of these is true:

- Special-case code for individual holidays instead of data plus generic rule types.
- `Date`, the local time zone or floats anywhere in the engine.
- A regional special case applied silently instead of through a switch.
- A rule without an official legal source and check date.
- The list of known differences to the reference models hides real bugs: every entry needs a reason, and which side is right, with a source.
- Packages beyond the seven listed above. That includes `@types/node`: typechecked code must not need Node APIs (e.g. country data files are imported through a static index, not by reading the folder); if that turns out impossible, stop and ask.

## Constraints

From `AGENTS.md` and the spec; not negotiable here:

- Dates: integer day numbers; ESLint enforces "no `Date` in the engine".
- Weights in data are strings. Readers accept fraction strings (`"1/2"`) and decimal strings (`"0.5"`); values not exactly representable in 1/480 day are rejected. Internally 1 day = 480 integer units.
- Code, identifiers, data keys and comments in English; domain terms from the spec glossary.
- Supply chain: exact versions, `npm ci`, `.npmrc` unchanged (`ignore-scripts=true`, `min-release-age=14`, `save-exact=true`); tools via npm scripts, never `npx`. `min-release-age` means npm picks the newest version that is at least 14 days old; that is intended.
- REUSE: SPDX header in every new file that allows comments; JSON files are covered by `REUSE.toml` (`package.json`, `tsconfig*.json` and `src/data/**` already are). `reuse lint` must pass. Licenses: code, data, configuration EUPL-1.2; Markdown CC-BY-4.0; lockfile CC0-1.0.
- Git: commits on `holiday-engine`, unsigned (`git -c commit.gpgsign=false commit …` if needed), never push. Commit messages end with the co-author line from the session.
- Work inside the Nix dev shell; `python3` with `holidays` 0.97 comes from there.
- TDD: engine functions get tests before or with the implementation (`AGENTS.md`: "Engine functions get tests before UI builds on them").

## What gets built

### Date arithmetic

- Conversion between ISO dates (`YYYY-MM-DD`), year/month/day and integer day numbers in the proleptic Gregorian calendar; weekday of a day number; leap years; days in month.
- Western Easter (Gregorian computus) and Orthodox Easter (Julian computus, expressed as a Gregorian date).
- Invalid input (e.g. `2027-02-30`, malformed strings, years outside the supported range) is rejected with an error, never silently shifted.

### Weights

- A parser from weight strings (`"1"`, `"0"`, `"1/2"`, `"0.5"`, later e.g. `"3/32"`) to integer units of 1/480 day, rejecting negative values, values above 1 and values not exact in 1/480. Needed because the country data contains the standard work week as weights. No formatting function yet.

### Rule types

All eight rule types from the spec table. *Designer's call:* the three that Germany doesn't need (n-th weekday in month, Orthodox Easter ± n, substitute day on weekend) are built now too, because the core is meant to be country-neutral and the spec calls them cheap. They are tested with synthetic data; no German rule uses them.

| Rule type | German example |
| --- | --- |
| Fixed date | 3 Oct |
| Easter ± n (Western) | Whit Monday = Easter + 50 |
| Weekday before/after a date | Day of Repentance and Prayer = Wednesday before 23 Nov |
| Valid from/until year | International Women's Day in Berlin from 2019 |
| One-off date | Reformation Day 2017 nationwide |
| n-th weekday in month | none |
| Easter ± n (Orthodox) | none |
| Substitute day on weekend | none; refers to the country's weekend, not fixed Sat/Sun |

- "Valid from/until year" is a validity range that can apply to any rule, not a separate date computation.
- A fixed date `02-29` is only accepted together with an explicit non-leap-year behavior: dropped, 28 Feb or 1 Mar.
- If the data needs a rule type not in this list, stop and ask (holiday-data skill).

### Country data and region tree

- One JSON file per country under `src/data/`, starting with Germany. Further countries later as data files without code changes.
- Contents: standard work week (required work per weekday as weight strings; DE Mon–Fri `"1"`, Sat/Sun `"0"`), week start (DE Monday), weekend days for substitute-day rules, the region tree country → federal state, and the rules.
- Every rule has a stable ID, a name translation key, the official source URL and the date the source was checked.
- Only statutory public holidays. 24 and 31 Dec are not holidays; they become day rules in a later branch.
- **Local rules** are switches per federal state, phrased in the spec as "applies at my place of work". Each has an ID, a name key, an explanation key and an official source URL:
  - BY: Augsburg Peace Festival, 8 Aug, City of Augsburg only (`augsburg` in the spec's file sketch).
  - BY: Assumption Day, 15 Aug, only in predominantly Catholic municipalities (`assumption` in the spec's file sketch). In Saarland it is a regular statewide holiday, not a switch.
  - SN and TH: Corpus Christi, only in certain municipalities.
- The engine takes a region selection shaped like the spec's file sketch: `{ country: "DE", state: "BY", options: { assumption: true, augsburg: false } }`. Switches not set count as off; switch IDs not defined for that state are an error.

### Engine output

- For a region selection and a range of day numbers (or years): all holidays in that range, each with day number, rule ID and name key, sorted by day.
- Several holidays on the same day are all returned (e.g. Ascension Day and 1 May in 2008).
- The output is about holidays only; required work comes later.

### Data validation

- A validator checks a country data file: structure, known rule types, valid dates and weights, unique IDs, source URL and check date on every rule, switch definitions. Tests run it against every data file in `src/data/`.

## Tests

| Level | What |
| --- | --- |
| Date arithmetic | Known dates, leap years (2000 yes, 2100 no, 1900 no), Easter tables (Western and Orthodox, including the earliest and latest dates in the range), fast-check round trips ISO ↔ day number ↔ year/month/day and weekday consistency over the supported range |
| Weights | Fractions and decimals accepted, non-exact values (e.g. `"1/7"`, `"0.3"`) and out-of-range values rejected |
| Rule types | Table-driven, one table per type; synthetic data for n-th weekday, Orthodox Easter and substitute day (including a Fri/Sat weekend); 29 Feb behaviors; validity ranges at the boundary years |
| German data | Known dates for at least three years per rule, including the year before and after each rule change (e.g. BE 2018/2019, MV 2022/2023, Reformation Day 2016/2017/2018) |
| date-holidays | Runs directly in Vitest: all 16 states, 2000–2100, statutory holidays only; switch combinations mapped to date-holidays' closest regions |
| python-holidays | A script under `scripts/` generates a JSON reference with the dev shell's `holidays` 0.97 (version recorded in the file); the file is checked in and compared in Vitest, 16 states, 2000–2100. The mapping follows how 0.97 actually behaves (checked 2026-10-17), see below. |
| Known differences | One documented list: per entry, state, date or year range, holiday, which side is right, reason, source. Any undocumented mismatch fails the test. |
| Lint rule | A test or fixture showing that `Date` in the engine folder fails `npm run lint` |

**python-holidays 0.97, how it models the German switches** (verified in the dev shell on 2026-10-17):

- Categories `public`, `catholic`, `school`; only `public` is on by default.
- Assumption Day in BY and Corpus Christi in SN and TH are in the opt-in `catholic` category.
- `Augsburg` is its own subdivision; its `public` set contains both 8 Aug and 15 Aug.
- `BYP` is still accepted and equals BY's `public` set.

Mapping of our switches to the reference:

| Our selection | Reference |
| --- | --- |
| any state, all switches off | subdivision, `public` |
| BY `assumption`; SN or TH Corpus Christi switch | subdivision, `public` + `catholic` |
| BY `augsburg` + `assumption` | subdivision `Augsburg`, `public` |
| BY `augsburg` without `assumption` | derived: `Augsburg` minus 15 Aug |

The two Bavarian switches stay independent in our data.

## Decisions

**By the maintainer:**

- Scope: project setup and holiday engine with passing tests; setup only what the engine needs.
- The engine description above (rule types, data file, local rules as switches, output, tests) was played back and accepted.
- `typescript-eslint` and `@eslint/js` may be added; both get rows in the spec's dependency table.
- The spec's python-holidays row is corrected to the actual 0.97 behavior in this branch.

**Designer's calls (check these):**

- All eight rule types now, including the three not needed for Germany.
- Country data as JSON under `src/data/`, validated by tests.
- Required work, cost and the counting model beyond weight parsing stay out of this branch; so do message catalogs.
- No CI workflows; v1 feasibility tests deferred to before the UI.
- TypeScript pinned to 6.0.x: the newest TypeScript is 7.0.2, but `typescript-eslint` 8.x requires `typescript` < 6.1.0.
- Generated python-holidays reference file licensed as project data (EUPL-1.2) via `REUSE.toml`.

## Left to the builder

- Day-number epoch and the supported year range (at least 2000–2100; reject outside with a clear error).
- File and module layout inside `src/engine/` and `tests/`, function names, exact JSON schema of the country data.
- Exact semantics of "weekday before/after" (strictly before vs. on-or-before) and of substitute days (which weekend days move where, collision with another holiday), chosen to fit real-world rules and documented in the data format description.
- Translation key naming scheme, as long as keys are stable.
- ESLint strictness beyond the recommended sets (e.g. type-checked rules).
- How the python-holidays script is invoked (an npm script is fine; it must not run in `npm run check`, since the reference is regenerated only on rule changes).
