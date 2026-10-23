<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Opening in Two Steps, Complete Read Reports and the Performance Gate: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Opening a file becomes two steps: reading (fast and bounded) and a check that finds the rule hints, with progress.
- Reading reports every problem it can name for certain, with its own code at the exact key. It refuses only with the full list, and follows one rule for required and optional parts.
- Every code gets a fixed severity.
- Performance is gated by instruction counts instead of wall-clock tests.

**Architecture:**
- **Positions:** `readFile` returns `positions`, the index in the text of every kept list element. Hints and report entries use paths in the text that was read.
- **The check step:** `readFile` stops calling `dayRuleWarnings`. `checkRules(file, positions, onProgress)` in `src/engine/file/check.ts` walks the day rules and match entries of a loaded file and returns hints.
- **Report entries:** two codes, `missingValue` and `invalidValue`, replace `invalidEntry`, at the path of the key itself. Every Error says in `dropped` what is not loaded.
  - A reader collects each list entry's report in a scratch `Report` and keeps only the Errors when the entry is dropped.
  - Core problems no longer throw: `readFile` returns the refusal `invalidCore` together with every Error.
- **Severities:** a fixed table in `src/engine/file/severity.ts` maps every code to error, warning or info.
- **The gate:** `npm run perf` builds each scenario's input natively, then runs it under Cachegrind (`node --predictable`) at 8× and 16× its base size. It compares the growth and a checked-in baseline. It runs inside `npm run check`.

**Tech Stack:** TypeScript 6.0.3, Vitest 5.0.3, Node 24 (type stripping through `scripts/ts-hooks.js`), Valgrind 3.26 (Cachegrind) from the Nix dev shell.

**Spec:**
- **Issue 0015, "Decisions" section:** `issues/0015-worst-case-read-time-of-crafted-files.md`, approved by the maintainer on 2026-10-19/20.
- **The design of 2026-10-23:** `docs/superpowers/specs/2026-10-23-required-and-optional-parts-design.md`, approved and committed in bb6b250.
- **`docs/SPEC.md`,** as Task 1 updates it.

Executors also read:
- `AGENTS.md`;
- `docs/file-format.md` (Reading);
- `docs/day-rules-format.md` (Warnings).

The maintainer approved this plan's open-and-check and performance part on 2026-10-23, and asked for all of it to run in one execution.

## Global Constraints

- **Git:**
  - Work on branch `file-format`, and commit with `git -c commit.gpgsign=false commit`.
  - Never push, tag or sign. The maintainer finishes the branch.
  - Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No new npm packages.**
  - Run tools via npm scripts, never `npx`.
  - Valgrind comes only from the dev shell (`flake.nix`), on Linux only. This session's shell has it on PATH (`valgrind-3.26.0`).
- **The maintainer's uncommitted edits** belong to Task 10 and go into its commit: `flake.nix` (Valgrind), `.claude/skills/release/SKILL.md` and `.claude/skills/dependency-update/SKILL.md`. They are already in the working tree. `.claude/skills/` is write-protected for agents, so don't edit those files; only `git add` them.
- **No wall-clock assertions in tests:** no `performance.now`, `Date.now` or `process.hrtime` in `tests/`. Test timeouts may stay as hang guards.
- **Reading stays as specified:**
  - Untrusted input never throws out of `readFile`.
  - The engine returns codes plus data, never sentences.
  - No JavaScript `Date` in `src/engine/**`.
- **No guessing:** a broken value that decides how others are read makes reading skip the values that depend on it; it never fills them with a default. A report entry is always correct about the loaded file.
- **Linear reading:** no step may search the whole report or a whole list for each entry. The perf gate's planted bug was exactly that.
- **The gate never raises its own baseline.** `npm run perf -- --update` writes `tests/perf/baseline.json`; a raised value needs the maintainer's approval, recorded in the commit message.
- **Valgrind invocation:** always `valgrind --tool=cachegrind --cache-sim=no --cachegrind-out-file=/dev/null --vgdb=no`. `--vgdb=no` keeps Valgrind from creating FIFOs in `/tmp`, which the sandbox blocks.
- **REUSE:**
  - New TypeScript/JS files start with `// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors` and `// SPDX-License-Identifier: EUPL-1.2`.
  - New issue files carry the CC-BY-4.0 header after their front matter.
  - `examples/**` is MIT-0 through `REUSE.toml`.
  - `tests/perf/baseline.json` is added to `REUSE.toml` (EUPL-1.2, next to the python-holidays reference).
- **Done:** a task is done when `npm run check` passes (from Task 10 on it includes the gate).
- **Language server:** check its diagnostics after edits.

## Review Focus

1. **Paths agree.** After a dropped rule, and in a source whose entries reading sorted, a hint and a read-report entry about the same rule or entry give the same path. That path is the one in the text. Test in Task 3.
2. **No cascades.** Each of these gives one Error, not one per dependent value:
   - an unknown `country` (not also one per option);
   - a source with an unknown `type` (not also one per entry);
   - a `match` with an unknown `type` (not also one per field).

   Tests in Tasks 4 and 5.
3. **No noise from what isn't loaded.** A leave day dropped for its `part` reports no `notMultipleOfMinUnit` and no `outsidePeriod`. A refused file reports no Warnings and no Infos. Tests in Tasks 4 and 5.
4. **An invalid optional list doesn't refuse.** `plan.days: {}` or `contract.rules: "x"` opens without that list, with one Error. Test in Task 6.
5. **A baseline written with another Node or Valgrind version:** the counts are not comparable. The gate fails with a message naming both versions instead of reporting false regressions; growth is still checked. Test in Task 10.

---

### Task 1: Spec, agent texts and issue records

**Files:**
- Modify `docs/SPEC.md`:
  - "Format" bullets at :322–:340;
  - "Finer granularity" rows at :191–:192;
  - "Sharing and validation" at :346–:383;
  - the feasibility table at :622–:631;
  - the test strategy table at :638–:650;
  - the local environment at :724;
  - the `check` workflow row at :732;
  - the release checklist at :864–:870.
- Modify `AGENTS.md`: Project, Hard rules, and the Commands line at :52.
- Modify issues:
  - `issues/0011-set-up-ci-check-and-dependency-review.md`;
  - `issues/0015-worst-case-read-time-of-crafted-files.md`;
  - `issues/0009-template-images-and-typ-export.md`.
- Create:
  - `issues/0016-verify-the-example-file-interpretations.md`;
  - `issues/0017-messages-in-the-open-dialog.md`.

- [ ] **Step 1: Replace the Loading bullet (`docs/SPEC.md`:346) with exactly:**

> - **Loading:** if the autosave of the same `id` is newer, the app offers to restore it (see File operations); then the revision warning applies. Opening runs in two steps in a Web Worker, so the page stays responsive, with a progress bar from the start. **Reading** checks the size, parses the JSON, checks `schema` and `kind`, migrates older schema versions and validates every value; its bar has no measure, and Cancel stops opening. **Checking** then looks at every day rule and every source entry with a `match` for the likely mistakes listed in `docs/day-rules-format.md`, and never changes the file; its bar shows "rule n of N", Skip opens the file without the hints, and Cancel stops opening. Both steps report a list; each entry is a code, the path of the affected value in the file as it was read, and the data the message needs, and the UI writes the sentence. The opened file shows both lists together, sorted by severity; with at least one Error the choice is "Open without these parts" or "Cancel", otherwise "OK".

- [ ] **Step 2: Replace the rest of the section.** Replace the bullets "Refused" (:347) and "Loaded with a report" (:348), the situation table (:350–:364), the paragraph "Optional parts that are missing …" (:366), the Limits table (:368–:381) and the paragraph after it (:383) with exactly:

> - **Required and optional:** a part of a file is required when the app can't work with the file or the entry without it and no default would be right for every file. It is optional when its absence has a default that is right for every file, or when only a feature the user may never use needs it. A missing optional part reads as its default and is not reported; a feature that needs it says so when it is used. An optional part that is present must be complete and valid like everything else. `docs/file-format.md` and `docs/day-rules-format.md` mark every key as required or optional, give the defaults and show two minimal files to start from.
> - **Reading reports everything it can name for certain:** every problem gets its own entry, also several in one list entry, and a missing value is told apart from an invalid one. Where a value decides how others are read (the country, a source's type, a match's type) and is broken, the values that depend on it are skipped, not guessed.
> - **Refused at once** (nothing is loaded, one message says why) when nothing reliable can follow: a file that is too large or not JSON; a missing, unknown or newer `schema` or `kind` (the device settings `.einstellungen.json` are recognized but not yet supported, see `docs/file-format.md`); content that doesn't match its `kind` (a rule set with `plan` or `ruleSet`); a count limit of the file exceeded.
> - **Refused with a list** (nothing is loaded) when a required part of the file itself is missing or invalid, such as the work week or the plan period: one dialog lists every Error reading found, each with its own message, so all of them can be fixed in one go.
> - **Loaded with a report** otherwise: a list entry or an optional part with a missing or invalid value is dropped, and nothing in the file is dropped or changed without an entry in the report.
> - **Severities:** every code has a fixed severity: **Error** (not loaded, lost when saving), **Warning** (loaded, but changed or probably wrong), **Info** (loaded unchanged). Something that is not loaded, a refused file or a dropped entry, reports its Errors only. `docs/file-format.md` lists every code with its severity and what happens.
> - **Limits:** every file, list and text that is read has a size limit (`docs/file-format.md`, Limits). A file over 10 MB, or over a count limit of the file as a whole, is refused; a single source or template over its own limits is dropped. Reading never interprets unknown structures (they are only reported), so deeply nested JSON costs no more than parsing it. Reading and checking grow at most linearly with the file, and the performance gate (`npm run perf`, see Test strategy) enforces it. Target: the largest file within the limits reads and checks in under 2 s together in the Firefox ESR on the reference machine (Intel Core i7-8650U), measured at each release; slower devices take longer and show the progress bar.

