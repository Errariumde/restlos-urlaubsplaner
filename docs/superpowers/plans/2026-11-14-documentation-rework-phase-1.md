<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation rework, phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the guard rails and the setup of the new documentation model in place:
- checked citations;
- status lines on the spec;
- a style check;
- the style page and decision record 0001;
- the how-tos and the pointer skills;
- the new `AGENTS.md` rules;
- the decided help and website design as planned work in the spec;
- a tracking issue that assigns all 60 spec sections.

**Architecture:** Two new pure rule modules sit next to the existing `scripts/reference-rules.ts`, each taking `TextFile[]` and returning `path:line: what; instead.` lines:
- `scripts/citation-rules.ts`, for paths, anchors, spec section names and the spec citation rule;
- `scripts/docs-rules.ts`, for the mechanical style rules.

A third module, `scripts/spec-status-rules.ts`, checks the status lines. The existing runners call them: `scripts/check-references.js`, and a new `scripts/check-docs.js` for the style rules. Everything else is Markdown: new pages under `docs/dev/en/`, edits to `AGENTS.md`, `docs/SPEC.md`, `docs/ai-tooling.md`, the skills and one issue file.

**Tech Stack:** TypeScript run through `node --import ./scripts/ts-hooks.js`, Vitest, Markdown, REUSE.

**Spec:** `docs/superpowers/specs/2026-11-14-documentation-rework-design.md`. Read it first; this plan argues from it, especially sections 3 to 6 and "Phase 1 scope". Project rules: `AGENTS.md`.

## Global Constraints

- **Where to work:** in the maintainer's checkout `/home/ai/Projekte/restlos-urlaubsplaner`, on branch `docs-rework`. The maintainer doesn't edit there until the branch is done. No task builds the app or runs e2e.
- **Commands:**
  - Run tools only through npm scripts (`npm run …`, `npm test`).
  - Never `npx` in any form, not even `npx --no-install`, no `npm exec`, no `node_modules/.bin` calls. Type-check with `npm run typecheck`.
  - Run single tests with `npm test -- tests/scripts/<file>.test.ts`.
  - Keep commands simple, one tool each.
- **Packages:** never add, remove or update one. No new tool in the Nix dev shell.
- **`npm run check`** must pass before every commit.
- **Commits:** on the branch, never on `main`, never push, tag or sign, in exactly this form:
  `git -c commit.gpgsign=false commit -m "<subject>" -m "<body>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
  Subjects are plain sentences without prefixes. Run `git add` as its own command first.
- **SPDX headers:** every new file gets one. Markdown is CC-BY-4.0, as an HTML comment directly after any frontmatter, or at the top. Code is EUPL-1.2, as `//` comments.
- **Repository text stands on its own:**
  - no pointers to chats, sessions, reviews or `docs/superpowers/`;
  - an issue number always gets a short description, for example "issue 0038 (keep what matters from the AI design documents)";
  - no "Ruling …" and no `final-review.md`.
- **New docs pages** follow the style rules of the spec's section 3. The check from Task 3 enforces the mechanical ones.
- **A changed `.svelte` file,** even a comment change in Task 1, goes through the Svelte MCP autofixer (`svelte-autofixer`) until it reports nothing.
- **Docs and code never cite `SPEC.md`:**
  - the only exceptions are the allowlist in Task 2 and the rule in `AGENTS.md`;
  - existing citations stay until their section moves;
  - new code or a new doc that needs a spec section moves that section first. That is not part of this plan, so if a task finds it needs one, stop and report.
