<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Project Setup and Holiday Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A minimal TypeScript toolchain plus a pure, country-neutral holiday engine with German data, verified against date-holidays and python-holidays for all 16 federal states, 2000–2100.

**Architecture:** `src/engine/` holds pure functions on integer day numbers (days since 1970-01-01): date arithmetic, Easter, weight parsing, rule evaluation, holiday lookup and data validation. Country data lives as JSON in `src/data/holidays/` behind a static index. Tests live in `tests/`, mirroring `src/`; the reference-model comparisons share one diff helper and one documented list of known differences.

**Tech Stack:** Node 24, npm ≥ 11.10, TypeScript 6.0.3, Vitest, fast-check, ESLint 10 with `@eslint/js` and `typescript-eslint`, date-holidays (tests only), Python `holidays` 0.97 from the Nix dev shell (reference generator only).

**Spec:** `docs/superpowers/specs/2026-10-17-holiday-engine-design.md` (design for this branch). `docs/SPEC.md` is the authoritative project specification. Executors read both, plus `AGENTS.md` and `.claude/skills/holiday-data/SKILL.md`.

## Global Constraints

- Branch `holiday-engine`; commit with `git -c commit.gpgsign=false commit`; never push, tag or sign. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Allowed packages, all dev dependencies, nothing else (including no `@types/node`): `typescript`, `vitest`, `fast-check`, `eslint`, `@eslint/js`, `typescript-eslint`, `date-holidays`. If something seems to need another package, stop and ask.
- `.npmrc` stays unchanged (`ignore-scripts=true`, `min-release-age=14`, `save-exact=true`). Run tools via npm scripts, never `npx`.
- "the engine uses integer day numbers, never JavaScript `Date`" (`AGENTS.md`); `Date` may appear in tests only.
- "1 day = 480 integer units. No floats for day fractions" (`AGENTS.md`).
- Weights: "readers accept fraction strings (`"1/2"`) and decimal strings with a decimal point (`"0.5"`) … Values that cannot be represented exactly in 1/480 are rejected" (`docs/SPEC.md`).
- Code, identifiers, data keys, comments in English; domain terms from the glossary in `docs/SPEC.md`.
- REUSE: every new file that allows comments starts with
  `SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors` and `SPDX-License-Identifier: EUPL-1.2` (Markdown: `CC-BY-4.0`, in an HTML comment). JSON files get a `REUSE.toml` entry unless an existing one covers them (`package.json`, `tsconfig*.json`, `src/data/**` are covered).
- Holiday data: every rule cites an official legal source with the date it was checked; no special-case code where a rule type suffices; a missing rule type means stop and ask (holiday-data skill).
- Work inside the Nix dev shell. After edits, check the TypeScript language server diagnostics and fix reported errors.
- A task is done when `npm run check` passes (from Task 1 on).

## Review Focus

1. **A plan period crossing a year boundary** (e.g. Jan 2027–Jan 2028): the result must equal the per-year results joined, with no gaps and no duplicates. Test in Task 6.
2. **Ranges at the supported year limits** (January 1583, December 9999): the internal ±1-year margin must be clamped, not throw. Test in Task 6.
3. **A typo in a data key** (`"validfrom"`): silently ignoring it would make a holiday apply in every year; the validator must report unknown keys. Test in Task 7.
4. **A German decimal comma or stray whitespace in a weight** (`"0,5"`, `" 1"`): must be rejected as `syntax`, never read as 0, 5 or 1. Test in Task 4.
5. **Day of Repentance and Prayer when 23 Nov is itself a Wednesday** (2016, 2022, 2033): the holiday is 16 Nov, not 23 Nov. Test in Task 8.

---

### Task 1: Toolchain, lint rule and documentation of the setup

**Files:**
- Create: `package.json`, `package-lock.json` (generated), `tsconfig.json`, `eslint.config.js`, `tests/lint/no-date-in-engine.test.ts`
- Modify: `AGENTS.md` (section "Environment", line starting "Commands (to be completed during setup)"), `docs/SPEC.md` (table under "### Dependencies", after the `eslint, eslint-plugin-svelte, svelte-check` row), `docs/ai-tooling.md` (section "7. Open checks", bullet "Sandbox with the toolchain")

**Interfaces:**
- Produces: npm scripts `test`, `lint`, `typecheck`, `check`; ESLint rule `no-restricted-globals` for `Date` on `src/engine/**/*.ts`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "restlos-urlaubsplaner",
  "version": "0.0.0",
  "private": true,
  "description": "Offline vacation planner for bridge days and holidays",
  "license": "EUPL-1.2",
  "type": "module",
  "engines": { "node": ">=24", "npm": ">=11.10" },
  "scripts": {
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc",
    "check": "npm run lint && npm run typecheck && npm test && reuse lint"
  }
}
```

- [ ] **Step 2: Install the dev dependencies**

Run: `npm install --save-dev typescript@6.0.3 vitest fast-check eslint @eslint/js typescript-eslint date-holidays`
Expected: `package-lock.json` created; `devDependencies` lists all seven with exact versions; no peer-dependency errors (`typescript-eslint` requires `typescript` < 6.1.0, hence the pin). `min-release-age` makes npm pick the newest versions at least 14 days old; that is intended.

- [ ] **Step 3: Review the lockfile**

Run: `node -e 'const l=require("./package-lock.json");const p=Object.entries(l.packages).filter(([k])=>k);console.log(p.length,"packages");for(const[k,v]of p)if(v.hasInstallScript)console.log("install script:",k)'`
Expected: a package count and the list of packages with install scripts (they don't run, because of `ignore-scripts`). Put both in the task report for the maintainer.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  },
  "include": ["src", "tests"]
}
```

No DOM library: the engine has no DOM; the UI branch adds it later.

- [ ] **Step 5: Write the failing lint test `tests/lint/no-date-in-engine.test.ts`**

```ts
import { ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

async function configFor(path: string): Promise<Linter.Config> {
  return (await new ESLint().calculateConfigForFile(path)) as Linter.Config;
}

describe("no Date in the engine", () => {
  it("reports the Date global in src/engine", async () => {
    const rule = (await configFor("src/engine/example.ts")).rules?.["no-restricted-globals"];
    expect(rule).toBeDefined();
    const messages = new Linter().verify("export const now = new Date();", [
      { rules: { "no-restricted-globals": rule! } },
    ]);
    expect(messages.map((m) => m.ruleId)).toEqual(["no-restricted-globals"]);
  });

  it("allows Date outside the engine", async () => {
    expect((await configFor("tests/example.test.ts")).rules?.["no-restricted-globals"]).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- tests/lint`
Expected: FAIL (no ESLint config found, or `rule` undefined).

- [ ] **Step 7: Write `eslint.config.js`**

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["coverage/", "dist/"] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine counts calendar days as integer day numbers (docs/SPEC.md, Date arithmetic)." },
      ],
    },
  },
);
```

Plus the SPDX header as `//` comments.

- [ ] **Step 8: Run the test and the full check**

Run: `npm test -- tests/lint` → PASS. Then `npm run check` → lint, typecheck, test and `reuse lint` all pass.

- [ ] **Step 9: Update the documentation**

- `AGENTS.md`: replace the line `- Commands (to be completed during setup): …` with

  ```markdown
  - Commands: `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run check` (all of these plus `reuse lint`). `npm run build` and `npm run test:e2e` follow with the UI.
  ```
