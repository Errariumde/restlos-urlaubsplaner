<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Counting Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure TypeScript counting model that turns a contract, calendar-source days and a plan into required work, cost, totals and stretches per day, with German holiday data underneath.

**Architecture:** New modules under `src/engine/counting/`, one responsibility each: input types (mirroring the spec's file sketch), day-rule matching, rule warnings, required work per day, leave and cost of one day (interval arithmetic on the day's work block), stretches over a day sequence, the plan computation that wires them together, and the part suggestion for the UI. Everything works in integer units (1 day = 480) and integer day numbers; results are plain data with codes, never sentences.

**Tech Stack:** TypeScript 6.0.3, Vitest, fast-check, ESLint with typescript-eslint; the existing holiday engine (`src/engine/holidays/`) and German data (`src/data/holidays/`).

**Spec:** `docs/superpowers/specs/2026-10-18-counting-model-design.md` (design for this branch; its tables of examples are the expected values below). `docs/SPEC.md` is the authoritative project specification. Executors read both, plus `AGENTS.md` and `docs/holiday-data-format.md` (date rules).

## Global Constraints

- Branch `counting-model`; commit with `git -c commit.gpgsign=false commit`; never push, tag or sign. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new packages ("Only packages listed in the spec. Ask before adding any package." — `AGENTS.md`). This branch needs none. Run tools via npm scripts, never `npx`.
- "1 day = 480 integer units. No floats for day fractions, no assumption 'only 0, ½, 1'." (`AGENTS.md`)
- "the engine uses integer day numbers, never JavaScript `Date`" (`AGENTS.md`); `Date` may appear in tests only.
- Dates in tests, docs and data are ISO `YYYY-MM-DD`; days without a year are `month` and `day`; no text syntax such as `"12-31"`.
- Code, identifiers and comments in English; domain terms from the glossary in `docs/SPEC.md` (required work, taken, allowance, plan, contract, work week, day rule, calendar source, mandatory leave, paid closure, leave from another plan, stretch).
- The engine returns problems and warnings as codes plus data, never as sentences ("no string concatenation of sentences" — `AGENTS.md`).
- Invalid typed input (out-of-range units, duplicate days, a malformed range) throws `RangeError`, as `holidaysBetween` already does; untrusted JSON is validated by the later file-format branch before it reaches the engine.
- REUSE: every new TypeScript file starts with `// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors` and `// SPDX-License-Identifier: EUPL-1.2`; every new Markdown file with the same lines in an HTML comment and `CC-BY-4.0`.
- Work inside the Nix dev shell. After edits, check the TypeScript language server diagnostics and fix reported errors.
- A task is done when `npm run check` passes.

## Review Focus

1. **A plan period that starts inside a stretch** (a company closure from 27 December 2027 to 4 January 2028, plan 2028): the stretch reaches back before the period, and only the cost inside the period counts. Test in Task 7.
2. **Partial leave on the first day of the period** whose free neighbour lies before the period (Monday 1 February 2027, plan February to December): the suggestion must see Sunday 31 January. Test in Task 8.
3. **A plan period at the limits of the supported years** (9999-01 to 9999-12, 1583-01 to 1583-12): the stretch margin is clamped, nothing throws. Test in Task 7.
4. **Recomputing on every click**: a 13-month plan with 40 rules and 300 source days must compute fast enough for the browser. Test in Task 7 (under 200 ms in Node).
5. **A company closure added later on a day already planned as own leave**: the day is charged once (1, not 2), attributed to mandatory leave. Test in Task 5.

---

### Task 1: Weight writer

