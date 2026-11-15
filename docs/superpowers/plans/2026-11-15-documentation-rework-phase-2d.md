<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation rework, phase 2d Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the built parts of these spec sections into pages under `docs/dev/en/` and the files that already hold them, with their rationale in explanation pages:
- "Security" and its three subsections, together with the network bullet of "Delivery format";
- "Build and CI (GitHub Free and local)" with "Workflows", "Consideration for upstream sources (caching)" and "Workflow security", together with "Repository settings on GitHub";
- the project sections: "Project operations and contributing", "Hobby project notice", "Files in the repository", "License compliance with REUSE", "AI tools in the repository" and "Releases and updates";
- the glossary of "Multilingual support (from the start)".

**Architecture:** four topics, each a move commit with the unchanged text and every citation update, then a rewrite commit.
- **Tasks 1 and 2:** security.
- **Tasks 3 and 4:** build and CI, the GitHub settings and the recommendation of "Project operations and contributing", which takes some of the settings' reasons.
- **Tasks 5 and 6:** the project sections.
- **Task 7:** the glossary, both commits in one task, because the table is short.

No code changes except paths in comments and one test name.

**Tech Stack:** Markdown, the docs checks from phase 1 (`npm run check`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-documentation-rework-design.md`, sections 3, 4 and "Phases".
- The binding list of destinations is the table in `issues/0055-move-the-spec-into-the-docs.md`.
- The move steps are in `docs/dev/en/howto/docs.md`.
- The style rules are in `docs/dev/en/reference/documentation-style.md`.
- Project rules: `AGENTS.md`.

**Phase 2 split:** 2a, 2b and 2c are merged. 2d is this plan and the last part of phase 2.

**Decided in this plan:**
- **Three "Recommendation:" paragraphs move one phase early,** as in 2c, because the moved text is full of reason clauses that need an explanation page. Issue 0055 allows doing a row early. They are those of "Security", "Build and CI (GitHub Free and local)" and "Project operations and contributing".
- **Explanation page names:**
  - `docs/dev/en/explanation/security-choices.md`;
  - `docs/dev/en/explanation/build-and-ci-choices.md`;
  - `docs/dev/en/explanation/hobby-project.md`.

  A topic ID is unique within an audience, so the first two can't take the names of their reference twins.
- **"Repository settings on GitHub" moves with build and CI,** because most of its rows enforce "Workflow security" and the two pages link to each other.
- **The Reason column of the GitHub settings doesn't stay in reference.** A reason that only names the rule a setting enforces becomes a link to that rule. A real reason goes to the explanation page of its topic:
  - workflows, caches and rulesets to `build-and-ci-choices.md`;
  - private reporting, alerts, secret scanning and code scanning to `security-choices.md`;
  - features, pull requests and moderation to `hobby-project.md`.
- **The two Pages rows of the GitHub settings stay in the spec as tracking:** "Pages" and "Environments → `github-pages`". They serve only the `release` workflow, which is not built.
- **The GitHub settings table is the one binding list of settings that exist only on GitHub.** Where `docs/dev/en/reference/dependencies.md` states one of them ("Alerts"), it links to the settings page instead.
- **The licences table stays whole in `docs/dev/en/reference/licensing.md`.** It is the list per component, which the "Licensing (REUSE)" hard rule in `AGENTS.md` sums up. The bullets that only restate the hard rule link to it instead.
- **The release checklist:** `docs/dev/en/howto/release.md` is the canonical copy. It gets the four steps that only the spec's checklist has, as the "Releases and updates" row of issue 0055 lists them. Every other line of the spec's checklist is cut, because the how-to states it; "`check`, `templates` and `e2e` green" is the how-to's "CI green". A step that needs a feature that is not built says so, as step 7 of the how-to already does.
- **`AGENTS.md`, "Environment", and the README's "Development" stay as they are.** They are short lists for agents and newcomers. `docs/dev/en/reference/build-and-ci.md` becomes the binding place for the local setup and its commands.
- **The glossary keeps its terms for planned features,** such as "Bridge day". The terms are binding for the code and texts still to be written. Each "Meaning" stays a short definition with a link to the reference page that holds the rule.

## Global Constraints

- **Where to work:** in the maintainer's checkout `/home/ai/Projekte/restlos-urlaubsplaner`, on branch `docs-phase-2d`. No task builds the app or runs e2e.
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
  - an issue number always gets a short description, for example "issue 0029 (run the build and the end-to-end tests in CI)";
  - no "Ruling …".
- **Move commits:**
  - Text moves unchanged. The only edits allowed are:
    - the ones `npm run check` demands, such as "e.g." becoming "for example";
    - splitting a sentence, a bullet or a table row that mixes built and planned parts, with as few word changes as possible.
  - The commit body lists every such edit.
  - The built and planned parts follow the section's status line; where the line is ambiguous, check the code, the workflows or the file in question.
  - Planned text stays in the spec, and its status line names what remains.
  - A section with no text left gets ``Status: moved to `<path>`.``, with the page that took its built text. A section with only planned text left gets `Status: planned for version N.`, with the lowest version from its old line.
- **Cutting duplicates:** a sentence, bullet or table row whose fact a reference page, a how-to or the file named as the destination already states, even in other words, is deleted from the spec instead of moved. Each cut is noted for the commit body together with the heading of the place that states it. A sentence that says more than that place is not a duplicate.
- **Rewrite commits:**
  - Follow the register of the page's quadrant:
    - reference is indicative and terse, with no rationale and no second person, and it uses must, must not and may;
    - explanation is decision, then why, then the rejected alternatives, as `docs/dev/en/explanation/architecture-choices.md` does with `## Why` and `## Rejected alternatives`;
    - a how-to is numbered steps in the imperative.
  - Check every fact a reference page states against the code, the workflows and the files it names.
  - When the code does something else, the page states what the code does. The spec's version stays in the spec as planned work only if a planned part of that section still says so.
  - List each case in the commit body. Never change code toward the spec.
  - A measurement or observation with a date, a tested browser version or "checked on" is evidence, not a requirement. It goes to the explanation page, or the reference page links to `docs/feasibility.md`, which holds the browser results.
  - After renaming a heading, update every citation of it: `git grep -n '<page file name>'` over the whole repository.
- **One binding place per fact:**
  - A reference page doesn't repeat a fact that another reference page or a hard rule in `AGENTS.md` already states; it links there instead.
  - The hard rules that overlap most: "Security", "Dependencies", "Git", "npm usage", "Licensing (REUSE)" and "File formats".
  - The reference pages that overlap most: `dependencies.md` (Dependabot, Dependency Review, the lockfile, `.npmrc`, the network lock), `file-format.md` ("Limits", the `schema` value), `architecture.md` ("Single-file build" and its size budget) and `test-strategy.md`.
  - Developer pages use relative links; the repository root is `../../../../` from `docs/dev/en/<quadrant>/`.
- **No spec pointers in moved text:** a page never points to a spec section, whether by name, by "see below" or by "see supply chain". The citation check sees only the file name.
- **Never touch:** `docs/superpowers/` (except this plan's checkboxes), `tests/perf/baseline.json`, `.claude/`, the workflows' steps (only their header comments).

## Review Focus

1. **Planned work moved as built.** Candidates the status lines and the files decide:
   - the iCal, Typst, .ics, file name and release rows of "Threats and countermeasures";
   - the Pages additions and `'wasm-unsafe-eval'` in "Content Security Policy";
   - the iCal, settings and template parsers in the fuzzing bullet, and the CI part of the CSP and network test (issue 0029 (run the build and the end-to-end tests in CI) is open);
   - the `templates`, `e2e` and `release` rows of the workflows table, the Playwright and Typst caches, the build artifact of `check`, and the release workflow's permissions and actions;
   - the README's screenshot, download link and verification instructions;
   - the SPDX bill of materials of a release, the About / Licenses page and the fonts row of the licences table;
   - the About page, the Pages update notice and migration in "Releases and updates".

   Tasks 1, 3 and 5 split by the status line and the files; Tasks 2, 4 and 6 verify.
2. **A sentence cut as a duplicate that the target doesn't actually state.** That would be a lost requirement. Examples to check:
   - the Dependabot bullet of the caching section against `dependencies.md`, which doesn't describe the move to a new NixOS release branch;
   - the spec's hobby project notice against `README.md`;
   - the "AI tools in the repository" paragraph against `docs/ai-tooling.md`, which doesn't say that `issues/` is separate from GitHub issues;
   - the spec's release checklist against `docs/dev/en/howto/release.md`;
   - "older versions reject newer files with a clear message" against what the file reader does.

   Each cut is listed with the place that states it, so the review can verify.
3. **A fact in two binding places.** Examples:
   - `security.md` against the "Security" hard rule and the "Network lock" bullet of `dependencies.md`;
   - `build-and-ci.md` against `dependencies.md` and the "npm usage" hard rule;
   - `github-settings.md` against the "Alerts" bullet of `dependencies.md`;
   - `licensing.md` against the "Licensing (REUSE)" hard rule;
   - `releases.md` against `file-format.md` on the `schema` value;
   - the glossary against `counting-model.md`, `files.md` and the "File formats" hard rule.

   The rewrite tasks link instead.
4. **Dated evidence written as a requirement:**
   - the CSP test of 2026-11-02 and its "Known gap";
   - "checked on GitHub's runners on 2026-10-24";
   - GitHub blocking `pull_request_target` "from 2 November 2026";
   - "labels as of October 2026" for the GitHub settings.

   They go to explanation pages or to `docs/feasibility.md`, not into reference text that must stay true.
5. **A spec pointer left in moved text,** such as "see Sharing and validation", "see supply chain", "see caching", "see Workflows", "see 'Avoid cache poisoning'", "details under 'Repository settings on GitHub'", "see repository settings", "see License", "see Format", "see Known gap" or "the text below". The rewrite tasks grep for them.

---

### Task 1: Move the security sections

**Files:**
- Create: `docs/dev/en/reference/security.md`, `docs/dev/en/explanation/security-choices.md`
- Modify:
  - `docs/SPEC.md`: "Security", "Threats and countermeasures", "Content Security Policy", "Verification", and the last bullet of "Delivery format";
  - `scripts/build/html.ts` (the comments at L5 and L39), `scripts/build/vite-restlos.ts` (L8), `e2e/helpers.ts` (L77), `src/engine/file/report.ts` (L107), `tests/scripts/build-html.test.ts` (the test name at L37);
  - `docs/feasibility.md` (L8 and L36);
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Produces: `reference/security.md` with the H1 `# Security` and the H2 headings `## Network access`, `## Threats and countermeasures`, `## Content Security Policy` and `## Verification`, and `explanation/security-choices.md` with the H1 `# Security choices`. Task 2 rewrites both and keeps the H2 headings, so the comments cited in step 6 stay valid.

- [ ] **Step 1: Cut the duplicates** in the five places, by the rule in the Global Constraints. Places to compare with:
  - `reference/file-format.md`, "Limits" and "Reading", for the size and count limits and the discarded keys;
  - `reference/dependencies.md`, "Measures against supply chain attacks", for the compromised dependency and the network lock;
  - `reference/test-strategy.md`, "Test levels", for the fuzzing and the end-to-end test.
- [ ] **Step 2: Move the "Recommendation:" paragraph of "Security"** unchanged into `explanation/security-choices.md`, under the H1 `# Security choices`.
- [ ] **Step 3: Move the built security text** into `reference/security.md`, under the H1 `# Security` and the headings from the Interfaces block.
  - `## Network access`: the built part of the last bullet of "Delivery format", "No network access at runtime". The service worker part stays in the spec.
  - `## Threats and countermeasures`: the built rows of the table, with the same columns. They are "Plan file or rule set from a colleague", "Display of foreign text" and the built part of "Compromised dependency". The rows for iCal, Typst, the .ics export, file names and foreign HTML files stay.
  - `## Content Security Policy`: the built text. The Pages additions (`worker-src 'self' blob:`, `manifest-src 'self'`) and `'wasm-unsafe-eval'` stay. The "**Tested**" and "**Known gap:**" bullets move too; Task 2 sorts out the evidence. Check the WebAssembly bullet: if nothing in the built app compiles WebAssembly, it stays as planned.
  - `## Verification`: the built parts. Fuzzing of the plan file and rule set reader moves, if a test in `tests/` fuzzes it with fast-check; the other parsers stay. The CSP and network test moves as a local end-to-end test (`e2e/helpers.ts`, `e2e/shell.spec.ts`); "CI test" stays as planned. The `SECURITY.md` bullet moves.
- [ ] **Step 4: Update the status lines** by the rule in the Global Constraints.
  - "Security" gets ``Status: moved to `docs/dev/en/explanation/security-choices.md`.`` Its planned parts are tracked in the subsections.
  - Each subsection with only planned text left gets `Status: planned for version N.`
  - "Delivery format" keeps its line if it still names the service worker of the Pages version.
- [ ] **Step 5: Update the citations.**
  - Run `git grep -n -E 'Security|Threats and countermeasures|Content Security Policy|Verification|spec.s order|policy from the spec' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md' ':!LICENSES'`.
  - Update every hit that cites the spec to the page and heading the text moved to. The known ones:
    - `scripts/build/html.ts:5` and `:39`, `scripts/build/vite-restlos.ts:8` and `e2e/helpers.ts:77`;
    - `src/engine/file/report.ts:107`, "(SPEC, Security)", to `docs/dev/en/reference/security.md`, "Threats and countermeasures";
    - the test name at `tests/scripts/build-html.test.ts:37`, "in the spec's order", to "in the order of the security reference";
    - `docs/feasibility.md:36`, "the app's policy from the spec": name the policy without the spec, for example "the app's standard policy".
  - `docs/feasibility.md:8`: name the pages that now build on the CSP results instead of the spec's "Content Security Policy". Keep the spec sections that still hold results.
  - Leave the "Security" hard rule in `AGENTS.md` unchanged; it doesn't cite the spec.
- [ ] **Step 6: Update issue 0055.**
  - Tick "Security", "Threats and countermeasures", "Content Security Policy" and "Verification".
  - "Security" gets `docs/dev/en/explanation/security-choices.md` for the recommendation, phase 2.
  - In the "Delivery format" row, say that the bullet on network access moved to `docs/dev/en/reference/security.md`.
  - Drop " (new)" after every path that now exists.
  - In the note on pages that appear as both a reference and an explanation page, name `security-choices.md` for security.
  - Under "Indirect mentions", remove the three entries this task rewords: `src/engine/file/report.ts` L107, `tests/scripts/build-html.test.ts` L37 and `docs/feasibility.md` L36.
- [ ] **Step 7: Run `npm run check`.** Expected: PASS. Then run `npm test -- tests/scripts/build-html.test.ts`. Expected: PASS.
- [ ] **Step 8: Commit.**
  - Subject: "Move the security sections out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the code decided what is built.

### Task 2: Rewrite the moved security text

**Files:**
- Modify:
  - `docs/dev/en/reference/security.md`, `docs/dev/en/explanation/security-choices.md`;
  - in `docs/dev/en/reference/dependencies.md`, only the "Network lock" bullet;
  - `docs/feasibility.md`, only if a CSP result in the moved text is missing there.
- Read, to check facts:
  - `scripts/build/html.ts`, `scripts/build/vite-restlos.ts`, `tests/scripts/build-html.test.ts`;
  - `src/engine/file/` (the reader, `report.ts` and the limits), the fuzz tests under `tests/engine/file/`;
  - `eslint.config.js` (`svelte/no-at-html-tags`);
  - `e2e/helpers.ts`, `e2e/shell.spec.ts`, `SECURITY.md`;
  - `docs/feasibility.md`, "Content Security Policy from `<meta>` and keyboard shortcuts";
  - the "Security" and "Dependencies" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 1.
- Produces: `reference/security.md` with the same four H2 headings. Task 4 may link to `## Content Security Policy`.

- [ ] **Step 1: Rewrite `reference/security.md`** in reference register.
  - The intro states what the moved recommendation decides and the code has built: every file from outside is untrusted, and the app has no network access.
  - Link to the "Security" hard rule in `AGENTS.md` instead of restating what it says: no `{@html}` with data, no `eval` or `new Function`, no network access at runtime, size limits on all imports.
  - Link to `file-format.md` "Limits" for the limits instead of writing the numbers.
  - List the directives of the policy in the order `standardPolicy` in `scripts/build/html.ts` writes them, and name the function.
  - The "Tested" bullet and the "Known gap" are evidence. Link to `docs/feasibility.md` for the results; the conclusion "the policy is defence in depth, not the only barrier" goes to `explanation/security-choices.md`.
  - A reason clause goes to `explanation/security-choices.md`. Examples: "GitHub Pages cannot set custom HTTP headers", "a meta policy applies only to what comes after it", "low risk, since no foreign HTML is rendered".
- [ ] **Step 2: Replace the "Network lock" bullet of `dependencies.md`** with one sentence that links to `security.md#content-security-policy`, so the meta tag and its place are stated once.
- [ ] **Step 3: Rewrite `explanation/security-choices.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision. Name isolated templates as planned for version 2.
  - Give the why, including the reason clauses from step 1 and the Firefox gap on `file://`.
  - Then the rejected alternatives the moved text names, such as an HTTP header for the policy. Don't invent alternatives the text doesn't name.
- [ ] **Step 4: Check every statement on `security.md`** against the files listed above. Apply the rule from the Global Constraints when the code differs, and note each case for the commit body.
- [ ] **Step 5: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|supply chain|Sharing and validation|Known gap|Format)' docs/dev/en/reference/security.md docs/dev/en/explanation/security-choices.md`.
  - Expected: no output.
- [ ] **Step 6: Run `npm run check`.** Expected: PASS.
- [ ] **Step 7: Commit.** Subject: "Rewrite the moved security text for its quadrants". The body lists the facts checked against the code and every case where the code differed.

### Task 3: Move the build and CI sections and the GitHub settings

**Files:**
- Create: `docs/dev/en/reference/build-and-ci.md`, `docs/dev/en/reference/github-settings.md`, `docs/dev/en/explanation/build-and-ci-choices.md`, `docs/dev/en/explanation/hobby-project.md`
- Modify:
  - `docs/SPEC.md`: "Build and CI (GitHub Free and local)", "Workflows", "Consideration for upstream sources (caching)", "Workflow security", "Repository settings on GitHub", "Project operations and contributing";
  - the header comments of `.github/workflows/check.yml` (L5), `.github/workflows/seed-cache.yml` (L4) and `.github/actions/nix/action.yml` (L6), and `scripts/nixos-release-status.ts` (L9);
  - `docs/ai-tooling.md` (L136);
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Consumes: `## Content Security Policy` in `reference/security.md` from Task 1.
- Produces:
  - `reference/build-and-ci.md` with the H1 `# Build and CI` and the H2 headings `## Local setup`, `## Workflows`, `## NixOS release check`, `## Caching` and `## Workflow security`;
  - `reference/github-settings.md` with the H1 `# GitHub settings` and the H2 headings `## Settings` and `## Setup order`;
  - `explanation/build-and-ci-choices.md` with the H1 `# Build and CI choices`;
  - `explanation/hobby-project.md` with the H1 `# Hobby project`.

  Task 4 rewrites them and keeps the H2 headings, so the comments cited in step 6 stay valid. Task 6 adds the reasons from the project sections to `hobby-project.md`.

- [ ] **Step 1: Cut the duplicates** in the five sections, by the rule in the Global Constraints. Places to compare with:
  - `reference/dependencies.md`, "Measures against supply chain attacks", for Dependabot, Dependency Review, `npm ci` and the `.npmrc` settings;
  - `reference/test-strategy.md` for the performance gate;
  - `docs/dev/en/howto/dependency-update.md` for the move to a new NixOS release.
- [ ] **Step 2: Move two recommendations.**
  - The "Recommendation:" paragraph of "Build and CI (GitHub Free and local)" and its "**GitHub Free, public repository:**" paragraph go unchanged into `explanation/build-and-ci-choices.md`, under the H1 `# Build and CI choices`.
  - The "Recommendation:" paragraph of "Project operations and contributing" goes unchanged into `explanation/hobby-project.md`, under the H1 `# Hobby project`.
- [ ] **Step 3: Move the built build and CI text** into `reference/build-and-ci.md`, under the H1 `# Build and CI` and the headings from the Interfaces block.
  - `## Local setup`: the "**Local (NixOS):**" paragraph. Check each tool and command against `flake.nix` and `package.json`.
  - `## Workflows`: the built rows of the table, with the same columns: `check`, `seed-cache` and Dependency Review. The `templates`, `e2e` and `release` rows stay. Check each built row against its file in `.github/workflows/`.
  - `## NixOS release check`: the "**NixOS release check:**" paragraph.
  - `## Caching`: the built bullets of "Consideration for upstream sources (caching)". The Playwright and Typst caches and the "**Artifacts:**" bullet stay. In "**No pointless runs:**", the path filter for `templates` stays.
  - `## Workflow security`: the built parts. The actions and permissions of the `release` workflow, `actions/attest-build-provenance` and the Pages actions stay.
  - "Documentation website" stays whole; it is planned.
- [ ] **Step 4: Move "Repository settings on GitHub"** into `reference/github-settings.md`.
  - Its "Recommendation:" paragraph goes under the H1 as the page's intro, unchanged; Task 4 sorts out its reason clause.
  - `## Settings`: the table, with the same columns, without the rows "Pages" and "Environments → `github-pages`", which stay in the spec. The sentence on workflow execution protections goes after the table.
  - `## Setup order`: the "**Order when setting up:**" paragraph.
- [ ] **Step 5: Update the status lines** by the rule in the Global Constraints.
  - "Build and CI (GitHub Free and local)" gets ``Status: moved to `docs/dev/en/reference/build-and-ci.md`.``
  - "Project operations and contributing" gets ``Status: moved to `docs/dev/en/explanation/hobby-project.md`.``
  - "Repository settings on GitHub" gets `Status: planned for version 1.`, because its two Pages rows stay.
  - Each other section with only planned text left gets `Status: planned for version N.`
- [ ] **Step 6: Update the citations.**
  - Run `git grep -n -E 'Build and CI|Workflows|upstream sources|Workflow security|cache poisoning|NixOS release check|Repository settings|the specification' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md' ':!LICENSES'`.
  - Update every hit that cites the spec to the page and heading the text moved to. The known ones:
    - `.github/workflows/check.yml:5`, to `docs/dev/en/reference/build-and-ci.md`, "Workflows";
    - `.github/workflows/seed-cache.yml:4`, to the same page, "Workflows" and "Workflow security";
    - `.github/actions/nix/action.yml:6`, to the same page, "Caching";
    - `scripts/nixos-release-status.ts:9`, to the same page, "NixOS release check";
    - `docs/ai-tooling.md:136`, "(see the specification)", to a link to `dev/en/reference/build-and-ci.md#workflow-security`.
  - Leave `tests/scripts/citation-rules.test.ts` unchanged; its spec citations are test data.
- [ ] **Step 7: Update issue 0055.**
  - Tick "Build and CI (GitHub Free and local)", "Workflows", "Consideration for upstream sources (caching)", "Workflow security", "Repository settings on GitHub" and "Project operations and contributing".
  - "Build and CI (GitHub Free and local)" gets `docs/dev/en/explanation/build-and-ci-choices.md` for the recommendation, phase 2.
  - "Project operations and contributing" gets phase 2.
  - "Repository settings on GitHub": add that the Pages rows stay as tracking until the `release` workflow is built.
  - Drop " (new)" after every path that now exists.
  - In the note on pages that appear as both a reference and an explanation page, name `build-and-ci-choices.md` for build and CI.
  - Under "Indirect mentions", remove the entry for `docs/ai-tooling.md` L136.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.**
  - Subject: "Move the build and CI sections, the GitHub settings and the project recommendation out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the files decided what is built.

### Task 4: Rewrite the moved build and CI text

**Files:**
- Modify:
  - `docs/dev/en/reference/build-and-ci.md`, `docs/dev/en/reference/github-settings.md`, `docs/dev/en/explanation/build-and-ci-choices.md`, `docs/dev/en/explanation/hobby-project.md`;
  - in `docs/dev/en/reference/dependencies.md`, only the "Alerts" bullet;
  - `docs/dev/en/explanation/security-choices.md`, only to take reasons from the settings table.
- Read, to check facts:
  - `flake.nix`, `package.json`, `.npmrc`, `scripts/nixos-release.js`, `scripts/nixos-release-status.ts`;
  - `.github/workflows/`, `.github/actions/nix/action.yml`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `SECURITY.md`;
  - `docs/dev/en/reference/dependencies.md`, `docs/dev/en/howto/dependency-update.md`;
  - the "Dependencies", "Git" and "npm usage" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 3.
- Produces: the four pages with the H2 headings from Task 3. Task 6 links to `github-settings.md#settings` for release immutability and adds to the "Why" of `hobby-project.md`.

- [ ] **Step 1: Rewrite `reference/build-and-ci.md`** in reference register.
  - Link to `dependencies.md` for what it states about Dependabot, Dependency Review, `npm ci` and `.npmrc`. Keep only what it doesn't say, such as the pull request that moves `flake.nix` to a new NixOS release branch.
  - Link to the "npm usage" hard rule instead of restating it.
  - The facts of a workflow follow its YAML file: triggers, the dev shell, steps, `cache-mode`, `permissions`, `concurrency` and `timeout-minutes`.
  - "Checked on GitHub's runners on 2026-10-24" and the date GitHub blocks `pull_request_target` are evidence; they go to `explanation/build-and-ci-choices.md`.
  - A reason clause goes to `explanation/build-and-ci-choices.md`. Examples: "a required check whose workflow a path filter skipped stays pending", "the route of the TanStack attack", "the app runs in the browser, Node is only for building".
- [ ] **Step 2: Rewrite `reference/github-settings.md`.**
  - The intro says what the page lists and that the settings are set once by hand. The reason "so the repository can be set up again without guessing" goes to `build-and-ci-choices.md`.
  - Replace the Reason column by the rule in "Decided in this plan": a link to the rule a setting enforces, or nothing. Each real reason goes to the explanation page of its topic.
  - Keep "labels as of October 2026" as a plain note on the labels.
  - Replace the "Alerts" bullet of `dependencies.md` with a link to `github-settings.md#settings`.
- [ ] **Step 3: Rewrite `explanation/build-and-ci-choices.md`.**
  - Turn the "Recommendation:" label into a plain statement of the decision.
  - Give the why, including the reason clauses from steps 1 and 2 and the dated evidence.
  - Then the rejected alternatives the moved text names, for example a path filter on `check`, a matrix over several Node versions, automatic retries, `pull_request_target`, and caches written by every workflow.
- [ ] **Step 4: Rewrite `explanation/hobby-project.md`** the same way: the decision as a plain statement, then why, with the settings' reasons from step 2, then the rejected alternatives the moved text names, such as a stale bot. Drop "the text below"; the notice is in `README.md`, so link there.
- [ ] **Step 5: Check every statement on the two reference pages** against the files listed above. A GitHub setting the repository can't show is stated as the page lists it. Apply the rule from the Global Constraints when the files differ, and note each case for the commit body.
- [ ] **Step 6: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|caching|supply chain|Workflows|.Avoid cache poisoning.)|details under|Repository settings on GitHub|dependency update procedure|the text below' docs/dev/en/reference/build-and-ci.md docs/dev/en/reference/github-settings.md docs/dev/en/explanation/build-and-ci-choices.md docs/dev/en/explanation/hobby-project.md`.
  - Expected: no output.