- `docs/SPEC.md`, dependency table, two rows after the eslint row:
  `| typescript-eslint | ESLint parser and rules for TypeScript | no | needed to lint TypeScript; umbrella for parser, plugin, utils and typescript-estree from the same project |`
  `| @eslint/js | ESLint's recommended rule set | no | from the ESLint team, no dependencies; no longer installed with eslint since ESLint 10 |`
- `docs/ai-tooling.md`, "Sandbox with the toolchain": state that `npm install`/`npm ci` against the registry works inside the sandbox (with today's date) if it did in Step 2; `npm run test:e2e` stays open.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js tests/lint AGENTS.md docs/SPEC.md docs/ai-tooling.md
git -c commit.gpgsign=false commit -m "Set up TypeScript, Vitest and ESLint for the engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Day numbers

**Files:**
- Create: `src/engine/days.ts`
- Test: `tests/engine/days.test.ts`

**Interfaces:**
- Produces (`src/engine/days.ts`):
  - `type DayNumber = number` — days since 1970-01-01 (day 0, a Thursday)
  - `type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`
  - `const WEEKDAYS: readonly Weekday[]` — Monday first
  - `const MIN_YEAR = 1583`, `const MAX_YEAR = 9999`
  - `interface Ymd { year: number; month: number; day: number }` — month 1–12
  - `isLeapYear(year: number): boolean`
  - `daysInMonth(year: number, month: number): number`
  - `dayFromYmd(year: number, month: number, day: number): DayNumber`
  - `ymdFromDay(day: DayNumber): Ymd`
  - `dayFromIso(iso: string): DayNumber` — strict `YYYY-MM-DD`
  - `isoFromDay(day: DayNumber): string`
  - `weekdayOf(day: DayNumber): Weekday`
  - Invalid input (non-integer, out of range, impossible date, malformed string) throws `RangeError`.

- [ ] **Step 1: Write the failing tests**

```ts
it("converts known dates", () => {
  expect(dayFromYmd(1970, 1, 1)).toBe(0);
  expect(dayFromYmd(2000, 1, 1)).toBe(10957);
  expect(dayFromYmd(2027, 5, 7)).toBe(20945);
  expect(dayFromYmd(1583, 1, 1)).toBe(-141349);
  expect(dayFromYmd(9999, 12, 31)).toBe(2932896);
  expect(isoFromDay(20945)).toBe("2027-05-07");
  expect(ymdFromDay(-141349)).toEqual({ year: 1583, month: 1, day: 1 });
});
it("knows leap years and month lengths", () => {
  expect([2000, 2024, 1900, 2100, 2027].map(isLeapYear)).toEqual([true, true, false, false, false]);
  expect([daysInMonth(2024, 2), daysInMonth(2100, 2), daysInMonth(2027, 4)]).toEqual([29, 28, 30]);
});
it("knows weekdays", () => {
  expect(weekdayOf(0)).toBe("thu");
  expect(weekdayOf(dayFromIso("2000-01-01"))).toBe("sat");
  expect(weekdayOf(dayFromIso("2027-05-07"))).toBe("fri");
  expect(weekdayOf(dayFromIso("2100-12-31"))).toBe("fri");
});
it.each([[2027, 2, 29], [2027, 13, 1], [2027, 0, 1], [2027, 4, 31], [1582, 12, 31], [10000, 1, 1], [2027, 1, 1.5]])(
  "rejects %i-%i-%i", (y, m, d) => expect(() => dayFromYmd(y, m, d)).toThrow(RangeError));
it.each(["2027-2-01", "2027-02-30", "20270201", " 2027-02-01", "2027-02-01T00:00", ""])(
  "rejects ISO %j", (s) => expect(() => dayFromIso(s)).toThrow(RangeError));
it("rejects day numbers outside the range", () => {
  expect(() => ymdFromDay(2932897)).toThrow(RangeError);
  expect(() => ymdFromDay(0.5)).toThrow(RangeError);
});
```

Property tests with fast-check over `fc.integer({ min: -141349, max: 2932896 })`:
- `dayFromYmd(y, m, d)` of `ymdFromDay(n)` is `n`; `dayFromIso(isoFromDay(n))` is `n`;
- `weekdayOf(n + 7) === weekdayOf(n)` (for `n + 7` in range);
- cross-check against the platform (allowed in tests): `Date.UTC(y, m - 1, d) / 86_400_000 === n`, and `WEEKDAYS[(new Date(n * 86_400_000).getUTCDay() + 6) % 7] === weekdayOf(n)`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/days.test.ts`
Expected: FAIL, cannot resolve `src/engine/days`.

- [ ] **Step 3: Implement `src/engine/days.ts`**

Use Howard Hinnant's `days_from_civil` / `civil_from_days` algorithms (integer-only, proleptic Gregorian); `weekdayOf` from `((n % 7) + 7 + 3) % 7` indexing `WEEKDAYS` (day 0 is Thursday, index 3).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/days.test.ts` → PASS; then `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/days.ts tests/engine/days.test.ts
git -c commit.gpgsign=false commit -m "Add integer day numbers for the engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Western and Orthodox Easter

**Files:**
- Create: `src/engine/easter.ts`
- Test: `tests/engine/easter.test.ts`

**Interfaces:**
- Consumes: `DayNumber`, `dayFromYmd`, `weekdayOf`, `MIN_YEAR`, `MAX_YEAR` from Task 2.
- Produces: `westernEaster(year: number): DayNumber`, `orthodoxEaster(year: number): DayNumber` (Gregorian day number of Orthodox Easter Sunday). Both throw `RangeError` outside `MIN_YEAR`–`MAX_YEAR`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  [1583, "1583-04-10"], [1818, "1818-03-22"], [2000, "2000-04-23"], [2008, "2008-03-23"], [2011, "2011-04-24"],
  [2019, "2019-04-21"], [2027, "2027-03-28"], [2038, "2038-04-25"], [2100, "2100-03-28"], [2285, "2285-03-22"], [9999, "9999-03-28"],
])("Western Easter %i is %s", (y, iso) => expect(isoFromDay(westernEaster(y))).toBe(iso));
it.each([[2000, "2000-04-30"], [2023, "2023-04-16"], [2024, "2024-05-05"], [2027, "2027-05-02"], [2100, "2100-05-02"]])(
  "Orthodox Easter %i is %s", (y, iso) => expect(isoFromDay(orthodoxEaster(y))).toBe(iso));
it("rejects years outside the range", () => {
  expect(() => westernEaster(1582)).toThrow(RangeError);
  expect(() => orthodoxEaster(10000)).toThrow(RangeError);
});
```

Property tests over `fc.integer({ min: 1583, max: 9999 })`: both are Sundays; Western Easter lies between 22 Mar and 25 Apr of that year; `orthodoxEaster(y) >= westernEaster(y)`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/easter.test.ts`
Expected: FAIL, cannot resolve `src/engine/easter`.

- [ ] **Step 3: Implement `src/engine/easter.ts`**

Western: Meeus/Jones/Butcher Gregorian computus. Orthodox: Meeus Julian computus giving a Julian-calendar date, converted with a module-private Julian-calendar variant of `days_from_civil` (no century rule) shifted to the 1970 epoch. No lookup tables.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/easter.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/easter.ts tests/engine/easter.test.ts
git -c commit.gpgsign=false commit -m "Add Western and Orthodox Easter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Weight parsing

**Files:**
- Create: `src/engine/weight.ts`
- Test: `tests/engine/weight.test.ts`

**Interfaces:**
- Produces (`src/engine/weight.ts`):
  - `const UNITS_PER_DAY = 480`
  - `type Units = number` — integer multiples of 1/480 day
  - `type WeightErrorCode = "syntax" | "range" | "inexact"`
  - `class WeightError extends Error { readonly code: WeightErrorCode; readonly input: string }`
  - `parseWeight(text: string): Units` — share of one day, 0 ≤ value ≤ 1

Accepted syntax, nothing else: integer `^\d+$`, decimal `^\d+\.\d+$`, fraction `^\d+/\d+$` with a non-zero denominator. Check order: syntax, then range (exact comparison with 1), then exactness. Decimal arithmetic must stay exact (integers only; strip trailing fractional zeros first; more than five remaining fractional digits can never be exact, since 480 = 2⁵·3·5).

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ["1", 480], ["0", 0], ["1/2", 240], ["0.5", 240], ["3/32", 45], ["0.03125", 15], ["2/4", 240],
  ["1.0", 480], ["0.50000000000", 240], ["1/480", 1], ["0.3", 144], ["480/480", 480],
])("parses %j as %i units", (s, units) => expect(parseWeight(s)).toBe(units));

const code = (s: string) => { try { parseWeight(s); return "ok"; } catch (e) { return (e as WeightError).code; } };
it.each(["", " 1", "1 ", "0,5", "-1/2", "-0.5", "1/0", "1/", "/2", ".5", "1.", "1e0", "½", "1/2/3", "0x1", "+1"])(
  "rejects %j as syntax", (s) => expect(code(s)).toBe("syntax"));
it.each(["2", "3/2", "1.5"])("rejects %j as range", (s) => expect(code(s)).toBe("range"));
it.each(["1/7", "0.33", "0.333", "1/960", "0.001"])("rejects %j as inexact", (s) => expect(code(s)).toBe("inexact"));
```

Property test: for `k` in `fc.integer({ min: 0, max: 32 })`, `parseWeight(\`${k}/32\`) === k * 15`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/weight.test.ts`
Expected: FAIL, cannot resolve `src/engine/weight`.

- [ ] **Step 3: Implement `parseWeight` in `src/engine/weight.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/weight.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/weight.ts tests/engine/weight.test.ts
git -c commit.gpgsign=false commit -m "Add exact parsing of day weights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Data types and rule dates

**Files:**
- Create: `src/engine/holidays/types.ts`, `src/engine/holidays/rules.ts`
- Test: `tests/engine/holidays/rules.test.ts`

**Interfaces:**
- Consumes: Task 2 (`DayNumber`, `Weekday`, `dayFromYmd`, `dayFromIso`, `weekdayOf`, `isLeapYear`), Task 3 (`westernEaster`, `orthodoxEaster`).
- Produces (`src/engine/holidays/types.ts`), the shape of the country JSON files and of the engine's input and output:

```ts
export interface Source { title: string; url: string; checked: string } // checked: ISO date
export type DateRule =
  | { type: "fixed"; month: number; day: number; nonLeap?: "drop" | "feb28" | "mar1" } // nonLeap only, and required, for 02-29
  | { type: "easter"; offset: number }
  | { type: "orthodoxEaster"; offset: number }
  | { type: "weekdayRelative"; weekday: Weekday; relation: "before" | "onOrBefore" | "after" | "onOrAfter"; month: number; day: number }
  | { type: "nthWeekday"; month: number; weekday: Weekday; n: 1 | 2 | 3 | 4 | -1 } // -1 = last
  | { type: "once"; date: string }; // ISO date
export interface HolidayRule {
  id: string; nameKey: string; date: DateRule;
  regions: "all" | string[];       // region IDs
  localRule?: string;              // applies only when this switch is on
  validFrom?: number; validUntil?: number; // years, inclusive
  substitute?: { when: Weekday[] }; // subset of the country's weekend
  sources: string[];               // keys of CountryData.sources, non-empty
}
export interface Region { id: string; nameKey: string }
export interface LocalRule { id: string; regions: string[]; nameKey: string; explanationKey: string; sources: string[] }
export interface CountryData {
  schema: 1; country: string; nameKey: string;
  weekStart: Weekday; weekend: Weekday[];
  workWeek: Record<Weekday, string>; // weight strings
  sources: Record<string, Source>;
  regions: Region[]; localRules: LocalRule[]; holidays: HolidayRule[];
}
export interface RegionSelection { country: string; state: string; options?: Readonly<Record<string, boolean>> }
export interface Holiday { day: DayNumber; ruleId: string; nameKey: string; substitute: boolean }
```

(The implementer may add `readonly` throughout.)

- Produces (`src/engine/holidays/rules.ts`): `ruleDate(rule: DateRule, year: number): DayNumber | null` — the occurrence for that year, `null` when there is none (`once` in another year, `02-29` with `nonLeap: "drop"` in a non-leap year). `before`/`after` are strict; `onOrBefore`/`onOrAfter` include the reference date. A `weekdayRelative` result may fall into the neighbouring year; it still belongs to `year`.

- [ ] **Step 1: Write the failing tests** (table-driven, one `describe` per rule type)

```ts
const at = (rule: DateRule, year: number) => { const d = ruleDate(rule, year); return d === null ? null : isoFromDay(d); };
// fixed
expect(at({ type: "fixed", month: 10, day: 3 }, 2027)).toBe("2027-10-03");
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2024)).toBe("2024-02-29");
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2027)).toBeNull();
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "feb28" }, 2027)).toBe("2027-02-28");
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "mar1" }, 2027)).toBe("2027-03-01");
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "mar1" }, 2000)).toBe("2000-02-29");
expect(at({ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2100)).toBeNull();
// easter
expect(at({ type: "easter", offset: 50 }, 2027)).toBe("2027-05-17");
expect(at({ type: "easter", offset: -2 }, 2027)).toBe("2027-03-26");
expect(at({ type: "easter", offset: 39 }, 2008)).toBe("2008-05-01");
// orthodoxEaster
expect(at({ type: "orthodoxEaster", offset: 0 }, 2027)).toBe("2027-05-02");
expect(at({ type: "orthodoxEaster", offset: 1 }, 2027)).toBe("2027-05-03");
// weekdayRelative (23 Nov 2022 is a Wednesday, 23 Nov 2027 a Tuesday, 20 Jun 2027 a Sunday)
const rel = (weekday: Weekday, relation: "before" | "onOrBefore" | "after" | "onOrAfter", month: number, day: number) =>
  ({ type: "weekdayRelative", weekday, relation, month, day }) as const;
expect(at(rel("wed", "before", 11, 23), 2027)).toBe("2027-11-17");
expect(at(rel("wed", "before", 11, 23), 2022)).toBe("2022-11-16");
expect(at(rel("wed", "onOrBefore", 11, 23), 2022)).toBe("2022-11-23");
expect(at(rel("thu", "after", 11, 23), 2027)).toBe("2027-11-25");
expect(at(rel("tue", "after", 11, 23), 2027)).toBe("2027-11-30");
expect(at(rel("tue", "onOrAfter", 11, 23), 2027)).toBe("2027-11-23");
expect(at(rel("sat", "onOrAfter", 6, 20), 2027)).toBe("2027-06-26");
// nthWeekday
expect(at({ type: "nthWeekday", month: 11, weekday: "thu", n: 4 }, 2027)).toBe("2027-11-25");
expect(at({ type: "nthWeekday", month: 5, weekday: "mon", n: -1 }, 2027)).toBe("2027-05-31");
expect(at({ type: "nthWeekday", month: 9, weekday: "mon", n: 1 }, 2027)).toBe("2027-09-06");
// once
expect(at({ type: "once", date: "2017-10-31" }, 2017)).toBe("2017-10-31");
expect(at({ type: "once", date: "2017-10-31" }, 2018)).toBeNull();
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/holidays/rules.test.ts`
Expected: FAIL, cannot resolve `src/engine/holidays/rules`.

- [ ] **Step 3: Write `types.ts` and implement `ruleDate` in `rules.ts`** (exhaustive `switch` on `rule.type`)

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/holidays/rules.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/holidays tests/engine/holidays/rules.test.ts
git -c commit.gpgsign=false commit -m "Add holiday data types and rule date evaluation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Holiday lookup for a region selection

**Files:**
- Create: `src/engine/holidays/holidays.ts`, `tests/engine/holidays/fixture.ts`
- Test: `tests/engine/holidays/holidays.test.ts`

**Interfaces:**
- Consumes: Task 2, Task 5 (`CountryData`, `RegionSelection`, `Holiday`, `ruleDate`).
- Produces: `holidaysBetween(data: CountryData, selection: RegionSelection, from: DayNumber, to: DayNumber): Holiday[]`
  - `from` and `to` inclusive; `from > to` returns `[]`.
  - Throws `RangeError` when `selection.country !== data.country`, the state is not in `data.regions`, or an `options` key (whether `true` or `false`) is not a local rule whose `regions` include the state.
  - A rule applies when its `regions` is `"all"` or contains the state, its `localRule` (if any) is `true` in `options`, and the occurrence's year is within `validFrom`/`validUntil`.
  - Occurrences are computed for the years from `fromYear − 1` to `toYear + 1`, clamped to `MIN_YEAR`–`MAX_YEAR`, then filtered to the range.
  - Substitute days: after all regular occurrences in that window are known, go through the occurrences of rules with `substitute` in day order; if the weekday is in `when`, add a `Holiday` with `substitute: true` (same `ruleId` and `nameKey`) on the first following day that is not in `data.weekend` and not taken by any holiday or earlier substitute.
  - Sorted by `day`, then `ruleId`, then regular before substitute.
- Produces (`tests/engine/holidays/fixture.ts`): `testCountry: CountryData` and `testCountryFriSat: CountryData`, synthetic and valid (Task 7 checks they validate):
  - `testCountry`: country `"XX"`, regions `A` and `B`, weekend `["sat", "sun"]`, week start `"mon"`, work week Mon–Fri `"1"`, Sat/Sun `"0"`, one source `"law"` used by every rule, local rule `special` for region `A`. Rules: `new-year` fixed 01-01 all, substitute `["sat","sun"]`; `second-day` fixed 01-02 all, substitute `["sat","sun"]`; `labour` fixed 05-01 all; `ascension` easter +39 all; `region-a-day` fixed 03-15 regions `["A"]`, validFrom 2020, validUntil 2025; `special-day` fixed 06-01 regions `["A"]`, localRule `special`; `once-day` once 2026-07-01 regions `["B"]`; `christmas` fixed 12-25 all, substitute `["sat","sun"]`; `boxing` fixed 12-26 all, substitute `["sat","sun"]`.
  - `testCountryFriSat`: same country with weekend `["fri", "sat"]` and only `new-year`, substitute `["fri","sat"]`.

- [ ] **Step 1: Write the failing tests**

```ts
const sel = (state: string, options?: Record<string, boolean>): RegionSelection => ({ country: "XX", state, ...(options && { options }) });
const between = (data: CountryData, s: RegionSelection, from: string, to: string) =>
  holidaysBetween(data, s, dayFromIso(from), dayFromIso(to)).map((h) => `${isoFromDay(h.day)} ${h.ruleId}${h.substitute ? " (substitute)" : ""}`);

it("moves colliding substitutes to the next free working day", () => {
  expect(between(testCountry, sel("B"), "2021-12-01", "2022-01-31")).toEqual([
    "2021-12-25 christmas", "2021-12-26 boxing", "2021-12-27 christmas (substitute)", "2021-12-28 boxing (substitute)",
    "2022-01-01 new-year", "2022-01-02 second-day", "2022-01-03 new-year (substitute)", "2022-01-04 second-day (substitute)",
  ]);
});
it("finds substitutes whose original day lies before the range", () => {
  expect(between(testCountry, sel("B"), "2022-01-03", "2022-01-04")).toEqual(["2022-01-03 new-year (substitute)", "2022-01-04 second-day (substitute)"]);
});
it("uses the country's own weekend", () => {
  expect(between(testCountryFriSat, sel("A"), "2027-01-01", "2027-01-05")).toEqual(["2027-01-01 new-year", "2027-01-03 new-year (substitute)"]);
});
it("respects validity years inclusively", () => {
  for (const [year, expected] of [[2019, 0], [2020, 1], [2025, 1], [2026, 0]] as const)
    expect(between(testCountry, sel("A"), `${year}-03-15`, `${year}-03-15`)).toHaveLength(expected);
});
it("applies local rules only when switched on", () => {
  expect(between(testCountry, sel("A"), "2027-06-01", "2027-06-01")).toEqual([]);
  expect(between(testCountry, sel("A", { special: false }), "2027-06-01", "2027-06-01")).toEqual([]);
  expect(between(testCountry, sel("A", { special: true }), "2027-06-01", "2027-06-01")).toEqual(["2027-06-01 special-day"]);
});
it("applies one-off dates once and only in their regions", () => {
  expect(between(testCountry, sel("B"), "2026-07-01", "2026-07-01")).toEqual(["2026-07-01 once-day"]);
  expect(between(testCountry, sel("B"), "2027-07-01", "2027-07-01")).toEqual([]);
  expect(between(testCountry, sel("A"), "2026-07-01", "2026-07-01")).toEqual([]);
});
it("returns every holiday on a shared day", () => {
  expect(between(testCountry, sel("B"), "2008-05-01", "2008-05-01")).toEqual(["2008-05-01 ascension", "2008-05-01 labour"]);
});
it.each([
  [{ country: "DE", state: "A" }], [sel("C")], [sel("B", { special: true })], [sel("A", { unknown: false })],
])("rejects selection %j", (s) => expect(() => holidaysBetween(testCountry, s, 0, 10)).toThrow(RangeError));
it("returns nothing for an empty range", () => expect(holidaysBetween(testCountry, sel("A"), 10, 9)).toEqual([]));
// Review Focus 1
it("gives the same result across a year boundary as per year", () => {
  expect(between(testCountry, sel("B"), "2027-01-01", "2028-01-31")).toEqual([
    ...between(testCountry, sel("B"), "2027-01-01", "2027-12-31"),
    ...between(testCountry, sel("B"), "2028-01-01", "2028-01-31"),
  ]);
});
// Review Focus 2
it("works at the limits of the supported years", () => {
  expect(between(testCountry, sel("B"), "9999-12-24", "9999-12-31")).toEqual([
    "9999-12-25 christmas", "9999-12-26 boxing", "9999-12-27 christmas (substitute)", "9999-12-28 boxing (substitute)",
  ]);
  expect(between(testCountry, sel("B"), "1583-01-01", "1583-01-02")).toEqual(["1583-01-01 new-year", "1583-01-02 second-day"]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/holidays/holidays.test.ts`
Expected: FAIL, cannot resolve `src/engine/holidays/holidays`.

- [ ] **Step 3: Implement `holidaysBetween` in `src/engine/holidays/holidays.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/holidays/holidays.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/holidays/holidays.ts tests/engine/holidays
git -c commit.gpgsign=false commit -m "Add holiday lookup with local rules, validity and substitute days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Country data validator

**Files:**
- Create: `src/engine/holidays/validate.ts`
- Test: `tests/engine/holidays/validate.test.ts`

**Interfaces:**
- Consumes: Task 2 (`WEEKDAYS`, `dayFromIso`, `daysInMonth`, `MIN_YEAR`, `MAX_YEAR`), Task 4 (`parseWeight`), Task 5 (types), Task 6 (`testCountry`, `testCountryFriSat` fixtures).
- Produces: `interface ValidationIssue { path: string; message: string }` and `validateCountryData(input: unknown): ValidationIssue[]` (empty = valid). Paths use JavaScript notation (`holidays[0].date.month`, `sources.law.url`); the root is `""`. Messages are English developer text (data files are written by maintainers, not loaded by users).

Checks, each reported with the path of the offending value:
- input is a plain object; `schema === 1`; `country` matches `^[A-Z]{2}$`; every `nameKey`/`explanationKey` is a non-empty string;
- `weekStart` and every `weekend` entry are weekdays; `weekend` non-empty, no duplicates; `workWeek` has exactly the seven weekday keys, each accepted by `parseWeight`;
- `sources`: each has non-empty `title`, `url` starting with `https://`, `checked` accepted by `dayFromIso`; every source is referenced by at least one rule or local rule;
- `regions`: non-empty, unique `id`s; `localRules`: unique `id`s, `regions` non-empty and known, `sources` non-empty and known;
- `holidays`: unique `id`s; `regions` is `"all"` or a non-empty list of known region IDs; `localRule` known and the rule's regions (or all regions) within that local rule's `regions`; `validFrom`/`validUntil` integers within `MIN_YEAR`–`MAX_YEAR`, `validFrom ≤ validUntil`; `substitute.when` non-empty and within `weekend`; `sources` non-empty and known;
- `date` per type: `month` 1–12; `fixed` day valid in a leap year, `nonLeap` required for 02-29 and forbidden otherwise; `weekdayRelative` and `nthWeekday` reference dates must exist in every year (no 02-29); `offset` an integer with |offset| ≤ 200; `n` one of 1, 2, 3, 4, −1; `once.date` accepted by `dayFromIso`; known `relation`, known `weekday`;
- **unknown keys** anywhere are reported (Review Focus 3).

- [ ] **Step 1: Write the failing tests**

```ts
it("accepts the fixtures", () => {
  expect(validateCountryData(testCountry)).toEqual([]);
  expect(validateCountryData(testCountryFriSat)).toEqual([]);
});
it.each([null, [], "XX", 1])("rejects %j as a whole", (input) => expect(validateCountryData(input).map((i) => i.path)).toEqual([""]));

// change(fn) = structuredClone(testCountry) as a loose record, mutated by fn
it.each<[string, (d: any) => void]>([
  ["schema", (d) => { delete d.schema; }],
  ["weekStart", (d) => { d.weekStart = "monday"; }],
  ["workWeek.fri", (d) => { d.workWeek.fri = "0,5"; }],
  ["holidays[1].id", (d) => { d.holidays[1].id = d.holidays[0].id; }],
  ["holidays[0].validfrom", (d) => { d.holidays[0].validfrom = 2020; }], // Review Focus 3
  ["holidays[0].date.nonLeap", (d) => { d.holidays[0].date = { type: "fixed", month: 2, day: 29 }; }],
  ["holidays[0].date.day", (d) => { d.holidays[0].date = { type: "fixed", month: 2, day: 30 }; }],
  ["holidays[0].date.nonLeap", (d) => { d.holidays[0].date = { type: "fixed", month: 3, day: 1, nonLeap: "drop" }; }],
  ["holidays[0].date.day", (d) => { d.holidays[0].date = { type: "weekdayRelative", weekday: "mon", relation: "after", month: 2, day: 29 }; }],
  ["holidays[0].date.n", (d) => { d.holidays[0].date = { type: "nthWeekday", month: 5, weekday: "mon", n: 5 }; }],
  ["holidays[0].date.date", (d) => { d.holidays[0].date = { type: "once", date: "2017-02-30" }; }],
  ["holidays[0].date.offset", (d) => { d.holidays[0].date = { type: "easter", offset: 1.5 }; }],
  ["holidays[0].regions[0]", (d) => { d.holidays[0].regions = ["Z"]; }],
  ["holidays[0].regions", (d) => { d.holidays[0].regions = []; }],
  ["holidays[0].localRule", (d) => { d.holidays[0].localRule = "nope"; }],
  ["holidays[0].regions", (d) => { d.holidays[0].localRule = "special"; d.holidays[0].regions = ["B"]; }],
  ["holidays[0].validUntil", (d) => { d.holidays[0].validFrom = 2026; d.holidays[0].validUntil = 2020; }],
  ["holidays[0].substitute.when[0]", (d) => { d.holidays[0].substitute = { when: ["mon"] }; }],
  ["holidays[0].sources", (d) => { d.holidays[0].sources = []; }],
  ["holidays[0].sources[0]", (d) => { d.holidays[0].sources = ["missing"]; }],
  ["sources.unused", (d) => { d.sources.unused = { title: "T", url: "https://example.org", checked: "2026-10-18" }; }],
  ["sources.law.url", (d) => { d.sources.law.url = "http://example.org"; }],
  ["sources.law.checked", (d) => { d.sources.law.checked = "2026-13-01"; }],
  ["localRules[0].regions[0]", (d) => { d.localRules[0].regions = ["Z"]; }],
])("reports %s", (path, mutate) => expect(validateCountryData(change(mutate)).map((i) => i.path)).toContain(path));
```

(Index 0 in these mutations is the fixture's first rule, `new-year`; keep the fixture order from Task 6. Use a typed escape instead of `any` if the lint rules object.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/engine/holidays/validate.test.ts`
Expected: FAIL, cannot resolve `src/engine/holidays/validate`.

- [ ] **Step 3: Implement `validateCountryData` in `src/engine/holidays/validate.ts`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/engine/holidays/validate.test.ts` → PASS; `npm run check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/holidays/validate.ts tests/engine/holidays/validate.test.ts
git -c commit.gpgsign=false commit -m "Add validation of country holiday data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: German holiday data

**Files:**
- Create: `src/data/holidays/de.json`, `src/data/holidays/index.ts`, `docs/holiday-data-format.md`
- Test: `tests/data/holidays/de.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 5, 6, 7.
- Produces (`src/data/holidays/index.ts`): `const countries: Readonly<Record<string, CountryData>>` with key `"DE"`, built from a static JSON import (no file-system access; the cast is safe because the test validates the file).

**Data decisions** (`de.json`):
- `country` `"DE"`, `nameKey` `"country.DE"`, `weekStart` `"mon"`, `weekend` `["sat","sun"]`, `workWeek` Mon–Fri `"1"`, Sat/Sun `"0"`.
- Regions, `nameKey` `region.DE.<id>`: BB, BE, BW, BY, HB, HE, HH, MV, NI, NW, RP, SH, SL, SN, ST, TH.
- Local rules, `nameKey` `localRule.DE.<id>`, `explanationKey` `localRule.DE.<id>.help`: `augsburg` (BY), `assumption` (BY), `corpusChristi` (SN, TH).
- Sources: one per state holiday law (`<state>-law`), `unification-treaty` for 3 Oct (Einigungsvertrag, Art. 2 Abs. 2), and the amending or one-off laws a rule relies on (validity changes, one-off dates, local-rule regulations). Each `url` must be an official legal source: the state's law portal or gazette, gesetze-im-internet.de, gesetze-bayern.de, and so on; not Wikipedia or holiday websites. Set `checked` to the date you open it. Use WebSearch/WebFetch to find them; if you cannot reach the web, stop and report instead of guessing URLs.
- Rules (`id` → `nameKey`, date, regions). Before entering a rule, confirm it in the state laws. Where a law differs from this table, follow the law and report the difference:

| id | nameKey | date | regions / condition |
| --- | --- | --- | --- |
| new-years-day | holiday.new-years-day | fixed 01-01 | all |
| epiphany | holiday.epiphany | fixed 01-06 | BW, BY, ST |
| womens-day-be | holiday.womens-day | fixed 03-08 | BE, validFrom 2019 |
| womens-day-mv | holiday.womens-day | fixed 03-08 | MV, validFrom 2023 |
| good-friday | holiday.good-friday | easter −2 | all |
| easter-sunday | holiday.easter-sunday | easter 0 | BB; HE if the Hessian law lists it |
| easter-monday | holiday.easter-monday | easter +1 | all |
| labour-day | holiday.labour-day | fixed 05-01 | all |
| liberation-day-2020 | holiday.liberation-day | once 2020-05-08 | BE |
| liberation-day-2025 | holiday.liberation-day | once 2025-05-08 | BE |
| uprising-anniversary-2028 | holiday.uprising-anniversary | once 2028-06-17 | BE, only if enacted (both reference models list it) |
| ascension-day | holiday.ascension-day | easter +39 | all |
| whit-sunday | holiday.whit-sunday | easter +49 | BB; HE if the Hessian law lists it |
| whit-monday | holiday.whit-monday | easter +50 | all |
| corpus-christi | holiday.corpus-christi | easter +60 | BW, BY, HE, NW, RP, SL |
| corpus-christi-local | holiday.corpus-christi | easter +60 | SN, TH; localRule corpusChristi |
| augsburg-peace-festival | holiday.augsburg-peace-festival | fixed 08-08 | BY; localRule augsburg |
| assumption-day | holiday.assumption-day | fixed 08-15 | SL |
| assumption-day-local | holiday.assumption-day | fixed 08-15 | BY; localRule assumption |
| world-childrens-day | holiday.world-childrens-day | fixed 09-20 | TH, validFrom 2019 |
| german-unity-day | holiday.german-unity-day | fixed 10-03 | all |
| reformation-day | holiday.reformation-day | fixed 10-31 | BB, MV, SN, ST, TH |
| reformation-day-north | holiday.reformation-day | fixed 10-31 | HB, HH, NI, SH; validFrom 2018 |
| reformation-day-2017 | holiday.reformation-day | once 2017-10-31 | BE, BW, BY, HB, HE, HH, NI, NW, RP, SH, SL |
| all-saints-day | holiday.all-saints-day | fixed 11-01 | BW, BY, NW, RP, SL |
| repentance-day | holiday.repentance-day | weekdayRelative wed before 11-23 | SN |
| christmas-day | holiday.christmas-day | fixed 12-25 | all |
| second-christmas-day | holiday.second-christmas-day | fixed 12-26 | all |

**`docs/holiday-data-format.md`** (CC-BY-4.0): every field of `CountryData` with its meaning; the semantics fixed in Tasks 5 and 6 (strict `before`/`after`, inclusive validity years, local rules as switches, substitute-day algorithm, `nonLeap`); the rule that every rule cites an official source with its check date; how to add a country (new JSON file, entry in `index.ts`, tests); a pointer to `.claude/skills/holiday-data/SKILL.md`.

- [ ] **Step 1: Write the failing tests** in `tests/data/holidays/de.test.ts`

```ts
const de = countries.DE!;
const year = (state: string, y: number, options?: Record<string, boolean>) =>
  holidaysBetween(de, { country: "DE", state, ...(options && { options }) }, dayFromYmd(y, 1, 1), dayFromYmd(y, 12, 31))
    .map((h) => `${isoFromDay(h.day).slice(5)} ${h.ruleId}`);
const has = (state: string, y: number, entry: string, options?: Record<string, boolean>) => year(state, y, options).includes(entry);

it.each(Object.entries(countries))("data file %s is valid", (_, data) => expect(validateCountryData(data)).toEqual([]));

// Every recurring rule on three years; values computed independently (Python dateutil / python-holidays), never from engine output.
const RECURRING: [ruleId: string, state: string, options: Record<string, boolean> | undefined, dates: [string, string, string]][] = [
  ["new-years-day", "HB", undefined, ["2026-01-01", "2027-01-01", "2028-01-01"]],
  ["epiphany", "ST", undefined, ["2026-01-06", "2027-01-06", "2028-01-06"]],
  ["womens-day-be", "BE", undefined, ["2026-03-08", "2027-03-08", "2028-03-08"]],
  ["womens-day-mv", "MV", undefined, ["2026-03-08", "2027-03-08", "2028-03-08"]],
  ["good-friday", "HB", undefined, ["2026-04-03", "2027-03-26", "2028-04-14"]],
  ["easter-sunday", "BB", undefined, ["2026-04-05", "2027-03-28", "2028-04-16"]],
  ["easter-monday", "HB", undefined, ["2026-04-06", "2027-03-29", "2028-04-17"]],
  ["labour-day", "HB", undefined, ["2026-05-01", "2027-05-01", "2028-05-01"]],
  ["ascension-day", "HB", undefined, ["2026-05-14", "2027-05-06", "2028-05-25"]],
  ["whit-sunday", "BB", undefined, ["2026-05-24", "2027-05-16", "2028-06-04"]],
  ["whit-monday", "HB", undefined, ["2026-05-25", "2027-05-17", "2028-06-05"]],
  ["corpus-christi", "NW", undefined, ["2026-06-04", "2027-05-27", "2028-06-15"]],
  ["corpus-christi-local", "TH", { corpusChristi: true }, ["2026-06-04", "2027-05-27", "2028-06-15"]],
  ["augsburg-peace-festival", "BY", { augsburg: true }, ["2026-08-08", "2027-08-08", "2028-08-08"]],
  ["assumption-day", "SL", undefined, ["2026-08-15", "2027-08-15", "2028-08-15"]],
  ["assumption-day-local", "BY", { assumption: true }, ["2026-08-15", "2027-08-15", "2028-08-15"]],
  ["world-childrens-day", "TH", undefined, ["2026-09-20", "2027-09-20", "2028-09-20"]],
  ["german-unity-day", "HB", undefined, ["2026-10-03", "2027-10-03", "2028-10-03"]],
  ["reformation-day", "BB", undefined, ["2026-10-31", "2027-10-31", "2028-10-31"]],
  ["reformation-day-north", "NI", undefined, ["2026-10-31", "2027-10-31", "2028-10-31"]],
  ["all-saints-day", "RP", undefined, ["2026-11-01", "2027-11-01", "2028-11-01"]],
  ["repentance-day", "SN", undefined, ["2026-11-18", "2027-11-17", "2028-11-22"]],
  ["christmas-day", "HB", undefined, ["2026-12-25", "2027-12-25", "2028-12-25"]],
  ["second-christmas-day", "HB", undefined, ["2026-12-26", "2027-12-26", "2028-12-26"]],
];
it.each(RECURRING)("has %s in %s on three years", (id, state, options, dates) => {
  for (const iso of dates) expect(has(state, Number(iso.slice(0, 4)), `${iso.slice(5)} ${id}`, options)).toBe(true);
});
it("has the complete Bavarian year 2027 without switches", () => {
  expect(year("BY", 2027)).toEqual([
    "01-01 new-years-day", "01-06 epiphany", "03-26 good-friday", "03-29 easter-monday", "05-01 labour-day",
    "05-06 ascension-day", "05-17 whit-monday", "05-27 corpus-christi", "10-03 german-unity-day",
    "11-01 all-saints-day", "12-25 christmas-day", "12-26 second-christmas-day",
  ]);
});
it("applies the Bavarian switches independently", () => {
  expect(has("BY", 2027, "08-15 assumption-day-local", { assumption: true })).toBe(true);
  expect(has("BY", 2027, "08-08 augsburg-peace-festival", { augsburg: true })).toBe(true);
  expect(has("BY", 2027, "08-15 assumption-day-local", { augsburg: true })).toBe(false);
});
it("has Assumption Day statewide in Saarland", () => expect(has("SL", 2027, "08-15 assumption-day")).toBe(true));
it("has Corpus Christi in SN and TH only with the switch", () => {
  for (const state of ["SN", "TH"]) {
    expect(has(state, 2027, "05-27 corpus-christi-local")).toBe(false);
    expect(has(state, 2027, "05-27 corpus-christi-local", { corpusChristi: true })).toBe(true);
  }
});
// Review Focus 5: 23 Nov is a Wednesday in 2016, 2022 and 2033
it.each([[2016, "11-16"], [2022, "11-16"], [2027, "11-17"], [2033, "11-16"]])(
  "has the Day of Repentance and Prayer %i on %s in SN", (y, md) => expect(has("SN", y, `${md} repentance-day`)).toBe(true));
it.each([["BE", "womens-day-be", 2018, 2019], ["MV", "womens-day-mv", 2022, 2023]] as const)(
  "starts Women's Day in %s", (state, id, before, from) => {
    expect(has(state, before, `03-08 ${id}`)).toBe(false);
    expect(has(state, from, `03-08 ${id}`)).toBe(true);
    expect(has(state, 2027, `03-08 ${id}`)).toBe(true);
  });
it("starts World Children's Day in TH in 2019", () => {
  expect([2018, 2019, 2027].map((y) => has("TH", y, "09-20 world-childrens-day"))).toEqual([false, true, true]);
});
it("has the Berlin one-off days only in their years", () => {
  expect(has("BE", 2020, "05-08 liberation-day-2020")).toBe(true);
  expect(has("BE", 2025, "05-08 liberation-day-2025")).toBe(true);
  expect([2021, 2026].some((y) => year("BE", y).some((e) => e.startsWith("05-08")))).toBe(false);
});
it.each(["BB", "BY", "HB", "SN"])("has exactly one Reformation Day entry in %s in 2017", (state) => {
  expect(year(state, 2017).filter((e) => e.startsWith("10-31"))).toHaveLength(1);
});
it("has Reformation Day in the northern states from 2018", () => {
  for (const state of ["HB", "HH", "NI", "SH"])
    expect([2016, 2017, 2018, 2027].map((y) => year(state, y).some((e) => e.startsWith("10-31")))).toEqual([false, true, true, true]);
  expect([2016, 2017, 2018].map((y) => year("BY", y).some((e) => e.startsWith("10-31")))).toEqual([false, true, false]);
});
it("returns both holidays on 1 May 2008", () => {
  expect(year("NW", 2008).filter((e) => e.startsWith("05-01"))).toEqual(["05-01 ascension-day", "05-01 labour-day"]);
});
it("has Easter Sunday and Whit Sunday in Brandenburg", () => {
  expect(has("BB", 2027, "03-28 easter-sunday") && has("BB", 2027, "05-16 whit-sunday")).toBe(true);
});
it.each(de.regions.map((r) => r.id))("has the nationwide holidays in %s", (state) => {
  const ids = year(state, 2027).map((e) => e.slice(6));
  for (const id of ["new-years-day", "good-friday", "easter-monday", "labour-day", "ascension-day", "whit-monday",
    "german-unity-day", "christmas-day", "second-christmas-day"]) expect(ids).toContain(id);
});
```

Add a test for `uprising-anniversary-2028` (BE, 2028 yes, 2027 no) if the rule was entered, and for HE Easter Sunday and Whit Sunday if those were entered.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data`
Expected: FAIL, cannot resolve `src/data/holidays/index`.

- [ ] **Step 3: Research the sources, write `de.json`, `index.ts` and `docs/holiday-data-format.md`**

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/data` → PASS; `npm run check` → PASS (including `reuse lint`).

- [ ] **Step 5: Commit**

```bash
git add src/data/holidays tests/data docs/holiday-data-format.md
git -c commit.gpgsign=false commit -m "Add German holiday data with official sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Comparison with date-holidays

**Files:**
- Create: `tests/reference/variants.ts`, `tests/reference/compare.ts`, `tests/reference/known-differences.ts`
- Test: `tests/reference/compare.test.ts`, `tests/reference/date-holidays.test.ts`

**Interfaces:**
- Consumes: Task 6 (`holidaysBetween`, `Holiday`, `RegionSelection`), Task 8 (`countries`).
- Produces (`tests/reference/variants.ts`):
  - `interface Variant { key: string; selection: RegionSelection }`
  - `const VARIANTS: readonly Variant[]`: the 16 states without switches, plus `BY+assumption`, `BY+augsburg`, `BY+assumption+augsburg`, `SN+corpusChristi`, `TH+corpusChristi` (key = state, then the switched-on options in alphabetical order, joined with `+`).
  - `const FIRST_YEAR = 2000`, `const LAST_YEAR = 2100`.
- Produces (`tests/reference/compare.ts`):

```ts
export interface ReferenceHoliday { date: string; name: string } // ISO date, reference's own name
export interface Difference { variant: string; date: string; kind: "onlyRestlos" | "onlyReference"; label: string }
export interface KnownDifference {
  reference: "date-holidays" | "python-holidays";
  variants: readonly string[] | "all";
  kind: Difference["kind"];
  label: string;                    // our ruleId (onlyRestlos) or the reference's name (onlyReference), exact
  years?: readonly [number, number]; // inclusive; omitted = all years
  correct: "restlos" | "reference";
  reason: string;
  source: string;                   // URL of the official source that settles it
}
export function diffHolidays(variant: string, ours: readonly Holiday[], reference: readonly ReferenceHoliday[]): Difference[];
export function explain(reference: KnownDifference["reference"], diffs: readonly Difference[], known: readonly KnownDifference[]):
  { unexplained: Difference[]; unused: KnownDifference[] };
```

  `diffHolidays` compares the sets of dates: a date only in ours gives one `onlyRestlos` difference per rule ID on that date; a date only in the reference gives one `onlyReference` difference per name on that date. Result sorted by date, then kind, then label. `explain` matches each difference against the entries of that reference (variant, kind, exact label, year range); `unused` lists entries of that reference that matched nothing.
- Produces (`tests/reference/known-differences.ts`): `const KNOWN_DIFFERENCES: readonly KnownDifference[]`, starting empty.

- [ ] **Step 1: Write the failing helper tests** in `tests/reference/compare.test.ts`

```ts
const h = (iso: string, ruleId: string): Holiday => ({ day: dayFromIso(iso), ruleId, nameKey: `holiday.${ruleId}`, substitute: false });
it("finds dates on one side only", () => {
  expect(diffHolidays("BB", [h("2027-01-01", "new-years-day"), h("2027-03-28", "easter-sunday")],
    [{ date: "2027-01-01", name: "Neujahr" }, { date: "2027-12-24", name: "Heiligabend" }])).toEqual([
    { variant: "BB", date: "2027-03-28", kind: "onlyRestlos", label: "easter-sunday" },
    { variant: "BB", date: "2027-12-24", kind: "onlyReference", label: "Heiligabend" },
  ]);
});
it("explains matching differences and reports unused entries", () => {
  const diff = { variant: "HE", date: "2027-03-28", kind: "onlyRestlos", label: "easter-sunday" } as const;
  const entry = { reference: "date-holidays", variants: ["HE"], kind: "onlyRestlos", label: "easter-sunday",
    correct: "restlos", reason: "r", source: "https://example.org" } as const;
  expect(explain("date-holidays", [diff], [entry])).toEqual({ unexplained: [], unused: [] });
  expect(explain("date-holidays", [diff], [{ ...entry, years: [2028, 2100] }]).unexplained).toEqual([diff]);
  expect(explain("date-holidays", [], [entry]).unused).toEqual([entry]);
  expect(explain("python-holidays", [diff], [entry])).toEqual({ unexplained: [diff], unused: [] });
});
```

- [ ] **Step 2: Run to verify failure, implement `variants.ts` and `compare.ts`, run to verify pass**

Run: `npm test -- tests/reference/compare.test.ts` → FAIL first (module missing), then PASS.

- [ ] **Step 3: Write `tests/reference/date-holidays.test.ts`**

One `it` per variant. Build the reference with `new Holidays("DE", state, region)` and `getHolidays(year)` for every year from `FIRST_YEAR` to `LAST_YEAR`, keeping only `type === "public"`, with `date.slice(0, 10)` as the ISO date. Variant mapping:

| Variant | date-holidays |
| --- | --- |
| any state without switches | `("DE", state)` |
| `BY+assumption` | `("DE", "BY", "KATH")` |
| `BY+assumption+augsburg` | `("DE", "BY", "A")` |
| `BY+augsburg` | `("DE", "BY", "A")` without entries on 08-15 |
| `SN+corpusChristi` | `("DE", "SN", "BZ")` |
| `TH+corpusChristi` | `("DE", "TH", "EIC")` |

Compute the differences of all variants once (module level or `beforeAll`). One `it` per variant asserts that `explain("date-holidays", thatVariantsDiffs, KNOWN_DIFFERENCES).unexplained` is `[]`; one more `it` asserts that `explain` over all variants' differences together gives `unused: []`.

- [ ] **Step 4: Run it, then resolve every difference**

Run: `npm test -- tests/reference/date-holidays.test.ts`
For each unexplained difference, check the official source. If our data is wrong, fix `de.json` (and extend the Task 8 tests). If the reference is wrong, or models something differently (e.g. date-holidays lists Easter Sunday in BE only as an observance), add a `KnownDifference` with the reason and the URL of the official source. Expected at the end: PASS.

- [ ] **Step 5: Run `npm run check`** → PASS

- [ ] **Step 6: Commit**

```bash
git add tests/reference src/data/holidays tests/data
git -c commit.gpgsign=false commit -m "Compare German holidays with date-holidays for 2000-2100

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: python-holidays reference

**Files:**
- Create: `scripts/python-holidays-reference.py`, `tests/reference/python-holidays-de.json` (generated), `tests/reference/python-holidays.test.ts`
- Modify: `package.json` (script `reference:python`), `REUSE.toml` (annotation for the generated file), `tests/reference/known-differences.ts`, `docs/SPEC.md` (table "Reference models for tests", python-holidays row), `AGENTS.md` (Commands line)

**Interfaces:**
- Consumes: Task 9 (`VARIANTS`, `FIRST_YEAR`, `LAST_YEAR`, `diffHolidays`, `explain`, `KNOWN_DIFFERENCES`).
- Produces: the reference file, shaped as

```json
{
  "generator": "scripts/python-holidays-reference.py",
  "package": "holidays",
  "version": "0.97",
  "years": [2000, 2100],
  "variants": {
    "BB": { "subdiv": "BB", "categories": ["public"], "exclude": [], "holidays": { "Neujahr": ["2000-01-01", "…"] } }
  }
}
```

- [ ] **Step 1: Write `scripts/python-holidays-reference.py`**

It takes the output path as its only argument and writes the file above with `json.dumps(…, indent=1, sort_keys=True, ensure_ascii=False)` plus a trailing newline (sorted names and dates, so regenerating gives a stable diff). It records `holidays.__version__`. Variant mapping (keys identical to `VARIANTS`):

| Variant | subdiv | categories | exclude |
| --- | --- | --- | --- |
| any state without switches | state | `public` | – |
| `BY+assumption`, `SN+corpusChristi`, `TH+corpusChristi` | state | `public`, `catholic` | – |
| `BY+assumption+augsburg` | `Augsburg` | `public` | – |
| `BY+augsburg` | `Augsburg` | `public` | `Mariä Himmelfahrt` |

python-holidays joins holidays on the same date into one name with `"; "` (e.g. `"Christi Himmelfahrt; Erster Mai"` on 2008-05-01); split them into separate names.

- [ ] **Step 2: Add the npm script and generate the file**

`package.json`: `"reference:python": "python3 scripts/python-holidays-reference.py tests/reference/python-holidays-de.json"`. It is not part of `check`.
Run: `npm run reference:python`
Expected: the file exists, `"version": "0.97"`, 21 variants.

- [ ] **Step 3: Add the `REUSE.toml` annotation**

Add `tests/reference/python-holidays-de.json` with `SPDX-License-Identifier = "EUPL-1.2"` and the project's copyright line, `precedence = "aggregate"`, under a comment "Generated reference data for tests".

- [ ] **Step 4: Write `tests/reference/python-holidays.test.ts`**

Import the JSON statically. Assert that `version` is `"0.97"`, `years` is `[FIRST_YEAR, LAST_YEAR]`, and the variant keys equal the `VARIANTS` keys. Then, per variant, flatten `holidays` into `ReferenceHoliday[]` and diff against `holidaysBetween` for 2000–2100. Same structure as Task 9: one `it` per variant asserting `unexplained: []` for `"python-holidays"`, and one asserting `unused: []` over all variants together.

- [ ] **Step 5: Run it and resolve every difference**, as in Task 9 Step 4

Run: `npm test -- tests/reference/python-holidays.test.ts` → PASS at the end.

- [ ] **Step 6: Update the docs**

- `docs/SPEC.md`, python-holidays row: replace `(MIT; Assumption Day for all of BY, BYP for Protestant municipalities, Augsburg not in BY)` with `(MIT; in version 0.97 Assumption Day in BY and Corpus Christi in SN and TH are in the opt-in category "catholic", and Augsburg is its own subdivision)`.
- `AGENTS.md`, Commands line: append `` `npm run reference:python` regenerates the python-holidays reference after rule changes. ``

- [ ] **Step 7: Run `npm run check`** → PASS

- [ ] **Step 8: Commit**

```bash
git add scripts tests/reference package.json REUSE.toml docs/SPEC.md AGENTS.md src/data/holidays tests/data
git -c commit.gpgsign=false commit -m "Compare German holidays with a python-holidays reference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Branch completion

- `npm ci` from a clean `node_modules`, then `npm run check`: everything passes.
- `git status` is clean; `git log main..holiday-engine` shows the design commit plus one commit per task.
- The final report lists: package count and install-script packages (Task 1), every rule where the law differed from the Task 8 table, and every known difference with its reason.
