<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation rework, phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two spec sections that the citation check's allowlist depends on into the docs, with their subsections:
- "Holiday sources and work week";
- "Dependencies and supply chain".

Then remove those two allowlist entries.

**Architecture:** Each topic takes two commits, following `docs/dev/en/howto/docs.md`:
- a move commit carries the unchanged text, every citation update, the status lines and the ticked rows of issue 0055 (move the spec into the docs);
- a rewrite commit brings the moved text into its quadrant's register and checks every fact against the code.

No code changes except the allowlist in `scripts/citation-rules.ts` and its test.

**Tech Stack:** Markdown, the docs checks from phase 1 (`npm run check`), Vitest for the allowlist test.

**Spec:** `docs/superpowers/specs/2026-11-14-documentation-rework-design.md`, sections 3, 4 and "Phases". The binding list of destinations is the table in `issues/0055-move-the-spec-into-the-docs.md`; the move steps are in `docs/dev/en/howto/docs.md`; the style rules are in `docs/dev/en/reference/documentation-style.md`. Project rules: `AGENTS.md`.

**Phase 2 split** (this plan is 2a; each later branch gets its own plan):
- **2a:** the holiday sections and the dependency sections, as above.
- **2b:**
  - the three format references move into `docs/dev/en/reference/`;
  - the file sections: "Files", "Content of the files", "What is stored where", "Format", "Sharing and validation".
- **2c:**
  - the counting model sections and "Date arithmetic";
  - the built parts of "Architecture, technology and tests" and "Reference models for tests";
  - the source types of "Multiple calendar sources (iCal)";
  - the browsers part of "Delivery format".
- **2d:**
  - security, and build and CI;
  - the project sections: the hobby notice, files in the repository, GitHub settings, REUSE, AI tools, releases;
  - the glossary.

## Global Constraints

- **Where to work:** in the maintainer's checkout `/home/ai/Projekte/restlos-urlaubsplaner`, on branch `docs-phase-2a`. No task builds the app or runs e2e.
- **Commands:**
  - Run tools only through npm scripts (`npm run …`, `npm test`).
  - Never `npx` in any form, not even `npx --no-install`, no `npm exec`, no `node_modules/.bin` calls. Type-check with `npm run typecheck`.
  - Run single tests with `npm test -- tests/scripts/<file>.test.ts`.
  - Keep commands simple, one tool each.