- [ ] **Step 7: Run `npm run check`.** Expected: PASS.
- [ ] **Step 8: Commit.** Subject: "Rewrite the moved build and CI text for its quadrants". The body lists the facts checked against the files and every case where they differed.

### Task 5: Move the project sections

**Files:**
- Create: `docs/dev/en/reference/repository-files.md`, `docs/dev/en/reference/licensing.md`, `docs/dev/en/reference/releases.md`
- Modify:
  - `docs/SPEC.md`: "Hobby project notice", "Files in the repository", "License compliance with REUSE", "AI tools in the repository", "Releases and updates";
  - `docs/ai-tooling.md`, `docs/dev/en/howto/release.md`;
  - `REUSE.toml` (the comment at L41), `scripts/orca-speech.ts` (L4);
  - `issues/0055-move-the-spec-into-the-docs.md`.

**Interfaces:**
- Consumes: `## Settings` in `reference/github-settings.md` from Task 3.
- Produces:
  - `reference/repository-files.md` with the H1 `# Repository files`;
  - `reference/licensing.md` with the H1 `# Licensing` and the H2 headings `## Licenses` and `## Checks`;
  - `reference/releases.md` with the H1 `# Releases` and the H2 headings `## Versions` and `## Updates`.

  Task 6 rewrites them and keeps the H2 headings.

