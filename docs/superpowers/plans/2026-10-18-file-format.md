<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# File Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read, check and write plan files (`.urlaub.json`) and rule sets (`.regeln.json`), turn them into counting-model input, import "Leave from another plan" as charged spans, and ship researched example files with hand-checked tests and a terminal command to try them.

**Architecture:** Two small counting-model changes first (other-plan pieces with a position and charged spans in the day result; the source type "Time off needed"). Then a new module `src/engine/file/`: a typed in-memory model, readers per part of the file that report every problem as a code with a path, a canonical writer, the conversion to `PlanInput`, and the other-plan import. Examples live in `examples/`, the command in `scripts/`.

**Tech Stack:** TypeScript 6.0.3, Vitest, fast-check, ESLint with typescript-eslint, Node 24 (type stripping) for the command; the existing engine (`src/engine/counting/`, `src/engine/holidays/`, `src/engine/weight.ts`, `src/engine/days.ts`) and German data (`src/data/holidays/`).

**Spec:** `docs/superpowers/specs/2026-10-18-file-format-design.md` (design for this branch, authoritative for this plan; its appendix holds the basis of the example rule sets). `docs/SPEC.md` is the project specification. Executors read the design, plus `AGENTS.md`, `docs/day-rules-format.md` and `docs/holiday-data-format.md` (date rules).

## Global Constraints

- Branch `file-format`; commit with `git -c commit.gpgsign=false commit`; never push, tag or sign. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (or the model that wrote the commit).
- No new packages ("Only packages listed in the spec. Ask before adding any package." — `AGENTS.md`), including no JSON-schema or validation library. Run tools via npm scripts, never `npx`.
- "1 day = 480 integer units. No floats for day fractions, no assumption 'only 0, ½, 1'." (`AGENTS.md`)
- No JavaScript `Date` in `src/engine/**` (ESLint enforces it); `Date` may appear in tests and `scripts/` only.
- Files: ISO dates `YYYY-MM-DD`, months `YYYY-MM`, weights as strings; writers write fraction strings, readers also accept decimal strings with a decimal point; values not exact in 1/480 are invalid.
- No timestamp, time zone, working hours, device or user information in any file; `savedAt`, `timeZone`, `workHours` are unknown fields.
- The engine returns codes plus data, never sentences ("no string concatenation of sentences" — `AGENTS.md`).
- Untrusted input never throws out of `readFile`: every problem becomes a report entry or a refusal. Typed engine input that is invalid still throws `RangeError` as before.
- Security: no `eval`/`new Function`; data from files is never inserted as markup; size limits as in the design's "Limits" table.
- REUSE: new TypeScript files start with `// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors` and `// SPDX-License-Identifier: EUPL-1.2`; new Markdown with the same lines in an HTML comment and `CC-BY-4.0`. Example files are covered by `REUSE.toml` (MIT-0).
- Code, identifiers and comments in English; domain terms from the glossary in `docs/SPEC.md`.
- Work inside the Nix dev shell. After edits, check the TypeScript language server diagnostics and fix reported errors.
- A task is done when `npm run check` passes.

## Review Focus

1. **A file saved by Windows Notepad** starts with a byte-order mark; `JSON.parse` would fail. Expected: a leading U+FEFF is ignored. Test in Task 3.
2. **A German decimal comma** (`"take": "0,5"`) or a calendar date that doesn't exist (`"2027-02-29"`, `"2027-2-3"`): the entry is dropped and reported, nothing crashes and nothing becomes 0. Tests in Tasks 3 and 6.
3. **Huge numbers** (`"allowance": "99999999999999999999"`, `"revision": 1e300`): refused as invalid core values, never `Infinity` or a rounded number. Test in Tasks 3 and 6.
4. **Names with emoji or umlauts at the length limit**: limits count characters (code points), so 200 emoji are a valid name and 201 are not. Test in Task 3.
5. **Two plans with different contracts** (the other plan frees the afternoon of 31 December, this one the morning): other-plan spans are positions in the day, not in the work block, so a span covers the same clock time in both. Test in Task 1.

---

### Task 1: Other-plan pieces with a position, charged spans in the day result

**Files:**
- Modify: `src/engine/counting/types.ts` (`SourceDay`), `src/engine/counting/leave.ts`, `src/engine/counting/plan.ts`, `src/engine/counting/required.ts` (source validation in `dayFacts`)
- Test: `tests/engine/counting/leave.test.ts`, `plan.test.ts`, `required.test.ts`, `suggest.test.ts` (migrate other-plan fixtures; new cases)

**Interfaces:**
- Consumes: the existing counting model.
- Produces:
  - `SourceDay` other-plan variant: `{ readonly type: "otherPlan"; readonly day: DayNumber; readonly sourceId: string; readonly from: Units; readonly to: Units; readonly kind: "leave" | "mandatory" }`. `from`/`to` are **day positions**: units of a full day, 0 = start of a full working day, `0 ≤ from < to ≤ 480`, integers. `dayFacts` throws `RangeError` otherwise.
  - `LeavePiece` becomes a union: `{ readonly kind: "own" | "mandatory"; readonly take: Units; readonly part: Part; readonly ruleId?: string; readonly sourceId?: string } | { readonly kind: "otherPlan"; readonly from: Units; readonly to: Units; readonly sourceId?: string }`.
  - `export interface ChargedSpan { readonly from: Units; readonly to: Units; readonly kind: "leave" | "mandatory" }` (day positions) and `DayLeave.charged: readonly ChargedSpan[]` — sorted by `from`, non-overlapping; `mandatory` spans are the charged mandatory leave (as `mandatoryCost` counts it), `leave` spans the rest of the charged own leave; empty when `charge` is false; the lengths add up to `cost`.
  - `overlappingOtherPlanIds(required: Pick<RequiredWork, "value" | "freePart">, pieces: readonly LeavePiece[]): string[]` (was `(r, pieces)`).

The work block of a day lies at day positions `[a, a + r)` with `a = freePart === "end" ? 0 : 480 − r`. An other-plan piece covers `[max(0, from − a), min(r, to − a))` of the block (nothing if empty). Free time at the start and end now comes from the union of all pieces: `p` = length of the union's interval that starts at 0, `q` = length of the one that ends at `r`, `remaining = r − measure(union)`, `whole = remaining === 0`. For pieces that touch an edge (all pieces before this task) the results are unchanged. A piece in the middle (only other-plan pieces can be) adds to neither `p` nor `q`. `charged` converts block intervals back to day positions (`+ a`).

- [ ] **Step 1: Migrate the existing other-plan fixtures** to positions, without changing any expectation: `take: T` (default part `"end"`) on a full day → `from: 480 − T, to: 480`; `take: T, part: "start"` → `from: 0, to: T`; add `kind: "leave"`. In `leave.test.ts` replace the helper `other(take, part)` by `other(from, to)`. The invalid fixture `take: 0` in `required.test.ts` becomes `from: 240, to: 240`. Update the calls of `overlappingOtherPlanIds`.

- [ ] **Step 2: Write the failing tests** (`leave.test.ts`, with `req(value, freePart = "end")` building a `RequiredWork`-like object as the file already does):