- **Packages:** never add, remove or update one.
- **`npm run check`** must pass before every commit.
- **Commits:** on the branch, never on `main`, never push, tag or sign, in exactly this form:
  `git -c commit.gpgsign=false commit -m "<subject>" -m "<body>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
  Subjects are plain sentences without prefixes. Run `git add` as its own command first.
- **SPDX headers:** every new page starts with the CC-BY-4.0 HTML comment that `docs/dev/en/howto/docs.md` has.
- **Repository text stands on its own:**
  - no pointers to chats, sessions, reviews or `docs/superpowers/`;
  - an issue number always gets a short description, for example "issue 0055 (move the spec into the docs)";
  - no "Ruling …".
- **Move commits:**
  - Text moves unchanged. The only edits allowed are:
    - the ones `npm run check` demands, such as "e.g." becoming "for example";
    - splitting a sentence that mixes built and planned parts, with as few word changes as possible.
  - The commit body lists every such edit.
  - The built and planned parts follow the section's status line.
  - Planned text stays in the spec. Its status line becomes `Status: planned for version N.` with the version from the old line.
  - A section with no text left gets ``Status: moved to `<path>`.``
- **Rewrite commits:**
  - Follow the register of the page's quadrant: reference is indicative, terse, with no rationale and no second person, and uses must, must not and may. How-to is imperative, with no theory. Explanation is decision, then why, then the rejected alternatives.
  - Check every fact that a reference page or how-to states against the code. When the code does something else, the page states what the code does, and the spec's version stays in the spec as planned work, only if a planned part of that section still says so. List each case in the commit body.
  - Never change code toward the spec.
- **One binding place per fact:** a reference page doesn't repeat a fact that another reference page, `docs/holiday-data-format.md` or a hard rule in `AGENTS.md` already states. It links there instead. Developer pages use relative links.
- **No spec pointers in moved text:** a reference page, how-to or explanation page never points to a spec section, by name or by "see below". The citation check sees only the file name.
- **Never touch:** `docs/superpowers/` (except this plan's checkboxes), `tests/perf/baseline.json`, `.claude/`.

## Review Focus

1. **A moved "implemented" statement that the code doesn't do.** The reference page becomes the authority, so a wrong sentence there is a wrong requirement. Tasks 2 and 4 check each fact against the files they name.
2. **A fact in two binding places:**
   - `reference/holiday-rules.md` against `docs/holiday-data-format.md`;
   - `reference/dependencies.md` against the "Dependencies" hard rule in `AGENTS.md`;
   - the how-to against either reference.

   Tasks 2 and 4 cut the duplicate and link instead.
3. **Planned work that reads as built,** for example choosing the federal state in the UI, or ical.js as an installed package. Tasks 1 and 3 split by the status line; Tasks 2 and 4 verify.
4. **A pointer to a spec section left in moved text,** such as "see Format", "see Workflows" or "see below". Tasks 2 and 4 grep for them.
5. **Rationale left in a reference page or how-to,** such as the "Needed for DE?" column or the "Assessment" column, or a must in an explanation page. Tasks 2 and 4 move it.

---

### Task 1: Move the holiday sections unchanged

**Files:**
- Create: `docs/dev/en/explanation/holiday-sources.md`, `docs/dev/en/reference/holiday-rules.md`
- Modify:
  - `docs/SPEC.md` ("Holiday sources and work week", "Rule types of the core", "Work week per country", "Region tree and German special cases", "Maintaining holiday data");
  - `docs/holiday-data-format.md` ("Adding a country");
  - `docs/dev/en/howto/holiday-data.md`;
  - `scripts/citation-rules.ts` (the allowlist);
  - `issues/0055-move-the-spec-into-the-docs.md`;
  - `issues/0056-edge-cases-in-the-docs-checks.md`.
- Test: `tests/scripts/citation-rules.test.ts`

**Interfaces:**
- Produces: the three page paths above, which Task 2 rewrites. `SPEC_CITATION_ALLOWLIST` without the `holiday-data.md` entry.

The destination of the `##` intro is `explanation/holiday-sources.md`, not the `explanation/holiday-rules.md` that issue 0055 names. The style page says a topic ID is unique within an audience, and `reference/holiday-rules.md` already takes `holiday-rules`.

- [ ] **Step 1: Change the allowlist test.** In the test "keeps the stage 1 scope and allowlist, each entry with the step that removes it", the expected keys become `["docs/dev/en/howto/dependency-update.md", "docs/dev/en/howto/docs.md"]`.
- [ ] **Step 2: Run it and see it fail.**
  - Run `npm test -- tests/scripts/citation-rules.test.ts`.
  - Expected: FAIL, because the `holiday-data.md` key is still there.
- [ ] **Step 3: Remove the `"docs/dev/en/howto/holiday-data.md"` entry** from `SPEC_CITATION_ALLOWLIST` in `scripts/citation-rules.ts`. Run the test: PASS.
- [ ] **Step 4: Move the `##` intro.** The "Recommendation:" paragraph under "Holiday sources and work week" goes unchanged into `explanation/holiday-sources.md`, under the H1 `# Holiday sources and work week`. In the spec, the status line becomes ``Status: moved to `docs/dev/en/explanation/holiday-sources.md`.``, with no text under it.
- [ ] **Step 5: Move the built parts of the three `###` sections** unchanged into `reference/holiday-rules.md`, under the H1 `# Holiday rules`, each under its own `##` heading with the spec's name.
  - "Rule types of the core" moves whole and gets the moved status line.
  - "Work week per country": the planned part (changing the work week and the week start in the UI) stays, with `Status: planned for version 1.`
  - "Region tree and German special cases": the planned part (choosing the federal state and its local rules in the UI, the explanatory text with its link, the legal proofreading) stays, with `Status: planned for version 1.`
- [ ] **Step 6: Move the holiday-data procedure parts.**
  - "Adding a country" moves unchanged from `docs/holiday-data-format.md` into a new `## Adding a country` section at the end of `howto/holiday-data.md`, and the format reference loses that section.
  - The two built bullets of the spec's "Maintaining holiday data" (source link and check date, changes only with a source and a test) move into a new `## Maintaining holiday data` section of the how-to.
  - The bullet about the help's notice stays in the spec, with `Status: planned for version 1.`