- [ ] **Step 1: Cut the duplicates** in the five sections, by the rule in the Global Constraints. Places to compare with:
  - `README.md`, "Projektstatus" and "Project status", for the notice;
  - `docs/ai-tooling.md` and `AGENTS.md`, "Text in the repository" and "Git", for the AI tools paragraph;
  - `docs/dev/en/howto/release.md` for the checklist;
  - `reference/file-format.md` for reading old and newer files.
- [ ] **Step 2: "Hobby project notice":** the two text blocks are the same as the README's, so they are cut, and `README.md` stays the canonical copy unchanged. The sentence that says where the notice appears moves to `reference/repository-files.md`, after the table.
- [ ] **Step 3: Move the built text of "Files in the repository"** into `reference/repository-files.md`: the table, with the same columns. In the `README.md` row, the screenshot, the download and Pages link and the verification stay in the spec. Check each row against the file it names.
- [ ] **Step 4: Move the built text of "License compliance with REUSE"** into `reference/licensing.md`.
  - `## Licenses`: the intro sentence and the table, with the same columns. Check the third-party row against `REUSE.toml` and `LICENSES/`; the fonts stay in the spec, because no font is embedded yet.
  - `## Checks`: the bullets on `reuse lint` and on SPDX headers for new files.
  - The SPDX bill of materials of a release and the bullet on the bundled npm packages stay.