```ts
describe("other-plan pieces with a position", () => {
  it("a middle piece frees time but neither edge", () =>
    expect(evaluateLeave(req(480), [other(120, 240)], true)).toMatchObject({ cost: 0, remaining: 360, whole: false, freeStart: 0, freeEnd: 0, charged: [] }));
  it("joins an own quarter at the start into one free stretch", () =>
    expect(evaluateLeave(req(480), [own(120, "start"), other(120, 240)], true)).toMatchObject({ cost: 120, freeStart: 240, costStart: 120, charged: [{ from: 0, to: 120, kind: "leave" }] }));
  it("charges only the second quarter of a mandatory morning", () =>
    expect(evaluateLeave(req(480), [mand(240, "start"), other(0, 120)], true)).toMatchObject({ cost: 120, mandatoryCost: 120, freeStart: 240, costStart: 120, charged: [{ from: 120, to: 240, kind: "mandatory" }] }));
  it("places a span by day position, not by work block (Review Focus 5)", () => {
    // required ½ with the free time at the start: the work block is the afternoon, day positions 240–480
    expect(evaluateLeave(req(240, "start"), [other(0, 240)], true)).toMatchObject({ remaining: 240, whole: false, freeStart: 240 });
    expect(evaluateLeave(req(240, "start"), [other(240, 480)], true)).toMatchObject({ remaining: 0, whole: true });
  });
  it("reports charged spans in day positions", () =>
    expect(evaluateLeave(req(240, "start"), [own(240, "start")], true).charged).toEqual([{ from: 240, to: 480, kind: "leave" }]));
  it("splits own and mandatory spans as mandatoryCost counts them", () =>
    expect(evaluateLeave(req(480), [own(240, "start"), mand(480, "end")], true).charged).toEqual([{ from: 0, to: 480, kind: "mandatory" }]));
  it("charges nothing outside the period", () =>
    expect(evaluateLeave(req(480), [own(480, "end")], false).charged).toEqual([]));
});
```

Extend the slot-by-slot property test ("matches a slot-by-slot model of the day"): the generator also produces other-plan pieces as random `from < to` multiples of 15 between 0 and 480 and a random `freePart`; the model marks the block slots `[from − a, to − a)`; `p`/`q` are the leading/trailing runs of free slots (already so after the counting-model review); `charged` must equal the runs of charged slots, converted to day positions, with `kind` `"mandatory"` for slots charged as mandatory leave.

In `plan.test.ts`, `DayResult.evaluation.charged` of the maintainer's example day (own ½ `start` + mandatory ½ `end`, Friday 24 December 2027): `[{ from: 0, to: 240, kind: "leave" }, { from: 240, to: 480, kind: "mandatory" }]`.

- [ ] **Step 3: Run the tests** — `npm test -- tests/engine/counting` — the new ones FAIL (`charged` missing, middle piece wrong), the migrated ones pass.

- [ ] **Step 4: Implement** the types, `pieceInterval` with day positions for other-plan pieces, `p`/`q`/`remaining` from the union, `charged`, the new `overlappingOtherPlanIds` signature (and its caller in `plan.ts`), and the validation in `dayFacts`.

- [ ] **Step 5: Run** `npm run check` — PASS.

- [ ] **Step 6: Commit** — `git add src/engine/counting tests/engine/counting` and commit "Give other-plan pieces a position and report charged spans per day".

---

### Task 2: The source type "Time off needed"

**Files:**
- Modify: `src/engine/counting/types.ts`, `src/engine/counting/required.ts` (validation), `src/engine/counting/plan.ts`
- Test: `tests/engine/counting/plan.test.ts`, `required.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `SourceDay` variant `{ readonly type: "needed"; readonly day: DayNumber; readonly sourceId: string; readonly take: Units; readonly part?: Part }` (`take` 1 … 480, validated in `dayFacts`). It has no effect on required work, leave, cost or stretches.
  - `Problem` variant `{ readonly code: "uncoveredNeed"; readonly day: DayNumber; readonly sourceIds: readonly string[] }`, ordered after `conflictingForcedRules`; only for days in the period; `sourceIds` each once, in input order.

A need is covered when the day is `whole`, or, with `part` (default `"end"`) `"end"`, when `evaluation.freeEnd ≥ take`; with `"start"`, when `freeStart ≥ take`. These are whole-day measures, so free time from lowered required work counts.

- [ ] **Step 1: Write the failing tests** (`plan.test.ts`; `need(day, take, part?)` builds a `needed` source day with `sourceId: "kita"`):

```ts
describe("time off needed", () => {
  const tue = "2027-05-04"; // a working Tuesday
  it("is covered by own leave at the same part", () =>
    expect(plan({ sources: [need(tue, HALF, "end")], leave: [leave(tue, HALF, "end")] }).problems).toEqual([]));
  it("is covered by a public holiday", () =>
    expect(plan({ sources: [need("2027-05-06", FULL)] }).problems).toEqual([])); // Ascension Day
  it("is covered by a half work-week day", () => {
    const halfTuesday = { ...BAVARIA, week: [{ from: d("2020-01-01"), required: { ...FULL_TIME, tue: HALF } }] };
    expect(plan({ contract: halfTuesday, sources: [need(tue, HALF, "end")] }).problems).toEqual([]);
  });
  it("is covered by leave from another plan", () =>
    expect(plan({ sources: [need(tue, HALF, "end"), { type: "otherPlan", day: d(tue), sourceId: "p", from: 240, to: 480, kind: "leave" }] }).problems).toEqual([]));
  it("is reported when the other half is free", () =>
    expect(plan({ sources: [need(tue, HALF, "end")], leave: [leave(tue, HALF, "start")] }).problems).toEqual([{ code: "uncoveredNeed", day: d(tue), sourceIds: ["kita"] }]));
  it("never costs anything", () => {
    const withNeed = plan({ sources: [need(tue, FULL)] });
    expect(withNeed.totals).toEqual(plan({}).totals);
    expect(withNeed.problems).toEqual([{ code: "uncoveredNeed", day: d(tue), sourceIds: ["kita"] }]);
  });
  it("is not reported outside the period", () =>
    expect(plan({ sources: [need("2026-12-15", FULL)] }).problems).toEqual([]));
});
```

`required.test.ts`: `dayFacts` throws `RangeError` for a `needed` source with `take: 0` and with `take: 481`.

- [ ] **Step 2: Run** `npm test -- tests/engine/counting` — FAIL.
- [ ] **Step 3: Implement** the type, the validation and the problem in `computePlan`.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Add the source type for time off needed".

---

### Task 3: File model, report, limits, and reading the envelope and the contract

**Files:**
- Create: `src/engine/file/types.ts`, `src/engine/file/report.ts`, `src/engine/file/limits.ts`, `src/engine/file/text.ts`, `src/engine/file/read-match.ts`, `src/engine/file/read-contract.ts`, `src/engine/file/read.ts`
- Modify: `src/engine/weight.ts` (`parseAmount`, `formatAmount`), `issues/0001-migrate-dropped-local-rule-options.md`
- Test: `tests/engine/file/read-envelope.test.ts`, `tests/engine/file/read-contract.test.ts`, `tests/engine/file/text.test.ts`, `tests/engine/weight.test.ts`

**Interfaces:**
- Consumes: `parseWeight`, `formatWeight`, `UNITS_PER_DAY` (`weight.ts`); `dayFromIso`, `WEEKDAYS`, `MIN_YEAR`, `MAX_YEAR` (`days.ts`); `countries` (`src/data/holidays/index.ts`); `DayRule`, `DayMatch`, `WorkWeekEntry`, `Part`, `PlanPeriod`, `LeaveDay`, `RequiredOverride` (`counting/types.ts`); `dayRuleWarnings`, `MAX_RANGE_DAYS`.
- Produces (later tasks use these exact names):

```ts
// src/engine/file/types.ts — the checked in-memory model; dates are day numbers, weights are units
export type Text = string | Readonly<Record<string, string>>; // language code → text
export interface Reference { readonly title: Text; readonly version: Text; readonly url: string; readonly checked: DayNumber }
export type FileRule = DayRule & { readonly label?: Text; readonly note?: Text; readonly references?: readonly string[]; readonly origin?: string };
export interface FileRegion { readonly country: string; readonly state?: string; readonly options?: Readonly<Record<string, boolean>> }
export interface FileContract {
  readonly name?: Text; readonly description?: Text;
  readonly references: Readonly<Record<string, Reference>>; // {} when absent
  readonly region: FileRegion; readonly minUnit: Units; readonly week: readonly WorkWeekEntry[]; readonly rules: readonly FileRule[];
}
export type EntryWhen =
  | { readonly date: DayNumber }
  | { readonly match: DayMatch; readonly validFrom?: number; readonly validUntil?: number; readonly except?: readonly DayNumber[] };