- [ ] **Step 3: Remove required/optional facts from the other spec sections.** Facts about defaults and required keys now live only in the format docs.
  - **"What a file is based on":** replace "They are optional in files people write themselves; the rule sets that come with restlos have all three, and every one of their rules cites a reference." with "The rule sets that come with restlos have all three, and every one of their rules cites a reference."
  - **"Region":** the bullet becomes "**Region:** `country` is a country of the holiday data, `state` one of its regions and `options` the local rules of that state; a plan file names the state wherever the country's data has states."
  - **"Calendar sources":** replace "Entries of type Holiday carry `required` (default `"0"`), entries of Mandatory leave and Time off needed `take` (default `"1"`), each with an optional `part`." with "Entries of type Holiday carry `required`, entries of Mandatory leave and Time off needed `take`, each with a `part`."
  - **The last Format bullet:** replace "Every key, check and limit is described in `docs/file-format.md`." with "`docs/file-format.md`, with `docs/day-rules-format.md` for day rules, is the reference for every key: whether it is required, its default, its checks, its codes and its limits."
  - **Finer granularity :191:** replace ", required for partial leave; loading a file without it keeps the leave with a suggested part and reports it." with "; partial leave without it is kept with a suggested part and reported."
  - **:192:** delete ", default `"1/2"`".

- [ ] **Step 4: Add a row to the feasibility table, after "CSP and keyboard shortcuts":**

> `| Web Worker from file:// | Does a worker built into the HTML file start from file:// with the CSP from <meta> (worker-src blob:) in the Firefox ESR, Chromium and Safari? How long does handing a 10 MB file's model to the page take? | version 1 |`

  Put `file://`, `<meta>` and `worker-src blob:` in backticks, as the table's other rows do.

- [ ] **Step 5: Add a row to the test strategy table, after "Files":**

> `| Performance | no wall-clock assertions in tests; every scenario runs at 8× and 16× its base size and fails when twice the input costs more than 2.2× the work, or when it costs more than 5 % over the checked-in baseline (tests/perf/baseline.json); raising the baseline needs the maintainer's approval | npm run perf: Cachegrind instruction counts with V8 --predictable, part of npm run check and CI |`

  Code spans as in the other rows.

- [ ] **Step 6: Update the local environment and CI texts.**
  - **:724:** the tool list becomes "(Node.js LTS with npm ≥ 11.10, Typst, Python for the python-holidays reference, Playwright browsers, Firefox ESR for the manual test, Valgrind on Linux for the performance gate)".
  - **After the `npm run plan` sentence,** add: "`npm run perf` runs the performance gate; `npm run check` includes it."
  - **The `check` workflow row:** its content becomes "`npm ci`, lint, REUSE check, type check, Vitest, performance gate, build, size check".

- [ ] **Step 7: Add a release checklist item after "Short manual test":**

> `- [ ] Largest file: npm run perf -- --largest-file <path> writes the worst crafted plan file within the limits; open it in the Firefox ESR on the reference machine and note the times for reading and checking (target: under 2 s together).`

  Code spans as appropriate.

- [ ] **Step 8: `AGENTS.md`.**
  - After the "Full specification" bullet, add:

    > - **File format:** `docs/file-format.md` and `docs/day-rules-format.md` are part of the specification: they mark every key as required or optional and list every code, severity and limit. `docs/SPEC.md` states the principles.
  - Add to Hard rules, after "Counting model":

    > - **Performance:** no wall-clock assertions in tests. `npm run perf` (part of `npm run check`) is the gate: it counts instructions with Cachegrind and fails when a scenario grows faster than its input or costs more than 5 % over `tests/perf/baseline.json`. Engine code that processes input of variable size gets a scenario in `tests/perf/scenarios.ts` in the same commit. Never raise the baseline without the maintainer's approval; `npm run perf -- --update` writes it.
  - Add "`npm run perf` runs the performance gate (Valgrind from the dev shell)" to the Commands line.

- [ ] **Step 9: Issue 0011.** Replace its "Timing tests" note with:

  > Performance gate (issue 0015): `npm run check` runs `npm run perf`, which needs Valgrind. Proposal for this branch, to be confirmed by the maintainer:
  >
  > - Install Valgrind on the runner from Ubuntu's archive (a package, not an action).
  > - Measure the pull request and its merge base in the same job. The runner's Node build and Valgrind differ from the dev shell's, so absolute counts won't match `tests/perf/baseline.json`.
  > - Allowed per scenario: the ratio of the PR's baseline to the base's baseline (1.0 if unchanged), plus 5 %.

  Add an acceptance criterion: "The `check` workflow runs the performance gate."

- [ ] **Step 10: Issue 0015, decision 4.**
  - Replace "A refusal is not in the list: the file doesn't open, and one error message says why." with "A refused file doesn't open, and one dialog says why. A stop (not JSON, too large, wrong `schema` or `kind`, a limit) gives one message. A missing or invalid required part lists every Error reading found, each with its own message (design of 2026-10-23)."
  - After the Error list, add the sentence "On 2026-10-23, `invalidEntry` was split into `missingValue` and `invalidValue`."

- [ ] **Step 11: Issue 0009.** Add under Notes:

  > - Decided on 2026-10-23 to settle with this issue: today an invalid image, or one over its size limit, drops its whole template (ruling R21 of the file-format branch). When the export is built, decide whether only the image is dropped and the export reports it missing, in line with decision 2a of that day (an over-long optional text drops only the text).

- [ ] **Step 12: Create issue 0016**, "Verify the interpretations in the example files".
  - **Front matter:** `status: open`, `priority: 3`, `area: examples`, `created: 2026-10-23`.
  - **Problem:** five points in the example files rest on our own reading or on a source we couldn't open. On 2026-10-23 the maintainer kept them as they are, without having verified them.
  - **Context:** the final report of branch `file-format` (2026-10-19), and decision 2d of the design of 2026-10-23.
  - **Acceptance criteria**, one checkbox each:
    - **Metall-Elektro BW** (`examples/rules/metall-elektro-bw.regeln.json`), § 27: when 24 or 31 December falls on a Sunday, the file treats Saturday 23 or 30 December as the day "immediately before". Confirmed or corrected.
    - **Versicherungen** (`examples/rules/versicherungen.regeln.json`): the description recommends setting Saturday to 0 required work, citing MTV § 13. Confirmed or corrected.
    - **Karneval Rheinland** (`examples/rules/karneval-rheinland.regeln.json`) keeps "Vorschlag 2026" in its name. Confirmed or changed.
    - **The Muster AG plans** (City of Augsburg) set `assumption: true`. Checked against the city's official list, which can only be searched through a form.
    - **IHK Köln:** its page couldn't be opened, so it isn't cited. Either cited from a page that opens, or left out for good.
    - All of the above are done before the app offers the examples as templates ("New → From rule set").

- [ ] **Step 13: Create issue 0017**, "Messages in the open dialog".
  - **Front matter:** `status: open`, `priority: 2`, `area: UI, engine (file format)`, `created: 2026-10-23`.
  - **Problem:** the open dialog writes a sentence for every report entry, but two things are still missing.
    - **Naming a dropped part.** A dropped rule, source or entry exists only in the text. The dialog can show its path and `data`, but nothing the user recognizes, unless the entry carries the rule's label or `id`, the source's name, or the entry's date.
    - **Where a JSON syntax error is.** The engine reports `notJson` without a position. Browsers put the position into their error text, but each in its own wording.
  - **Context:** the design of 2026-10-23 (decision 1 and Non-goals).
  - **Acceptance criteria:**
    - It is decided what a report entry carries to name a dropped part, and the engine provides it.
    - It is decided whether and how the dialog shows where a JSON syntax error is.

- [ ] **Step 14: Verify and commit.**

  Run `npm run check`. Expected: PASS (docs only; `reuse lint` clean).

```bash
git add docs/SPEC.md AGENTS.md issues/0009-template-images-and-typ-export.md issues/0011-set-up-ci-check-and-dependency-review.md issues/0015-worst-case-read-time-of-crafted-files.md issues/0016-verify-the-example-file-interpretations.md issues/0017-messages-in-the-open-dialog.md
git -c commit.gpgsign=false commit -m "Specify opening in two steps, complete read reports, required parts and the performance gate"
```

---

### Task 2: Positions of kept list elements

**Files:**
- Create: `src/engine/file/positions.ts`, `tests/engine/file/positions.test.ts`
- Modify:
  - `src/engine/file/report.ts` (`ReadResult`);
  - `src/engine/file/read.ts`;
  - `src/engine/file/read-contract.ts` (`readRules`);
  - `src/engine/file/read-sources.ts` (`readSource`, `readSources`);
  - `src/engine/file/read-templates.ts` (`readTemplates`);
  - `src/engine/file/read-plan.ts` (`readEntries`);
  - `docs/file-format.md` (Reading).

**Interfaces:**
- Produces (in `src/engine/file/positions.ts`):

```ts
/** The loaded path of a kept list element ("sources[0].entries[3]") → its index in that list in the text that was read. */
export type Positions = ReadonlyMap<string, number>;
/**
 * The path in the text for a path in the loaded file: each list index along the path is replaced by the text
 * index of that element. An element without an entry in `positions` keeps its index.
 */
export function textPath(positions: Positions, loadedPath: string): string;
```

- Produces (in `report.ts`): the ok branch of `ReadResult` gains `readonly positions: Positions`.
- **Covered lists:** `contract.rules`, `sources`, each source's `entries`, `templates`, `plan.days`, `plan.overrides` and `plan.notes`.
  - Work-week entries and images can't shift: any problem in them drops their parent.
  - `except` dates and citations are values, not objects the UI marks.