- [ ] **Step 5: "AI tools in the repository":** cut every sentence that `docs/ai-tooling.md` or `AGENTS.md` states already. Move the rest unchanged into `docs/ai-tooling.md`, in the section it belongs to. The known remainder is that `issues/` is separate from GitHub issues, which stay the channel for bug reports and ideas from users.
- [ ] **Step 6: Move "Releases and updates".**
  - Into `reference/releases.md`: the built bullets that step 1 left, under `## Versions` (Semantic Versioning, reading old and newer files) and `## Updates` (no update check in the downloaded HTML, releases on GitHub, immutable releases). These stay: the About page, the Pages update notice, and the `release` workflow that creates the draft.
  - Into `docs/dev/en/howto/release.md`: the four steps only the spec's checklist has, each in the step it belongs to, with as few word changes as possible; the commit body lists them. They are the ".ics and `.typ`" export (step 6 says "PDF and .ics export"), the size budget, checking the data status of the holiday rules, and opening the Pages version on a phone.
  - Cut the rest of the spec's checklist, by "Decided in this plan".
- [ ] **Step 7: Update the status lines** by the rule in the Global Constraints.
  - "Hobby project notice" gets ``Status: moved to `README.md`.``
  - "AI tools in the repository" gets ``Status: moved to `docs/ai-tooling.md`.``
  - Each other section with only planned text left gets `Status: planned for version N.`