export type Entry<T> = EntryWhen & { readonly name?: Text } & T;
export type Color = { readonly slot: string } | { readonly rgb: string };
interface SourceBase { readonly id: string; readonly name: Text; readonly color: Color; readonly visible: boolean; readonly origin?: string }
export type FileSource = SourceBase & (
  | { readonly type: "holiday"; readonly entries: readonly Entry<{ readonly required: Units; readonly part?: Part }>[] }
  | { readonly type: "paidClosure" | "info"; readonly entries: readonly Entry<object>[] }
  | { readonly type: "mandatory" | "needed"; readonly entries: readonly Entry<{ readonly take: Units; readonly part?: Part }>[] }
  | { readonly type: "otherPlan"; readonly plan: OtherPlanRef;
      readonly entries: readonly ({ readonly date: DayNumber; readonly from: Units; readonly to: Units; readonly kind: "leave" | "mandatory" } & { readonly name?: Text })[] });
export interface OtherPlanRef { readonly id: string; readonly name: Text; readonly revision: number }
export interface TemplateImage { readonly name: string; readonly type: "image/png" | "image/jpeg" | "image/svg+xml"; readonly data: string } // Base64
export interface Template { readonly id: string; readonly name: Text; readonly api: number; readonly typst: string; readonly typ: string; readonly images?: readonly TemplateImage[]; readonly origin?: string }
export type Theme = Readonly<Record<string, unknown>> | null;
export interface Note { readonly day: DayNumber; readonly text: string }
export interface FilePlan { readonly range: PlanPeriod; readonly allowance: Units; readonly days: readonly LeaveDay[]; readonly overrides: readonly RequiredOverride[]; readonly notes: readonly Note[] }
export interface RuleSetFile { readonly kind: "ruleSet"; readonly id: string; readonly revision: number; readonly contract: FileContract; readonly sources: readonly FileSource[]; readonly templates: readonly Template[]; readonly theme: Theme }
export interface PlanFile extends Omit<RuleSetFile, "kind"> { readonly kind: "plan"; readonly ruleSet?: OtherPlanRef; readonly plan: FilePlan }
export type AnyFile = PlanFile | RuleSetFile;

// src/engine/file/report.ts
export type RefusalCode = "notJson" | "tooLarge" | "limitExceeded" | "unknownSchema" | "newerSchema" | "unknownKind" | "settingsNotSupported" | "kindMismatch" | "invalidCore";
export type ReportCode = "unknownField" | "invalidEntry" | "duplicateDate" | "duplicateId" | "unknownReference" | "textTooLong"
  | "sourceTooLarge" | "templateTooLarge" | "unknownLocalRule" | "personalSourceInRuleSet" | "invalidMinUnit"
  | "notMultipleOfMinUnit" | "partSuggested" | "outsidePeriod" | "ruleWarning";
export type ReportData = Readonly<Record<string, string | number>>;
export interface ReportEntry { readonly code: ReportCode; readonly path: string; readonly data?: ReportData }
export interface Refusal { readonly code: RefusalCode; readonly path?: string; readonly data?: ReportData }
export type ReadResult = { readonly ok: true; readonly file: AnyFile; readonly report: readonly ReportEntry[] } | { readonly ok: false; readonly refusal: Refusal };
export class Report { readonly entries: ReportEntry[]; add(code: ReportCode, path: string, data?: ReportData): void }
export class Refused extends Error { constructor(readonly refusal: Refusal) } // thrown inside readers, caught only by readFile
export const child: (path: string, key: string) => string; // "" + "contract" → "contract", "contract" + "rules" → "contract.rules"
export const at: (path: string, index: number) => string;  // "contract.rules" + 2 → "contract.rules[2]"
export function checkKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[], path: string, report: Report): void; // reports unknownField per extra key

// src/engine/file/limits.ts — the design's "Limits" table
export const LIMITS: { fileBytes: 10_485_760; rules: 1000; sources: 50; templates: 20; weekEntries: 100; references: 100;
  planDays: 2000; overrides: 2000; notes: 2000; entriesPerSource: 2000; exceptPerEntry: 400; sourceDays: 50_000;
  periodMonths: 36; typBytes: 524_288; imageBytes: 1_048_576; templateImageBytes: 2_097_152; shortText: 200; longText: 2000 };
export function utf8Length(text: string): number; // without TextEncoder (not in the project's lib types)
export function textLength(text: string): number;  // code points

// src/engine/file/text.ts
export function readText(value: unknown, path: string, maxLength: number, report: Report): Text | undefined;
export function textFor(text: Text, language: string): string; // the language, else "en", else the first entry; a string as is

// src/engine/file/read-match.ts
export function readMatch(value: unknown, path: string, report: Report): DayMatch | undefined;
// src/engine/file/read-contract.ts
export function readContract(value: unknown, path: string, kind: "plan" | "ruleSet", report: Report): FileContract; // throws Refused for core problems
// src/engine/file/read.ts
export function readFile(text: string): ReadResult;

// src/engine/weight.ts
export function parseAmount(text: string): Units;   // like parseWeight but ≥ 0 without an upper bound; WeightError "range" above 10_000 days
export function formatAmount(units: Units): string; // reduced fraction, as files write the allowance: "33", "25/2"
```

Conventions every reader follows: a reader that returns `undefined` has already reported why, and its caller drops the containing entry without a second report entry; core problems throw `Refused({ code: "invalidCore", path })`; paths are dot-separated keys with `[index]` for list items, no leading dot (`contract.rules[2].requiredAtMost`).

- [ ] **Step 1: Write the failing tests.**

`tests/engine/weight.test.ts`:

```ts
describe("parseAmount", () => {
  it.each([["33", 15_840], ["0", 0], ["12.5", 6000], ["25/2", 6000], ["1/480", 1]])("reads %j", (text, units) => expect(parseAmount(text)).toBe(units));
  it.each(["-1", "1,5", "", "1e3", "99999999999999999999", "10001"])("rejects %j", (text) => expect(() => parseAmount(text)).toThrow(WeightError));
  it("writes amounts as fractions and round-trips", () => {
    expect(formatAmount(15_840)).toBe("33");
    expect(formatAmount(6000)).toBe("25/2");
    for (const units of [0, 1, 239, 240, 481, 15_840, 4_800_000]) expect(parseAmount(formatAmount(units))).toBe(units);
  });
});
```

`tests/engine/file/text.test.ts`: `readText` accepts `"Heiligabend"`, `{ de: "Heiligabend", en: "Christmas Eve" }`, `{ fr: "Réveillon" }`; reports `invalidEntry` for `{}`, `{ DE: "x" }`, `{ de: 1 }`, `3`; reports `textTooLong` for 201 characters and accepts 200 emoji (`"😀".repeat(200)`, Review Focus 4). `textFor({ de: "A", en: "B" }, "de")` → `"A"`, `textFor({ de: "A", en: "B" }, "fr")` → `"B"`, `textFor({ de: "A" }, "fr")` → `"A"`, `textFor("x", "en")` → `"x"`.

`tests/engine/file/read-envelope.test.ts` (a helper `minimal(overrides)` returns the JSON text of a smallest valid rule set: `schema`, `kind`, `id`, `revision`, `contract` with `region: { country: "DE" }`, `week` with one full-time entry, `rules: []`, plus `sources: []`, `templates: []`, `theme: null`; top-level keys in `overrides` replace or add to these; the helper module also exports that contract as `MINIMAL_CONTRACT`):

```ts
it("reads a minimal rule set with an empty report", () => {
  const result = readFile(minimal());
  expect(result).toMatchObject({ ok: true, report: [] });
  if (result.ok) expect(result.file).toMatchObject({ kind: "ruleSet", revision: 1, contract: { minUnit: 240, references: {} } });
});
it("ignores a leading byte-order mark (Review Focus 1)", () => expect(readFile("﻿" + minimal()).ok).toBe(true));
it.each([
  ["notJson", "{"],
  ["tooLarge", " ".repeat(10_485_761)],
  ["unknownSchema", minimal({ schema: "urlaubsplaner/1" })],
  ["newerSchema", minimal({ schema: "restlos/2" })],
  ["unknownKind", minimal({ kind: "calendar" })],
  ["settingsNotSupported", minimal({ kind: "settings" })],
  ["kindMismatch", minimal({ plan: {} })],
  ["kindMismatch", minimal({ ruleSet: { id: "x", name: "x", revision: 1 } })],
  ["invalidCore", minimal({ id: "" })],
  ["invalidCore", minimal({ revision: 0 })],
  ["invalidCore", minimal({ revision: 1e300 })], // Review Focus 3
])("refuses with %s", (code, text) => expect(readFile(text)).toMatchObject({ ok: false, refusal: { code } }));
it("reports unknown fields and drops them", () =>
  expect(readFile(minimal({ savedAt: "2026-10-17T14:02:00Z" }))).toMatchObject({ ok: true, report: [{ code: "unknownField", path: "savedAt" }] }));