- [ ] **Step 1: Write the failing tests in `tests/engine/file/positions.test.ts`.**
  - `"maps every list index along a path"`: with `positions = new Map([["sources[0]", 1], ["sources[0].entries[0]", 7]])`:
    - `textPath(positions, "sources[0].entries[0].match")` is `"sources[1].entries[7].match"`;
    - `textPath(positions, "contract.rules[3]")` is `"contract.rules[3]"`.
  - `"gives a rule after a dropped rule its position in the text"`: `planFile` with rules `[{ id: 5 }, rule "a", rule "b"]`, each a valid `fixed` rule with `requiredAtMost: "1/2"`. `positions` maps `contract.rules[0]` → 1 and `contract.rules[1]` → 2.
  - `"follows the entries that reading sorted"`: one `info` source with entries `[{ match: { type: "fixed", month: 5, day: 1 } }, { date: "2027-03-01" }, { date: "2027-02-01" }]`.
    - The loaded order is 1 February, 1 March, then the match.
    - `positions` maps `sources[0].entries[0]` → 2, `[1]` → 1 and `[2]` → 0.
  - `"maps a kept source after a dropped one, with its entries"`: sources `[{ id: "bad" }, an info source with two date entries]`. The map has `sources[0]` → 1, and `sources[0].entries[0]` → 0 and `[1]` → 1.
  - `"maps leave days, overrides, notes and templates"`:
    - days `[{ date: "2027-05-03", take: "1" }, { date: "x", take: "1" }, { date: "2027-02-01", take: "1" }]` give `plan.days[0]` → 2 and `plan.days[1]` → 0;
    - templates `[{ id: 5 }, a valid template]` give `templates[0]` → 1.

- [ ] **Step 2: Run `npm test -- tests/engine/file/positions.test.ts`.** Expected: FAIL (module not found).

- [ ] **Step 3: Implement `textPath`, and record the positions while reading.**
  - The readers already know each element's text index when they build its path. Keep the text index next to each kept element, and assign the loaded index after any sorting:
    - `sortEntries` (`read-sources.ts`) and the date sort in `readEntries` (`read-plan.ts`) sort pairs of element and text index, or an equivalent;
    - `readSource` returns its entries' text indexes, which `readSources` stores under the source's loaded path.
  - `readFile` returns the map in the ok result.
  - `textPath` walks the path's `[n]` segments from the left and looks up each prefix in loaded coordinates.

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Docs.** In `docs/file-format.md`, Reading, after the paragraph on report entries, add:

  > `readFile` also returns `positions`: for every kept rule, source, source entry, template, leave day, override and note, its index in the list in the text that was read. Report entries and hints use paths in that text; `textPath` in `src/engine/file/positions.ts` turns a path in the loaded file into one in the text.