**Files:**
- Modify: `src/engine/weight.ts`
- Test: `tests/engine/weight.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `UNITS_PER_DAY`, `Units`, `parseWeight` (existing).
- Produces: `formatWeight(units: Units): string` — the reduced fraction string files contain (`"0"`, `"1"`, `"1/2"`, `"3/32"`); throws `RangeError` unless `units` is an integer from 0 to 480.

- [ ] **Step 1: Write the failing tests**

```ts
describe("formatWeight", () => {
  it.each([[0, "0"], [480, "1"], [240, "1/2"], [45, "3/32"], [15, "1/32"], [1, "1/480"], [144, "3/10"], [160, "1/3"]])(
    "writes %i units as %j", (units, text) => expect(formatWeight(units)).toBe(text));
  it("round-trips every multiple of 1/480 day", () => {
    for (let units = 0; units <= 480; units++) expect(parseWeight(formatWeight(units))).toBe(units);
  });
  it.each([-1, 481, 1.5, Number.NaN])("rejects %j", (units) => expect(() => formatWeight(units)).toThrow(RangeError));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/weight.test.ts`
Expected: FAIL, `formatWeight` is not exported.

- [ ] **Step 3: Implement `formatWeight` in `src/engine/weight.ts`**

Reduce `units/480` by the greatest common divisor; write only the numerator when the denominator is 1.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/weight.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/weight.ts tests/engine/weight.test.ts
git -c commit.gpgsign=false commit -m "Add a writer for weight strings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Input types and day-rule matching

**Files:**
- Create: `src/engine/counting/types.ts`, `src/engine/counting/match.ts`, `tests/engine/counting/helpers.ts`
- Test: `tests/engine/counting/match.test.ts`

**Interfaces:**
- Consumes: `ruleDate(rule: DateRule, year: number): DayNumber | null` (`src/engine/holidays/rules.ts`), `DateRule`, `RegionSelection`, `CountryData` (`src/engine/holidays/types.ts`), `DayNumber`, `Weekday`, `weekdayOf`, `ymdFromDay`, `dayFromYmd`, `MIN_YEAR`, `MAX_YEAR` (`src/engine/days.ts`), `Units`.
- Produces (`src/engine/counting/types.ts`), exactly these names and fields; later tasks rely on them:

```ts
/** Where in the day a partial piece lies: at the start or at the end of the working time. */
export type Part = "start" | "end";

export interface RangeMatch {
  readonly type: "range";
  readonly from: DateRule;
  readonly to?: DateRule; // exactly one of `to` and `days`
  readonly days?: number; // whole number, 1 … MAX_RANGE_DAYS
  readonly weekdays?: readonly Weekday[]; // non-empty when present
}
export type DayMatch = DateRule | RangeMatch;

interface DayRuleBase {
  readonly id: string;
  readonly match: DayMatch;
  readonly validFrom?: number; // years, inclusive; for a range, the year in which it starts
  readonly validUntil?: number;
  /** Where the free time lies when the effect's value is below a full day; default "end". */
  readonly part?: Part;
}
export type DayRule = DayRuleBase &
  ({ readonly requiredAtMost: Units } | { readonly requiredExactly: Units } | { readonly mandatory: Units });

export interface WorkWeekEntry {
  readonly from: DayNumber; // valid until the next entry's `from`; the first entry also applies before it
  readonly required: Readonly<Record<Weekday, Units>>;
}

export interface Contract {
  readonly region: RegionSelection;
  readonly week: readonly WorkWeekEntry[]; // non-empty, strictly increasing `from`
  readonly rules: readonly DayRule[];
}

/** One day of a calendar source, already resolved from its iCal or plan file. */
export type SourceDay =
  | { readonly type: "holiday"; readonly day: DayNumber; readonly sourceId: string; readonly required: Units; readonly part?: Part }
  | { readonly type: "paidClosure" | "info"; readonly day: DayNumber; readonly sourceId: string }
  | { readonly type: "mandatory" | "otherPlan"; readonly day: DayNumber; readonly sourceId: string; readonly take: Units; readonly part?: Part };

export interface LeaveDay {
  readonly day: DayNumber;
  readonly take: Units; // 1 … 480
  readonly part?: Part; // required when take < 480
}

export interface RequiredOverride {
  readonly day: DayNumber;
  readonly required: Units;
  readonly part?: Part; // where the free time lies; default "end"
}

export interface YearMonth { readonly year: number; readonly month: number }
export interface PlanPeriod { readonly from: YearMonth; readonly to: YearMonth } // both months inclusive

export interface PlanInput {
  readonly country: CountryData; // holiday data for contract.region.country
  readonly contract: Contract;
  readonly sources: readonly SourceDay[];
  readonly period: PlanPeriod;
  readonly allowance: Units; // ≥ 0, may exceed one day
  readonly leave: readonly LeaveDay[]; // at most one entry per day
  readonly overrides: readonly RequiredOverride[]; // at most one entry per day
}
```

- Produces (`src/engine/counting/match.ts`):
  - `const MAX_RANGE_DAYS = 366`
  - `ruleDays(rule: Pick<DayRule, "match" | "validFrom" | "validUntil">, from: DayNumber, to: DayNumber): DayNumber[]` — the days the rule matches between `from` and `to` (inclusive), sorted, each once.
    - A date rule: `ruleDate(match, year)` for every year whose occurrence can fall in the window.
    - A range: for each start year Y with `validFrom ≤ Y ≤ validUntil` and `s = ruleDate(from, Y) !== null`: with `days`, the days `s … s + days − 1`; with `to`, up to the first of `ruleDate(to, Y)`, `ruleDate(to, Y + 1)` that is ≥ `s` (no occurrence if neither is); then keep only `weekdays` if given.
    - Start years from `year(from) − 2` to `year(to)`, clamped to `MIN_YEAR … MAX_YEAR`; `ruleDate(to, Y + 1)` is not evaluated when `Y + 1 > MAX_YEAR`.
    - Throws `RangeError` when a range has both or neither of `to` and `days`, `days` is not an integer from 1 to `MAX_RANGE_DAYS`, or `weekdays` is empty.
- Produces (`tests/engine/counting/helpers.ts`), shared by Tasks 2–8:
  - `d = dayFromIso`, `isoDays(days: readonly DayNumber[]): string[]`, `span(fromIso: string, toIso: string): string[]` (every ISO date from–to)
  - `FULL = 480`, `HALF = 240`, `FULL_TIME: Readonly<Record<Weekday, Units>>` (Mon–Fri 480, Sat/Sun 0)
  - `fixed(month, day)`, `once(isoDate)`, `easter(offset)` returning `DateRule`
  - `BAVARIA: Contract` = `{ region: { country: "DE", state: "BY" }, week: [{ from: d("2020-01-01"), required: FULL_TIME }], rules: [] }`
  - `CHRISTMAS_EVE_RULES: readonly DayRule[]` = `christmas-eve` (`fixed(12, 24)`) and `new-years-eve` (`fixed(12, 31)`), both `requiredAtMost: HALF`
  - `baseInput(changes: Partial<PlanInput> = {}): PlanInput` — `countries.DE`, `BAVARIA`, period 2027-01 to 2027-12, allowance `30 * FULL`, no sources, leave or overrides; `changes` replace whole fields.

- [ ] **Step 1: Write the failing tests**

```ts
const days = (match: DayMatch, from: string, to: string, validity: { validFrom?: number; validUntil?: number } = {}) =>
  isoDays(ruleDays({ match, ...validity }, d(from), d(to)));
const newYear: RangeMatch = { type: "range", from: fixed(12, 27), to: fixed(1, 2) };

describe("ruleDays", () => {
  it("evaluates single-day date rules per year", () =>
    expect(days(fixed(12, 31), "2027-01-01", "2028-12-31")).toEqual(["2027-12-31", "2028-12-31"]));
  it("applies validity years to single-day rules", () =>
    expect(days(fixed(3, 8), "2018-01-01", "2020-12-31", { validFrom: 2019 })).toEqual(["2019-03-08", "2020-03-08"]));
  it("crosses New Year with `to`, including an occurrence that started the year before", () => {
    expect(days(newYear, "2027-12-01", "2028-01-31")).toEqual(span("2027-12-27", "2028-01-02"));
    expect(days(newYear, "2026-12-30", "2027-01-03")).toEqual(span("2026-12-30", "2027-01-02"));
  });
  it("combines a `once` start with an Easter end", () =>
    expect(days({ type: "range", from: once("2028-03-20"), to: easter(1) }, "2027-01-01", "2029-12-31"))
      .toEqual(span("2028-03-20", "2028-04-17")));
  it("uses a `once` end only in its own year", () =>
    expect(days({ type: "range", from: fixed(12, 27), to: once("2028-01-04") }, "2026-01-01", "2029-12-31"))
      .toEqual(span("2027-12-27", "2028-01-04")));
  it("skips years in which `to` gives no day on or after the start", () =>
    expect(days({ type: "range", from: fixed(3, 1), to: once("2020-01-01") }, "2027-01-01", "2027-12-31")).toEqual([]));
  it("counts `days` from the start", () =>
    expect(days({ type: "range", from: easter(-52), days: 6 }, "2027-01-01", "2027-12-31")).toEqual(span("2027-02-04", "2027-02-09")));
  it("keeps only the listed weekdays", () =>
    expect(days({ type: "range", from: fixed(12, 1), to: fixed(12, 31), weekdays: ["sat"] }, "2027-01-01", "2027-12-31"))
      .toEqual(["2027-12-04", "2027-12-11", "2027-12-18", "2027-12-25"]));
  it("applies validity to the year in which a range starts", () =>
    expect(days(newYear, "2027-12-01", "2029-01-31", { validUntil: 2027 })).toEqual(span("2027-12-27", "2028-01-02")));
  it("keeps the length with `days` and the end date with `to` in leap years", () => {
    const length: RangeMatch = { type: "range", from: fixed(2, 27), days: 4 };
    expect(days(length, "2027-01-01", "2027-12-31")).toEqual(span("2027-02-27", "2027-03-02"));
    expect(days(length, "2028-01-01", "2028-12-31")).toEqual(span("2028-02-27", "2028-03-01"));
    expect(days({ type: "range", from: fixed(2, 27), to: fixed(3, 2) }, "2028-01-01", "2028-12-31")).toEqual(span("2028-02-27", "2028-03-02"));
  });
  it("counts a day matched by two occurrences once", () =>
    expect(days({ type: "range", from: fixed(1, 1), days: 366 }, "2027-12-31", "2028-01-02")).toEqual(["2027-12-31", "2028-01-01", "2028-01-02"]));
  it("stays within the supported years without throwing", () => {
    expect(days({ type: "range", from: fixed(12, 27), days: 7 }, "9999-12-01", "9999-12-31")).toEqual(span("9999-12-27", "9999-12-31"));
    expect(days(newYear, "9999-12-01", "9999-12-31")).toEqual([]); // its end would lie in 10000
    expect(days(newYear, "1583-01-01", "1583-01-05")).toEqual([]);
  });
  it.each([
    [{ type: "range", from: fixed(1, 1), days: 0 }], [{ type: "range", from: fixed(1, 1), days: 367 }],
    [{ type: "range", from: fixed(1, 1), days: 1.5 }], [{ type: "range", from: fixed(1, 1), to: fixed(1, 2), days: 2 }],
    [{ type: "range", from: fixed(1, 1) }], [{ type: "range", from: fixed(1, 1), days: 2, weekdays: [] }],
  ] as [RangeMatch][])("rejects %j", (match) => expect(() => ruleDays({ match }, d("2027-01-01"), d("2027-12-31"))).toThrow(RangeError));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/match.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/match`.

- [ ] **Step 3: Write `types.ts` and `helpers.ts` as specified, and implement `ruleDays` in `src/engine/counting/match.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/match.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting tests/engine/counting
git -c commit.gpgsign=false commit -m "Add day-rule types and matching with ranges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Day-rule warnings and the day-rule reference

**Files:**
- Create: `src/engine/counting/warnings.ts`, `docs/day-rules-format.md`
- Test: `tests/engine/counting/warnings.test.ts`

**Interfaces:**
- Consumes: Task 2 (`DayRule`, `ruleDays`, `MAX_RANGE_DAYS`), `ruleDate`.
- Produces (`src/engine/counting/warnings.ts`):
  - `type RuleWarningCode = "leapYearLength" | "mixedRangeEnds" | "neverApplies"`
  - `interface RuleWarning { readonly code: RuleWarningCode; readonly ruleId: string }`
  - `dayRuleWarnings(rule: DayRule): RuleWarning[]` — in the order of the codes above:
    - `leapYearLength`: a range with `days` whose `from` is `fixed`, when the month and day of its last day differ between the start years 2000, 2001, 2002 and 2003 (years in which `from` gives no day are skipped). Four consecutive years cover every leap-year position of a range of at most 366 days.
    - `mixedRangeEnds`: a range with `to` where exactly one of `from` and `to` has type `fixed` or `once`.
    - `neverApplies`: `ruleDays` finds no day in the candidate years. If the match contains a `once` date (as the rule itself, `from` or `to`), the candidate years are that year −1 to +1 for each such date; otherwise 400 consecutive years from `max(MIN_YEAR, validFrom ?? 2000)`, ending no later than `validUntil` and `MAX_YEAR` (no candidate years at all also means `neverApplies`).

- [ ] **Step 1: Write the failing tests**

```ts
const r = (match: DayMatch, extra: { validFrom?: number; validUntil?: number } = {}): DayRule =>
  ({ id: "r", match, requiredAtMost: 0, ...extra });
const codes = (rule: DayRule) => dayRuleWarnings(rule).map((w) => w.code);

describe("dayRuleWarnings", () => {
  it.each([
    [{ type: "range", from: fixed(2, 27), days: 4 }, ["leapYearLength"]],
    [{ type: "range", from: fixed(12, 1), days: 100 }, ["leapYearLength"]],
    [{ type: "range", from: fixed(12, 27), days: 6 }, []],
    [{ type: "range", from: once("2027-02-27"), days: 4 }, []],
    [{ type: "range", from: easter(-52), days: 6 }, []],
    [{ type: "range", from: fixed(2, 27), to: fixed(3, 2) }, []],
  ] as [RangeMatch, string[]][])("leap-year length of %j", (match, expected) => expect(codes(r(match))).toEqual(expected));
  it.each([
    [{ type: "range", from: easter(-52), to: fixed(3, 1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: fixed(4, 20), to: easter(1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: once("2028-03-20"), to: easter(1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: fixed(12, 27), to: fixed(1, 2) }, []],
    [{ type: "range", from: easter(-52), to: easter(-47) }, []],
    [{ type: "range", from: { type: "nthWeekday", month: 11, weekday: "sun", n: 4 }, to: { type: "weekdayRelative", weekday: "sun", relation: "before", month: 12, day: 25 } }, []],
  ] as [RangeMatch, string[]][])("mixed ends of %j", (match, expected) => expect(codes(r(match))).toEqual(expected));
  it("finds rules that never produce a day", () => {
    expect(codes(r(once("2027-03-13"), { validFrom: 2028 }))).toEqual(["neverApplies"]);
    expect(codes(r({ type: "range", from: easter(0), days: 1, weekdays: ["mon"] }))).toEqual(["neverApplies"]);
    expect(codes(r(fixed(12, 31), { validFrom: 2030, validUntil: 2029 }))).toEqual(["neverApplies"]);
    expect(codes(r(once("2027-03-13")))).toEqual([]);
    expect(codes(r(fixed(12, 31)))).toEqual([]);
  });
  it("reports the rule ID", () => expect(dayRuleWarnings({ id: "x", match: once("1999-01-01"), validFrom: 2000, mandatory: 480 }))
    .toEqual([{ code: "neverApplies", ruleId: "x" }]));
});
```


- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/warnings.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/warnings`.

- [ ] **Step 3: Implement `dayRuleWarnings` in `src/engine/counting/warnings.ts`**

- [ ] **Step 4: Write `docs/day-rules-format.md`**

A reference for people who write day rules by hand, in the style of `docs/holiday-data-format.md`, with these sections:
- **Top level:** `id`, `match`, `validFrom`/`validUntil` (inclusive years; for a range the start year), exactly one effect, optional `part`; `label` (`{ "de": …, "en": … }`) and `origin` as in the spec's plan file sketch.
- **Match:** the six date rules link to `holiday-data-format.md#date-rules`; `range` with `from`, `to` or `days` (1–366), `weekdays`, and the year rule ("`to` is the first day on or after the start, in the start year or the next").
- **Effects:** `requiredAtMost`, `requiredExactly`, `mandatory`, each a weight string (`"1"`, `"1/2"`; decimals such as `"0.5"` are accepted when reading).
- **Part:** `"start"` or `"end"`, where the free time lies when the value is below a full day; default `"end"`.
- **Warnings:** the three codes above, each with an example and what to do (`to` instead of `days`; check the dates in the preview).
- **Examples:** 24 and 31 December at most ½; working Saturday `2027-03-13` exactly 1; company closure from 27 December for 4 days as mandatory leave; the company closes at noon on 24 December (mandatory `"1/2"`); the four range examples from the design.
- **Weekly patterns** belong in the work week; why a forced rule "every Sunday" would beat Easter Sunday.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tests/engine/counting/warnings.test.ts` → PASS; `npm run check` → PASS (includes `reuse lint` for the new Markdown file).

- [ ] **Step 6: Commit**

```bash
git add src/engine/counting/warnings.ts tests/engine/counting/warnings.test.ts docs/day-rules-format.md
git -c commit.gpgsign=false commit -m "Add day-rule warnings and a reference for writing day rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Day facts and required work

**Files:**
- Create: `src/engine/counting/required.ts`
- Test: `tests/engine/counting/required.test.ts`

**Interfaces:**
- Consumes: Task 2 (types, `ruleDays`), `holidaysBetween` and `Holiday` (`src/engine/holidays`), `weekdayOf`.
- Produces (`src/engine/counting/required.ts`):

```ts
export type RequiredLayer =
  | { readonly kind: "workWeek"; readonly value: Units; readonly entryFrom: DayNumber }
  | { readonly kind: "publicHoliday"; readonly value: 0; readonly ruleId: string; readonly nameKey: string }
  | { readonly kind: "holidaySource"; readonly value: Units; readonly sourceId: string; readonly part?: Part }
  | { readonly kind: "paidClosure"; readonly value: 0; readonly sourceId: string }
  | { readonly kind: "ruleAtMost"; readonly value: Units; readonly ruleId: string; readonly part?: Part }
  | { readonly kind: "ruleExactly"; readonly value: Units; readonly ruleId: string; readonly part?: Part }
  | { readonly kind: "override"; readonly value: Units; readonly part?: Part };

export interface RequiredWork {
  readonly value: Units;
  readonly freePart: Part; // where the free time lies when value < 480
  readonly decidedBy: RequiredLayer;
  readonly layers: readonly RequiredLayer[];
  readonly conflictingRules: readonly string[]; // IDs of requiredExactly rules with different values on this day, else []
}

export interface DayFacts {
  readonly day: DayNumber;
  readonly base: { readonly entryFrom: DayNumber; readonly value: Units };
  readonly holidays: readonly Holiday[];
  readonly sources: readonly SourceDay[]; // every source of the day, Info included, in input order
  readonly rules: readonly DayRule[]; // matching rules, in contract order
  readonly override?: RequiredOverride;
}

export function dayFacts(input: Pick<PlanInput, "country" | "contract" | "sources" | "overrides">, from: DayNumber, to: DayNumber): DayFacts[];
export function requiredWork(facts: DayFacts): RequiredWork;
```

- `dayFacts` returns one entry per day from `from` to `to`, consecutive. Base: the work-week entry with the latest `from` ≤ day, or the first entry for days before it. Throws `RangeError` for an empty work week, `from` dates not strictly increasing, a unit value outside 0–480 in the week, sources or rules, or two overrides on one day.
- `requiredWork`:
  - `layers` in this order: the work week; one `publicHoliday` per holiday; `holidaySource` (value `required`) and `paidClosure` per source in input order (Info, mandatory and other-plan sources add no layer); `ruleAtMost` per rule in contract order; `ruleExactly` per rule in contract order; the override.
  - Value: the minimum of the work week and all lowering layers; if any `ruleExactly` applies, the lowest of their values instead; if an override exists, its value.
  - `decidedBy`: among the layers of the stage that set the final value (base and lowering, forced, or override) with exactly that value, the first one with an explicit `part`, otherwise the first one. `freePart` = `decidedBy.part ?? "end"`.
  - `conflictingRules`: the IDs of all `ruleExactly` layers when their values are not all equal.

- [ ] **Step 1: Write the failing tests**

```ts
const req = (iso: string, changes: Partial<PlanInput> = {}) => {
  const facts = dayFacts(baseInput(changes), d(iso), d(iso))[0];
  if (!facts) throw new Error("no facts");
  return requiredWork(facts);
};
const rules = (...list: DayRule[]) => ({ contract: { ...BAVARIA, rules: list } });

describe("requiredWork", () => {
  it("takes the work week as the base value", () => {
    const w = req("2027-05-05");
    expect([w.value, w.decidedBy.kind, w.freePart]).toEqual([480, "workWeek", "end"]);
  });
  it("lowers a public holiday to 0", () => expect(req("2027-05-06").decidedBy).toMatchObject({ kind: "publicHoliday", ruleId: "ascension-day" }));
  it("takes the minimum of the lowering layers", () => {
    const w = req("2027-05-05", {
      sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "company", required: HALF }],
      ...rules({ id: "quarter", match: once("2027-05-05"), requiredAtMost: 120 }),
    });
    expect([w.value, w.decidedBy.kind, w.layers.map((l) => l.kind)]).toEqual([120, "ruleAtMost", ["workWeek", "holidaySource", "ruleAtMost"]]);
  });
  it("keeps a public holiday at 0 under a ½ holiday source", () =>
    expect(req("2027-05-06", { sources: [{ type: "holiday", day: d("2027-05-06"), sourceId: "company", required: HALF }] }).value).toBe(0));
  it("keeps 24 and 31 December on a weekend at 0", () => {
    expect(req("2022-12-24", rules(...CHRISTMAS_EVE_RULES)).value).toBe(0);
    expect(req("2022-12-31", rules(...CHRISTMAS_EVE_RULES)).value).toBe(0);
  });
  it("lets a forced rule beat a public holiday", () =>
    expect(req("2027-05-06", rules({ id: "work", match: easter(39), requiredExactly: FULL })).value).toBe(480));
  it("takes the lower of conflicting forced rules and reports them", () => {
    const w = req("2027-03-13", rules({ id: "a", match: once("2027-03-13"), requiredExactly: HALF }, { id: "b", match: once("2027-03-13"), requiredExactly: FULL }));
    expect([w.value, w.conflictingRules]).toEqual([240, ["a", "b"]]);
  });
  it("applies a manual override last", () => {
    const w = req("2027-03-13", { ...rules({ id: "a", match: once("2027-03-13"), requiredExactly: FULL }), overrides: [{ day: d("2027-03-13"), required: 120 }] });
    expect([w.value, w.decidedBy.kind]).toEqual([120, "override"]);
  });
  it("sets a paid closure to 0", () =>
    expect(req("2027-05-05", { sources: [{ type: "paidClosure", day: d("2027-05-05"), sourceId: "closure" }] }).decidedBy.kind).toBe("paidClosure"));
  it("follows a work week with a change", () => {
    const week = [{ from: d("2020-01-01"), required: FULL_TIME }, { from: d("2027-07-01"), required: { ...FULL_TIME, fri: 0 } }];
    const contract = { contract: { ...BAVARIA, week } };
    expect([req("2027-06-25", contract).value, req("2027-07-02", contract).value]).toEqual([480, 0]);
  });
  it("applies the first work-week entry before its start", () => {
    const facts = dayFacts(baseInput({ contract: { ...BAVARIA, week: [{ from: d("2027-04-01"), required: FULL_TIME }] } }), d("2027-01-04"), d("2027-01-04"))[0];
    expect(facts?.base).toEqual({ entryFrom: d("2027-04-01"), value: 480 });
  });
  it("supports an all-zero entry for part-year work", () => {
    const week = [{ from: d("2020-01-01"), required: FULL_TIME }, { from: d("2027-10-01"), required: { ...FULL_TIME, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 } }];
    expect(req("2027-10-04", { contract: { ...BAVARIA, week } }).value).toBe(0);
  });
  it("puts the free time at the end unless the deciding layer says otherwise", () => {
    expect(req("2027-05-05", rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF })).freePart).toBe("end");
    expect(req("2027-05-05", rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF, part: "start" })).freePart).toBe("start");
    expect(req("2027-05-05", {
      sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "company", required: HALF }],
      ...rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF, part: "start" }),
    }).freePart).toBe("start");
  });
});

describe("dayFacts", () => {
  it("lists every source of a day, Info included, and the matching rules in contract order", () => {
    const facts = dayFacts(baseInput({
      sources: [{ type: "info", day: d("2027-05-05"), sourceId: "school" }],
      ...rules({ id: "b", match: once("2027-05-05"), requiredAtMost: HALF }, { id: "a", match: fixed(5, 5), mandatory: FULL }),
    }), d("2027-05-04"), d("2027-05-06"));
    expect(facts.map((f) => f.day)).toEqual([d("2027-05-04"), d("2027-05-05"), d("2027-05-06")]);
    expect(facts[1]?.sources.map((s) => s.sourceId)).toEqual(["school"]);
    expect(facts[1]?.rules.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it.each([
    [{ contract: { ...BAVARIA, week: [] } }],
    [{ contract: { ...BAVARIA, week: [{ from: d("2027-01-01"), required: FULL_TIME }, { from: d("2027-01-01"), required: FULL_TIME }] } }],
    [{ overrides: [{ day: d("2027-05-05"), required: 0 }, { day: d("2027-05-05"), required: 480 }] }],
    [{ sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "x", required: 481 }] }],
  ] as [Partial<PlanInput>][])("rejects invalid input %#", (changes) =>
    expect(() => dayFacts(baseInput(changes), d("2027-05-01"), d("2027-05-31"))).toThrow(RangeError));
});
```


- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/required.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/required`.

- [ ] **Step 3: Implement `dayFacts` and `requiredWork` in `src/engine/counting/required.ts`**

Match every rule once over the whole window with `ruleDays` and index the results by day; look up holidays once with `holidaysBetween(input.country, input.contract.region, from, to)`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/required.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting/required.ts tests/engine/counting/required.test.ts
git -c commit.gpgsign=false commit -m "Add required work per day from work week, layers and overrides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Leave and cost of one day

**Files:**
- Create: `src/engine/counting/leave.ts`
- Test: `tests/engine/counting/leave.test.ts`

**Interfaces:**
- Consumes: Task 2 (`Part`), Task 4 (`RequiredWork`).
- Produces (`src/engine/counting/leave.ts`):

```ts
export type LeaveKind = "own" | "mandatory" | "otherPlan";
export interface LeavePiece {
  readonly kind: LeaveKind;
  readonly take: Units; // 1 … 480
  readonly part: Part;
  readonly ruleId?: string; // mandatory leave from a day rule
  readonly sourceId?: string; // mandatory or other-plan leave from a calendar source
}
export interface DayLeave {
  readonly cost: Units; // ownCost + mandatoryCost
  readonly ownCost: Units;
  readonly mandatoryCost: Units;
  readonly remaining: Units; // work left
  readonly whole: boolean; // remaining === 0
  readonly freeStart: Units; // free time at the start of the day; 480 when whole
  readonly freeEnd: Units; // free time at the end of the day; 480 when whole
  readonly costStart: Units; // cost inside the free time at the start; the whole cost when whole
  readonly costEnd: Units; // cost inside the free time at the end; 0 when whole
  readonly ownCoveredByOtherPlan: boolean;
}
export function evaluateLeave(required: Pick<RequiredWork, "value" | "freePart">, pieces: readonly LeavePiece[], charge: boolean): DayLeave;
```

Positions are relative to the day's work block of length `R = required.value`. Every piece becomes one interval inside `[0, R)`: `part: "start"` → `[0, min(take, R))`, `part: "end"` → `[R − min(take, R), R)`. With `own`, `mand`, `other` the unions of the pieces of each kind:

```text
free     = own ∪ mand ∪ other        = [0, p) ∪ [R − q, R)  (p, q: longest start and end interval)
remaining = max(0, R − p − q);  whole = remaining === 0
charged  = charge ? own ∪ (mand \ other) : ∅
cost = |charged|;  mandatoryCost = charge ? |mand \ other| : 0;  ownCost = cost − mandatoryCost
a = freePart === "end" ? 0 : 480 − R              (start of the work block in the day)
freeStart = whole ? 480 : a + p;  freeEnd = whole ? 480 : 480 − a − R + q
costStart = whole ? cost : |charged ∩ [0, p)|;  costEnd = whole ? 0 : |charged ∩ [R − q, R)|
ownCoveredByOtherPlan = |own ∩ other| > 0
```

Every set has at most two intervals; a small private helper for union, difference and measure of interval lists inside `[0, R)` is enough.

- [ ] **Step 1: Write the failing tests**

```ts
const at = (value: number, freePart: Part = "end") => ({ value, freePart });
const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mand = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "m" });
const other = (take: number, part: Part = "end"): LeavePiece => ({ kind: "otherPlan", take, part, sourceId: "o" });
const pick = (x: DayLeave) => [x.cost, x.ownCost, x.mandatoryCost, x.remaining, x.freeStart, x.freeEnd];

describe("evaluateLeave", () => {
  // [cost, ownCost, mandatoryCost, remaining, freeStart, freeEnd]
  it.each([
    ["company closure", at(480), [mand(480)], [480, 0, 480, 0, 480, 480]],
    ["mandatory leave on a Sunday", at(0), [mand(480)], [0, 0, 0, 0, 480, 480]],
    ["company closes at noon", at(480), [mand(240)], [240, 0, 240, 240, 0, 240]],
    ["maintainer's example: own ½ start, mandatory ½ end", at(480), [own(240, "start"), mand(240)], [480, 240, 240, 0, 480, 480]],
    ["own and mandatory on the same half", at(480), [own(240), mand(240)], [240, 0, 240, 240, 0, 240]],
    ["mandatory ½ on a day with at most ½", at(240), [mand(240)], [240, 0, 240, 0, 480, 480]],
    ["own ½ at the start of a ½ day frees it", at(240), [own(240, "start")], [240, 240, 0, 0, 480, 480]],
    ["½ day with the free time at the start, no leave", at(240, "start"), [], [0, 0, 0, 240, 240, 0]],
    ["15 minutes of work left", at(480), [own(470, "start")], [470, 470, 0, 10, 470, 0]],
    ["leave from another plan never costs", at(480), [other(480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave already counted in another plan", at(480), [mand(480), other(480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave half covered by another plan", at(480), [mand(480), other(240, "start")], [240, 0, 240, 0, 480, 480]],
    ["own leave on a day taken in another plan", at(480), [own(480), other(480)], [480, 480, 0, 0, 480, 480]],
    // Review Focus 5
    ["closure added on a day already planned as own leave", at(480), [own(480), mand(480)], [480, 0, 480, 0, 480, 480]],
  ] as [string, ReturnType<typeof at>, LeavePiece[], number[]][])("%s", (_, required, pieces, expected) =>
    expect(pick(evaluateLeave(required, pieces, true))).toEqual(expected));

  it("splits the cost of a day with work in the middle", () => {
    const x = evaluateLeave(at(480), [own(120, "start"), mand(120)], true);
    expect([x.remaining, x.freeStart, x.freeEnd, x.costStart, x.costEnd]).toEqual([240, 120, 120, 120, 120]);
  });
  it("flags own leave covered by leave from another plan", () => {
    expect(evaluateLeave(at(480), [own(480), other(480)], true).ownCoveredByOtherPlan).toBe(true);
    expect(evaluateLeave(at(480), [own(240, "start"), other(240)], true).ownCoveredByOtherPlan).toBe(false);
  });
  it("frees time but charges nothing when charge is false", () =>
    expect(pick(evaluateLeave(at(480), [own(480)], false))).toEqual([0, 0, 0, 0, 480, 480]));

  const sixteenth = fc.integer({ min: 0, max: 32 }).map((k) => k * 15);
  const part = fc.constantFrom<Part>("start", "end");
  it("costs min(taken, required work) for any multiple of 1/32", () =>
    fc.assert(fc.property(sixteenth, sixteenth.filter((t) => t > 0), part, part, (r, take, p, freePart) => {
      const x = evaluateLeave(at(r, freePart), [own(take, p)], true);
      expect(x.cost).toBe(Math.min(take, r));
      expect(x.remaining).toBe(r - Math.min(take, r));
    })));
  it("keeps cost, free time and remaining work consistent", () =>
    fc.assert(fc.property(sixteenth, fc.array(fc.record({ kind: fc.constantFrom<LeaveKind>("own", "mandatory", "otherPlan"), take: sixteenth.filter((t) => t > 0), part }), { maxLength: 4 }), part,
      (r, pieces, freePart) => {
        const x = evaluateLeave(at(r, freePart), pieces, true);
        expect(x.cost).toBeLessThanOrEqual(r);
        expect(x.costStart + x.costEnd).toBe(x.cost);
        if (!x.whole) expect(x.freeStart + x.freeEnd + x.remaining).toBe(480);
      })));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/leave.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/leave`.

- [ ] **Step 3: Implement `evaluateLeave` in `src/engine/counting/leave.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/leave.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting/leave.ts tests/engine/counting/leave.test.ts
git -c commit.gpgsign=false commit -m "Add cost and free time of a day with positions within the day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Stretches

**Files:**
- Create: `src/engine/counting/stretches.ts`
- Test: `tests/engine/counting/stretches.test.ts`

**Interfaces:**
- Consumes: `DayNumber`, `Units`.
- Produces (`src/engine/counting/stretches.ts`):

```ts
export interface StretchDay {
  readonly day: DayNumber;
  readonly whole: boolean;
  readonly freeStart: Units;
  readonly freeEnd: Units;
  readonly costStart: Units;
  readonly costEnd: Units;
  readonly closure: boolean; // a paid closure (see Task 7)
}
export interface StretchPoint { readonly day: DayNumber; readonly offset: Units } // 0 … 480 within the day
export interface Stretch {
  readonly start: StretchPoint; // offset 0 = from the start of the day, 240 = from noon
  readonly end: StretchPoint; // exclusive: offset 480 = until the end of the day, 240 = until noon
  readonly cost: Units;
  readonly daysOff: Units;
  readonly listed: boolean; // cost > 0 or a closure day inside
}
export function findStretches(days: readonly StretchDay[]): Stretch[];
```

- `days` must be consecutive; otherwise `RangeError`.
- One pass: a whole day continues the open stretch or opens one at offset 0. A partial day with `freeStart > 0` adds `freeStart` and `costStart` to the open stretch, or forms a new stretch from offset 0 if none is open, and that stretch ends at offset `freeStart`; a partial day with `freeStart = 0` ends the open stretch at the end of the previous day. Then, if `freeEnd > 0`, the partial day opens a new stretch at offset `480 − freeEnd` with `freeEnd` and `costEnd`. A stretch still open after the last day ends there. `daysOff` adds up the free time; `cost` adds `costStart + costEnd` of whole days and the matching side of partial days.
- `DayLeave` (Task 5) plus `day` and `closure` is a `StretchDay`.

- [ ] **Step 1: Write the failing tests**

```ts
type Shape = Omit<StretchDay, "day">;
const work: Shape = { whole: false, freeStart: 0, freeEnd: 0, costStart: 0, costEnd: 0, closure: false };
const free = (cost = 0, closure = false): Shape => ({ whole: true, freeStart: 480, freeEnd: 480, costStart: cost, costEnd: 0, closure });
const partial = (freeStart: number, freeEnd: number, costStart = 0, costEnd = 0): Shape => ({ ...work, freeStart, freeEnd, costStart, costEnd });
const seq = (...shapes: Shape[]): StretchDay[] => shapes.map((s, i) => ({ ...s, day: d("2027-05-05") + i }));
const fmt = (s: Stretch) =>
  `${isoFromDay(s.start.day)}@${s.start.offset} ${isoFromDay(s.end.day)}@${s.end.offset} ${s.cost}/${s.daysOff}${s.listed ? " listed" : ""}`;
const run = (...shapes: Shape[]) => findStretches(seq(...shapes)).map(fmt);

describe("findStretches", () => {
  it("ends a stretch with a free start on its last day", () =>
    expect(run(work, free(), partial(240, 0, 240), free(), free(), work))
      .toEqual(["2027-05-06@0 2027-05-07@240 240/720 listed", "2027-05-08@0 2027-05-09@480 0/960"]));
  it("starts a stretch with a free end on its first day", () =>
    expect(run(work, free(), partial(0, 240, 0, 240), free(), free(), work))
      .toEqual(["2027-05-06@0 2027-05-06@480 0/480", "2027-05-07@240 2027-05-09@480 240/1200 listed"]));
  it("breaks at 10 units of work", () =>
    expect(run(free(), partial(470, 0, 470), free())).toEqual(["2027-05-05@0 2027-05-06@470 470/950 listed", "2027-05-07@0 2027-05-07@480 0/480"]));
  it("lists a paid closure without cost", () => expect(run(work, free(0, true), free(), work)).toEqual(["2027-05-06@0 2027-05-07@480 0/960 listed"]));
  it("splits a day with work in the middle", () =>
    expect(run(work, partial(120, 120, 120, 120), work)).toEqual(["2027-05-06@0 2027-05-06@120 120/120 listed", "2027-05-06@360 2027-05-06@480 120/120 listed"]));
  it("closes a stretch at the end of the list", () => expect(run(work, free(480))).toEqual(["2027-05-06@0 2027-05-06@480 480/480 listed"]));
  it("rejects days that are not consecutive", () =>
    expect(() => findStretches([{ ...work, day: 10 }, { ...work, day: 12 }])).toThrow(RangeError));
  it("keeps every unit of cost and free time", () => {
    const shape = fc.oneof(
      fc.integer({ min: 0, max: 480 }).map((c) => free(c)),
      fc.tuple(fc.integer({ min: 0, max: 239 }), fc.integer({ min: 0, max: 239 })).chain(([s, e]) =>
        fc.tuple(fc.integer({ min: 0, max: s }), fc.integer({ min: 0, max: e })).map(([cs, ce]) => partial(s, e, cs, ce))),
    );
    fc.assert(fc.property(fc.array(shape, { maxLength: 30 }), (shapes) => {
      const days = seq(...shapes);
      const stretches = findStretches(days);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(sum(stretches.map((s) => s.cost))).toBe(sum(days.map((x) => x.costStart + x.costEnd)));
      expect(sum(stretches.map((s) => s.daysOff))).toBe(sum(days.map((x) => (x.whole ? 480 : x.freeStart + x.freeEnd))));
    }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/stretches.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/stretches`.

- [ ] **Step 3: Implement `findStretches` in `src/engine/counting/stretches.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/stretches.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting/stretches.ts tests/engine/counting/stretches.test.ts
git -c commit.gpgsign=false commit -m "Add stretches of unbroken time off with partial days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Plan computation

**Files:**
- Create: `src/engine/counting/plan.ts`
- Test: `tests/engine/counting/plan.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6 (`PlanInput`, `dayFacts`, `requiredWork`, `RequiredWork`, `DayFacts`, `evaluateLeave`, `LeavePiece`, `DayLeave`, `findStretches`, `Stretch`), `dayFromYmd`, `daysInMonth`, `ymdFromDay`, `MIN_YEAR`, `MAX_YEAR`.
- Produces (`src/engine/counting/plan.ts`):

```ts
export const STRETCH_MARGIN_DAYS = 60;

export interface DayResult {
  readonly day: DayNumber;
  readonly inPeriod: boolean;
  readonly facts: DayFacts;
  readonly required: RequiredWork;
  readonly leave: readonly LeavePiece[];
  readonly evaluation: DayLeave;
  readonly closure: boolean;
}
export interface PlanTotals {
  readonly allowance: Units;
  readonly planned: Units;
  readonly remaining: Units; // allowance − planned, may be negative
  readonly byYear: readonly { readonly year: number; readonly planned: Units }[]; // every calendar year the period touches, ascending
}
export type Problem =
  | { readonly code: "leaveOutsidePeriod"; readonly day: DayNumber }
  | { readonly code: "leaveWithoutRequiredWork"; readonly day: DayNumber }
  | { readonly code: "leaveTakenInOtherPlan"; readonly day: DayNumber; readonly sourceIds: readonly string[] }
  | { readonly code: "conflictingForcedRules"; readonly day: DayNumber; readonly ruleIds: readonly string[] };
export interface PlanResult {
  readonly period: { readonly from: DayNumber; readonly to: DayNumber };
  readonly days: readonly DayResult[]; // consecutive: the period ± STRETCH_MARGIN_DAYS, clamped to the supported years
  readonly totals: PlanTotals;
  readonly stretches: readonly Stretch[]; // every stretch with at least one day in the period, in order
  readonly problems: readonly Problem[]; // sorted by day, then in the order of the codes above
}
export function periodBounds(period: PlanPeriod): { from: DayNumber; to: DayNumber };
export function computePlan(input: PlanInput): PlanResult;
```

- `periodBounds`: first day of the start month to the last day of the end month; `RangeError` for a month outside 1–12, a year outside 1583–9999 or a start after the end.
- `computePlan`:
  - Throws `RangeError` for two leave entries on one day, `take` outside 1–480, `take < 480` without `part`, or a negative or non-integer allowance.
  - Leave pieces of a day: own leave only for days inside the period (`part ?? "end"`); mandatory leave from matching rules with `mandatory` (`part: rule.part ?? "end"`, `ruleId`); mandatory and other-plan sources (`part ?? "end"`, `sourceId`). `evaluateLeave(required, pieces, inPeriod)`.
  - `closure`: required value 0, base value > 0, and a `paidClosure` layer or a `ruleAtMost`/`ruleExactly` layer with value 0.
  - Stretches: `findStretches` over all days of the window; keep those with a day in the period.
  - Totals over days in the period only.
  - Problems: `leaveOutsidePeriod` for own leave outside the period; for days in the period, `leaveWithoutRequiredWork` (own leave, required value 0), `leaveTakenInOtherPlan` (`ownCoveredByOtherPlan`, with the other-plan source IDs of the day) and `conflictingForcedRules` (non-empty `conflictingRules`).

- [ ] **Step 1: Write the failing tests**

```ts
const fmt = (s: Stretch) => `${isoFromDay(s.start.day)}@${s.start.offset} ${isoFromDay(s.end.day)}@${s.end.offset} ${s.cost}/${s.daysOff}`;
const listed = (result: PlanResult) => result.stretches.filter((s) => s.listed).map(fmt);
const dayOf = (result: PlanResult, iso: string) => {
  const found = result.days.find((x) => x.day === d(iso));
  if (!found) throw new Error(`no day ${iso}`);
  return found;
};
const leave = (iso: string, take = FULL, part?: Part): LeaveDay => ({ day: d(iso), take, ...(part && { part }) });
const plan = (changes: Partial<PlanInput>) => computePlan(baseInput(changes));
const withRules = (...rules: DayRule[]) => ({ ...BAVARIA, rules });
const closureRule: DayRule = { id: "closure", match: { type: "range", from: fixed(12, 27), to: fixed(1, 4) }, validFrom: 2027, validUntil: 2027, mandatory: FULL };
const month = (year: number, m: number) => ({ year, month: m });

describe("computePlan: stretches from the design", () => {
  it("½ on Fri 7 May in the morning", () =>
    expect(listed(plan({ leave: [leave("2027-05-07", HALF, "start")] }))).toEqual(["2027-05-06@0 2027-05-07@240 240/720"]));
  it("½ on Fri 7 May in the afternoon", () =>
    expect(listed(plan({ leave: [leave("2027-05-07", HALF, "end")] }))).toEqual(["2027-05-07@240 2027-05-09@480 240/1200"]));
  it("Christmas with 24 and 31 December at most ½", () => {
    const christmas = ["2027-12-27", "2027-12-28", "2027-12-29", "2027-12-30"].map((x) => leave(x));
    const contract = withRules(...CHRISTMAS_EVE_RULES);
    expect(listed(plan({ contract, leave: [...christmas, leave("2027-12-31", HALF, "end")] }))).toEqual(["2027-12-24@240 2028-01-02@480 2160/4560"]);
    expect(listed(plan({ contract, leave: [leave("2027-12-24", HALF, "end"), ...christmas, leave("2027-12-31", HALF, "end")] })))
      .toEqual(["2027-12-24@0 2028-01-02@480 2400/4800"]);
  });
  it("the maintainer's example: own ½ in the morning, mandatory ½ in the afternoon", () => {
    const contract = withRules({ id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF });
    const morning = plan({ contract, leave: [leave("2027-12-24", HALF, "start")] });
    expect(listed(morning)).toEqual(["2027-12-24@0 2027-12-26@480 480/1440"]);
    expect([dayOf(morning, "2027-12-24").evaluation.ownCost, dayOf(morning, "2027-12-24").evaluation.mandatoryCost]).toEqual([240, 240]);
    expect(listed(plan({ contract, leave: [leave("2027-12-24", HALF, "end")] }))).toEqual(["2027-12-24@240 2027-12-26@480 240/1200"]);
  });
  it("lists a standalone paid closure with cost 0", () => {
    const sources: SourceDay[] = span("2027-12-27", "2027-12-30").map((x) => ({ type: "paidClosure", day: d(x), sourceId: "closure" }));
    expect(listed(plan({ sources }))).toEqual(["2027-12-25@0 2027-12-30@480 0/2880"]);
  });
  it("doesn't list ordinary weekends and holidays", () => expect(listed(plan({}))).toEqual([]));
  // Review Focus 1
  it("reaches back before a period that starts inside a stretch and counts only the cost inside it", () => {
    const result = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2028, 12) } });
    expect(listed(result)).toEqual(["2027-12-25@0 2028-01-04@480 960/5280"]);
    expect(result.totals.planned).toBe(960);
  });
});

describe("computePlan: totals and plans that share a month", () => {
  it("charges a closure over New Year once across two plans", () => {
    const plan2027 = plan({ contract: withRules(closureRule), period: { from: month(2027, 1), to: month(2028, 1) } });
    expect(plan2027.totals.byYear).toEqual([{ year: 2027, planned: 2400 }, { year: 2028, planned: 960 }]);
    const otherPlan: SourceDay[] = ["2028-01-03", "2028-01-04"].map((x) => ({ type: "otherPlan", day: d(x), sourceId: "plan-2027", take: FULL }));
    const plan2028 = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2029, 1) }, sources: otherPlan });
    expect(plan2028.totals.planned).toBe(0);
    const again = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2029, 1) }, sources: otherPlan, leave: [leave("2028-01-03")] });
    expect(again.totals.planned).toBe(480);
    expect(again.problems).toEqual([{ code: "leaveTakenInOtherPlan", day: d("2028-01-03"), sourceIds: ["plan-2027"] }]);
  });
  it("never counts leave from another plan and shows it on the day", () => {
    const sources: SourceDay[] = span("2027-06-01", "2027-06-03").map((x) => ({ type: "otherPlan", day: d(x), sourceId: "p", take: FULL }));
    const result = plan({ sources });
    expect(result.totals.planned).toBe(0);
    expect(dayOf(result, "2027-06-02").facts.sources.map((s) => s.sourceId)).toEqual(["p"]);
    expect(listed(result)).toEqual([]);
  });
  it("goes below zero without blocking", () =>
    expect(plan({ allowance: FULL, leave: [leave("2027-05-05"), leave("2027-05-07")] }).totals).toMatchObject({ planned: 960, remaining: -480 }));
});

describe("computePlan: problems", () => {
  it("reports leave outside the period and leave on a day without required work", () => {
    const result = plan({ leave: [leave("2027-05-09"), leave("2028-02-01")] });
    expect(result.problems).toEqual([{ code: "leaveWithoutRequiredWork", day: d("2027-05-09") }, { code: "leaveOutsidePeriod", day: d("2028-02-01") }]);
    expect(result.totals.planned).toBe(0);
  });
  it("charges nothing for 24 and 31 December on a Sunday", () => {
    const result = plan({ contract: withRules(...CHRISTMAS_EVE_RULES), period: { from: month(2028, 1), to: month(2028, 12) }, leave: [leave("2028-12-24"), leave("2028-12-31")] });
    expect([result.totals.planned, result.problems.map((p) => p.code)]).toEqual([0, ["leaveWithoutRequiredWork", "leaveWithoutRequiredWork"]]);
  });
  it("reports conflicting forced rules", () =>
    expect(plan({ contract: withRules({ id: "a", match: once("2027-03-13"), requiredExactly: HALF }, { id: "b", match: once("2027-03-13"), requiredExactly: FULL }) }).problems)
      .toEqual([{ code: "conflictingForcedRules", day: d("2027-03-13"), ruleIds: ["a", "b"] }]));
  it.each([
    [{ leave: [leave("2027-05-05"), leave("2027-05-05")] }], [{ leave: [{ day: d("2027-05-05"), take: 0 }] }],
    [{ leave: [{ day: d("2027-05-05"), take: HALF }] }], [{ allowance: -1 }], [{ period: { from: month(2027, 5), to: month(2027, 4) } }],
  ] as [Partial<PlanInput>][])("rejects invalid input %#", (changes) => expect(() => plan(changes)).toThrow(RangeError));
});

describe("computePlan: limits", () => {
  // Review Focus 3
  it("works at the limits of the supported years", () => {
    expect(isoFromDay(plan({ period: { from: month(9999, 1), to: month(9999, 12) } }).days.at(-1)?.day ?? 0)).toBe("9999-12-31");
    expect(isoFromDay(plan({ period: { from: month(1583, 1), to: month(1583, 12) } }).days[0]?.day ?? 0)).toBe("1583-01-01");
  });
  it("keeps the costs of all stretches equal to planned", () => {
    const take = fc.integer({ min: 1, max: 32 }).map((k) => k * 15);
    const leaveDays = fc.uniqueArray(fc.integer({ min: 0, max: 58 }), { maxLength: 15 }).chain((offsets) =>
      fc.tuple(...offsets.map((o) => fc.tuple(take, fc.constantFrom<Part>("start", "end")).map(([t, p]) => ({ day: d("2027-01-01") + o, take: t, part: p })))));
    const mandatoryDays = fc.uniqueArray(fc.integer({ min: 0, max: 58 }), { maxLength: 6 }).map((offsets) =>
      offsets.map((o): SourceDay => ({ type: "mandatory", day: d("2027-01-01") + o, sourceId: "m", take: HALF, part: "end" })));
    fc.assert(fc.property(leaveDays, mandatoryDays, (leaveList, sources) => {
      const result = plan({ period: { from: month(2027, 1), to: month(2027, 2) }, leave: leaveList, sources });
      expect(result.stretches.reduce((sum, s) => sum + s.cost, 0)).toBe(result.totals.planned);
    }), { numRuns: 50 });
  });
  // Review Focus 4
  it("computes a 13-month plan with 40 rules and 300 source days quickly", () => {
    const rules: DayRule[] = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? { id: `r${i}`, match: fixed(1 + (i % 12), 1 + (i % 28)), requiredAtMost: HALF }
        : { id: `r${i}`, match: { type: "range", from: fixed(1 + (i % 12), 1), days: 10, weekdays: ["fri"] }, mandatory: HALF });
    const sources: SourceDay[] = Array.from({ length: 300 }, (_, i) => ({ type: "holiday", day: d("2027-01-01") + i, sourceId: "s", required: HALF }));
    const input = baseInput({ contract: withRules(...rules), sources, period: { from: month(2027, 1), to: month(2028, 1) } });
    computePlan(input);
    const startedAt = performance.now();
    computePlan(input);
    expect(performance.now() - startedAt).toBeLessThan(200);
  });
});
```

Declare `performance` at the top of the test file as `tests/engine/weight.test.ts` does (`declare const performance: { now(): number };`).

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/plan.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/plan`.

- [ ] **Step 3: Implement `periodBounds` and `computePlan` in `src/engine/counting/plan.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/plan.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting/plan.ts tests/engine/counting/plan.test.ts
git -c commit.gpgsign=false commit -m "Add the plan computation with totals, stretches and problems

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Where partial own leave lies

**Files:**
- Create: `src/engine/counting/suggest.ts`
- Test: `tests/engine/counting/suggest.test.ts`

**Interfaces:**
- Consumes: Task 5 (`evaluateLeave`), Task 7 (`computePlan`, `periodBounds`, `DayResult`).
- Produces (`src/engine/counting/suggest.ts`): `suggestPart(input: PlanInput, day: DayNumber, take: Units): Part | null`
  - `RangeError` when `day` is outside the period or `take` is not an integer from 1 to 480.
  - Computes the plan without the own leave on `day`, then evaluates the day with an extra own piece of `take` on each side. Both sides free the whole day → `"end"`; exactly one does → that side.
  - Otherwise: the previous day ends free (`freeEnd > 0`) or the next day starts free (`freeStart > 0`); exactly one of them → `"start"` for the previous day, `"end"` for the next day; both or neither → `null`.

- [ ] **Step 1: Write the failing tests**

```ts
const suggest = (iso: string, take = HALF, changes: Partial<PlanInput> = {}) => suggestPart(baseInput(changes), d(iso), take);

describe("suggestPart", () => {
  it.each([
    ["2027-05-10", "start"], // Sunday before, Tuesday after
    ["2027-05-14", "end"], // Thursday before, Saturday after
    ["2027-05-07", null], // Ascension before, Saturday after
    ["2027-05-12", null], // working days on both sides
  ] as [string, Part | null][])("on %s suggests %j", (iso, expected) => expect(suggest(iso)).toBe(expected));
  it("suggests the end when the leave covers all work either way", () =>
    expect(suggest("2027-12-24", HALF, { contract: { ...BAVARIA, rules: CHRISTMAS_EVE_RULES } })).toBe("end"));
  it("suggests the side that frees the whole day", () =>
    expect(suggest("2027-12-24", HALF, { contract: { ...BAVARIA, rules: [{ id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF }] } })).toBe("start"));
  it("ignores own leave already on that day", () => expect(suggest("2027-05-10", HALF, { leave: [{ day: d("2027-05-10"), take: FULL }] })).toBe("start"));
  it("suggests the end for a full day", () => expect(suggest("2027-05-12", FULL)).toBe("end"));
  // Review Focus 2
  it("sees free days before the period", () =>
    expect(suggest("2027-02-01", HALF, { period: { from: { year: 2027, month: 2 }, to: { year: 2027, month: 12 } } })).toBe("start"));
  it.each([["2028-01-03", HALF], ["2027-05-12", 0], ["2027-05-12", 481]] as [string, number][])("rejects %s with %i", (iso, take) =>
    expect(() => suggest(iso, take)).toThrow(RangeError));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/counting/suggest.test.ts`
Expected: FAIL, cannot resolve `src/engine/counting/suggest`.

- [ ] **Step 3: Implement `suggestPart` in `src/engine/counting/suggest.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/counting/suggest.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/counting/suggest.ts tests/engine/counting/suggest.test.ts
git -c commit.gpgsign=false commit -m "Add a suggestion for where partial own leave lies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Branch completion

- `npm ci` from a clean `node_modules`, then `npm run check`: everything passes.
- `git status` is clean; `git log main..counting-model` shows the design commit, the plan commit and one commit per task.
- No file under `src/engine/` uses `Date`, floats for day fractions, or a sentence meant for users.
- The final report lists every designer's call from the design that turned out differently in code, and every follow-up recorded in `issues/`.