- [ ] **Step 7: Update the citations.**
  - Step 1 of `howto/holiday-data.md` cites `reference/holiday-rules.md`, `explanation/holiday-sources.md` and `docs/holiday-data-format.md`, with relative links, and no longer names the spec.
  - Then run `git grep -n -E '"(Holiday sources and work week|Rule types of the core|Work week per country|Region tree and German special cases|Maintaining holiday data|Adding a country)"'`. The only expected hits are in `docs/SPEC.md`, `docs/superpowers/` and `issues/`.
- [ ] **Step 8: Update the issues.**
  - **Issue 0055:**
    - tick the rows "Holiday sources and work week", "Rule types of the core", "Work week per country", "Region tree and German special cases" and "Maintaining holiday data";
    - change the first row's destination to `docs/dev/en/explanation/holiday-sources.md`;
    - add one Notes line: "counting-model", "architecture", "security" and "build-and-ci" appear as both a reference and an explanation page, so each explanation page gets another name when its row moves.
  - **Issue 0056:** add the edge case that no check enforces unique topic IDs within an audience.
- [ ] **Step 9: Run `npm run check`.** Expected: PASS. Fix only what it reports, within the move-commit edits allowed by the Global Constraints.
- [ ] **Step 10: Commit.** Subject: "Move the holiday rules and the holiday-data procedure out of the spec". The body lists the allowed edits made in steps 4 to 6.

### Task 2: Rewrite the holiday pages

**Files:**
- Modify: `docs/dev/en/reference/holiday-rules.md`, `docs/dev/en/explanation/holiday-sources.md`, `docs/dev/en/howto/holiday-data.md`
- Read, to check facts:
  - `src/engine/holidays/` (`types.ts`, `rules.ts` and the substitute code);
  - `src/data/holidays/de.json` and `index.ts`;
  - the work-week and week-start code in `src/engine/` and `src/ui/`;
  - `docs/holiday-data-format.md`.

**Interfaces:**
- Consumes: the pages from Task 1.
- Produces: final pages. Branch 2b moves `docs/holiday-data-format.md` and will update the links that point to it.

- [ ] **Step 1: Rewrite the reference page.**
  - Write it in reference register.
  - Cut every fact that `docs/holiday-data-format.md` already states, and link to its section instead: the rule types and their fields under "Date rules", `nonLeap` for 29 February, "Local rules" and "Substitute days". What remains says what the format reference doesn't, for example the region tree, the German special cases with their official sources, and the place of work.
  - A rationale clause, such as the "Needed for DE?" column, "Countries define the work week differently … Therefore", or why the place of work decides, goes to the explanation page.
- [ ] **Step 2: Rewrite the explanation page.** Turn the "Recommendation:" label into a plain statement of the decision. Then give the why, including the rationale from step 1.
- [ ] **Step 3: Rewrite the how-to.**
  - Merge "Adding a country" and "Maintaining holiday data" into the numbered steps, so each instruction appears once. For example, the source map with `checked` is already step 4, and the tests are step 6.
  - A new country's file, import and `countries` entry become one step.
  - Drop "see the how-to above".
- [ ] **Step 4: Check each statement on the reference page and in the how-to** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -i -E 'SPEC|see (below|above|Format|Counting model)' docs/dev/en/reference/holiday-rules.md docs/dev/en/explanation/holiday-sources.md docs/dev/en/howto/holiday-data.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the holiday pages for their quadrants". The body lists the facts checked against the code and every case where the code differed.

### Task 3: Move the dependency sections unchanged

**Files:**
- Create: `docs/dev/en/explanation/supply-chain.md`, `docs/dev/en/reference/dependencies.md`
- Modify:
  - `docs/SPEC.md` ("Dependencies and supply chain", "Dependencies", "Measures against supply chain attacks");
  - `docs/dev/en/howto/dependency-update.md` and `docs/dev/en/howto/docs.md`;
  - `AGENTS.md` (the "Dependencies" hard rule);
  - `scripts/citation-rules.ts`;
  - `issues/0055-move-the-spec-into-the-docs.md`.