- [ ] **Step 6: Run `npm run check`.** Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/engine/file tests/engine/file docs/file-format.md
git -c commit.gpgsign=false commit -m "Return the text position of every kept list element"
```

---

### Task 3: The check step, and reading without hints

**Files:**
- Create: `src/engine/file/check.ts`
- Modify:
  - `src/engine/file/read.ts:8,54-58` (no memo, no `warnings` argument);
  - `src/engine/file/read-contract.ts` (`readRule`, `readRules`, `readContract`: drop the `warnings` parameter and line :224);
  - `src/engine/file/read-sources.ts` (`readEntry`, `readSource`, `readSources`: drop the `warnings` parameter and :166–:170);
  - `src/engine/file/report.ts:31` (remove `"ruleWarning"` from `ReportCode`).
- Test:
  - Create `tests/engine/file/check.test.ts`.
  - Modify:
    - `tests/engine/file/read-contract.test.ts:121,136`;
    - `tests/engine/file/read-sources.test.ts:158-165`;
    - `tests/examples/helpers.ts:19-25` (`readExample`).
  - The `read-plan.test.ts` users of `ruleWarning` change in Task 9. In this task, only make them compile and pass: `warningsOf` counts the entries of `checkRules(file, positions)`.
- Docs:
  - `docs/file-format.md`: remove the `ruleWarning` row at :311; add a "### Checking" section after "Loaded with a report"; fix the sentence at :370.
  - `docs/day-rules-format.md:62`.
  - The design documents of 2026-10-18 stay as they are: they record what was decided then.

**Interfaces:**
- Consumes:
  - `dayRuleWarningsMemo(): RuleWarningCheck` and `RuleWarningCode` from `src/engine/counting/warnings.ts` (unchanged);
  - `AnyFile` from `src/engine/file/types.ts`;
  - `Positions` and `textPath` (Task 2).
- Produces (in `src/engine/file/check.ts`):

```ts
export type CheckCode = RuleWarningCode; // "leapYearLength" | "mixedRangeEnds" | "neverApplies"
export interface CheckEntry {
  readonly code: CheckCode;
  readonly path: string; // "contract.rules[i]" or "sources[i].entries[j]": positions in the text that was read
}
/** Called with (0, total) before the first rule, then after each rule; the last call is (total, total). */
export type CheckProgress = (done: number, total: number) => void;
/** The N of "rule n of N": day rules plus match entries of all sources. */
export function checkCount(file: AnyFile): number;
/** Hints for a loaded file: contract rules in order, then each source's match entries in loaded order. */
export function checkRules(file: AnyFile, positions: Positions, onProgress?: CheckProgress): CheckEntry[];
```

  - The hints of one rule come in the order `dayRuleWarnings` gives them.
  - A source entry is checked as the rule `{ id: source.id, match, validFrom?, validUntil?, requiredAtMost: 0 }`, as reading did until now.
  - One `dayRuleWarningsMemo()` serves one call.
  - Paths go through `textPath(positions, …)`.

- [ ] **Step 1: Write the failing tests in `tests/engine/file/check.test.ts`.**

  Build files with `readFile(planFile(…))` and `minimal(…)` from `./helpers`, and take `file` and `positions` from the ok result. Each test:
  - `"gives each hint of a contract rule with its path"`
    - Input: rules `[{ id: "carnival", match: { type: "range", from: { type: "easter", offset: -52 }, to: { type: "fixed", month: 3, day: 1 } }, requiredAtMost: "1/2" }, { id: "old-closure", match: { type: "once", date: "2019-07-01" }, validFrom: 2020, requiredAtMost: "0" }]`.
    - Expect `checkRules(file, positions)` to equal `[{ code: "mixedRangeEnds", path: "contract.rules[0]" }, { code: "neverApplies", path: "contract.rules[1]" }]`.
  - `"points to a source entry by its position in the text"`
    - Input: one `info` source with entries `[{ match: { type: "range", from: { type: "fixed", month: 2, day: 27 }, days: 4 } }, { date: "2027-03-01" }]`.
    - Expect `[{ code: "leapYearLength", path: "sources[0].entries[0]" }]`. Also check that `file.sources[0].entries[1]` is the one with a `match`.
  - `"gives a hint and a report entry about the same rule the same path"` (Review Focus 1)
    - Input: rules `[{ id: 5 }, { …the carnival rule, colour: "red" }]`.
    - The report holds `unknownField` at `contract.rules[1].colour`, and the hint is `mixedRangeEnds` at `contract.rules[1]`.
  - `"checks a rule set like a plan file"`: the same two rules in `minimal({ contract: { ...BAVARIA_CONTRACT, rules } })` give the same two entries.
  - `"reports progress from 0 to N, one step per rule"`
    - Input: the rules `{ id: "a", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2" }` and the same with `id: "b"`, day 31, plus one `info` source with `[{ date: "2027-03-01" }, { match: { type: "fixed", month: 5, day: 1 } }, { match: { type: "fixed", month: 6, day: 1 } }]`.
    - `checkCount(file)` is 4, and the calls are `[[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]]`.
  - `"reports 0 of 0 once for a file without rules or match entries"`: calls `[[0, 0]]`, result `[]`.
  - `"gives the hint once for each of 1000 identical rules"`: 1000 copies of the `old-closure` rule with ids `r0…r999` give 1000 `neverApplies` entries, the last at `contract.rules[999]`.

- [ ] **Step 2: Run `npm test -- tests/engine/file/check.test.ts`.**

  Expected: FAIL (module `check` not found).

- [ ] **Step 3: Implement `checkCount` and `checkRules` in `src/engine/file/check.ts`; remove the hints from reading.** Done means all of these hold:
  - `grep -rn "warnings\|RuleWarningCheck" src/engine/file/read*.ts` finds nothing.
  - `"ruleWarning"` is gone from `ReportCode`.
  - The comment at `read.ts:54` goes with the memo.

- [ ] **Step 4: Update the reading tests.**
  - **`read-contract.test.ts:136`:** the never-applying rule now reads with `report: []`, and `checkRules` gives `neverApplies` at `contract.rules[0]`. Rename the test to `"reads a rule that never applies without a report entry"`.
  - **`read-contract.test.ts:121`:** drop the `ruleWarning` filter.
  - **`read-sources.test.ts:158`:** rename it to `"reads a range with a leap-year length without a report entry"`. Expect `report: []`, and that `checkRules` gives `[{ code: "leapYearLength", path: "sources[0].entries[0]" }]`.
  - **`readExample` in `tests/examples/helpers.ts`,** which every example test uses:
    - besides the empty report, require `expect(checkRules(result.file, result.positions), path).toEqual([])`;
    - update its doc comment to "must load with an empty report and no hints".

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Docs.**
  - **`docs/file-format.md`, "### Checking", with these facts:**
    - `checkRules(file, positions, onProgress)` runs on a loaded file and never changes it.
    - It checks contract rules and then each source's match entries.
    - Paths are positions in the text that was read, like the read report's (see `positions`).
    - Progress: `(0, N)` first, then once per rule. `checkCount` gives N.
    - The codes are `neverApplies`, `leapYearLength` and `mixedRangeEnds`, linked to the Day rules warnings.
  - **`file-format.md:370`:** the example of notices becomes "such as leave outside the period".
  - **`day-rules-format.md:62`** becomes: "`dayRuleWarnings(rule)` returns codes with the rule ID. The rule dialog shows them while a rule is edited; after a file is opened, `checkRules` lists them for every rule and match entry ([Checking](file-format.md#checking)). They are warnings, not errors: a rule with a warning is still valid."

- [ ] **Step 7: Run `npm run check`.** Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/engine/file tests/engine/file tests/examples docs/file-format.md docs/day-rules-format.md
git -c commit.gpgsign=false commit -m "Check the rules in a step of its own after reading"
```

---

### Task 4: Codes, severities, and every problem of an entry

**Files:**
- Create:
  - `src/engine/file/severity.ts`;
  - `tests/engine/file/severity.test.ts`;
  - `tests/engine/file/report.test.ts`.
- Modify:
  - `src/engine/file/report.ts`, `text.ts`, `read-match.ts`, `read-contract.ts`, `read-sources.ts`, `read-templates.ts`, `read-plan.ts`;
  - the reader tests in `tests/engine/file/` and `tests/scripts/plan-summary.test.ts`;
  - `docs/file-format.md` (Reading, "Loaded with a report", Checking);
  - `issues/0014-file-format-follow-ups.md`.

**Interfaces:**
- Consumes: `CheckCode` (Task 3).
- Produces:

```ts
// report.ts
export const ERROR_CODES = [
  "unknownField", "missingValue", "invalidValue", "duplicateDate", "duplicateId", "unknownReference",
  "textTooLong", "sourceTooLarge", "templateTooLarge", "unknownLocalRule", "personalSourceInRuleSet",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type NoticeCode = "invalidMinUnit" | "notMultipleOfMinUnit" | "partSuggested" | "outsidePeriod";
export type ReportCode = ErrorCode | NoticeCode;
export type ReportData = Readonly<Record<string, string | number | readonly string[]>>;
export interface ReportEntry {
  readonly code: ReportCode;
  readonly path: string;     // the key itself, in the text that was read
  readonly dropped?: string; // set on every Error: the path of what is not loaded because of it; "" is the whole file
  readonly data?: ReportData;
}
export class Report {
  readonly entries: ReportEntry[];
  error(code: ErrorCode, path: string, dropped: string, data?: ReportData): void;
  notice(code: NoticeCode, path: string, data?: ReportData): void;
  /** True when an Error was added whose `dropped` is exactly `path`. Called only on the scratch report of one entry. */
  drops(path: string): boolean;
  /** Appends `part`'s entries: all of them when `kept`, only its Errors otherwise. */
  merge(part: Report, kept: boolean): void;
}

// severity.ts
export type Severity = "error" | "warning" | "info";
/** `checkSkipped` is never produced by the engine: the UI adds it when the user skips the check. */
export type Code = ReportCode | CheckCode | "checkSkipped";
export const SEVERITY: Readonly<Record<Code, Severity>>;
```

  `readText(value, path, maxLength, report, dropped)` gains `dropped`, the path of what is not loaded when the text is invalid.

**Rules every reader follows** (core values still throw `Refused` until Task 5):
- **The two codes:**
  - `missingValue`: a required key is absent.
  - `invalidValue`: a value is present but wrong (type, range, format, order, a duplicate in `weekdays`, `to` ≤ `from` in an other-plan span, `validUntil` < `validFrom`).
  - Both replace `invalidEntry`.
- **Paths name the key as deep as reading looked:**
  - `contract.rules[0].match.month`;
  - `contract.name.de` (a non-string in a language map);
  - `contract.name.EN` (an invalid language code);
  - `sources[0].entries[2].match.weekdays[1]`.
  - An entry that isn't an object is reported at the entry.
- **Choices between keys stand at the object,** with `data: { oneOf: [...] }`: `missingValue` when none is present, `invalidValue` when several are. The choices:
  - a rule's effect (`requiredAtMost`, `requiredExactly`, `mandatory`);
  - an entry's `date` or `match`;
  - a range's `to` or `days`;
  - a color's `slot` or `rgb`.
- **Every key of an entry is checked,** also after a problem. The order follows the writer's key order (`docs/file-format.md`, Writing), with the choice at its keys' place. The entry's unknown fields come last, in the file's order.
- **Dependents are skipped:**
  - a `match` with a missing or unknown `type`: its other fields are not checked;
  - a source with a missing or unknown `type`, or a personal source in a rule set: its entries are not read;
  - a fixed date whose `month` is invalid: its `day` is not checked;
  - `validUntil` < `validFrom` is checked only when both are valid years.
- **What `dropped` holds:**

| Error | `dropped` |
| --- | --- |
| a problem in a rule, source, source entry, template, reference, leave day, override or note, including inside its `match` or its texts | that entry |
| a problem in an image | its template |
| a problem in the `ruleSet` reference, or in a source's `plan` | `ruleSet`, or that source |
| a source's `color` | that source |
| `unknownField` | the key itself |
| `unknownReference` | that citation |
| an invalid `except` date | that date |
| `contract.region.options` not a map | `contract.region.options` |
| one invalid option, `unknownLocalRule` | that option |
| a rule set's invalid `state` | `contract.region.state` |
| `theme`, `contract.references`, `contract.name` or `description` invalid | that key |
| `duplicateDate` (at `….date`), `duplicateId` (at `….id`) | that entry |
| `textTooLong` | as for any problem of the text's holder (a rule with an over-long `label` is dropped; Task 6 changes the optional texts) |
| `sourceTooLarge`, `personalSourceInRuleSet` | that source |
| `templateTooLarge` | that template |

- **Scratch reports:** a reader collects one list entry's report entries in a scratch `Report`, drops the entry when `scratch.drops(entryPath)`, and then calls `report.merge(scratch, kept)`. So a dropped entry keeps its Errors (a second missing key, an unknown field, an unknown citation) and loses its Warnings and Infos.
- **The extra report entry for a rule dropped over its `label`** (ruling R20) goes: `dropped` now says it.

- [ ] **Step 1: Write the failing tests.**
  - **`severity.test.ts`:** `"gives every code the severity the spec fixes"`. `SEVERITY` must equal exactly an object literal with these 19 keys:
    - **error:** `missingValue`, `invalidValue`, `duplicateDate`, `duplicateId`, `textTooLong`, `sourceTooLarge`, `templateTooLarge`, `unknownReference`, `unknownLocalRule`, `personalSourceInRuleSet`, `unknownField`;
    - **warning:** `invalidMinUnit`, `partSuggested`, `notMultipleOfMinUnit`, `neverApplies`, `leapYearLength`, `mixedRangeEnds`;
    - **info:** `outsidePeriod`, `checkSkipped`.
  - **`report.test.ts`:**
    - `"merges a kept part with all its entries"`;
    - `"merges a dropped part with its Errors only"`: a part with `error("unknownField", "a.x", "a.x")` and `notice("outsidePeriod", "a")`, merged with `kept` false, adds only the Error.
  - **`read-contract.test.ts`, `"reports every problem of a rule"`:**
    - Input: rule `{ match: { type: "fixed", month: 13, day: 1 }, validFrom: 1500, requiredAtMost: "1/2", requiredExactly: "0", colour: "red" }`.
    - The report equals, in this order:
      - `missingValue` at `contract.rules[0].id`;
      - `invalidValue` at `contract.rules[0].match.month`;
      - `invalidValue` at `contract.rules[0].validFrom`;
      - `invalidValue` at `contract.rules[0]` with `data: { oneOf: ["requiredAtMost", "requiredExactly", "mandatory"] }`.

      All four have `dropped: "contract.rules[0]"`. Last comes `unknownField` at `contract.rules[0].colour` with `dropped: "contract.rules[0].colour"`.
  - **`read-contract.test.ts`, `"skips the fields of a match whose type is unknown"`** (Review Focus 2):
    - Input: `match: { type: "fixd", month: 13, day: 99 }`.
    - The report holds only `invalidValue` at `….match.type`.
  - **`read-contract.test.ts`, `"keeps the Error of an unknown citation when the rule is dropped"`:**
    - Input: a rule with `references: ["nope"]` and no effect.
    - The report holds `missingValue` at `contract.rules[0]` (`oneOf`), then `unknownReference` at `contract.rules[0].references[0]` with `data: { reference: "nope" }`.
  - **`read-sources.test.ts`, `"skips the entries of a source with an unknown type"`** (Review Focus 2):
    - Input: type `"holidays"` and three invalid entries.
    - The report holds only `invalidValue` at `sources[0].type`, with `dropped: "sources[0]"`.
  - **`read-sources.test.ts`, `"reports a missing color and an invalid visible together"`:** `missingValue` at `sources[0].color` and `invalidValue` at `sources[0].visible`, both dropping `sources[0]`.
  - **`read-templates.test.ts`, `"drops the template of an image without data"`:** `missingValue` at `templates[0].images[0].data`, with `dropped: "templates[0]"`.
  - **`read-plan.test.ts`, `"drops a leave day without its Warnings"`** (Review Focus 3):
    - Input: days `[{ date: "2026-05-01", take: "1/4", part: "middle" }]`, a date outside the 2027 period with `minUnit` `"1/2"`.
    - The report is exactly `[{ code: "invalidValue", path: "plan.days[0].part", dropped: "plan.days[0]" }]`.
  - **`text.test.ts`:** a map `{ de: 5 }` gives `invalidValue` at `x.de`; a map `{ EN: "a" }` gives `invalidValue` at `x.EN`; `{}` gives `invalidValue` at `x`. Each has the `dropped` passed in.

- [ ] **Step 2: Run `npm test -- tests/engine/file`.** Expected: FAIL.

- [ ] **Step 3: Implement `ERROR_CODES`, the `Report` methods and `SEVERITY`, and rework every reader by the rules above.**
  - `drops` and `merge` cost no more than the size of the scratch report.
  - The main report never searches itself.

- [ ] **Step 4: Update the existing tests.**
  - Every assertion on `invalidEntry` becomes the entry the rules above give: code, the key's path, `dropped`, and `data` only where the rules set it.
  - Don't weaken an assertion to `toContain` or drop it.
  - `tests/scripts/plan-summary.test.ts` changes only where a printed code or path changes.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Docs.** In `docs/file-format.md`:
  - **Reading:** a report entry has a `code`, the `path` of the key itself in the text that was read, for an Error `dropped` (what is not loaded: `""` is the whole file, otherwise the path of the dropped part or key), and `data` for some codes.
  - **"Loaded with a report":**
    - replace the `invalidEntry` row with a `missingValue` row and an `invalidValue` row, with their choice rule (`data.oneOf`);
    - describe the `dropped` rule as "the entry that holds the value" with the exceptions of the table above;
    - remove the clause "reported also as `invalidEntry` of the rule with `data.field`" from `textTooLong`;
    - add a "Severity" column with the values of Step 1;
    - add one sentence: "An entry that is dropped reports its Errors, not its Warnings and Infos."
  - **Checking:** give the three codes the severity Warning, and add a `checkSkipped` row as Info, "added by the app when the user skips the check".

- [ ] **Step 7: Issue 0014.**
  - Delete the item "When the reader drops a rule, …".
  - Under Notes, add "Decided on 2026-10-23 (design `2026-10-23-required-and-optional-parts-design.md`): a dropped entry keeps its Errors and loses its Warnings and Infos."

- [ ] **Step 8: Run `npm run check`.** Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add src/engine/file tests docs/file-format.md issues/0014-file-format-follow-ups.md
git -c commit.gpgsign=false commit -m "Report every problem with its own code at the key, and give every code a severity"
```

---

### Task 5: A refused file lists every Error

**Files:**
- Modify:
  - `src/engine/file/report.ts` (`ReadResult`), `read.ts`, `read-contract.ts` (`readRegion`, `readWeek`, `readRules`, `readContract`), `read-plan.ts` (`readRange`, `readAllowance`, `readList`, `readPlanDraft`), `read-sources.ts` (`readSources`), `read-templates.ts` (`readTemplates`);
  - `scripts/plan.js:21`, `scripts/plan-summary.ts`;
  - tests in `tests/engine/file/` and `tests/scripts/plan-summary.test.ts`;
  - `docs/file-format.md` (Reading, Refused).

**Interfaces:**
- Produces:

```ts
export type ReadResult =
  | { readonly ok: true; readonly file: AnyFile; readonly report: readonly ReportEntry[]; readonly positions: Positions }
  | { readonly ok: false; readonly refusal: Refusal; readonly report: readonly ReportEntry[] };
```

  - **A stop** (`tooLarge`, `notJson`, `unknownSchema`, `newerSchema`, `unknownKind`, `settingsNotSupported`, `kindMismatch`, `limitExceeded`) still throws `Refused` and gives `report: []`.
  - **`invalidCore`** has no `path`. Its `report` holds every Error in reading order and no Warning or Info.

- **Core values:** each gets `missingValue` or `invalidValue` with `dropped: ""`, and reading goes on:
  - `id`, `revision`, `contract`, `contract.region`, its `country`;
  - a plan file's `state` where the country's data has regions;
  - `contract.week`, with every problem of every entry at its key: `week[i].from` (also when it isn't after the previous `from`), `week[i].required`, `week[i].required.mon` …;
  - `plan`, `plan.range` (`from`, `to`; `to` before `from` at `plan.range.to`), `plan.allowance`.
  - Until Task 6, also `contract.rules`, `sources`, `templates`, `plan.days`, `plan.overrides` and `plan.notes` when present but not a list.
  - An empty `week` is `invalidValue` at `contract.week`.
  - A file is refused when an Error has `dropped: ""`.
- **Skips:**
  - `contract` not an object: nothing inside is read; the plan lists are read against `minUnit` `"1/2"`.
  - An invalid `country`: `state` and `options` are not checked.
  - A missing or invalid `plan.range`: no `outsidePeriod`.
  - Any core Error: no source-days limit check and no part suggestions.

- [ ] **Step 1: Write the failing tests** (in `tests/engine/file/read-envelope.test.ts` unless named otherwise).
  - **`"lists every missing core value at once"`:**
    - Input: `planFile` without `id`, without `contract.week` and without `plan.allowance`.
    - Expect `{ ok: false, refusal: { code: "invalidCore" }, report: [missingValue at "id", missingValue at "contract.week", missingValue at "plan.allowance"] }`, each with `dropped: ""`.
  - **`"lists the Errors of the other parts too, but no Warnings"`** (Review Focus 3):
    - Input: the same file plus `minUnit: "x"` and a rule without `match`.
    - The report also holds `missingValue` at `contract.rules[0].match` (`dropped: "contract.rules[0]"`), and no `invalidMinUnit`.
  - **`"skips the state and options of an unknown country"`** (Review Focus 2, `read-contract.test.ts`):
    - Input: region `{ country: "XX", state: "BY", options: { foo: true } }`.
    - The report is exactly `[invalidValue at "contract.region.country", dropped ""]`.
  - **`"reports every invalid work-week entry"`** (`read-contract.test.ts`):
    - Input: week `[{ from: "2020-01-01", required: { …FULL_TIME_WEEK.required, mon: "x" } }, { from: "2019-01-01", required: FULL_TIME_WEEK.required }]`.
    - Expect `invalidValue` at `contract.week[0].required.mon` and at `contract.week[1].from`.
  - **`"refuses a plan file without a state in a country with regions"`:** `missingValue` at `contract.region.state`, `dropped: ""`.
  - **`"still stops at once"`:** it.each over the existing stop cases (`"{"`, a file over 10 MB, `schema` `"restlos/2"`, `kind` `"x"`, a rule set with `plan`, 1001 rules). Each gives its code and `report: []`.
  - **`tests/scripts/plan-summary.test.ts`:** `"prints the path of a refusal"` becomes `"prints a refused file with its list"`. `formatSummary(readFile(minimal({ revision: 0 })))` is `"Refused: invalidCore\nReport: invalidValue at revision"`. Severity and `dropped` come in Task 7.

- [ ] **Step 2: Run `npm test -- tests/engine/file tests/scripts`.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - The core readers report instead of throwing, and return `undefined` for a broken value.
  - `readEnvelope` builds the file only when no Error has `dropped: ""`.
  - Otherwise it returns `invalidCore` with `report.entries.filter((entry) => SEVERITY[entry.code] === "error")`.
  - `scripts/plan.js:21` adds `report: []` to its `tooLarge` result.
  - In `formatSummary`, a refused result prints `Refused: <code>[ at <path>][ (data)]`, then the report section as for a loaded file.

- [ ] **Step 4: Update the existing refusal tests.** Each `invalidCore` refusal with a path becomes `invalidCore` with the matching report entry. For example, `"refuses an unknown country"` expects `invalidValue` at `contract.region.country`.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Docs (`docs/file-format.md`).**
  - **Reading:** "It returns either a refusal, and nothing is loaded, or the file with a report" becomes three outcomes:
    - a stop with its code;
    - `invalidCore` with every Error reading found;
    - the file with its report and `positions`.
  - **Refused:** the `invalidCore` row becomes "A required part of the file itself is missing or invalid (the Required column says which). The refusal comes with every Error reading found, each at its key; the file's own parts have `dropped: ""`." It names no keys.

- [ ] **Step 7: Run `npm run check`.** Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/engine/file scripts tests docs/file-format.md
git -c commit.gpgsign=false commit -m "Refuse a file with every Error reading found"
```

---

### Task 6: Required and optional parts

**Files:**
- Modify:
  - `src/engine/file/read-contract.ts`, `read-sources.ts`, `read-templates.ts`, `read-plan.ts`;
  - the reader tests;
  - `docs/file-format.md`, `docs/day-rules-format.md`.

**Behaviour:** from the design's "Every key" section.
- **Now optional:**
  - A missing `contract.rules` reads as `[]`, without a report entry.
  - A source without `visible` reads as `true`; one without `entries` reads as `[]`. Neither is reported.
- **Invalid optional lists are dropped, not refused.** `contract.rules`, `sources`, `templates`, `plan.days`, `plan.overrides` and `plan.notes` present but not a list give `invalidValue` at that path, with `dropped` that path, and read as `[]`.
- **Values that are only shown are dropped alone; the entry is kept:**
  - an invalid or over-long `label` or `note` of a rule: `invalidValue` or `textTooLong`, with `dropped` the key's own path;
  - a rule's `references` that isn't a list: `invalidValue` at `….references`, `dropped` the same, and the rule keeps no citations;
  - a citation that isn't a string: `invalidValue` at `….references[i]`, `dropped` the same;
  - an invalid or over-long `name` of a source entry.
- **Unchanged:**
  - A source's `visible` or `entries` that is present but invalid drops the source.
  - Required texts that are too long still drop their holder: a source's or template's `name`, a reference's `title` or `version`, a plan reference's `name`, a note's `text`.

- [ ] **Step 1: Write the failing tests.**
  - **`"reads a contract without rules"`:** a rule set whose contract has no `rules` key gives `ok`, `rules: []` and `report: []`.
  - **`"drops an optional list that isn't a list"`** (Review Focus 4): it.each over `contract.rules`, `sources`, `templates`, `plan.days`, `plan.overrides` and `plan.notes`, each set to `{}`.
    - The result is ok, and the list is empty.
    - The report is exactly `[{ code: "invalidValue", path, dropped: path }]`.
  - **`"reads a source without visible and entries"`:** `visible: true`, `entries: []`, `report: []`.
  - **`"keeps a rule whose label is too long, without the label"`:**
    - The report holds `textTooLong` at `contract.rules[0].label`, with `dropped: "contract.rules[0].label"` and `data: { limit: 200 }`.
    - The rule is present and has no `label`.
  - **`"keeps a rule without the invalid %s"`:** it.each over `label: 5`, `note: { EN: "x" }`, `references: "x"` and `references: [5]`. The rule is kept without that value. The paths and `dropped` are as above: `references: [5]` gives `….references[0]`.
  - **`"keeps a source entry whose name is too long, without the name"`.**
  - **`"still drops a source whose name is too long"`:** `textTooLong` at `sources[0].name`, `dropped: "sources[0]"`.

- [ ] **Step 2: Run `npm test -- tests/engine/file`.** Expected: FAIL.

- [ ] **Step 3: Implement.** Update the tests that asserted the old drops. For example, the over-long-label tests in `read-contract.test.ts:165` now expect the rule to be kept.

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Docs.**
  - **`docs/file-format.md`:**
    - Add a section "### Required and optional" after "Values" with the design's rule, in the spec's words (Task 1, Step 2, first bullet). Then:
      - "In the tables, *yes* means: missing or invalid refuses the file when the key belongs to the file itself, and drops the part or list entry that holds it otherwise. *No* gives the default. A present optional part that is invalid is dropped alone at the file, contract or plan level; inside a list entry the entry is dropped, except for values that are only shown (a rule's `label`, `note` and `references`, an entry's `name`), which are dropped alone."
      - The special cases `minUnit` (Warning) and region options (dropped alone).
    - Give every key table a "Required" column with the design's values:
      - top level, plan reference, contract, reference, region, work-week entry, rule keys of this file, source, entry, other-plan entry, template, image, plan;
      - for the plan lists' entries, add a short table for leave days, overrides and notes.
    - Remove the sentences "Missing reads as `[]`." / "Missing reads as `null`." from the Meaning column, and "a missing list reads as `[]`" from the Plan paragraph: the column says it.
    - Remove the section "### Missing optional parts" and the sentence after its table.
    - The `textTooLong` row: "an optional text that is only shown (a rule's `label` or `note`, an entry's `name`, `contract.name` and `description`) is dropped alone; a required one drops the part that holds it".
    - The Limits row for names and notes: "the text dropped, or the entry when the text is required".
  - **`docs/day-rules-format.md`:**
    - The top-level key table gets the same "Required" column: `id` yes; `match` yes; the effect yes, exactly one; the rest no.
    - Replace "An over-long `label` or `note` makes the whole rule invalid: it is dropped when the file is read." with "An invalid or over-long `label`, `note` or `references` is dropped when the file is read; the rule is kept."

- [ ] **Step 6: Run `npm run check`.** Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/engine/file tests/engine/file docs/file-format.md docs/day-rules-format.md
git -c commit.gpgsign=false commit -m "Read what the app can do without as optional, and drop only what is shown"
```

---

### Task 7: The plan command prints severities, dropped parts and hints

**Files:**
- Modify: `scripts/plan-summary.ts`, `tests/scripts/plan-summary.test.ts`

**Interfaces:**
- Consumes: `SEVERITY` (Task 4), `checkRules` (Task 3), `ReadResult` (Task 5).

- [ ] **Step 1: Update `tests/scripts/plan-summary.test.ts`.**
  - **The first test** expects:
    - `"Report:"`, `"  error unknownField at savedAt"`, `"  warning partSuggested at plan.days[0] (part=end)"`, then `"Hints: none"`;
    - then the existing lines from `"Allowance 30, …"` on.
  - **The rule-set test** expects `["test-rule-set — rule set, revision 1", "Report: none", "Hints: none", "Rules:", …]`.
  - **New tests:**
    - `"prints the hints with their severity"`: a rule set with the `old-closure` rule from Task 3 contains the line `"Hints: warning neverApplies at contract.rules[0]"`. One line goes inline after the title, as the report does.
    - `"prints what an Error drops"`: a rule with `validFrom: 1500` gives `"Report: error invalidValue at contract.rules[0].validFrom; drops contract.rules[0]"`.
    - `"prints a refused file with severities"`: `readFile(minimal({ revision: 0 }))` gives `"Refused: invalidCore\nReport: error invalidValue at revision; drops the file"`.
  - `"prints a refusal"` (`notJson`) stays as it is.

- [ ] **Step 2: Run `npm test -- tests/scripts/plan-summary.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Extend `formatSummary`.**
  - Every report line becomes `<severity> <code> at <path>[ (data)][; drops <dropped>]`.
    - The suffix appears only when `dropped` differs from `path`; `""` prints as "the file".
    - A list in `data` prints with `String(value)`.
  - For a loaded file, a "Hints" section from `checkRules(file, positions)` follows the report, formatted like it.

- [ ] **Step 4: Run `npm run check`.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add scripts/plan-summary.ts tests/scripts/plan-summary.test.ts
git -c commit.gpgsign=false commit -m "Print severities, dropped parts and hints in npm run plan"
```

---

### Task 8: Minimal examples, and tests that keep the docs and the reader in agreement

**Files:**
- Create:
  - `examples/minimal/minimal.urlaub.json`, `examples/minimal/minimal.regeln.json`;
  - `tests/examples/minimal.test.ts`;
  - `tests/engine/file/full.ts` (the full fixture), `tests/engine/file/required.test.ts`.
- Modify: `docs/file-format.md` (new section "## Minimal examples" before "## Example", and a link from the intro).

**Interfaces:**
- Consumes: `readFile` (Task 5), `checkRules` (Task 3).
- Produces (in `tests/engine/file/full.ts`):

```ts
/** A plan file that holds every optional key at least once and reads with an empty report. */
export const FULL_PLAN: Record<string, unknown>;
/** A deep copy of `file` without the key at `path` ("sources[2].entries[0].take"). */
export function without(file: Record<string, unknown>, path: string): Record<string, unknown>;
```

- **The minimal plan file** (written exactly like this, two-space indent, final newline):

```json
{
  "schema": "restlos/1",
  "kind": "plan",
  "id": "my-plan-2027",
  "revision": 1,
  "contract": {
    "region": { "country": "DE", "state": "BY" },
    "week": [
      { "from": "2027-01-01", "required": { "mon": "1", "tue": "1", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } }
    ]
  },
  "plan": { "range": { "from": "2027-01", "to": "2027-12" }, "allowance": "30" }
}
```

  The minimal rule set is the same with `"kind": "ruleSet"`, `"id": "my-rules"`, the region `{ "country": "DE" }` and no `plan`.

- **What `FULL_PLAN` holds:**
  - **File and contract:** a `ruleSet` reference; `contract` with `name`, `description`, `references` (`basis` with all four keys), region `{ country: "DE", state: "BY", options: { assumption: true } }`, `minUnit` `"1/2"`, one week entry, and one rule with every key (`origin`, `label`, `match` 24 December, `validFrom` 2027, `validUntil` 2030, `requiredAtMost` `"1/2"`, `part`, `note`, `references: ["basis"]`).
  - **`sources`:**
    - a `holiday` source with `origin` and a date entry with `name`, `required` and `part`;
    - a `mandatory` source with a match entry (a range with `weekdays`) with `validFrom`, `validUntil`, `except`, `name`, `take` and `part`;
    - an `otherPlan` source with `plan` and one entry with `name`;
    - an `info` and a `needed` source.
  - **`templates`, `theme` and `plan`:** one template with `origin` and one image; `theme: {}`; `plan` with a full-day leave without `part`, a half day with `part`, an override with `part`, and a note.
  - Every weight is a multiple of ½, every date inside 2027, and no rule gets a hint.

- [ ] **Step 1: Write the failing tests.**
  - **`tests/examples/minimal.test.ts`:**
    - `"reads %s with an empty report and no hints"`: it.each over both files, with `readExample` from `./helpers`. The canonical round trip is not asked: the writer adds the empty lists and `theme`.
    - `"the docs show the minimal examples as they are"`: the two ` ```json ` blocks under "## Minimal examples" in `docs/file-format.md` equal the files' text without the final newline.
  - **`tests/engine/file/required.test.ts`:**
    - `"reads the full file with an empty report"`: `readFile(JSON.stringify(FULL_PLAN))` is ok, with `report: []` and `checkRules` giving `[]`.
    - **`"refuses the minimal plan file without %s"`:** it.each over `id`, `revision`, `contract`, `contract.region`, `contract.region.country`, `contract.region.state`, `contract.week`, `contract.week[0].from`, `contract.week[0].required`, the seven `contract.week[0].required.<day>`, `plan`, `plan.range`, `plan.range.from`, `plan.range.to` and `plan.allowance`.
      - Each gives `refusal: { code: "invalidCore" }`.
      - The report is exactly `[{ code: "missingValue", path, dropped: "" }]`.
    - **`"drops %s from the full file without %s"`:** it.each over pairs of required key and dropped part. Each gives an ok result whose report is exactly `[{ code: "missingValue", path: <key>, dropped: <part> }]`, plus the follow-on entries named here.
      - **Rule:** its match is `{ "type": "fixed", "month": 12, "day": 24 }`. `id`, `match`, `match.type`, `match.month` and `match.day` each drop `contract.rules[0]`. Removing `requiredAtMost` gives `missingValue` at `contract.rules[0]` with `data.oneOf`.
      - **The mandatory entry's range:**
        - `match.from` and `match.from.type` each drop that entry.
        - Removing `match.to` gives `missingValue` at `….match` with `data.oneOf: ["to", "days"]`.
      - **Reference:** `title`, `version`, `url`, `checked` of `contract.references.basis`. Each drops the reference, plus the follow-on `unknownReference` at `contract.rules[0].references[0]`.
      - **Plan reference:** `ruleSet.id`, `.name`, `.revision`, each dropping `ruleSet`.
      - **Source:** `id`, `name`, `type`, `color` of each source, each dropping that source. The `plan` of the `otherPlan` source, and its `id`, `name` and `revision`, drop the source too.
      - **Entry:** removing a date entry's `date` gives `missingValue` at the entry with `data.oneOf: ["date", "match"]`. The other-plan entry's `date`, `from`, `to` and `kind` each drop that entry.
      - **Template:** `id`, `name`, `api`, `typst`, `typ`, each dropping the template. The image's `name`, `type` and `data` drop the template too.
      - **Plan entries:** a leave day's `date` and `take`; an override's `date` and `required`; a note's `date` and `text`. Each drops its entry.
    - **`"reads the full file without the optional %s"`:** it.each over every optional key of `FULL_PLAN`. Each gives an ok result with `report: []`, except for these two:
      - `contract.references` gives only the follow-on `unknownReference`;
      - the half day's `part` gives `partSuggested`.

      The optional keys:
      - `ruleSet`, `sources`, `templates`, `theme`;
      - `contract.name`, `description`, `references`, `region.options`, `minUnit`, `rules`;
      - the rule's `origin`, `label`, `validFrom`, `validUntil`, `part`, `note`, `references`;
      - each source's `origin`, `visible` and `entries`;
      - each entry's `validFrom`, `validUntil`, `except`, `name`, `required`, `take` and `part`;
      - the other-plan entry's `name`;
      - the template's `origin` and `images`;
      - `plan.days`, `plan.overrides`, `plan.notes`;
      - the half day's `part`, the override's `part`.

- [ ] **Step 2: Run `npm test -- tests/examples/minimal.test.ts tests/engine/file/required.test.ts`.** Expected: FAIL (missing files and section).

- [ ] **Step 3: Write the two files, `FULL_PLAN`, `without`, and the docs section.**
  - **`docs/file-format.md`, "## Minimal examples":**
    - one sentence: "The smallest files the app reads, with only the required keys, as a starting point for writing a file by hand; the app fills in the rest when it saves";
    - the two blocks, verbatim;
    - one line naming the files in `examples/minimal/`.
  - Link the section from the intro paragraph.

- [ ] **Step 4: Run `npm run plan -- examples/minimal/minimal.urlaub.json` and `npm run plan -- examples/minimal/minimal.regeln.json`.**

  Expected:
  - exit 0, with "Report: none" and "Hints: none";
  - for the plan, "Allowance 30, planned 0, remaining 30".

- [ ] **Step 5: Run `npm run check`.** Expected: PASS (`reuse lint` covers `examples/**`).

- [ ] **Step 6: Commit.**

```bash
git add examples/minimal tests/examples/minimal.test.ts tests/engine/file/full.ts tests/engine/file/required.test.ts docs/file-format.md
git -c commit.gpgsign=false commit -m "Add minimal example files and tests for every required and optional key"
```

---

### Task 9: Shared crafted shapes; no wall-clock assertions

**Files:**
- Create: `tests/engine/file/shapes.ts`
- Modify:
  - `tests/engine/weight.test.ts:48`;
  - `tests/engine/counting/plan.test.ts:166-179` (delete the test and its comment line);
  - `tests/engine/file/model.test.ts:137-150`;
  - `tests/engine/file/read-plan.test.ts:217-225,239-350`.

  The line numbers are as of the start of this plan. Earlier tasks may have moved them, so find the tests by name.

**Interfaces:**
- Consumes: `planFile`, `BAVARIA_CONTRACT` (`./helpers`); `checkRules` (Task 3).
- Produces (in `tests/engine/file/shapes.ts`; Task 11 uses them):

```ts
export type EntryShape = () => Generator<Record<string, unknown>>;
export const earlyEasterRangesOffWeekday: EntryShape; // shape X of issue 0015
export const easterRangesJustOutOfReach: EntryShape;  // moved from read-plan.test.ts (first entryShapes item)
export const calendarRangesOffWeekday: EntryShape;    // moved from read-plan.test.ts (second entryShapes item)
/** The first `count` entries of `shape`. */
export function takeEntries(shape: EntryShape, count: number): Record<string, unknown>[];
/** As many entries of `shape` as a plan file of 10 MiB − 20,000 bytes holds, at most 50 × 2000 (today's loop at read-plan.test.ts:336-341). */
export function fillToLimits(shape: EntryShape): Record<string, unknown>[];
/** A plan file with `entries` as info sources of at most 2000 entries each, ids "s0", "s1", … (today's code at read-plan.test.ts:342-344). */
export function entriesPlan(entries: readonly Record<string, unknown>[]): string;
/** The file of read-plan.test.ts:240 scaled by n ≤ 2000: n leave days (today's half-day and `part` pattern) and n notes from 2026-10-01, Math.floor(n / 2) rules, 50 sources × 2 ranges of Math.floor(n / 4) days. limitsPlan(2000) is today's file. */
export function limitsPlan(n: number): string;
```

  The shape X generator. It is a fixture the tests can't derive, so it is given in full:

```ts
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const earlyEasterRangesOffWeekday: EntryShape = function* () {
  for (let validFrom = 1600; ; validFrom++) {
    for (let k = 286; k <= 338; k++) {
      const dayOfYear = k - 281; // the 0-based day of the next year: 5 (6 January) for k = 286
      const [month, day] = dayOfYear < 31 ? [1, dayOfYear + 1] : [2, dayOfYear - 30];
      yield { match: { type: "range", from: { type: "easter", offset: k }, to: { type: "fixed", month, day }, weekdays: [WEEKDAYS[(k + 12) % 7]] }, validFrom };
    }
  }
};
```

- [ ] **Step 1: Create `shapes.ts`.** Move the two shapes and the fill and split loops out of `read-plan.test.ts`, and add shape X and `limitsPlan`.

- [ ] **Step 2: Rewrite the timed tests without timing.**
  - **`weight.test.ts:48`:** rename it to `"handles inputs of a million characters"` and drop the two `performance.now` lines. The test timeout guards against superlinear parsing.
  - **`plan.test.ts:166-179`:** delete the test. The `readAndCompute:limitsPlan` scenario (Task 11) takes over.
  - **`model.test.ts:137`:** rename it to `"returns null above the limit"` and drop the `Date.now` lines. `"stops before expanding later entries"` proves the early stop.
  - **`read-plan.test.ts:217`:** rename it to `"suggests 300 parts in one read"`; keep the length-300 assertion.
  - **`read-plan.test.ts:240`:** rename it to `"reads and computes an accepted file at the limits"`.
    - Build the file with `limitsPlan(2000)`.
    - Drop the warm-up and the timing; keep the four content assertions.
  - **`read-plan.test.ts:292`:** rename it to `"reads and checks 1000 rules of %s without validity years"`.
    - Use `readFile` directly and drop `timedRead`.
    - Expect 1000 rules and `checkRules(file, positions)` to equal `[]`.
  - **`read-plan.test.ts:335`:** rename it to `"reads and checks distinct never-applying %s, as many as 10 MiB hold"`. It runs over the three shapes, with X added as `"ranges from an early Easter to the next January or February, on a weekday they never cover"`.
    - Read `entriesPlan(fillToLimits(shape))`.
    - Expect more than 45,000 entries and an empty read report.
    - Expect `checkRules(file, positions).filter((e) => e.code === "neverApplies")` to have one entry per entry.
    - Keep the timeout `30_000` as the hang guard.

- [ ] **Step 3: Check that nothing measures time.**

  Run: `grep -rnE "performance\.now|Date\.now|process\.hrtime" tests`

  Expected: no output.

- [ ] **Step 4: Run `npm run check`.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add tests
git -c commit.gpgsign=false commit -m "Share the crafted shapes and drop the wall-clock assertions"
```

---

### Task 10: The performance gate

**Files:**
- **Already in the working tree** (the maintainer's edits; commit them here, don't edit them):
  - `flake.nix`: Valgrind in the Linux-only list;
  - `.claude/skills/release/SKILL.md`: step 6a, the largest-file timing;
  - `.claude/skills/dependency-update/SKILL.md`: the `otherEnvironment` and `--update` step.
- Modify: `package.json`
  - add `"perf": "node --import ./scripts/ts-hooks.js scripts/perf.js"`;
  - `check` becomes `npm run lint && npm run typecheck && npm test && npm run perf && reuse lint`.
- Create:
  - `scripts/perf-verdict.ts`;
  - `scripts/perf.js` (runner);
  - `scripts/perf-run.js` (child entry);
  - `tests/perf/scenarios.ts`;
  - `tests/perf/baseline.json`;
  - `tests/scripts/perf-verdict.test.ts`.
- Modify: `REUSE.toml` (add `tests/perf/baseline.json` to the "Generated reference data for tests" paths)

**Interfaces:**
- Consumes: `entriesPlan`, `takeEntries`, `earlyEasterRangesOffWeekday` (Task 9); `readFile` (`src/engine/file/read.ts`).
- Produces:

```ts
// tests/perf/scenarios.ts
export interface Scenario {
  readonly name: string;                  // "<engine step>:<input shape>", e.g. "read:earlyEasterRanges"
  readonly base: number;                  // runs at 8 × base and 16 × base
  readonly input: (n: number) => string;  // built natively before Valgrind, handed over as a file
  readonly run: (input: string) => void;  // the measured work
}
export const SCENARIOS: readonly Scenario[];

// scripts/perf-verdict.ts
export const SIZES = [8, 16] as const;
export const GROWTH_LIMIT = 2.2;
export const BUDGET_TOLERANCE = 0.05;
export interface Counts {
  readonly node: string;      // process.version
  readonly valgrind: string;  // first line of `valgrind --version`
  readonly work: Readonly<Record<string, readonly [number, number]>>; // instructions at 8× and 16×
}
export type Finding =
  | { readonly kind: "growth"; readonly scenario: string; readonly growth: number }
  | { readonly kind: "overBudget"; readonly scenario: string; readonly size: 8 | 16; readonly change: number }
  | { readonly kind: "cheaper"; readonly scenario: string; readonly size: 8 | 16; readonly change: number }
  | { readonly kind: "noBaseline"; readonly scenario: string }
  | { readonly kind: "otherEnvironment"; readonly baseline: { node: string; valgrind: string }; readonly measured: { node: string; valgrind: string } };
/** growth, overBudget and otherEnvironment fail the gate; cheaper and noBaseline are notices. */
export function verdict(measured: Counts, baseline: Counts | undefined): { readonly failed: boolean; readonly findings: readonly Finding[] };
```

  - `change` is `measured / baseline − 1`; growth is `work16 / work8`.
  - With `otherEnvironment`, the budget comparisons are skipped and growth is still checked.

- [ ] **Step 1: Write the failing tests in `tests/scripts/perf-verdict.test.ts`.** Use `env = { node: "v24.21.0", valgrind: "valgrind-3.26.0" }`:
  - **`"passes when the work grows at most 2.2× and stays within 5 %"`:** measured `{ a: [1000, 1950] }`, baseline the same. Expect `{ failed: false, findings: [] }`.
  - **`"fails a scenario that grows more than 2.2× for twice the input"`:** `[1000, 2300]`. Expect `failed: true` and the finding `{ kind: "growth", scenario: "a", growth: 2.3 }`.
  - **`"allows exactly 2.2×"`:** `[1000, 2200]`. Not failed.
  - **Budget,** with baseline `[1000, 2000]`:
    - `"allows exactly 5 % over the baseline and fails above it"`: measured `[1050, 2000]` passes. `[1051, 2000]` fails with `{ kind: "overBudget", scenario: "a", size: 8, change: 0.051 }` (compare with `toBeCloseTo`).
    - `"notes a scenario that got more than 5 % cheaper"`: measured `[900, 1800]` passes with two `cheaper` findings, sizes 8 and 16.
  - **`"checks only growth for a scenario without a baseline"`:** the baseline lacks `a`. Expect `noBaseline`, not failed; `[1000, 2300]` still fails on growth.
  - **`"fails on a baseline from another Node or Valgrind"`** (Review Focus 5): baseline node `"v24.20.0"`. Expect failed, one `otherEnvironment` finding, and no `overBudget` even for `[2000, 4000]` against `[1000, 2000]`.
  - **`"treats a missing baseline file as no baseline for every scenario"`:** `verdict(measured, undefined)` gives one `noBaseline` per scenario, not failed.

- [ ] **Step 2: Run `npm test -- tests/scripts/perf-verdict.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Implement `verdict` in `scripts/perf-verdict.ts`.**

- [ ] **Step 4: Implement the runner and the child.**
  - **`scripts/perf-run.js`** (plain JS, `/* global process */`, like `scripts/plan.js`):
    - imports `SCENARIOS`;
    - with no arguments it does nothing more, which is the baseline run of startup and imports;
    - with `<name> <inputPath>` it runs that scenario on the file's text.
  - **`scripts/perf.js`**, in order:
    0. `--largest-file <path>` (below) is handled first, without Valgrind.
    1. `spawnSync("valgrind", ["--version"])`. On error, print "perf: skipped, Valgrind not found (the dev shell has it on Linux; CI runs the gate)" and exit 0.
    2. `mkdtempSync` in `os.tmpdir()`. For each scenario and each size in `SIZES`, write `scenario.input(scenario.base * size)` to a file.
    3. Run `valgrind --tool=cachegrind --cache-sim=no --cachegrind-out-file=/dev/null --vgdb=no node --predictable --import ./scripts/ts-hooks.js scripts/perf-run.js [<name> <path>]`:
       - once without arguments;
       - then once per scenario and size;
       - at most `Math.min(4, os.availableParallelism())` at a time.
    4. Parse the count from stderr with `/I\s+refs:\s+([\d,]+)/`. A child that fails, or prints no count, fails the gate with the last 20 lines of its stderr.
    5. work = count − count of the run without arguments.
    6. Read `tests/perf/baseline.json` if it exists, then call `verdict`.
    7. Print one line per scenario: work at 8× and 16× in millions with one decimal, growth with two decimals, and the change against the baseline in percent. Then print each finding as a sentence:
       - growth, overBudget and otherEnvironment start with "FAIL";
       - cheaper says "lower it with `npm run perf -- --update` (maintainer's approval)".
    8. Exit 1 if failed.
    9. Remove the temp directory.
  - **`--update`:** writes `tests/perf/baseline.json` from the measured counts, with scenario names sorted, two-space indent and a trailing newline. It refuses with exit 1 when a growth check fails.
  - **`--largest-file <path>`:** writes `entriesPlan(fillToLimits(earlyEasterRangesOffWeekday))` to `<path>` and exits 0. It needs no Valgrind.

- [ ] **Step 5: Add the first scenario to `tests/perf/scenarios.ts`.**
  - `read:earlyEasterRanges`, base 1000.
  - `input = (n) => entriesPlan(takeEntries(earlyEasterRangesOffWeekday, n))`.
  - `run = (text) => { readFile(text); }`.
  - A header comment says what a scenario is and points to the AGENTS.md rule.

- [ ] **Step 6: Write the first baseline and run the gate.**

  Run each on its own: `npm run perf -- --update`, then `npm run perf`.

  Expected:
  - The second run prints the scenario with a growth below 2.2 and +0.0 % against the baseline, and exits 0.
  - For orientation: this shape measured about 1,699 M and 3,312 M instructions with hints. Without hints, reading is cheaper.

- [ ] **Step 7: Check the skip path.**

  Run: `env PATH="$(dirname "$(command -v node)")" npm run perf`. This is a PATH with Node and npm but without Valgrind.

  Expected: the skip line, exit 0.

- [ ] **Step 8: Run `npm run check`.** Expected: PASS, with the gate's lines.

- [ ] **Step 9: Commit.** The maintainer's three edits go into this commit.

```bash
git add flake.nix .claude/skills/release/SKILL.md .claude/skills/dependency-update/SKILL.md package.json REUSE.toml scripts/perf-verdict.ts scripts/perf.js scripts/perf-run.js tests/perf tests/scripts/perf-verdict.test.ts
git -c commit.gpgsign=false commit -m "Gate performance on Cachegrind instruction counts"
```

---

### Task 11: The remaining scenarios

**Files:**
- Modify: `tests/perf/scenarios.ts`, `tests/perf/baseline.json`
- Modify: `issues/0015-worst-case-read-time-of-crafted-files.md`
  - status `done`, `closed:` the day of the commit, `branch: file-format`;
  - all acceptance criteria ticked or replaced by the decisions.

**Interfaces:**
- Consumes:
  - the shapes and `limitsPlan` (Task 9);
  - `checkRules` (Task 3);
  - `readFile`, `writeFile` (`src/engine/file/write.ts`), `computePlan` (`src/engine/counting/plan.ts`), `planInput` (`src/engine/file/model.ts`).

- [ ] **Step 1: Add the scenarios.**
  - The model JSON is `JSON.stringify(<the file of the ok result of readFile(text)>)`; the model contains no `Set` or `Map`.
  - The check scenarios pass `new Map()` as `positions`, so their paths stay loaded paths.
  - The 16× run of every scenario stays within the file limits.

| Name | Base | Input for n | Measured run |
| --- | --- | --- | --- |
| `read:easterRangesJustOutOfReach` | 1000 | `entriesPlan(takeEntries(easterRangesJustOutOfReach, n))` | `readFile(text)` |
| `read:calendarRangesOffWeekday` | 1000 | `entriesPlan(takeEntries(calendarRangesOffWeekday, n))` | `readFile(text)` |
| `readAndCompute:limitsPlan` | 125 | `limitsPlan(n)` | `readFile`, then `computePlan(planInput(file))` |
| `check:earlyEasterRanges` | 1000 | model JSON of the `read:earlyEasterRanges` input | `checkRules(JSON.parse(text), new Map())` |
| `check:calendarRangesOffWeekday` | 1000 | model JSON of the `read:calendarRangesOffWeekday` input | `checkRules(JSON.parse(text), new Map())` |
| `write:limitsPlan` | 125 | model JSON of `limitsPlan(n)` | `writeFile(JSON.parse(text))` |

  `readAndCompute:limitsPlan` covers `suggestParts` (half days without `part`) and the source expansion.

- [ ] **Step 2: Update the baseline and run the gate.**

  Run each on its own: `npm run perf -- --update`, then `npm run perf`.

  Expected:
  - 7 scenarios, each with a growth of at most 2.2 and +0.0 %, exit 0;
  - the whole run takes about 2 minutes on the i7-8650U.

  If a scenario grows by more than 2.2×, that is a finding to report, not a reason to raise the limit.

- [ ] **Step 3: Close issue 0015.** Set the front matter. Under "Acceptance criteria", replace the timing criterion with: "`checkRules` produces the hints after reading; `npm run perf` gates reading, checking, computing and writing."

- [ ] **Step 4: Run `npm run check`.** Expected: PASS.

- [ ] **Step 5: Commit.**

  The message names the baseline as new, approved by the maintainer on 2026-10-20 with the gate's parameters.

```bash
git add tests/perf issues/0015-worst-case-read-time-of-crafted-files.md
git -c commit.gpgsign=false commit -m "Add the reading, checking, computing and writing scenarios to the gate"
```