- [ ] **Step 8: Update the citations.**
  - Run `git grep -n -E 'Project operations|Hobby project|Files in the repository|License compliance|AI tools in the repository|Releases and updates|release checklist' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md' ':!LICENSES'`.
  - Update every hit that cites the spec to the page and heading the text moved to. The known ones:
    - `REUSE.toml:41`, to `docs/dev/en/reference/licensing.md`, "Licenses";
    - `scripts/orca-speech.ts:4`: "the release checklist" now means `docs/dev/en/howto/release.md`; keep `docs/SPEC.md, "Accessibility"`, which moves in phase 4.
- [ ] **Step 9: Update issue 0055.**
  - Tick "Hobby project notice", "Files in the repository", "License compliance with REUSE", "AI tools in the repository" and "Releases and updates".
  - Drop " (new)" after every path that now exists.
  - In "Phases", mark the canonical copies of the hobby project notice and the release checklist as done, the way the rows are.
- [ ] **Step 10: Run `npm run check`.** Expected: PASS.
- [ ] **Step 11: Commit.**
  - Subject: "Move the project sections out of the spec".
  - The body lists every cut with the place that states it, every allowed edit, and every case where the files decided what is built.

### Task 6: Rewrite the moved project text

**Files:**
- Modify:
  - `docs/dev/en/reference/repository-files.md`, `docs/dev/en/reference/licensing.md`, `docs/dev/en/reference/releases.md`;
  - in `docs/ai-tooling.md` and `docs/dev/en/howto/release.md`, only the text Task 5 added;
  - in `docs/dev/en/explanation/hobby-project.md`, only its "Why", to take reason clauses from this task.