it("reports the old work hours and time zone as unknown fields (0005)", () =>
  expect(readFile(minimal({ contract: { ...MINIMAL_CONTRACT, timeZone: "Europe/Berlin", workHours: { am: "08:00-12:00" } } })))
    .toMatchObject({ ok: true, report: [{ code: "unknownField", path: "contract.timeZone" }, { code: "unknownField", path: "contract.workHours" }] }));
it("never throws, whatever the JSON", () =>
  fc.assert(fc.property(fc.json(), (text) => { readFile(text); })));
```

`tests/engine/file/read-contract.test.ts` — each through `readFile(minimal({ contract: … }))`:
- region: unknown country → `invalidCore` at `contract.region.country`; a rule set without `state` loads; a plan's region is checked in Task 6; an invalid state in a rule set → `invalidEntry` at `contract.region.state`, state dropped.
- **0001:** `options: { assumption: true, renamedOption: false }` with state `BY` → `unknownLocalRule` at `contract.region.options.renamedOption`, the option dropped, `assumption` kept; a non-boolean option value → `invalidEntry`.
- `minUnit`: missing → 240 without a report entry; `"1/4"` → 120; `"3/8"` (480 is not a multiple of 180) and `"0"` → `invalidMinUnit`, 240 used.
- `week`: empty, an entry without `sun`, `"0,5"` (Review Focus 2), a date `"2027-02-29"`, or start dates not strictly increasing → `invalidCore` at `contract.week`; more than 100 entries → refusal `limitExceeded` with `data: { limit: "weekEntries" }`.
- rules: one valid rule of every effect with `label`, `note`, `references` and `origin`; an invalid rule (two effects; `mandatory: "0"`; `match: { type: "fixed", month: 2, day: 30 }`; `match: { type: "range", from: { type: "fixed", month: 1, day: 1 } }`; `validFrom: 1500`) → `invalidEntry` at `contract.rules[i]`, the rule dropped, the others kept; a second rule with the same `id` → `duplicateId`; a citation of an unknown reference key → `unknownReference` and the citation dropped; a rule whose `dayRuleWarnings` returns `neverApplies` → `ruleWarning` with `data: { warning: "neverApplies" }`, the rule kept; 1001 rules → refusal `limitExceeded`.
- references: a valid entry; one with an `http://` URL, one without `checked` → `invalidEntry`, dropped.
- `name` with 201 characters → `textTooLong` at `contract.name`, the name dropped.

- [ ] **Step 2: Run** `npm test -- tests/engine/file tests/engine/weight.test.ts` — FAIL (modules missing).

- [ ] **Step 3: Implement** `limits.ts`, `report.ts`, `text.ts`, `read-match.ts` (all six date rules of `docs/holiday-data-format.md` plus `range` as in `docs/day-rules-format.md`: months 1–12, days valid in a leap year, `nonLeap` only and required for 29 February, Easter offsets as integers within ±366, `days` 1 … `MAX_RANGE_DAYS`, `weekdays` non-empty without duplicates, no range inside a range), `read-contract.ts`, and `read.ts` for the envelope: strip one leading U+FEFF; `utf8Length` > `LIMITS.fileBytes` → `tooLarge` before `JSON.parse`; the top level must be an object; `schema` must match `/^restlos\/(\d+)$/` (1 → read, above 1 → `newerSchema`, anything else → `unknownSchema`); `kind` decides the allowed keys; `id` a non-empty string of at most 200 characters; `revision` a safe integer ≥ 1. This task reads rule sets completely except the items of `sources` and `templates` and the `theme`: until Task 4 replaces them, `sources` and `templates` must be arrays and are read as `[]`, `theme` as `null`. `kind: "plan"` (with `ruleSet` and `plan`) is added in Task 6; until then it is refused as `unknownKind`. Report entries come out in the order of the file (depth first). IDs everywhere (rules, references, sources, templates): non-empty strings of at most 200 characters.

- [ ] **Step 4: Implement** `parseAmount` (the fraction and decimal syntax of `parseWeight` without its upper bound, at most 10,000 days, every digit string checked for length before `Number()`) and `formatAmount` (a reduced fraction like `formatWeight`, e.g. `"33"`, `"25/2"`).

- [ ] **Step 5: Close issue 0001** in this commit: `status: done`, `closed:` the commit date, `branch: file-format`, and a line under Notes: "Decided: the reader drops options the holiday data doesn't define and reports them (`unknownLocalRule`); a table of renamed options waits until a rename happens."

- [ ] **Step 6: Run** `npm run check` — PASS.
- [ ] **Step 7: Commit** — "Read the envelope and the contract of plan files and rule sets".

---

### Task 4: Reading sources, templates and the colour scheme

**Files:**
- Create: `src/engine/file/read-sources.ts`, `src/engine/file/read-templates.ts`
- Modify: `src/engine/file/read.ts`
- Test: `tests/engine/file/read-sources.test.ts`, `tests/engine/file/read-templates.test.ts`

**Interfaces:**
- Consumes: Task 3 (`Report`, `Refused`, `readText`, `readMatch`, `checkKeys`, `LIMITS`, the model types).
- Produces: `readSources(value: unknown, path: string, kind: "plan" | "ruleSet", report: Report): FileSource[]` (entries with a `match` are also run through `dayRuleWarnings`, called with a rule made of the entry's `match`, `validFrom`, `validUntil`, the source's `id` and `requiredAtMost: 0`; its warnings become `ruleWarning` at the entry's path), `readTemplates(value: unknown, path: string, report: Report): Template[]`, `readTheme(value: unknown, path: string, report: Report): Theme`; `readFile` uses them.

Source fields as in the design's "Calendar sources" table. Entry defaults: `holiday` `required` `"0"`, `mandatory`/`needed` `take` `"1"`; `part` optional (the counting model's default `"end"` applies). Other-plan entries: `date` only (a `match` → `invalidEntry`), `from` < `to`, both weights from 0 to 1, `kind` required.

