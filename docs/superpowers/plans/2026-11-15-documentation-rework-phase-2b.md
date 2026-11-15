<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation rework, phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Move the three format references into `docs/dev/en/reference/`.
- Then move the spec's file sections after them: "Files: plan file, rule set and settings", "Content of the files", "What is stored where", "Format" and the built parts of "Sharing and validation".

**Architecture:**
- **Task 1** moves the three files with `git mv` and updates every citation of their paths.
- **Task 2** is the move commit for the spec sections. It cuts what the format reference already says, moves the remaining built text unchanged, and leaves the planned text as tracking.
- **Task 3** is the rewrite commit. It brings the moved text into its quadrant's register and checks every fact against the code.

No code changes except paths in comments and tests.

**Tech Stack:** Markdown, the docs checks from phase 1 (`npm run check`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-documentation-rework-design.md`, sections 3, 4 and "Phases".
- The binding list of destinations is the table in `issues/0055-move-the-spec-into-the-docs.md`.
- The move steps are in `docs/dev/en/howto/docs.md`.
- The style rules are in `docs/dev/en/reference/documentation-style.md`.
- Project rules: `AGENTS.md`.

**Phase 2 split:**
- **2a** is merged: the holiday and dependency sections.
- **2b** is this plan.
- **2c:**
  - the counting model sections and "Date arithmetic";
  - the built parts of "Architecture, technology and tests", including the worker part of "Sharing and validation";
  - "Reference models for tests";
  - the source types of "Multiple calendar sources (iCal)";
  - the browsers part of "Delivery format".
- **2d:**
  - security, and build and CI;
  - the project sections;
  - the glossary.

**Decided in this plan:**
- **"What is stored where"** moves to `docs/dev/en/reference/files.md`, not to `file-format.md` as issue 0055 says. The section lists which content lives in which kind of file and which in the browser. `file-format.md` documents the keys of plan files and rule sets.
- **The "Recommendation:" paragraph** of "Files: plan file, rule set and settings" moves in this branch to `docs/dev/en/explanation/file-kinds.md`, one phase early, so the `##` keeps no rationale. Issue 0055 allows doing a row early.

## Global Constraints

- **Where to work:** in the maintainer's checkout `/home/ai/Projekte/restlos-urlaubsplaner`, on branch `docs-phase-2b`. No task builds the app or runs e2e.
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
  - Subjects are plain sentences without prefixes. Run `git add` (or `git mv`) as its own command first.
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
  - The built and planned parts follow the section's status line; where the line is ambiguous, check the code.
  - Planned text stays in the spec, and its status line names what remains. A section with no text left gets ``Status: moved to `<path>`.``
- **Rewrite commits:**
  - Follow the register of the page's quadrant:
    - reference is indicative and terse, with no rationale and no second person, and it uses must, must not and may;
    - how-to is imperative, with no theory;
    - explanation is decision, then why, then the rejected alternatives.
  - Check every fact a reference page states against the code.
  - When the code does something else, the page states what the code does. The spec's version stays in the spec as planned work only if a planned part of that section still says so.
  - List each case in the commit body. Never change code toward the spec.
- **One binding place per fact:**
  - A reference page doesn't repeat a fact that another reference page or a hard rule in `AGENTS.md` already states; it links there instead.
  - The "File formats" hard rule in `AGENTS.md` overlaps the file kinds most.
  - Developer pages use relative links; the repository root is `../../../../` from `docs/dev/en/<quadrant>/`.
- **No spec pointers in moved text:** a reference, how-to or explanation page never points to a spec section, whether by name, by "see below" or by "see File operations". The citation check sees only the file name.
- **Never touch:** `docs/superpowers/` (except this plan's checkboxes), `tests/perf/baseline.json`, `.claude/`.

## Review Focus

1. **A citation left on an old path:**
   - `docs/file-format.md`, `docs/day-rules-format.md` or `docs/holiday-data-format.md` in a code comment;
   - a test that reads the file, such as `tests/examples/minimal.test.ts`;
   - a relative link in a `docs/dev/` page.

   `npm run check` catches most of these, and the grep in Task 1 catches the rest.
2. **A spec sentence cut as a duplicate that the format reference doesn't actually state.** That would be a lost requirement. Task 2 lists each cut together with the place that says it, so the review can verify.
3. **Planned work moved as built.** Examples:
   - the editor commands;
   - the open dialog with its progress bar and report;
   - the device settings export;
   - the revision record;
   - "Use colors from file?".

   Task 2 splits by the status line and the code; Task 3 verifies.
4. **A fact in two binding places.** Examples:
   - `files.md` against `file-format.md`, for the `kind` values and the file name suffixes;
   - `files.md` against the "File formats" hard rule in `AGENTS.md`.

   Task 3 links instead.
5. **A spec pointer left in moved text,** such as "see File operations", "see First start", "see Test strategy" or "see Delivery format". Task 3 greps for them.

---

### Task 1: Move the three format references

**Files:**
- Move: `docs/file-format.md`, `docs/day-rules-format.md` and `docs/holiday-data-format.md` to `docs/dev/en/reference/`, with the same file names.
- Modify:
  - every file that cites one of the three paths: `AGENTS.md`, `docs/SPEC.md`, `docs/dev/en/howto/holiday-data.md`, `docs/dev/en/howto/release.md`, `docs/dev/en/reference/holiday-rules.md`, `e2e/min-unit.spec.ts`, `src/engine/file/severity.ts`, `tests/engine/file/required.test.ts` and `tests/examples/minimal.test.ts`, plus any other hit of the grep in step 4;
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Produces: `docs/dev/en/reference/file-format.md`, `docs/dev/en/reference/day-rules-format.md` and `docs/dev/en/reference/holiday-data-format.md`. Task 2 adds the spec's text to `file-format.md`.

- [ ] **Step 1: Move the three files** with `git mv`, one command each.
- [ ] **Step 2: Remove the spec citation from `file-format.md`.**
  - In "Limits", the sentence "How fast reading and checking a file within these limits must be is set in the spec's Limits bullet ([Sharing and validation](SPEC.md#sharing-and-validation))." cites the spec, and the page is now under the citation check's scope.
  - Move the two sentences of the spec's "Limits" bullet (in "Sharing and validation") that start "Reading and checking grow at most linearly" and "Target: the largest file" unchanged into their place. Delete them from the spec bullet.
  - "see Test strategy" inside them stays for Task 3.
- [ ] **Step 3: Run `npm run check`.** Fix only what it reports in the moved files, within the move-commit edits the Global Constraints allow (about six: "e.g." and similar).
- [ ] **Step 4: Update every citation.**
  - Run `git grep -n -E '(file-format|day-rules-format|holiday-data-format)\.md'`.
  - Update every hit that doesn't already use the new path. That includes the relative `../../../` links in `docs/dev/en/`. Make relative links relative to the citing file. The moved files keep their links to each other, because they stay siblings.
  - Leave these unchanged: `docs/superpowers/`, `CHANGELOG.md`, issues with `status: done`, and the four test files of the text checks (`tests/scripts/{reference,citation,docs,spec-status}-rules.test.ts`), whose paths are test data.
- [ ] **Step 5: Update `AGENTS.md`.** Delete the sentence "Until phase 2 moves them, the format references `docs/file-format.md`, `docs/day-rules-format.md` and `docs/holiday-data-format.md` are reference pages in place." from the "Authority" bullet.
- [ ] **Step 6: Update issue 0055.**
  - Every path in it now uses the new location.
  - Drop " (new)" after `docs/dev/en/reference/file-format.md`.
  - Drop the indirect mention of `docs/file-format.md` L411 ("the spec's Limits bullet"), which step 2 resolved.
- [ ] **Step 7: Check that no stale path is left.**
  - Run the grep from step 4 again.
  - Expected: hits only under the new paths and in the files step 4 leaves unchanged.
  - Run `npm test -- tests/examples/minimal.test.ts tests/engine/file/required.test.ts`. Expected: PASS.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.** Subject: "Move the three format references into docs/dev/en/reference". The body lists the allowed edits and the moved Limits sentences.

### Task 2: Move the spec's file sections

**Files:**
- Create: `docs/dev/en/reference/files.md`, `docs/dev/en/explanation/file-kinds.md`
- Modify:
  - `docs/SPEC.md`: "Files: plan file, rule set and settings", "Content of the files", "What is stored where", "Format", "Sharing and validation";
  - `docs/dev/en/reference/file-format.md`;
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Consumes: `docs/dev/en/reference/file-format.md` from Task 1.
- Produces: the pages Task 3 rewrites.

- [ ] **Step 1: Cut the duplicates.** For each of the five sections, find every sentence or bullet whose fact `reference/file-format.md` or `reference/day-rules-format.md` already states, even in other words, and delete it from the spec. Note each cut with the heading of the place that states it. A sentence that says more than the format reference is not a duplicate.
- [ ] **Step 2: Move "Files: plan file, rule set and settings".**
  - The "Recommendation:" paragraph moves unchanged into `explanation/file-kinds.md`, under the H1 `# File kinds`.
  - The table of the three files and the paragraph on the editor model, without its planned commands, move unchanged into `reference/files.md`, under the H1 `# Files` and a `## File kinds` heading.
- [ ] **Step 3: Move "What is stored where"** unchanged into `reference/files.md`, under `## What is stored where`, built parts only.
  - The status line says the revision record and "Use colors from file?" aren't built.
  - Check in `src/ui/` whether the device settings and the recovery copies are stored in IndexedDB. Move only what is.
- [ ] **Step 4: Move the rest of "Content of the files", "Format" and "Sharing and validation".** What step 1 left of their built parts moves unchanged into `reference/file-format.md`, each piece at the end of the section it belongs to, for example "Plan", "Reading" or "Limits".
  - The worker and the handover to the page stay in "Sharing and validation" for branch 2c.
  - So do the planned parts: the open dialog with its progress bar and report, "Rule set for colleagues", the HTML self-copy, and "No contract data in .ics".
- [ ] **Step 5: Update the status lines.**
  - A section with no text left gets ``Status: moved to `<path>`.``
  - A section with only planned text left gets `Status: planned for version N.`, with the version from the old line.
  - "Sharing and validation" keeps built text (the worker), so it stays "partly implemented"; its line names what is missing, with each part's version.
- [ ] **Step 6: Update the citations.**
  - Run `git grep -n -E '"(Files: plan file, rule set and settings|Files|Content of the files|What is stored where|Format|Sharing and validation)"'`.
  - Update every hit outside `docs/SPEC.md`, `docs/superpowers/` and `issues/` to the page the text moved to.
  - Pointers inside the spec stay, because the headings stay.
- [ ] **Step 7: Update issue 0055.**
  - Tick the rows "Files: plan file, rule set and settings", "Content of the files", "What is stored where" and "Format".
  - Change the destination of "What is stored where" to `docs/dev/en/reference/files.md`.
  - In the "Files" row, change the destinations to their final form, and drop " (new)" after every path that now exists.
  - Leave "Sharing and validation" unticked, because its worker part moves in 2c.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.**
  - Subject: "Move the spec's file sections into the file references".
  - The body lists every cut, with the place in the format reference that states it, and every allowed edit.

### Task 3: Rewrite the moved file text

**Files:**
- Modify: `docs/dev/en/reference/files.md`, `docs/dev/en/explanation/file-kinds.md` and, in `docs/dev/en/reference/file-format.md`, only the paragraphs Tasks 1 and 2 added.
- Read, to check facts:
  - `src/engine/file/` (reader, writer, limits, severities);
  - the IndexedDB and settings code in `src/ui/`;
  - `examples/`;
  - the "File formats" hard rule in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 2.

- [ ] **Step 1: Rewrite `reference/files.md`.**
  - Write it in reference register.
  - Whatever the "File formats" hard rule in `AGENTS.md` or `file-format.md` already states is linked, not restated. That includes the kinds, `kind`, the suffixes, no references between files, and which sources a rule set never holds.
  - A reason clause goes to `explanation/file-kinds.md`.
- [ ] **Step 2: Rewrite the added paragraphs in `reference/file-format.md`** in its existing register and terminology. Merge each one into the section around it, so that every fact appears once on the page.
- [ ] **Step 3: Rewrite `explanation/file-kinds.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision.
  - Give the why, including the reason clauses from steps 1 and 2.
  - Then the rejected alternatives the moved text names: references between files, and a separate color scheme file.
- [ ] **Step 4: Check every statement on the two reference pages that Tasks 1 and 2 added** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|Format|File operations|First start|Test strategy|Delivery format)' docs/dev/en/reference/files.md docs/dev/en/explanation/file-kinds.md docs/dev/en/reference/file-format.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the moved file text for its quadrants". The body lists the facts checked against the code and every case where the code differed.