- Read, to check facts:
  - `README.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/`;
  - `REUSE.toml`, `LICENSES/`, `package.json` (`version` and the scripts);
  - `src/engine/file/` (how the reader treats the `schema` value);
  - `docs/dev/en/reference/file-format.md`, `docs/dev/en/reference/architecture.md` ("Single-file build");
  - the "Licensing (REUSE)", "Git" and "File formats" hard rules in `AGENTS.md`.

**Interfaces:**
- Consumes: the pages from Task 5, `github-settings.md#settings` and `hobby-project.md` from Task 4.

- [ ] **Step 1: Rewrite `reference/repository-files.md`** in reference register. Merge the sentence on where the notice appears into the table rows, so each file's content is stated once.
- [ ] **Step 2: Rewrite `reference/licensing.md`.**
  - Link to the "Licensing (REUSE)" hard rule instead of restating it; keep the table, by "Decided in this plan".
  - Link to "REUSE" in `docs/dev/en/howto/release.md` or the release checklist only if a release step needs it.
- [ ] **Step 3: Rewrite `reference/releases.md`.**
  - Link to `file-format.md` for the `schema` value instead of restating it.
  - Link to `github-settings.md#settings` for release immutability.
  - A reason clause, such as "no network", goes to `explanation/hobby-project.md` or links to `security.md#network-access`.