- [ ] **Step 1: Write the failing tests** (`read-sources.test.ts`, through `readFile`):
- one valid source of every type in a plan file, with date entries, a `range` entry with `validFrom`, `validUntil` and `except`, and entry names as plain strings and language maps — loads with an empty report and the expected model (`except` as day numbers, weights as units, `{ date }` for other-plan entries with `from: 0, to: 480`).
- colours: `{ slot: "accent-3" }` and `{ rgb: "#1a7f37" }` valid; `{ slot: "Accent 3" }`, `{ rgb: "green" }`, both keys → `invalidEntry`, source dropped.
- invalid entries are dropped one by one: an entry with both `date` and `match`, a `needed` entry with `take: "0"`, a `holiday` entry with `required: "1,5"`, an other-plan entry with `from: "1/2", to: "1/4"`, an other-plan entry with a `match`, an `except` date `"2027-13-01"` (only that date dropped) — each `invalidEntry` at its path.
- a source with 2001 entries, or one entry with 401 `except` dates → `sourceTooLarge`, the source dropped; 51 sources → refusal `limitExceeded`.
- in a rule set, an `otherPlan` and a `needed` source → `personalSourceInRuleSet` each, dropped; `holiday`, `paidClosure`, `mandatory`, `info` kept.
- a second source with the same `id` → `duplicateId`.
- an `origin` field on a source in a rule set → `unknownField` (rule sets have no `origin`); likewise on rules (extend Task 3's contract reader for this if not already done).

`read-templates.test.ts`: a template with two PNG images loads; `typ` of 524,289 bytes → `templateTooLarge`; an image of 1,048,577 decoded bytes, or three images of 1 MB → `templateTooLarge`; an image `type: "image/gif"` or non-Base64 `data` → `invalidEntry` for that template; 21 templates → refusal `limitExceeded`. `theme`: `null`, `{}` and `{ "accent-1": "#336699" }` kept unchanged; `[]`, `"dark"` and an object nested 33 levels deep → `invalidEntry` at `theme`, `null` used.

- [ ] **Step 2: Run** `npm test -- tests/engine/file` — FAIL.
- [ ] **Step 3: Implement** both readers and wire them into `readFile`. Decoded Base64 size: `length / 4 * 3` minus padding, after checking `/^[A-Za-z0-9+/]*={0,2}$/` and `length % 4 === 0`.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Read calendar sources, templates and the colour scheme".

---

### Task 5: From file to counting model

**Files:**
- Create: `src/engine/file/model.ts`
- Modify: `src/engine/counting/plan.ts` (export `computationWindow`)
- Test: `tests/engine/file/model.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `ruleDays`; `countries`.
- Produces:
  - `export function computationWindow(period: PlanPeriod): { from: DayNumber; to: DayNumber }` in `plan.ts` — the period ± `STRETCH_MARGIN_DAYS`, clamped to `MIN_DAY`/`MAX_DAY`; `computePlan` uses it.
  - `export function expandSources(sources: readonly FileSource[], from: DayNumber, to: DayNumber, max = LIMITS.sourceDays): SourceDay[] | null` — every entry's days between `from` and `to` as `SourceDay`s; `null` as soon as more than `max` days would result (stop expanding there). Order: sources in list order, entries in list order, a `match` entry's days ascending.
  - `export function planInput(file: PlanFile): PlanInput` — throws `RangeError` only for a model that `readFile` would never produce (a plan whose sources exceed the limit).

- [ ] **Step 1: Write the failing tests:**
- a hand-made `PlanFile` (Bavaria, two rules with file-only fields, a holiday source with a ½ entry and `part: "start"`, a `needed` source with the Kita Tuesday `match` (`range` 1 Sep → 31 Aug, `weekdays: ["tue"]`, `validFrom`/`validUntil` 2027, `except` `2027-12-28`), an `otherPlan` source, leave, an override) → `planInput` equals the expected `PlanInput` written out in the test: rules without `label`/`note`/`references`/`origin`; source days with the right types and fields; the Tuesdays from 2027-09-07 to the end of the window without 2027-12-28; no source day outside `computationWindow(period)`.
- `expandSources` with a daily `range` of 366 days in each of 200 entries returns `null` for the default limit and stops early (the test passes `max: 1000` and checks it returns `null` without expanding all entries — measure with a counting stub or time bound of 50 ms).
- `computePlan(planInput(file))` runs on the hand-made file.

- [ ] **Step 2: Run** `npm test -- tests/engine/file/model.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Turn a loaded plan file into counting-model input".

---

### Task 6: Reading the plan

**Files:**
- Create: `src/engine/file/read-plan.ts`
- Modify: `src/engine/file/read.ts`, `src/engine/counting/suggest.ts` (`suggestParts`)
- Test: `tests/engine/file/read-plan.test.ts`, `tests/engine/counting/suggest.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5, `suggestPart`.
- Produces:
  - `export function suggestParts(input: PlanInput, requests: readonly { readonly day: DayNumber; readonly take: Units }[]): (Part | null)[]` in `suggest.ts` — the same answer as `suggestPart` for each request, computed from **one** `computePlan` of `input` without the requested days' leave; `suggestPart` becomes a call of it with one request.
  - `readPlanSection(value: unknown, path: string, contract: FileContract, report: Report): FilePlan` (draft: partial leave without `part` gets `"end"` here; `readFile` then replaces it, see Step 3).
  - `readFile` reads complete plan files: `kind: "plan"` with the keys of a rule set plus `ruleSet` (optional; `{ id, name, revision }`, invalid → `invalidEntry`, dropped) and `plan` (required, else `invalidCore`).

- [ ] **Step 1: Write the failing tests** (`read-plan.test.ts`, through `readFile` with a minimal plan file in Bavaria):
- `range` `{ from: "2027-01", to: "2028-01" }` → `{ from: { year: 2027, month: 1 }, to: { year: 2028, month: 1 } }`; `"2027-1"`, `"2027-13"`, from after to → refusal `invalidCore` at `plan.range`; 37 months → refusal `limitExceeded`; `allowance` `"33"` → 15,840 units, `"99999999999999999999"` and `"-1"` → refusal `invalidCore` (Review Focus 3).
- a plan file without `contract.region.state` → refusal `invalidCore` at `contract.region.state`.
- `days`: `{ date: "2027-05-07", take: "1" }` loads; `take: "0,5"`, `take: "2"`, `date: "2027-02-29"`, `part: "morning"` → `invalidEntry`, dropped (Review Focus 2); the same date twice → `duplicateDate`, the first kept; 2001 entries → refusal `limitExceeded`.
- `overrides` and `notes` the same way; a note with an empty `text` → `invalidEntry`; 2001 characters → `textTooLong`.
- outside the period: a leave day, an override and a note in 2026 → each kept with `outsidePeriod`.
- `minUnit` `"1/2"`, a leave day with `take: "1/4"` and an override with `required: "1/4"` → both kept with `notMultipleOfMinUnit`.
- `ruleSet` `{ id, name, revision }` read; an invalid one → `invalidEntry`, dropped; a plan file without `plan` → refusal `invalidCore` at `plan`.
- partial leave without `part`: Friday 2027-05-07 after Ascension Day with `take: "1/2"` → `part: "start"` and `partSuggested` with `data: { part: "start" }`; a Wednesday between working days → `"end"` with `partSuggested` (`data: { part: "end" }`); 300 such days are suggested from one computation (the whole read takes under 500 ms).
- the source-day limit: 50 sources with 1000 `range` entries of 2 days each in the period (100,000 days) → refusal `limitExceeded` with `data: { limit: "sourceDays" }`.
- performance: a plan file at the limits that is accepted (1000 rules, 50 sources × 2 entries each covering 500 days, 2000 leave days, 2000 notes) is read and computed (`computePlan(planInput(file))`) in under 1000 ms.
- lists come out sorted by date whatever their order in the file.

`suggest.test.ts`: `suggestParts` gives the same results as calling `suggestPart` per request for the existing suggestion cases.

- [ ] **Step 2: Run** `npm test -- tests/engine/file tests/engine/counting/suggest.test.ts` — FAIL.
- [ ] **Step 3: Implement** `read-plan.ts`, `suggestParts`, and in `readFile` for plan files: read the plan section; check `expandSources(...)` over `computationWindow(range)` (refusal on `null`); then, if any leave lacks `part`, build `planInput` of the draft file and replace those parts by `suggestParts(...) ?? "end"`, reporting `partSuggested` for each. Sort `days`, `overrides` and `notes` by date.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Read the plan section of plan files".

---

### Task 7: Writing

**Files:**
- Create: `src/engine/file/write.ts`, `tests/engine/file/arbitraries.ts`
- Modify: `src/engine/weight.ts` (`formatSpan`)
- Test: `tests/engine/file/write.test.ts`, `tests/engine/weight.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `export function writeFile(file: AnyFile): string` — writes the model as it is.
  - `export function prepareSave(file: AnyFile, newId?: string): AnyFile` — `revision + 1`; with `newId`, that `id` and `revision` 1 ("Save as", "Based on the current file").
  - `export function toRuleSet(file: PlanFile, id: string): RuleSetFile` — "Save as rule set": without plan, `ruleSet`, `origin` and the personal sources, revision 1.
  - `export function formatSpan(from: Units, to: Units): [string, string]` in `weight.ts`.

Canonical output: `JSON.stringify(value, null, 2) + "\n"` of objects built in this key order (absent optional keys omitted; `references` omitted when empty; the lists `rules`, `sources`, `entries`, `templates`, `days`, `overrides`, `notes` always written):

| Object | Key order |
| --- | --- |
| file | `schema` (`"restlos/1"`), `kind`, `id`, `revision`, `ruleSet`, `contract`, `sources`, `templates`, `theme`, `plan` |
| contract | `name`, `description`, `references`, `region`, `minUnit`, `week`, `rules` |
| reference | `title`, `version`, `url`, `checked` |
| region | `country`, `state`, `options` (keys sorted) |
| week entry | `from`, `required` (`mon` … `sun`) |
| rule | `id`, `origin`, `label`, `match`, `validFrom`, `validUntil`, the effect, `part`, `note`, `references` |
| match | `type`, then the fields in the order of `docs/holiday-data-format.md` and `docs/day-rules-format.md` |
| source | `id`, `origin`, `name`, `type`, `color`, `visible`, `plan`, `entries` |
| entry | `date` or `match`, `validFrom`, `validUntil`, `except`, `name`, `required` / `take` / `from`, `to`, `part`, `kind` |
| template | `id`, `origin`, `name`, `api`, `typst`, `typ`, `images` (`name`, `type`, `data`) |
| plan | `range` (`from`, `to`), `allowance`, `days` (`date`, `take`, `part`), `overrides` (`date`, `required`, `part`), `notes` (`date`, `text`) |

Weights with `formatWeight`, the allowance with `formatAmount`, other-plan `from`/`to` with `formatSpan`, dates with `isoFromDay`, months as `YYYY-MM`. Source entries: date entries by date (other-plan entries by date, then `from`), then match entries in their list order — the reader sorts them the same way, so the model is always canonical. A `RuleSetFile` is written without `origin` anywhere and without `otherPlan` and `needed` sources, whatever the model contains.

- [ ] **Step 1: Write the failing tests.**

```ts
describe("formatSpan", () => {
  it.each([[120, 240, ["1/4", "2/4"]], [0, 240, ["0", "1/2"]], [240, 480, ["1/2", "1"]], [0, 480, ["0", "1"]], [96, 160, ["3/15", "5/15"]], [90, 120, ["3/16", "4/16"]]])(
    "writes %i–%i as %j", (from, to, text) => expect(formatSpan(from, to)).toEqual(text));
  it("round-trips through parseWeight", () => {
    for (let from = 0; from < 480; from += 15) for (let to = from + 15; to <= 480; to += 15) {
      const [a, b] = formatSpan(from, to);
      expect([parseWeight(a), parseWeight(b)]).toEqual([from, to]);
    }
  });
});
```

`write.test.ts`:
- a fixed small plan file model → `writeFile` equals an expected text written out in the test (key order, indentation, sorting, `"restlos/1"`, fractions, final line break, no byte-order mark).
- `prepareSave` raises the revision; with a new id resets it to 1; `writeFile` itself never changes `revision`.
- `toRuleSet` of a plan with `origin` everywhere, an `otherPlan` and a `needed` source → no `plan`, `ruleSet`, `origin`, personal sources; `readFile(writeFile(...))` gives an empty report.
- property (fast-check, `arbitraries.ts`): for random valid models — texts as strings and language maps, rules of every match type and effect, sources of every type with date and match entries, templates with images, plan lists with weights as random multiples of 1/32 — `readFile(writeFile(x))` is `{ ok: true, file: x, report: [] }`. The arbitraries produce canonical models (lists sorted as the writer sorts, `minUnit` 15 so every multiple of 1/32 is allowed, only valid dates, no rule that triggers a `dayRuleWarnings` warning).

- [ ] **Step 2: Run** `npm test -- tests/engine/file/write.test.ts tests/engine/weight.test.ts` — FAIL.
- [ ] **Step 3: Implement** `formatSpan` (smallest shared denominator of both reduced fractions; 0 and 480 written `"0"` and `"1"`) and `write.ts`.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Write plan files and rule sets canonically".

---

### Task 8: Importing "Leave from another plan"

**Files:**
- Create: `src/engine/file/other-plan.ts`
- Modify: `issues/0006-other-plan-sources-include-mandatory-leave.md`
- Test: `tests/engine/file/other-plan.test.ts`

**Interfaces:**
- Consumes: `readFile`, `planInput`, `computePlan`, `DayLeave.charged`.
- Produces:

```ts
export type ImportNotice =
  | { readonly code: "differentPlan"; readonly previousId: string }
  | { readonly code: "olderRevision"; readonly previousRevision: number }
  | { readonly code: "outdatedCopyOfCurrent"; readonly copyRevision: number };
export type OtherPlanImport =
  | { readonly ok: true; readonly plan: OtherPlanRef; readonly entries: Extract<FileSource, { type: "otherPlan" }>["entries"];
      readonly notices: readonly ImportNotice[]; readonly report: readonly ReportEntry[] }
  | { readonly ok: false; readonly refusal: Refusal | { readonly code: "notAPlan" } };
export function importOtherPlan(text: string, current: { readonly id: string; readonly revision: number }, previous?: OtherPlanRef): OtherPlanImport;
```

`entries`: for every day of the other plan's period with `evaluation.cost > 0`, one entry per charged span (`date`, `from`, `to`, `kind`), sorted. `plan`: its `id`, `contract.name` (or its `id` when it has no name) and `revision`. Notices: `previous` with another `id` → `differentPlan`; same `id` but a lower `revision` → `olderRevision`; the imported plan holds an `otherPlan` source whose `plan.id` is `current.id` with a `revision` below `current.revision` → `outdatedCopyOfCurrent`.

- [ ] **Step 1: Write the failing tests** (plans built as models and written with `writeFile`):
- a plan with own whole days, own ½ `start`, mandatory ½ `end` (the maintainer's example) and a ½ day rule → the expected entries, including `[{ from: 0, to: 240, kind: "leave" }, { from: 240, to: 480, kind: "mandatory" }]` on the example day; days outside the period and days with cost 0 have no entry.
- **0006:** plan 2027 (2027-01 to 2028-01) and plan 2028 (2028-01 to 2029-01) with the same closure rule (27 Dec to 4 Jan, Mon–Fri, `mandatory 1`); 2028 imports 2027 → 3 and 4 January 2028 cost 0 in 2028 and 1 each in 2027.
- the quarter case from the design (shared day, mandatory ½ `start`; plan Y has own ¼ `start`; X imports Y, Y imports X): X charges only `[120, 240)`, its entry is `{ from: "1/4", to: "2/4" }` when written, Y has no `leaveTakenInOtherPlan` for that day, and the day's costs in X and Y add up to ½ day.
- property (fast-check, multiples of 1/32): one shared working day, a mandatory rule (random take and part), own leave in A at the start and in B at the end that don't overlap; A0 = A without sources; B1 = B importing A0; A2 = A importing B1 → `cost(A2) + cost(B1)` equals the length of the union of A's own leave, B's own leave and the mandatory leave on that day.
- notices: `differentPlan`, `olderRevision`, `outdatedCopyOfCurrent` (B1 above contains A0 with a lower revision than A's current); a rule set as input → `{ ok: false, refusal: { code: "notAPlan" } }`; an unreadable file → its refusal.

- [ ] **Step 2: Run** `npm test -- tests/engine/file/other-plan.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Close issue 0006**: `status: done`, `closed:` the commit date, `branch: file-format`; under Notes: "The `.urlaub.json` part is done (charged spans, design 2026-10-18-file-format); the `.ics` criterion moved to issue 0010. Mutual references charge a shared day once because each plan stores what the other actually charged."
- [ ] **Step 5: Run** `npm run check` — PASS.
- [ ] **Step 6: Commit** — "Import leave from another plan as charged spans".

---

### Task 9: `npm run plan`

**Files:**
- Create: `scripts/ts-hooks.ts`, `scripts/plan.ts`, `scripts/plan-summary.ts`
- Modify: `package.json` (script), `tsconfig.json` (`"include": ["src", "tests", "scripts"]`)
- Test: `tests/scripts/plan-summary.test.ts`

**Interfaces:**
- Consumes: `readFile`, `planInput`, `computePlan`, `formatAmount`, `textFor`, `isoFromDay`.
- Produces: `"plan": "node --import ./scripts/ts-hooks.ts scripts/plan.ts"` in `package.json`; `export function formatSummary(result: ReadResult): string` in `scripts/plan-summary.ts`.

`ts-hooks.ts` registers synchronous hooks with `registerHooks` from `node:module` (checked on Node 24.21 during planning): `resolve` retries a relative specifier without extension as `specifier + ".ts"`; `load` passes `importAttributes: { type: "json" }` for URLs ending in `.json`. `plan.ts` reads the path from `process.argv[2]`, refuses files above `LIMITS.fileBytes` by `statSync` before reading, prints `formatSummary(readFile(text))` and exits with 1 on a refusal or a missing argument.

Output (English; amounts of days as mixed numbers such as `10 1/2`, positions within a day as `@` plus a fraction):

```text
Beispiel GmbH (ohne Tarifvertrag) — plan 2027-01 to 2027-12, revision 4
Report: none
Allowance 30, planned 22, remaining 8
2027: 22
Stretches:
  2026-12-31@1/2 – 2027-01-10: 10 1/2 days off, cost 2
  …
Problems: none
```

For a rule set: the name, the report, then one line per rule (`id`, the effect and its value, the label in English). For a refusal: `Refused: <code> at <path>`.

- [ ] **Step 1: Write the failing test**: `formatSummary` of a small plan file read from a text in the test equals an expected text (one stretch with a partial start, one problem, one report entry, a rule set, a refusal).
- [ ] **Step 2: Run** `npm test -- tests/scripts` — FAIL.
- [ ] **Step 3: Implement**, then try `npm run plan -- <a small file in $TMPDIR>` by hand.
- [ ] **Step 4: Run** `npm run check` — PASS (ESLint and `tsc` now also cover `scripts/`).
- [ ] **Step 5: Commit** — "Add npm run plan to print what the engine computes for a file".

---

### Task 10: Example rule sets

**Files:**
- Create: `examples/rules/oeffentlicher-dienst.regeln.json`, `metall-elektro-bw.regeln.json`, `banken.regeln.json`, `versicherungen.regeln.json`, `bauhauptgewerbe.regeln.json`, `karneval-rheinland.regeln.json`, `beispiel-gmbh.regeln.json`; `LICENSES/MIT-0.txt` (`reuse download MIT-0`; if the sandbox blocks the download, report it — don't write the text from memory)
- Test: `tests/examples/rule-sets.test.ts`, `tests/examples/helpers.ts`

**Interfaces:**
- Consumes: `readFile`, `planInput`, `computePlan`, `writeFile`.
- Produces: the seven files (read by Task 11 for Beispiel GmbH); `tests/examples/helpers.ts` with `readExample(path): AnyFile` (asserts an empty report) and `planFrom(ruleSet, { state, options?, week?, range, allowance, days })` building a `PlanFile` from a rule set.

Content per file: the design's "Example files" table and appendix. Every file: a fixed UUID v4 as `id` (write it once, never regenerate), `revision` 1, `contract.name` with the version year (e.g. `"Versicherungen (MTV 2026)"`), `description` in `de` and `en` naming who it is for, what the model can't express (from the appendix notes) and that the user must check it against their own contract and gets no guarantee; `references` with `title` (with the paragraph), `version`, `url`, `checked`; every rule with `label` (`de`, `en`), `note` where the appendix names one, and `references`. **Open every URL before citing it** (WebFetch); `checked` is the day it was opened; where the appendix says "prefer"/"open … before citing", follow it; a link that can't be opened is replaced by an official alternative that can, or the task reports it as a concern. Write the files with `writeFile` from a model (a throwaway script in `$TMPDIR`) so they are canonical; the tests check `writeFile(readExample(p)) === readFileSync(p)`.

- [ ] **Step 1: Write the failing tests** (`rule-sets.test.ts`):
- every `examples/rules/*.regeln.json` reads with an empty report and is canonical.
- meta: `description` has `de` and `en`; every reference has all four fields; `contract.name` contains a four-digit year; every rule cites at least one reference; no rule has `origin`.
- hand-worked plans (stretch format as in `stretches.test.ts`: `start@offset end@offset cost/daysOff listed`), each with its reasoning as a comment:

| Rule set, region | Plan | Leave | Expected |
| --- | --- | --- | --- |
| Öffentlicher Dienst, NW | 2027-01 to 2027-12 | 27–30 Dec 2027 | 24 and 31 Dec (Fridays) required 0; stretch `2027-12-24@0 2028-01-02@480 1920/4800 listed`; planned 1920 |
| Öffentlicher Dienst, NW | 2028-01 to 2028-12 | 27–29 Dec 2028 | 24 and 31 Dec are Sundays, the rules change nothing; stretch `2028-12-23@0 2029-01-01@480 1440/4800 listed` |
| Metall-Elektro BW | 2027-01 to 2027-12 | 27–30 Dec 2027 | 24 and 31 Dec required 240, free at the end; stretch `2027-12-24@240 2027-12-30@480 1920/3120 listed`; the afternoon of 31 Dec to 2 Jan is an unlisted stretch with cost 0 |
| Metall-Elektro BW, week Mon–Sat `1` | 2028-01 to 2028-12 | none | Sat 23 Dec 2028 and Sat 30 Dec 2028 required 240 (`freePart` `"end"`); Sun 24 and Sun 31 Dec 0; in 2027 Thu 23 Dec stays 480 |
| Banken, HE | 2027-01 to 2027-12 | 27–30 Dec 2027 | as Öffentlicher Dienst 2027 |
| Versicherungen, HH | 2027-01 to 2027-12 | 30 Mar–2 Apr 2027 | stretch `2027-03-26@0 2027-04-04@480 1920/4800 listed`; Sat 27 Mar decided by the work week (0) |
| Versicherungen, HH, week Mon–Sat `1` | 2027-01 to 2027-12 | 30 Mar–3 Apr 2027 | Sat 27 Mar and Sat 15 May required 0 by the rules; stretch `2027-03-26@0 2027-04-04@480 2400/4800 listed` |
| Bauhauptgewerbe, NI | 2027-01 to 2027-12 | 27–30 Dec 2027 | as Öffentlicher Dienst 2027 |
| Karneval Rheinland, NW | 2027-01 to 2027-12 | Fri 5 Feb 2027 | Thu 4 Feb required 240 free at the end, Mon 8 Feb 0, Tue 9 Feb 480; stretch `2027-02-04@240 2027-02-08@480 480/2160 listed` |
| Beispiel GmbH | 2027-01 to 2027-12 | none | 27–30 Dec mandatory: planned 1920; stretch `2027-12-24@240 2027-12-30@480 1920/3120 listed` |
| Beispiel GmbH | 2028-01 to 2028-12 | none | closure Wed 27–Fri 29 Dec 2028 (Sat 30 excluded): planned 1440; stretch `2028-12-23@0 2029-01-01@480 1440/4800 listed` |

- [ ] **Step 2: Run** `npm test -- tests/examples` — FAIL (files missing).
- [ ] **Step 3: Research and write** the seven files as above; add `LICENSES/MIT-0.txt`.
- [ ] **Step 4: Run** `npm test -- tests/examples` — PASS. If an expected value disagrees, recheck the reasoning against the calendar and the rules before touching either; report any value you changed and why.
- [ ] **Step 5: Run** `npm run check` — PASS (`reuse lint` now needs `MIT-0.txt`).
- [ ] **Step 6: Commit** — "Add seven example rule sets with their basis".

---

### Task 11: Example plan files

**Files:**
- Create: `examples/plans/beispiel-gmbh-2027.urlaub.json`, `examples/plans/muster-ag-2027.urlaub.json`, `examples/plans/muster-ag-2028.urlaub.json`
- Test: `tests/examples/plans.test.ts`

**Interfaces:**
- Consumes: Task 10 (`beispiel-gmbh.regeln.json`, helpers), `importOtherPlan`, `writeFile`, `toRuleSet`.
- Produces: the three files.

**Beispiel GmbH 2027** (from the rule set: `ruleSet` reference and `origin` on its rules as the app would set them; period 2027-01 to 2027-12; allowance `"30"`): info source "Projektphase" with a `range` 2027-09-06 to 2027-10-29; an `otherPlan` source "Urlaub 2026" (`plan` a fixed fictional id, name `"Beispiel GmbH (ohne Tarifvertrag)"`, revision 9) with whole days 2027-01-04 and 2027-01-05 (`from "0"`, `to "1"`, `kind "leave"`); own leave 7–8 Jan, 30 Mar–2 Apr, 7 May, 28 May, 2–13 Aug 2027; two notes (`"Brückentag"` on 7 May and 28 May). Expected (Bavaria, Assumption on):

- planned 10,560 (22 days), remaining 3840 (8 days), 2027: 10,560;
- listed stretches, in order: `2026-12-31@240 2027-01-10@480 960/5040` (the half New Year's Eve 2026 joins 1 Jan, the other plan's 4–5 Jan, Epiphany 6 Jan and own 7–8 Jan; only own leave costs), `2027-03-26@0 2027-04-04@480 1920/4800`, `2027-05-06@0 2027-05-09@480 480/1920`, `2027-05-27@0 2027-05-30@480 480/1920`, `2027-07-31@0 2027-08-15@480 4800/7680`, `2027-12-24@240 2027-12-30@480 1920/3120`;
- no problems; the file reads like a realistic plan (the help will show it as "View example").

**Muster AG 2027 and 2028** ("Muster AG (Testbeispiel)", fictional, no rule set file; region Bavaria with `augsburg: true` and `assumption` as the official list gives for the city of Augsburg — check it in `src/data/holidays/de.json` and its source): work week full time, from 2027-09-01 Tuesday `"1/2"`; rules: 24 Dec `mandatory "1/2"` `part "end"`, 31 Dec `requiredAtMost "1/2"` `part "end"`, closure `range` 27 Dec to 4 Jan with `weekdays` Mon–Fri `mandatory "1"`, a working Saturday 2027-11-20 `requiredExactly "1"` (`once`); an override 2027-11-11 `required "1/2"` `part "end"`; notes; sources: `holiday` "Betriebsfeier" 2027-07-02 `required "1/2"` `part "end"`, `paidClosure` "Inventur" 2027-10-15, `info` "Messe" (a range), `needed` "Kita" with the Tuesday `match` (1 Sep to 31 Aug, `validFrom`/`validUntil` 2027, `except` 2027-12-28), the closure days as a range 2027-08-02 to 2027-08-13, and the single date 2027-11-12 "Pädagogischer Tag" left uncovered. 2027 plan: period 2027-01 to 2028-01, allowance `"30"`; own ½ `start` on Fri 24 Dec 2027, own leave on 5 and 7 Jan 2028, own leave covering the Kita summer closure. 2028 plan: period 2028-01 to 2029-01, allowance `"30"`, with the 2027 plan as "Leave from another plan" exactly as `importOtherPlan` produces it (generate, don't hand-write), plus a few own days. Fixed expectations:

- 2027, Fri 24 Dec 2027: whole day free, cost 480 (the maintainer's example);
- 2027, the stretch `2027-12-24@0 2028-01-09@480 4080/8160 listed` (24 Dec 1, 27 Dec 1, Tue 28 Dec ½ because of the Tuesday work week, 29–30 Dec 1 each, 31 Dec ½, 3 Jan 1, Tue 4 Jan ½, own 5 and 7 Jan 1 each; Epiphany 6 Jan);
- 2027, `paidClosure` 15 Oct: the stretch `2027-10-15@0 2027-10-17@480 0/1440 listed`;
- 2027, problems include `uncoveredNeed` on 2027-11-12 and no `uncoveredNeed` on any Tuesday from September;
- 2028, 3 and 4 January 2028 cost 0 (0006), and the turn-of-the-year stretch is not listed (no cost in 2028);
- all other values hand-worked with their reasoning in the test.

- [ ] **Step 1: Write the failing tests** (`plans.test.ts`): the three files read with an empty report and are canonical; the expectations above.
- [ ] **Step 2: Run** `npm test -- tests/examples/plans.test.ts` — FAIL.
- [ ] **Step 3: Write the files** with `writeFile` from models (throwaway script in `$TMPDIR`; the 2028 source from `importOtherPlan(writeFile(plan2027), …)`); then `npm run plan -- examples/plans/beispiel-gmbh-2027.urlaub.json` and compare with the expectations by eye.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit** — "Add the example plan files Beispiel GmbH and Muster AG".

---

### Task 12: Documentation and spec

**Files:**
- Create: `docs/file-format.md`
- Modify: `docs/day-rules-format.md`, `docs/SPEC.md`, `issues/0005-work-hours-as-named-fields.md`

- [ ] **Step 1: Write `docs/file-format.md`** — a reference for people who write plan files and rule sets by hand, in the style of `docs/day-rules-format.md`: the three kinds and the schema with its version policy; every object with its keys in the writer's order (Task 7's table) and their meaning; texts and language maps; references; sources and entries per type; other-plan spans; the plan lists; what is refused and what is dropped or kept with a report (codes and examples); the limits table; a short complete example (use `examples/rules/beispiel-gmbh.regeln.json`).
- [ ] **Step 2: Update `docs/day-rules-format.md`**: `note`, `references` (link to `docs/file-format.md`), `label` and `note` as plain strings or language maps; `origin` exists only in plan files.
- [ ] **Step 3: Apply the spec changes** listed in the design's "Documentation updates in this branch" to `docs/SPEC.md` (sketch replaced by the design's sketch; every listed section). Keep the spec's style; don't copy the design's reasoning, state the rules.
- [ ] **Step 4: Close issue 0005** as `wontfix`, `closed:` the commit date, `branch: file-format`; under Notes: "Decided on 2026-10-18: the contract has no working hours; partial days go into `.ics` as all-day events. A user-defined conversion of partial days (import and export) is noted in issue 0010."
- [ ] **Step 5: Run** `npm run check` — PASS.
- [ ] **Step 6: Commit** — "Document the file format and update the spec".