- **Never touch:** `docs/superpowers/` (except this plan's checkboxes), `tests/perf/baseline.json`, `.claude/hooks/`, `.claude/settings*.json`.
- **Task 8 runs in the main session, not in a subagent.** It writes to `.claude/skills/`, which needs the maintainer to approve a permission prompt. Bash cannot write there.

## Review Focus

1. **Sentence punctuation after a path:** `` `docs/SPEC.md`. `` or `(see docs/file-format.md),` must resolve the path without the trailing punctuation. Test in Task 1.
2. **URLs containing `docs`:** `https://docs.github.com/en/pages` and `https://example.com/docs/a.md` are not repository paths and must not be reported. Test in Task 1.
3. **Short heading names:** a citation of "Build and CI" or "Day cell" resolves against the headings "Build and CI (GitHub Free and local)" and "Day cell: what is shown how". Test in Task 1.
4. **Code blocks:**
   - `## Project status` inside a fenced code block is not a heading for the status check (Task 4);
   - `just` or `e.g.` inside a fenced block or a code span is not a style error (Task 3);
   - line numbers after a fence still point to the right line (Task 3).
5. **German abbreviations:** "z. B." with a non-breaking space passes, "z. B." with a normal space and "z.B." fail. Test in Task 3.

---

### Task 1: Resolve cited paths, anchors and spec section names

**Files:**
- Create: `scripts/citation-rules.ts`
- Modify: `scripts/check-references.js` (call the new checks)
- Test: `tests/scripts/citation-rules.test.ts`
- Fix: whatever the new check reports in the repository, at least "Main screen" in `e2e/allowance.spec.ts` L92 and `src/ui/screens/MainScreen.svelte` L351, and "Licensing" in `REUSE.toml` L41. Choose the right section after reading `docs/SPEC.md`; "Allowance display" and the licence table under "Goals and scope" are the likely targets.

**Interfaces:**
- Consumes: `TextFile` from `scripts/reference-rules.ts`.
- Produces:
  - `export function githubSlug(heading: string): string`: lowercase; drop every character that is not a Unicode letter, digit, space, `-` or `_`; spaces → `-`. Duplicate handling is not needed.
  - `export function specSectionNames(specText: string): Set<string>`. It holds:
    - the text of every `##` and `###` heading outside fenced code blocks, in full and cut at its first `: ` or ` (`;
    - every bold run-in label: a paragraph or list item that starts with `**Label**` or `**Label:**`, without the colon.
  - `export function checkCitations(files: readonly TextFile[]): string[]`.

- [x] **Step 1: Write the failing tests** in `tests/scripts/citation-rules.test.ts`:

```ts
const spec = { path: "docs/SPEC.md", text: "# T\n\n## Build and CI (GitHub Free and local)\n\n### Day cell: what is shown how\n\n**Detail view:** text\n\n```\n## Project status\n```\n" };
const fmt = { path: "docs/file-format.md", text: "# Format\n\n## Sharing and validation\n" };

it("accepts existing paths, also with sentence punctuation after them", () =>
  expect(checkCitations([spec, fmt, { path: "a.md", text: "See `docs/file-format.md`. And (docs/SPEC.md),\n" }])).toEqual([]));
it("reports a missing docs path with its line", () =>
  expect(checkCitations([spec, { path: "src/a.ts", text: "x\n// docs/gone.md\n" }])).toEqual([expect.stringMatching(/^src\/a\.ts:2: .*docs\/gone\.md/)]));
it("ignores URLs, folder paths, patterns and paths marked (new)", () =>
  expect(checkCitations([spec, { path: "a.md", text: "https://docs.github.com/en/pages https://example.com/docs/a.md docs/user/ docs/dev/en/howto/<name>.md docs/dev/en/reference/glossary.md (new)\n" }])).toEqual([]));
it("resolves quoted spec section names in full, cut at ': ' or ' (', and bold labels", () =>
  expect(checkCitations([spec, { path: "src/a.ts", text: '// docs/SPEC.md, "Build and CI"\n// `docs/SPEC.md`, "Day cell", "Detail view"\n// docs/SPEC.md ("Build and CI (GitHub Free and local)")\n' }])).toEqual([]));
it("reports a section name that does not exist, and a heading inside a code block does not count", () =>
  expect(checkCitations([spec, { path: "src/a.ts", text: '// docs/SPEC.md, "Main screen"\n// docs/SPEC.md, "Project status"\n' }])).toHaveLength(2));
it("checks anchors against GitHub slugs", () => {
  expect(checkCitations([spec, fmt, { path: "a.md", text: "[s](docs/file-format.md#sharing-and-validation)\n" }])).toEqual([]);
  expect(checkCitations([spec, fmt, { path: "a.md", text: "[s](docs/file-format.md#sharing)\n" }])).toHaveLength(1);
});
it("resolves relative Markdown links from the file's folder and skips topic-ID links", () => {
  const files = [spec, fmt, { path: "docs/dev/en/howto/x.md", text: "[f](../../../file-format.md) [t](day-rules) [u](https://a.b/c)\n" }];
  expect(checkCitations(files)).toEqual([]);
});
it("skips docs/superpowers, CHANGELOG.md, done issues and its own test", () =>
  expect(checkCitations([spec,
    { path: "docs/superpowers/plans/p.md", text: "docs/gone.md\n" },
    { path: "CHANGELOG.md", text: "docs/gone.md\n" },
    { path: "issues/0001-x.md", text: "---\nstatus: done\n---\ndocs/gone.md\n" },
    { path: "tests/scripts/citation-rules.test.ts", text: "docs/gone.md\n" }])).toEqual([]));
it("treats a path as existing when it is a file or a folder of listed files", () =>
  expect(checkCitations([spec, { path: "a.md", text: "docs/SPEC.md and docs/superpowers\n" }, { path: "docs/superpowers/x.md", text: "" }])).toEqual([]));
```

Also add `githubSlug("Build and CI (GitHub Free and local)") === "build-and-ci-github-free-and-local"` and `githubSlug("Füße & Hände") === "füße--hände"`.

- [x] **Step 2: Run them and see them fail.** Run `npm test -- tests/scripts/citation-rules.test.ts`. Expected: FAIL, because the module doesn't exist.

- [x] **Step 3: Implement `scripts/citation-rules.ts`.**
  - **Root paths:** match `(?<![\w/.:-])docs\/[A-Za-z0-9_./-]*[A-Za-z0-9_/-]`, which keeps sentence punctuation outside the match.
    - Skip: a match ending in `/`, and a match directly followed by ` (new)`.
    - A path resolves when it is a listed file or a prefix of one. Existence is checked against the paths in `files`, with no file system access.
    - Anchors: a `#slug` directly after a `.md` path must be a `githubSlug` of a heading in that file.
  - **Markdown links:** in `.md` files only, match `](target)`.
    - Skip `http:`, `https:` and `mailto:` targets, and targets without `/` and without `.` (topic IDs).
    - A target starting with `#` is an anchor in the same file.
    - Otherwise resolve it with `path.posix` from the file's folder, then check it like a root path.
  - **Section names:** match ``SPEC\.md`?(?:,\s*|\s*\(\s*|\s+)((?:"[^"]+"(?:,\s*)?)+)``. Every quoted name must be in `specSectionNames` of `docs/SPEC.md`. The separator before the first quote is required, so `{ path: "docs/SPEC.md", text }` in a test file is not a citation. Add that line as a test case that must give no error.
  - **Exemptions:** the same as `reference-rules.ts`, plus `CHANGELOG.md` and `tests/scripts/citation-rules.test.ts`.
  - **Errors:** `${path}:${line}: <what>; <instead>.` Examples:
    - "the path docs/x.md does not exist; correct it, or mark a planned page with (new)";
    - "docs/SPEC.md has no section "X"; cite an existing heading or move the section first".

- [x] **Step 4: Run the tests and see them pass.** Run `npm test -- tests/scripts/citation-rules.test.ts`. Expected: PASS.

- [x] **Step 5: Wire it into `scripts/check-references.js`.** Concatenate `checkCitations(files)` after `checkReferences(files)`, keep the header comment accurate, and change the summary to "reference(s) to fix." Then run `npm run check`. Expected: lint, types, tests, perf, catalogs and CSS pass, and the reference check lists findings.

- [x] **Step 6: Fix every finding in the repository.** Correct the citation, the path or the anchor; never weaken the rule. Done issues are exempt and stay unchanged. Then run `npm run check`. Expected: PASS.

- [x] **Step 7: Commit.** Add the four kinds of files. Subject: "Check that cited docs paths, anchors and spec sections exist". The body lists the citations fixed.

### Task 2: The spec citation rule, stage 1

**Files:**
- Modify: `scripts/citation-rules.ts`, `scripts/check-references.js`, `scripts/reference-rules.ts` (fix hints only)
- Test: `tests/scripts/citation-rules.test.ts`, `tests/scripts/reference-rules.test.ts`

**Interfaces:**
- Produces:
  - `export const SPEC_CITATION_SCOPE: readonly string[] = ["docs/user/", "docs/dev/"]`. Task 8 adds `".claude/skills/"`.
  - `export const SPEC_CITATION_ALLOWLIST: Readonly<Record<string, string>>`, with entries for:
    - `"docs/dev/en/howto/dependency-update.md"`: removed in phase 2, when "Dependencies and supply chain" moves;
    - `"docs/dev/en/howto/holiday-data.md"`: removed in phase 2, when "Holiday sources and work week" moves;
    - `"docs/dev/en/howto/docs.md"`: removed when `docs/SPEC.md` is deleted.
  - `export function checkSpecCitations(files: readonly TextFile[]): string[]`.

- [x] **Step 1: Write the failing tests:**
  - `docs/dev/en/reference/a.md` with "see docs/SPEC.md" → 1 error;
  - `docs/user/de/howto/b.md` with "laut SPEC" → 1 error;
  - an allowlisted path with "docs/SPEC.md" → no error;
  - `src/a.ts` with "docs/SPEC.md" → no error, because it is outside the scope;
  - "the CommonMark spec" in a scoped file → no error.

  In `tests/scripts/reference-rules.test.ts`, the "says what to do instead" test now expects `"docs/dev/en/"` instead of `"docs/SPEC.md"`.
- [x] **Step 2: Run both files and see the new tests fail.** Run `npm test -- tests/scripts/citation-rules.test.ts tests/scripts/reference-rules.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement.** The pattern is `/SPEC\.md|\bSPEC\b/`. The error reads: "a citation of the spec, which docs and code never cite; cite the reference page, or move the section into docs/dev/en/reference/ first". In `reference-rules.ts`, the two `instead` texts that say "docs/SPEC.md" now say "a page under docs/dev/en/". Call `checkSpecCitations` from `check-references.js`.
- [x] **Step 4: Run the tests and see them pass, then run `npm run check`.** Expected: PASS for both.
- [x] **Step 5: Commit.** Subject: "Keep new docs from citing the spec".

### Task 3: The docs style check

**Files:**
- Create: `scripts/docs-rules.ts`, `scripts/check-docs.js` (built like `scripts/check-css.js`, scanning `docs/user/**` and `docs/dev/**` from `git ls-files` like `check-references.js`)
- Modify: `package.json`: in `"check"`, add `node --import ./scripts/ts-hooks.js scripts/check-docs.js` after the reference check.
- Test: `tests/scripts/docs-rules.test.ts`

**Interfaces:**
- Produces: `export function checkDocs(files: readonly TextFile[]): string[]`. Files outside `docs/user/` and `docs/dev/` are ignored.

The rules. Each is a `{ pattern, what, instead, applies(path) }` entry, like `reference-rules.ts`:

| Rule | Applies to |
| --- | --- |
| Path shape `^docs/(user\|dev)/[a-z]{2}/(tutorials\|howto\|reference\|explanation)(/decisions)?/[a-z0-9][a-z0-9-]*\.md$` | every `.md` file in scope |
| `\b(e\.g\.\|i\.e\.\|etc\.)` | English (`/en/`) |
| `\b(simply\|easily\|just\|merely\|obviously\|straightforward)\b`, case-insensitive | English |
| `\b(currently\|soon\|at the moment\|now\|will be)\b`, case-insensitive | English |
| `!` not followed by `[` | English and German |
| `\b[Ww]e\b`, `\bour\b` | English, not under `/tutorials/` |
| `\b[Yy]ou(r)?\b` | English under `/reference/` |
| `\b(du\|dich\|dir\|dein\w*)\b`, case-insensitive | German under `/reference/` |
| `^Recommendation:` | under `/reference/` |
| `\b(einfach\|eben\|halt\|natürlich\|offensichtlich)\b` | German (`/de/`) |
| `\b[Ww]ir\b` | German |
| `\w[*:_]innen\b`, `\w+Innen\b` | German |
| `\bz\. ?B\.` or `\bd\. ?h\.` with a normal space or none | German; only U+00A0 between the letters passes |

Skipped: lines inside fenced code blocks; text inside backtick code spans and HTML comments, so the SPDX header is skipped; link targets `](…)`. Skipped lines still count toward the line number.

- [x] **Step 1: Write the failing tests:**
  - one per rule, each with the line number;
  - code fences, code spans and the SPDX comment produce no errors;
  - a `just` on line 7 after a fence on lines 3–5 reports line 7;
  - `docs/dev/en/notes.md` (no quadrant) reports the path shape;
  - `docs/dev/en/explanation/decisions/0001-documentation-model.md` passes the shape;
  - "z. B." passes; "z. B." and "z.B." fail.
- [x] **Step 2: Run the tests and see them fail.** Run `npm test -- tests/scripts/docs-rules.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement `scripts/docs-rules.ts` and `scripts/check-docs.js`,** and edit `package.json`'s `"check"`. The runner prints "The docs follow the style rules." on success.
- [x] **Step 4: Run the tests and `npm run check`.** Expected: PASS. There are no files in scope yet.
- [x] **Step 5: Commit.** Subject: "Check the mechanical style rules of the new docs".

### Task 4: Status lines on every spec section

**Files:**
- Create: `scripts/spec-status-rules.ts`
- Modify: `scripts/check-references.js` (call it), `docs/SPEC.md` (60 status lines)
- Test: `tests/scripts/spec-status-rules.test.ts`

**Interfaces:**
- Produces: `export function checkSpecStatus(files: readonly TextFile[]): string[]`. It looks only at `docs/SPEC.md`, and returns nothing if that file is absent.

The rule:
- Under every `##` and `###` heading outside fenced code blocks, the next non-empty line must match `/^Status: (implemented|see the subsections|planned for version [1-3]|partly implemented; .+|not a requirement; moves to .+ in phase [2-6])\.$/`.
- When a `##` has no intro text before its first `###`, its line is `Status: see the subsections.`

- [x] **Step 1: Write the failing tests:** a missing line, a wrong form, a valid line for each of the five forms, `## Project status` inside a fence ignored, a missing `docs/SPEC.md` → no errors.
- [x] **Step 2: Run them and see them fail.** Run `npm test -- tests/scripts/spec-status-rules.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement the module and wire it into `check-references.js`.**
- [x] **Step 4: Run the tests.** Expected: PASS. `npm run check` now fails with 60 findings.
- [x] **Step 5: Write the 60 status lines.**
  - Decide each from the code (`src/`), the open issues (`issues/`, `status:` not done) and `git log`.
  - Name an issue only where one exists, with its short description.
  - "Not a requirement; moves to … in phase N" is for: "Goals and scope", "Stages, risks, decisions", "Repository settings on GitHub" and "Hobby project notice". Each names the destination from the tracking list in Task 11.
  - Keep a list of the lines whose status was a judgement call, for the commit body.
- [x] **Step 6: Run `npm run check`.** Expected: PASS.
- [x] **Step 7: Commit.** Subject: "Mark every spec section as implemented, partly implemented or planned". The body asks the maintainer to confirm the judgement calls and lists them.

### Task 5: Stale lines

**Files:**
- Modify: `docs/ai-tooling.md` (L20, L134), `docs/SPEC.md`

- [x] **Step 1: Make the fixes:**
  - **`docs/ai-tooling.md`:**
    - L134: replace "GitHub workflows are still missing" with what exists. `.github/workflows/` has `check.yml`, `dependency-review.yml` and `seed-cache.yml`; the pinning rule stays.
    - L20: replace "about 65 KB" with the measured size (`wc -c docs/SPEC.md`, rounded to 5 KB).
  - **`docs/SPEC.md`:**
    - "As of" becomes 2026-11-14.
    - The depscope.dev links (L712, L721 and the source list near L1001) return HTTP 410. Drop the links, keeping the counts with "(depscope, as of 2026-10)", or replace them with deps.dev links to the same versions.
    - In the workflows table, the `templates`, `e2e` and `release` rows get "(planned)" after the name.
- [x] **Step 2: Run `npm run check`.** Expected: PASS.
- [x] **Step 3: Commit.** Subject: "Fix stale lines in the AI tooling notes and the spec".

### Task 6: The style page and decision record 0001

**Files:**
- Create: `docs/dev/en/reference/documentation-style.md`, `docs/dev/en/explanation/decisions/0001-documentation-model.md`

**Interfaces:**
- Consumes: the checks of Tasks 1–3, which both pages must pass.

- [x] **Step 1: Write `documentation-style.md`.** It is reference: indicative, terse, no "you". It holds:
  - the spec's section 3 in full: audience first; mixing is the defect; voice; order; lengths; the cut list; grammar; the register table, including the row for agent files;
  - the German rules of section 2;
  - the layout and topic-ID rules of section 1;
  - must, must not and may, defined once at the top.
- [x] **Step 2: Write `0001-documentation-model.md`.** It is explanation:
  - the decision first, in three or four sentences;
  - then why;
  - then the approaches table of the spec's "Approaches considered", one row per question;
  - "Status: accepted, 2026-11-14".

  It must not cite `SPEC.md` or `docs/superpowers/`; it states the reasons itself.
- [x] **Step 3: Run `npm run check`.** Expected: PASS, including the docs check and REUSE.
- [x] **Step 4: Commit.** Subject: "Write the documentation style page and the first decision record".

### Task 7: The how-tos

**Files:**
- Create: `docs/dev/en/howto/dependency-update.md`, `holiday-data.md`, `release.md`, `ui-texts.md`, `docs.md`

- [x] **Step 1: Copy the procedures.** For each of the four skills, copy the body of `.claude/skills/<name>/SKILL.md` into `docs/dev/en/howto/<name>.md`. The body is everything after the frontmatter and the SPDX comment. Add an SPDX header and an `#` title. Change only what the checks reject, and note each such change for the commit body.
- [x] **Step 2: Run `npm run check`.** Expected: PASS. The two spec citations are allowlisted.
- [x] **Step 3: Commit.** Subject: "Copy the four procedures from the skills into docs/dev/en/howto". The body lists any check-forced changes.
- [x] **Step 4: Fix the content.**
  - In `release.md`, the schema check reads `"restlos/1"`, the value of `schema` in `docs/file-format.md`. The old text was `urlaubsplaner/N`.
  - Fix anything else stale: compare each step with `package.json` scripts and the workflows.
- [x] **Step 5: Write `docs.md`,** following the spec's section 5:
  - the hard rules first, one line each;
  - then about ten imperative steps, ending with `npm run check`.

  It names `docs/SPEC.md` only in its step on moving text out of it; that's allowlisted.
- [x] **Step 6: Run `npm run check`.** Expected: PASS.
- [x] **Step 7: Commit.** Subject: "Bring the how-tos up to date and add the docs procedure".

### Task 8: Pointer skills (main session only)

**Files:**
- Modify: `.claude/skills/dependency-update/SKILL.md`, `holiday-data/SKILL.md`, `release/SKILL.md`, `ui-texts/SKILL.md`
- Create: `.claude/skills/docs/SKILL.md`
- Modify: `scripts/citation-rules.ts` (`SPEC_CITATION_SCOPE` gains `".claude/skills/"`), `tests/scripts/citation-rules.test.ts`

- [x] **Step 1: Add the test:** `.claude/skills/x/SKILL.md` containing "docs/SPEC.md" gives 1 error. Run `npm test -- tests/scripts/citation-rules.test.ts`. Expected: FAIL.
- [x] **Step 2: Add the scope entry.** Run the same tests. Expected: PASS.
- [x] **Step 3: Write the five skill files with the Write tool.** The maintainer approves the prompt.
  - Keep the frontmatter of each existing skill unchanged. The new `docs` skill gets:
    - `name: docs`;
    - `description: Write, move or review documentation in docs/ (user docs in English and German, developer docs in English) following the Diátaxis layout and the style rules. Use when adding or changing a docs page, moving text out of the spec, or writing help topics.`;
    - `license: CC-BY-4.0`;
    - `metadata: { project: restlos-urlaubsplaner }`.
  - The SPDX comment follows the frontmatter, then the body:

```markdown
Read `docs/dev/en/howto/<name>.md` completely (the path is from the repository root, not from this skill's folder), then follow it step by step. If the conversation was summarised since you read it, read it again before the next step.
```

  - `triage` stays unchanged.
- [x] **Step 4: Run `npm run check`.** Expected: PASS. The pointer targets resolve, and no skill cites the spec.
- [x] **Step 5: Commit.** Subject: "Point the skills to the how-tos in docs/dev/en/howto".

### Task 9: `AGENTS.md` and the AI tooling notes

**Files:**
- Modify: `AGENTS.md` (the "Project" bullets, a new "Documentation" section, "Repository-specific procedures", the `npm run check` description), `docs/ai-tooling.md` (L16)

- [x] **Step 1: Replace the "Full specification" and "File format" bullets** with one "Authority" bullet holding the rule from the spec's section 4. Copy it verbatim, including the strict-move sentence. Keep the glossary bullet until phase 2.
- [x] **Step 2: Add a "## Documentation" section after "Text in the repository":**

```markdown
## Documentation

- `docs/user/<language>/` holds the end-user docs, which feed the in-app help and the website: English (`en/`) is the source, German (`de/`) is required at the same paths and changes in the same commit, further languages are optional. `docs/dev/en/` holds the developer docs, in English.
- Pages sit in `tutorials/`, `howto/`, `reference/` or `explanation/` (Diátaxis); a folder appears with its first page. Normative statements live only in reference, rationale only in explanation; a page that mixes them is a defect.
- User pages link to each other by topic ID, which is the file name, not by path.
- Style rules: `docs/dev/en/reference/documentation-style.md`. Procedure: `docs/dev/en/howto/docs.md`. `npm run check` runs the docs, citation and spec status checks.
```

- [x] **Step 3: Replace the intro of "Repository-specific procedures"** with: "Step-by-step procedures live as how-tos in `docs/dev/en/howto/`, readable by humans and every agent. The skills in `.claude/skills/*/SKILL.md` (Agent Skills format) point to them." Add the line "`docs` – writing or moving documentation". `triage` keeps its line and gets "(a full skill, not a pointer)".
- [x] **Step 4: Update the descriptions of `npm run check`.** The Environment line and the "Text in the repository" bullet both name the new checks: unresolved citations, citations of the spec, spec status lines and the docs style rules.
- [x] **Step 5: In `docs/ai-tooling.md`,** change the L16 table row "Specification, authoritative" to "Tracking of planned work; reference pages are authoritative".
- [x] **Step 6: Run `npm run check`.** Expected: PASS.
- [x] **Step 7: Commit.** Subject: "State the documentation model and the new authority rule in AGENTS.md".

### Task 10: The decided help and website design as planned work in the spec

**Files:**
- Modify: `docs/SPEC.md`: "Dependencies" (L708ff), "Built-in help" (L553ff), the Pages parts of "Delivery format" (L55ff), "Build and CI" (L776ff) and its "Workflows" table

- [x] **Step 1: Add markdown-it to the dependency table:** markdown-it 15.0.3; purpose "parses the help Markdown"; not in the HTML; assessment "approved 2026-11-14; build only; 6 packages including itself (`argparse` already present); CommonMark; installed with the help".
- [x] **Step 2: Add mdBook to the dev shell description in "Build and CI":** mdBook 0.5.2 from nixpkgs, planned with the website, "approved 2026-11-14; no npm package".
- [x] **Step 3: Rewrite the planned part of "Built-in help"** in short form, from the spec's sections 2 and 7:
  - the sources under `docs/user/`;
  - markdown-it with `html: true` in a Vite plugin;
  - the closed typed tree and the checks;
  - `HelpTopic.svelte` without `{@html}`;
  - `{ui:…}`, `{shortcut:…}` and `{#id}`;
  - topic IDs with generated types, the alias list and the content-hash sync;
  - the dialog pattern.

  Keep the chapter list and the keyboard table where they are; they move in phase 5. Keep its status line "planned".
- [x] **Step 4: Write the website into "Delivery format" and "Build and CI":**
  - "Delivery format" gets the Pages layout: a landing page at `/<repo>/`, the app at `/<repo>/app/` with the service worker scoped there, and docs at `/<repo>/docs/de/`, `/docs/en/` and `/docs/dev/`.
  - "Build and CI" gets the three mdBook books, the language link, the checked interface-string rewrite and deployment with releases.
  - Keep the status lines consistent with Task 4.
- [x] **Step 5: Run `npm run check`.** Expected: PASS.
- [x] **Step 6: Commit.** Subject: "Record the decided help and website design as planned work in the spec".

### Task 11: The tracking issue

**Files:**
- Create: `issues/0055-move-the-spec-into-the-docs.md`, from `issues/_template.md`

- [x] **Step 1: Write the issue.** Frontmatter: `status: open`, `priority: 2`, `area: docs`, `branch:` empty, `created: 2026-11-14`. The body:
  - **Problem:** built behaviour, rationale and status still live in `SPEC.md`, and code cites it.
  - **Context:** the authority rule in `AGENTS.md`.
  - **Acceptance criteria:**
    - every row below is done;
    - the stage 2 citation rule is on;
    - the four indirect mentions are reworded.
  - **Notes:**
    - a table of all 60 sections, in spec order, with the columns section, status (from Task 4), destination and phase. A destination is a path followed by ` (new)`, "stays as tracking", "README", "issues" or "help". Phase 2 to 6.
    - the rule that a feature branch may do a row early and ticks it.

  Destinations follow the spec's "Phases" and Phase 1 scope step 9:
  - phase 2: the reference-shaped sections;
  - phase 3: explanation and status;
  - phase 4: UI behaviour;
  - planned parts stay as tracking.
- [x] **Step 2: Find the four indirect mentions** with `git grep -n -i -E "the spec('s)?\b|\bSPEC\b"`, run separately in `src`, `scripts`, `e2e`, `tests` and `docs`. The command excludes nothing, so read each hit. List the hits that refer to `SPEC.md`, among them `src/engine/file/report.ts` L107 and `docs/file-format.md` L411.
- [x] **Step 3: Run `npm run check`.** Expected: PASS. The ` (new)` paths are skipped.
- [x] **Step 4: Commit.** Subject: "Track the move of every spec section into the docs".

### Task 12: Final verification

- [x] **Step 1: Run `npm run check`.** Expected: PASS, with "The text stands on its own." and "The docs follow the style rules." in the output.
- [x] **Step 2: Check the spec's "Done means" list for phase 1** item by item against the branch (`git log main..HEAD --stat`). Report each item with the file that proves it.
- [x] **Step 3: Tick this plan's checkboxes.** Stop at the branch: the maintainer reviews, signs, merges and pushes.