- [ ] **Step 4: Rewrite the text Task 5 added** to `docs/ai-tooling.md` in that page's register, and to `docs/dev/en/howto/release.md` as numbered imperative steps. The size budget step links to `architecture.md#single-file-build` instead of repeating the limit.
- [ ] **Step 5: Add the reason clauses from steps 1 to 4** to the "Why" of `explanation/hobby-project.md`, where they are about the project's operation. Leave the rest of that page as Task 4 wrote it.
- [ ] **Step 6: Check every statement on the three reference pages** and in the added text against the files listed above. Apply the rule from the Global Constraints when the files differ, and note each case for the commit body.
- [ ] **Step 7: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|License|repository settings|Format)|the text below' docs/dev/en/reference/repository-files.md docs/dev/en/reference/licensing.md docs/dev/en/reference/releases.md docs/dev/en/howto/release.md`.
  - Expected: no output. `docs/ai-tooling.md` keeps its L16 and L21, which name the spec until it is deleted.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.** Subject: "Rewrite the moved project text for its quadrants". The body lists the facts checked against the files and every case where they differed.

### Task 7: Move and rewrite the glossary

**Files:**
- Create: `docs/dev/en/reference/glossary.md`
- Modify:
  - `docs/SPEC.md`: the "**Glossary**" table in "Multilingual support (from the start)";
  - `AGENTS.md` (L21), `CONTRIBUTING.md` (L28);
  - `issues/0055-move-the-spec-into-the-docs.md`.