- Test: `tests/scripts/citation-rules.test.ts`

**Interfaces:**
- Produces: the two page paths, which Task 4 rewrites. `SPEC_CITATION_ALLOWLIST` with only the `docs.md` entry.

- [ ] **Step 1: Change the allowlist test.** The expected keys become `["docs/dev/en/howto/docs.md"]`. Run it and see it FAIL.
- [ ] **Step 2: Remove the `dependency-update.md` entry** from `SPEC_CITATION_ALLOWLIST`. Run the test: PASS.
- [ ] **Step 3: Move the `##` intro.** The "Recommendation:" paragraph moves unchanged into `explanation/supply-chain.md`, under the H1 `# Dependencies and supply chain`. The spec gets ``Status: moved to `docs/dev/en/explanation/supply-chain.md`.``
- [ ] **Step 4: Move both `###` sections whole** into `reference/dependencies.md`, under the H1 `# Dependencies`, as `## Approved packages` (the table) and `## Measures against supply chain attacks`.
  - The table moves whole, also the rows of packages that aren't installed: an approval applies before the package is installed.
  - Both spec sections get ``Status: moved to `docs/dev/en/reference/dependencies.md`.``
- [ ] **Step 5: Update the citations.**
  - **`AGENTS.md`:** "only packages listed in the spec" becomes "only packages listed in `docs/dev/en/reference/dependencies.md`".
  - **Step 1 of `howto/dependency-update.md`:** it links to the reference page instead of the spec.
  - **The hard rule in `howto/docs.md`:** it becomes "Docs never cite the spec. Exception: this page's move steps."
  - **Check for stray citations:** run `git grep -n -E '"(Dependencies and supply chain|Dependencies|Measures against supply chain attacks)"|listed in the spec'`. The only expected hits are in `docs/SPEC.md`, `docs/superpowers/` and `issues/`.
- [ ] **Step 6: Update issue 0055.**
  - Tick the rows "Dependencies and supply chain", "Dependencies" and "Measures against supply chain attacks".
  - Drop "L58 ('only packages listed in the spec', phase 2 with the Dependencies row)" from the stage 2 list.
- [ ] **Step 7: Run `npm run check`.** Expected: PASS.
- [ ] **Step 8: Commit.** Subject: "Move the package list and the supply chain measures out of the spec". The body lists the allowed edits.

### Task 4: Rewrite the dependency pages

**Files:**
- Modify: `docs/dev/en/reference/dependencies.md`, `docs/dev/en/explanation/supply-chain.md`
- Read, to check facts:
  - `package.json`, `.npmrc`, `.github/dependabot.yml` and `.github/workflows/dependency-review.yml`;
  - the CSP in `scripts/build/`;
  - `flake.nix`;
  - the "Dependencies" hard rule in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 3.

- [ ] **Step 1: Rewrite the table.**
  - Columns: Package, Purpose, In the HTML, Installed. The Installed column says "yes", or names the feature that brings the package, for example "with the iCal import".
  - The "Assessment" column and the "date library – not needed" row move to the explanation page.
  - "Check the dependency tree during setup, otherwise `@messageformat/core`" becomes the fact `package.json` shows.
  - Keep the approval dates.
- [ ] **Step 2: Rewrite the measures.**
  - Write them as must, must not and may statements.
  - Each "because …" clause goes to the explanation page.
  - "Checked during setup, otherwise a targeted exception" for esbuild becomes the fact the setup shows.
  - "(see Workflows)" and "(Nix ecosystem, see below)" become links to the files under `.github/`, or are dropped.
  - Whatever the "Dependencies" hard rule in `AGENTS.md` already says isn't repeated as a second rule. Link to `AGENTS.md`, or state each fact once and make sure both say the same.
- [ ] **Step 3: Rewrite the explanation page.**
  - Decision first, then why: the npm incidents of 2026, and the per-package assessments from step 1.
  - Then the rejected alternatives the moved text names, such as a date library.
- [ ] **Step 4: Check each statement on the reference page** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -i -E 'SPEC|see (below|above|Workflows)' docs/dev/en/reference/dependencies.md docs/dev/en/explanation/supply-chain.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the dependency pages for their quadrants". The body lists the facts checked against the code and every case where the code differed.
