<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation rework, phase 2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the built parts of these spec sections into reference pages under `docs/dev/en/`, with their rationale in explanation pages:
- the counting model sections;
- "Date arithmetic";
- the built parts of "Architecture, technology and tests", including the worker part of "Sharing and validation";
- "Reference models for tests";
- the source types of "Multiple calendar sources (iCal)";
- the browsers part of "Delivery format".

**Architecture:** three topics, each in two tasks: a move commit with the unchanged text and every citation update, then a rewrite commit.
- **Tasks 1 and 2:** the counting model and the iCal source types.
- **Tasks 3 and 4:** architecture, date arithmetic and tests.
- **Tasks 5 and 6:** the browsers and `file://`.

No code changes except paths in comments and in one ESLint message.

**Tech Stack:** Markdown, the docs checks from phase 1 (`npm run check`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-documentation-rework-design.md`, sections 3, 4 and "Phases".
- The binding list of destinations is the table in `issues/0055-move-the-spec-into-the-docs.md`.
- The move steps are in `docs/dev/en/howto/docs.md`.
- The style rules are in `docs/dev/en/reference/documentation-style.md`.
- Project rules: `AGENTS.md`.

**Phase 2 split:**
- **2a and 2b** are merged: the holiday, dependency and file sections, and the three format references.
- **2c** is this plan.
- **2d:** security, build and CI, the project sections and the glossary.

**Decided in this plan:**
- **Three "Recommendation:" paragraphs move one phase early,** because the moved text has reason clauses that need an explanation page. Issue 0055 allows doing a row early. The three paragraphs are those of "Counting model (weights)", "Architecture, technology and tests" and "Delivery format", the last one together with "No desktop wrapper".
- **Explanation page names:**
  - `docs/dev/en/explanation/counting-choices.md`;
  - `docs/dev/en/explanation/architecture-choices.md`;
  - `docs/dev/en/explanation/delivery-format.md`.

  A topic ID is unique within an audience, so the first two can't take the names of their reference twins.
- **No `docs/dev/en/reference/calendar-sources.md`.**
  - The built part of the iCal section is the source types and their effects. "Calendar sources" in `reference/file-format.md` and its subsections already state them.
  - The display of several sources on one day is already in the spec's "Day cell: what is shown how", which moves in phase 4.
  - So the iCal section is cut where those state it. The rest goes to `file-format.md` and `holiday-rules.md`.
- **The architecture diagram stays in the spec as tracking.** It draws planned outputs (.ics, print, `.typ`, the HTML copy) and planned plan state (recovery).
- **"Architecture, technology and tests" stays "partly implemented".** It keeps the feasibility table with its done tests, which moves in phase 3, so its status line names only what is missing.
- **The last bullet of "Delivery format"** ("No network access at runtime…") stays for branch 2d. Its fact belongs to "Security" there.

## Global Constraints

- **Where to work:** in the maintainer's checkout `/home/ai/Projekte/restlos-urlaubsplaner`, on branch `docs-phase-2c`. No task builds the app or runs e2e.
- **Commands:**
  - Run tools only through npm scripts (`npm run …`, `npm test`).
  - Never `npx` in any form, not even `npx --no-install`. No `npm exec`, no `node_modules/.bin` calls, no `node scripts/…` calls. Type-check with `npm run typecheck`.
  - Run single tests with `npm test -- <file>`.
  - Keep commands simple, one tool each.
- **Packages:** never add, remove or update one.
- **`npm run check`** must pass before every commit.
- **Commits:**
  - On the branch, never on `main`.
  - Never push, tag or sign.
  - Use exactly this form:
    `git -c commit.gpgsign=false commit -m "<subject>" -m "<body>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
  - Subjects are plain sentences without prefixes. Run `git add` as its own command first.
- **SPDX headers:** every new page starts with the CC-BY-4.0 HTML comment that `docs/dev/en/howto/docs.md` has.
- **Repository text stands on its own:**
  - no pointers to chats, sessions, reviews or `docs/superpowers/`;
  - an issue number always gets a short description, for example "issue 0055 (move the spec into the docs)";
  - no "Ruling …".
- **Move commits:**
  - Text moves unchanged. The only edits allowed are:
    - the ones `npm run check` demands, such as "e.g." becoming "for example";
    - splitting a sentence or a table row that mixes built and planned parts, with as few word changes as possible.
  - The commit body lists every such edit.
  - The built and planned parts follow the section's status line; where the line is ambiguous, check the code.
  - Planned text stays in the spec, and its status line names what remains.
  - A section with no text left gets ``Status: moved to `<path>`.`` A section with only planned text left gets `Status: planned for version N.`, with the lowest version from its old line.
- **Cutting duplicates:** a sentence, bullet or table row whose fact a reference page already states, even in other words, is deleted from the spec instead of moved. Each cut is noted for the commit body together with the heading of the place that states it. A sentence that says more than that place is not a duplicate.
- **Rewrite commits:**
  - Follow the register of the page's quadrant:
    - reference is indicative and terse, with no rationale and no second person, and it uses must, must not and may;
    - explanation is decision, then why, then the rejected alternatives, as `docs/dev/en/explanation/file-kinds.md` does with `## Why` and `## Rejected alternatives`.
  - Check every fact a reference page states against the code.
  - When the code does something else, the page states what the code does. The spec's version stays in the spec as planned work only if a planned part of that section still says so.
  - List each case in the commit body. Never change code toward the spec.
  - A measurement with a date or a tested browser version is evidence, not a requirement. It goes to the explanation page, or the reference page links to `docs/feasibility.md`, which holds the results.
- **One binding place per fact:**
  - A reference page doesn't repeat a fact that another reference page or a hard rule in `AGENTS.md` already states; it links there instead.
  - The hard rules that overlap most: "Counting model", "Dates", "Performance", "Browsers" and "Security".
  - Developer pages use relative links; the repository root is `../../../../` from `docs/dev/en/<quadrant>/`.
- **No spec pointers in moved text:** a reference or explanation page never points to a spec section, whether by name, by "see below" or by "see Allowance display". The citation check sees only the file name.
- **Never touch:** `docs/superpowers/` (except this plan's checkboxes), `tests/perf/baseline.json`, `.claude/`.

## Review Focus

1. **Planned work moved as built.** Candidates the status lines and the code decide:
   - the .ics and template rows of "Finer granularity";
   - the decimal display "depending on the setting";
   - dismissing a time-off need for one day, in issue 0043 (dismiss a time-off need for one day);
   - an .ics file as the source of "Leave from another plan";
   - "migration" and the "`revision` warning" in the Files row of the test strategy;
   - the iCal, PDF/Typst and Pro HTML test rows;
   - help, templates and a font inside the size budget;
   - WASM and the user's files in the `file://` bullet;
   - the clear message when a browser lacks a feature.

   Tasks 1, 3 and 5 split by the status line and the code; Tasks 2, 4 and 6 verify.
2. **A sentence cut as a duplicate that the reference doesn't actually state.** That would be a lost requirement. Examples to check:
   - the iCal "Effect" row says "0 or ½" for Holiday, `file-format.md` says `"0"` … `"1"`;
   - "Values that cannot be represented exactly in 1/480 are rejected on loading with a message" against what the reader does.

   Each cut is listed with the place that states it, so the review can verify.
3. **A fact in two binding places.** Examples:
   - `counting-model.md` against the "Counting model" and "Dates" hard rules;
   - `counting-model.md` against `file-format.md`, for `take`, `part`, `minUnit` and time off needed;
   - `test-strategy.md` against the "Performance" hard rule;
   - the counting rows of `test-strategy.md` against the "Tests" row of `counting-model.md`;
   - `browsers-and-file-urls.md` against the "Browsers" hard rule.

   The rewrite tasks link instead.
4. **Dated evidence written as a requirement:**
   - the handover times of 69–152 ms and the 13.2 MB model;
   - the CI agreement within 0.5 % measured 2026-10-24;
   - the browser versions tested on 2026-11-02;
   - "Firefox ESR (currently 153, as of 2026-10-17)";
   - "Svelte 5 (currently 5.57.2 from 6 October 2026)".

   They go to explanation pages, to `docs/feasibility.md` or to `docs/dev/en/reference/dependencies.md`, not into reference text that must stay true.
5. **A spec pointer left in moved text,** such as "see Allowance display", "see Mandatory leave", "see Detail view", "see Format", "see Counting model", "see Sharing and validation, Loading", "see .ics export" or "see File operations". The rewrite tasks grep for them.

---

### Task 1: Move the counting model sections and the iCal source types

**Files:**
- Create: `docs/dev/en/reference/counting-model.md`, `docs/dev/en/explanation/counting-choices.md`
- Modify:
  - `docs/SPEC.md`: "Multiple calendar sources (iCal)", "Counting model (weights)", "The one formula", "Finer granularity: prepared, offered only in the leave bar", "How a day's required work comes about", "Work week with validity";
  - `docs/dev/en/reference/file-format.md`, `docs/dev/en/reference/holiday-rules.md`;
  - `src/ui/i18n/format.ts` (the comment at L68);
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Produces: `reference/counting-model.md` with the H2 headings `## The one formula`, `## Finer granularity`, `## How a day's required work comes about` and `## Work week with validity`, and `explanation/counting-choices.md` with the H1 `# Counting choices`. Task 2 rewrites both.

- [ ] **Step 1: Cut the duplicates** in the six sections, by the rule in the Global Constraints. Places to compare with:
  - in `reference/file-format.md`: "Values", "Smallest leave unit", "Work week", "Calendar sources" with "Types", "Entries", "Time off needed" and "Leave from another plan", and the intro at L10 ("no time zone");
  - in `docs/SPEC.md`: "Day cell: what is shown how", layer 4, for the conflicts display ("the cell shows up to three lanes and beyond that a '+' pattern").
- [ ] **Step 2: Move the "Recommendation:" paragraph of "Counting model (weights)"** unchanged into `explanation/counting-choices.md`, under the H1 `# Counting choices`.
- [ ] **Step 3: Move the four counting subsections** into `reference/counting-model.md`, under the H1 `# Counting model` and one H2 each, with the headings from the Interfaces block. Move only what step 1 left of their built parts.
  - "The one formula" is implemented and moves whole.
  - "Finer granularity": the .ics and template rows and the paragraph "What is still missing later is only UI…" stay. Check in `src/ui/i18n/format.ts` whether a setting switches to decimal numbers; if not, "or a decimal number, depending on the setting" stays as planned.
  - "How a day's required work comes about": dismissing a need for one day stays, because issue 0043 (dismiss a time-off need for one day) is open.
  - "Work week with validity": the help's text on the two counting methods and on § 5 BUrlG stays.
- [ ] **Step 4: Move what step 1 left of the built iCal text.**
  - What a source type does goes to the end of its section in `reference/file-format.md`, for example the use of "Leave from another plan" for the previous year.
  - "School holidays are not built in" and "They come as a calendar source of type Info" go to the end of "Embedded countries" in `reference/holiday-rules.md`.
  - These stay: import, "Update source", editing and export, the duplicate mark, the up and down buttons for the order, and the help's list of school holiday sources.
  - Check `src/engine/file/other-plan.ts`: if it reads only `.urlaub.json`, "The source is an .ics" stays as planned.
- [ ] **Step 5: Update the status lines** by the rule in the Global Constraints:
  - "Counting model (weights)" and "The one formula" get ``Status: moved to `<path>`.``
  - Each section with only planned text left gets `Status: planned for version N.`
- [ ] **Step 6: Update the citations.**
  - Run `git grep -n -E 'Counting model|one formula|Finer granularity|required work comes about|Work week with validity|Multiple calendar sources|Mandatory leave|Time off needed' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md'`.
  - Update every hit that cites the spec to the page the text moved to. The known one is `src/ui/i18n/format.ts:68`.
  - Leave the "Counting model" hard rule in `AGENTS.md` unchanged; it doesn't cite the spec.
- [ ] **Step 7: Update issue 0055.**
  - Tick the rows "Multiple calendar sources (iCal)", "Counting model (weights)", "The one formula", "Finer granularity: prepared, offered only in the leave bar", "How a day's required work comes about" and "Work week with validity".
  - "Multiple calendar sources (iCal)" gets this destination: cut where `docs/dev/en/reference/file-format.md` or the spec's "Day cell: what is shown how" says it already; the rest to `docs/dev/en/reference/file-format.md` and `docs/dev/en/reference/holiday-rules.md`; planned parts stay as tracking.
  - "Counting model (weights)" gets `docs/dev/en/explanation/counting-choices.md`, phase 2.
  - Drop " (new)" after every path that now exists.
  - In the note on pages that appear as both a reference and an explanation page, name `counting-choices.md` for the counting model.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.**
  - Subject: "Move the counting model sections and the iCal source types out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the code decided what is built.

### Task 2: Rewrite the moved counting text

**Files:**
- Modify:
  - `docs/dev/en/reference/counting-model.md`, `docs/dev/en/explanation/counting-choices.md`;
  - in `docs/dev/en/reference/file-format.md` and `docs/dev/en/reference/holiday-rules.md`, only the text Task 1 added;
  - `docs/dev/en/explanation/holiday-sources.md`, if a reason clause from `holiday-rules.md` isn't there yet.
- Read, to check facts:
  - `src/engine/counting/`, `src/engine/weight.ts`, `src/engine/days.ts`;
  - `src/ui/i18n/format.ts`, `src/ui/calendar/leave-switch.ts`, `src/ui/calendar/keyboard.svelte.ts`;
  - `tests/engine/counting/`;
  - the "Counting model" and "Dates" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 1.
- Produces: `reference/counting-model.md` with the H2 headings `## Cost of a day`, `## Units`, `## Required work`, `## Mandatory leave` and `## Work week`. Task 4 links to them from `reference/test-strategy.md`.

- [ ] **Step 1: Rewrite `reference/counting-model.md`** in reference register, under the headings from the Interfaces block.
  - Link to the "Counting model" hard rule in `AGENTS.md` instead of restating it: 480 units, no floats, cost as the overlap, the order of the layers and the leave bar down to 1/32.
  - Link to `file-format.md` for what it states about `take`, `part`, `minUnit` and time off needed.
  - A reason clause goes to `explanation/counting-choices.md`. Examples: "so that sums stay exact", "This way a contract with a switch to part-time stays one file".
  - The table of example days stays a table.
- [ ] **Step 2: Rewrite the text Task 1 added** to `file-format.md` and `holiday-rules.md` in the page's existing register and terminology. Merge each piece into the section around it, so that every fact appears once on the page. The reason "because the dates are set anew every year" goes to `explanation/holiday-sources.md` if that page doesn't say it already.
- [ ] **Step 3: Rewrite `explanation/counting-choices.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision.
  - Give the why, including the reason clauses from step 1.
  - Then the rejected alternatives the moved text names: floats, a fixed set of "only 0, ½, 1", and `"full"`/`"half"` as values.
- [ ] **Step 4: Check every statement on `counting-model.md`** and in the added text against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|Format|Allowance display|Mandatory leave|Detail view|Counting model|Date arithmetic)' docs/dev/en/reference/counting-model.md docs/dev/en/explanation/counting-choices.md docs/dev/en/reference/file-format.md docs/dev/en/reference/holiday-rules.md docs/dev/en/explanation/holiday-sources.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the moved counting text for its quadrants". The body lists the facts checked against the code and every case where the code differed.

### Task 3: Move the architecture, date arithmetic and test sections

**Files:**
- Create: `docs/dev/en/reference/architecture.md`, `docs/dev/en/reference/test-strategy.md`, `docs/dev/en/explanation/architecture-choices.md`
- Modify:
  - `docs/SPEC.md`: "Reference models for tests", "Date arithmetic", "Sharing and validation", "Architecture, technology and tests";
  - `eslint.config.js` (the message at L46), `scripts/build/vite-restlos.ts` (the comments at L7 and L85), `src/ui/worker/client.ts` (L70), `src/ui/worker/protocol.ts` (L4);
  - `docs/feasibility.md` (L8);
  - `issues/0055-move-the-spec-into-the-docs.md`, `issues/0056-edge-cases-in-the-docs-checks.md`.

**Interfaces:**
- Produces:
  - `reference/architecture.md` with the H2 headings `## Engine`, `## Date arithmetic`, `## Worker` and `## Size budget`;
  - `reference/test-strategy.md` with `## Reference models` and `## Test levels`;
  - `explanation/architecture-choices.md` with the H1 `# Architecture choices`.

  Task 4 rewrites them.

- [ ] **Step 1: Cut the duplicates** in the four sections, by the rule in the Global Constraints. The second paragraph of "Date arithmetic", on weights in files, is compared with "Values" and "Reading" in `reference/file-format.md`.
- [ ] **Step 2: Move the "Recommendation:" paragraph of "Architecture, technology and tests"** unchanged into `explanation/architecture-choices.md`, under the H1 `# Architecture choices`.
- [ ] **Step 3: Move the built architecture text** into `reference/architecture.md`, under the H1 `# Architecture` and the headings from the Interfaces block.
  - `## Engine`: "All outputs (UI, .ics, PDF, JSON) read the same computed state…", split by what is built. The diagram stays in the spec.
  - `## Date arithmetic`: what step 1 left of "Date arithmetic", which is implemented.
  - `## Worker`: the "**Worker:**" paragraph without the Pro HTML part. After it, the worker part of "Sharing and validation", "Loading": from "Opening runs in two steps in a Web Worker" to "took 0.3–2 ms", without the progress bar.
  - `## Size budget`: the built part of "**Size budget:**". Check in `scripts/build/vite-restlos.ts` and the build what the limit covers today. Help, templates and a font that aren't built stay; so does the Pro HTML.
  - These stay in the spec: "**Licenses in the build:**", the feasibility table with the paragraph after it, the open dialog, the progress bars and the refusal dialogs.
- [ ] **Step 4: Move the test text** into `reference/test-strategy.md`, under the H1 `# Test strategy`.
  - `## Reference models`: "Reference models for tests", whole; it is implemented.
  - `## Test levels`: the built rows of the "**Test strategy**" table, as a table with the same columns. Check each row's tool and tests in `tests/`, `e2e/`, `playwright.config.ts` and `package.json`.
  - The iCal and PDF/Typst rows stay in the spec, and so does every planned part of a row, such as the Pro HTML in "End-to-end" or "migration" in "Files".
- [ ] **Step 5: Update the status lines.**
  - "Reference models for tests" and "Date arithmetic" get ``Status: moved to `<path>`.``
  - "Sharing and validation" gets `Status: planned for version 1.`
  - "Architecture, technology and tests" stays "partly implemented". Its line names only what is missing: `Status: partly implemented; the About / Licenses page and the iCal and PDF/Typst tests are not built, planned for version 1; the Pro HTML and its feasibility test, planned for version 2; the feasibility test of the HTML self-copy, planned for version 3.`
- [ ] **Step 6: Update the citations.**
  - Run `git grep -n -E 'Date arithmetic|Reference models|Test strategy|Size budget|"Worker"|Sharing and validation|Architecture, technology' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md'`.
  - Known hits: `eslint.config.js:46`, `scripts/build/vite-restlos.ts:85`, `src/ui/worker/client.ts:70` and `src/ui/worker/protocol.ts:4`. Update each to the page the text moved to.
  - `scripts/build/vite-restlos.ts:7` cites the whole spec for the worker string module, the CSP and the size limit. Cite `docs/dev/en/reference/architecture.md` for the worker and the size limit, and keep `docs/SPEC.md, "Content Security Policy"` for the CSP, which moves in branch 2d.
  - `docs/feasibility.md:8`: name the pages that now hold the "Architecture, technology and tests" results. Keep the spec sections that still hold the rest.
  - Leave `tests/scripts/citation-rules.test.ts` unchanged; its paths are test data.
- [ ] **Step 7: Update issue 0056 (edge cases in the docs checks).** Its "Citation forms the section-name check skips" examples point to `eslint.config.js:46` and `src/ui/worker/protocol.ts:4`, which step 6 changes. Write each form as an inline example instead, for example `(docs/SPEC.md, Date arithmetic)`.
- [ ] **Step 8: Update issue 0055.**
  - Tick "Reference models for tests", "Date arithmetic" and "Sharing and validation".
  - Leave "Architecture, technology and tests" unticked, because its open feasibility tests move in phase 3. Change its recommendation destination to `docs/dev/en/explanation/architecture-choices.md`, phase 2.
  - Drop " (new)" after every path that now exists.
  - In the note on pages that appear as both a reference and an explanation page, name `architecture-choices.md` for the architecture.
- [ ] **Step 9: Run `npm run check`.** Expected: PASS. Then run `npm test -- tests/lint/no-date-in-engine.test.ts`. Expected: PASS.
- [ ] **Step 10: Commit.**
  - Subject: "Move the architecture, date arithmetic and test sections out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the code decided what is built.

### Task 4: Rewrite the moved architecture and test text

**Files:**
- Modify: `docs/dev/en/reference/architecture.md`, `docs/dev/en/reference/test-strategy.md`, `docs/dev/en/explanation/architecture-choices.md`
- Read, to check facts:
  - `package.json`, `vite.config.ts`, `eslint.config.js`, `scripts/build/`;
  - `src/engine/` (its imports), `src/ui/worker/`;
  - `tests/reference/`, `tests/perf/`, `tests/engine/`, `tests/lint/`, `playwright.config.ts`, `e2e/`;
  - `docs/dev/en/reference/dependencies.md`;
  - the "Dates", "Performance" and "Security" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 3, and the headings of `reference/counting-model.md` from Task 2.
- Produces: `reference/architecture.md` with the H2 headings `## Technology`, `## Engine`, `## Day numbers`, `## Worker` and `## Single-file build`. Task 6 links to `## Single-file build`.

- [ ] **Step 1: Rewrite `reference/architecture.md`** in reference register, under the headings from the Interfaces block.
  - `## Technology` states the facts the moved "Recommendation:" paragraph names and the code confirms: Svelte 5 and TypeScript, Vite with vite-plugin-singlefile, Vitest. Versions are linked to `dependencies.md`, not written.
  - `## Engine` states that the engine is a pure TypeScript module without DOM and without runtime dependencies, if its imports confirm it.
  - `## Day numbers` links to the "Dates" hard rule instead of restating it.
  - A reason clause goes to `explanation/architecture-choices.md`. Examples: why a classic worker from a `blob:` URL, why no Blobs, why the model stays in the worker.
- [ ] **Step 2: Rewrite `reference/test-strategy.md`.**
  - Link to the "Performance" hard rule instead of restating it. Keep only what the rule doesn't say, such as the input sizes and the growth factor, if `tests/perf/` confirms them.
  - The counting rows link to `reference/counting-model.md` instead of repeating a fact that page states.
  - The python-holidays version and the date-holidays range must match `tests/reference/` and the dev shell.
- [ ] **Step 3: Rewrite `explanation/architecture-choices.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision.
  - Give the why, including the reason clauses from step 1 and the dated handover measurements.
  - Then the rejected alternatives the moved text names: a module worker from a `blob:` URL, Vite's inline worker with its `data:` URL, handing the whole model to the page, and Blobs between page and worker.
- [ ] **Step 4: Check every statement on the two reference pages** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|Sharing and validation|Loading|Delivery format|Content Security Policy|Built-in help|\.ics export|Test strategy)' docs/dev/en/reference/architecture.md docs/dev/en/reference/test-strategy.md docs/dev/en/explanation/architecture-choices.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the moved architecture and test text for its quadrants". The body lists the facts checked against the code and every case where the code differed.

### Task 5: Move the browsers part of "Delivery format"

**Files:**
- Create: `docs/dev/en/reference/browsers-and-file-urls.md`, `docs/dev/en/explanation/delivery-format.md`
- Modify:
  - `docs/SPEC.md`: "Delivery format";
  - `docs/feasibility.md` (L8);
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Produces: `reference/browsers-and-file-urls.md` with the H2 headings `## Supported browsers` and `## Opened from disk`, and `explanation/delivery-format.md` with the H1 `# Delivery format`. Task 6 rewrites both.

- [ ] **Step 1: Cut the duplicates** in "Delivery format", by the rule in the Global Constraints. Compare with `reference/architecture.md` (the size budget) and the other reference pages.
- [ ] **Step 2: Move the "Recommendation:" paragraph and the "**No desktop wrapper.**" paragraph** unchanged into `explanation/delivery-format.md`, under the H1 `# Delivery format`.
- [ ] **Step 3: Move the built browsers text** into `reference/browsers-and-file-urls.md`, under the H1 `# Browsers and file URLs`.
  - `## Supported browsers`: the built parts of the "**Supported browsers:**" paragraph. Check `src/` for a message when a browser lacks a feature; if there is none, that sentence stays as planned. The help's pointers for Safari and iPhone users stay.
  - `## Opened from disk`: the built part of the first bullet of "**Consequences of `file://` for the design**". Check `scripts/build/` for what is embedded today. WASM and opening the user's own files stay, because opening real files is issue 0030 (open real files in the UI: rule sets and the read report).
  - These stay in the spec: the variants table, "**Pages layout:**", the saving and storage bullets, and the last bullet on network access, which moves with "Security" in branch 2d.
- [ ] **Step 4: Check the status line** of "Delivery format". Keep it if it still names what is missing, because the variants table keeps the built standard HTML row.
- [ ] **Step 5: Update the citations.**
  - Run `git grep -n -E 'Delivery format|Supported browsers|desktop wrapper|Consequences of' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md'`.
  - Update every hit that cites the spec to the page the text moved to.
  - `docs/feasibility.md:8`: name `docs/dev/en/reference/browsers-and-file-urls.md` for the browser results that moved, and keep "Delivery format" for the storage results that stay.
- [ ] **Step 6: Update issue 0055.**
  - Tick "Delivery format": its browsers part and its recommendation have moved, and what remains is planned or moves with "Security".
  - Change its destination to name `docs/dev/en/explanation/delivery-format.md` for phase 2, and add that the bullet on network access moves with "Security".
  - Drop " (new)" after every path that now exists.
- [ ] **Step 7: Run `npm run check`.** Expected: PASS.
- [ ] **Step 8: Commit.**
  - Subject: "Move the browsers part of the delivery format out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the code decided what is built.

### Task 6: Rewrite the moved browsers text

**Files:**
- Modify: `docs/dev/en/reference/browsers-and-file-urls.md`, `docs/dev/en/explanation/delivery-format.md`
- Read, to check facts:
  - `vite.config.ts` (`build.target`), `scripts/build/`, `flake.nix`;
  - `playwright.config.ts`;
  - `docs/feasibility.md`;
  - the "Browsers" and "Security" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 5, and `## Single-file build` in `reference/architecture.md` from Task 4.

- [ ] **Step 1: Rewrite `reference/browsers-and-file-urls.md`** in reference register.
  - Link to the "Browsers" hard rule in `AGENTS.md` instead of restating that only ESR features are used and that the ESR is checked by hand.
  - State the build target as the code sets it, not as a dated version list.
  - Link to `docs/feasibility.md` for which browser versions were tested and when.
  - What the single-file build embeds is linked to `architecture.md`, not repeated.
  - A reason clause goes to `explanation/delivery-format.md`.
- [ ] **Step 2: Rewrite `explanation/delivery-format.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision. Name the GitHub Pages version as planned for version 1.
  - Give the why, including the reason clauses from step 1.
  - Then the rejected alternatives the moved text names: a local server .exe, Tauri and Electron.
- [ ] **Step 3: Check every statement on the reference page** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 4: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|Build and CI|Documentation website|File operations|Delivery format)' docs/dev/en/reference/browsers-and-file-urls.md docs/dev/en/explanation/delivery-format.md`.
  - Expected: no output.
- [ ] **Step 5: Run `npm run check`.** Expected: PASS.
- [ ] **Step 6: Commit.** Subject: "Rewrite the moved browsers text for its quadrants". The body lists the facts checked against the code and every case where the code differed.