- Read, to check facts in the second commit:
  - `src/ui/i18n/de.json`, `src/ui/i18n/en.json` (the UI terms);
  - `docs/dev/en/reference/counting-model.md`, `docs/dev/en/reference/files.md`, `docs/dev/en/reference/file-format.md`, `docs/dev/en/reference/day-rules-format.md`;
  - the "Counting model" and "File formats" hard rules in `AGENTS.md`.

**Interfaces:**
- Produces: `reference/glossary.md` with the H1 `# Glossary` and one table with the columns German, English and Meaning.

- [ ] **Step 1: Move the glossary.**
  - The line "**Glossary** (binding for UI, help, templates and code identifiers):" becomes the page's intro, and the table follows it unchanged, except for the edits `npm run check` demands.
  - "Multilingual support (from the start)" keeps its status line, which doesn't name the glossary.
- [ ] **Step 2: Re-point the citations.**
  - `AGENTS.md:21` and `CONTRIBUTING.md:28` say "the glossary in `docs/SPEC.md`". Both name `docs/dev/en/reference/glossary.md` instead.
  - Run `git grep -n -i 'glossary' -- ':!docs/SPEC.md' ':!docs/superpowers' ':!issues' ':!CHANGELOG.md'` and update any other hit that cites the spec. `tests/scripts/` paths are test data and stay.
- [ ] **Step 3: Update issue 0055.**
  - In the row "Multilingual support (from the start)", drop " (new)" after the glossary path and say that the glossary moved; the row stays open for phase 4.
  - Under "The citation rule", remove `AGENTS.md` L21 and `CONTRIBUTING.md` L28 from the lines that need rewriting.
  - In "Phases", mark the glossary bullet as done, the way Task 5 marks the canonical copies.
- [ ] **Step 4: Run `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** Subject: "Move the glossary out of the spec". The body lists every allowed edit.
- [ ] **Step 6: Rewrite `reference/glossary.md`** in reference register.
  - Each Meaning is one short definition. Rule detail, such as "any multiple of 1/32 possible" or what a file holds, is replaced by a link to the page that states it: `counting-model.md`, `files.md`, `file-format.md` or `day-rules-format.md`.
  - A term for a planned feature stays, by "Decided in this plan". Its meaning must not describe the feature as built; for example, "imported once from iCal" becomes what a calendar source is.
  - Check each English term against `en.json` and each German term against `de.json`. Where the UI uses another word, note it for the commit body and keep the glossary's term; changing UI texts is not part of this task.
- [ ] **Step 7: Look for spec pointers.**
  - Run `git grep -n -E 'SPEC\.md|\bSPEC\b|\b[Tt]he spec\b|[Ss]pecification|see (below|above|Format)' docs/dev/en/reference/glossary.md`.
  - Expected: no output.
- [ ] **Step 8: Run `npm run check`.** Expected: PASS.
- [ ] **Step 9: Commit.** Subject: "Rewrite the glossary for its quadrant". The body lists the facts checked and every term where the UI differs.
