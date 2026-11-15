<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: documentation rework (Diátaxis docs, a temporary spec, in-app help and website)

As of: 2026-11-14. Branch: `docs-rework` (phase 1). Issues: phase 3 folds in issue 0038 (keep what matters from the AI design documents). Phase 1 writes a tracking issue for the moves of phases 2 to 4.

This document covers the whole documentation model and every phase. Phase 1 is described in enough detail to plan from. Phases 2 to 6 are described as decided, and each gets its own plan when it is scheduled.

## Intent

The documentation and the way the spec works are reworked so that every reader finds the right kind of text:
- people planning their leave, in German and English;
- contributors;
- AI agents.

Today one file, `docs/SPEC.md`, holds 23,254 words that mix five kinds of text:
- normative reference;
- rationale (13 paragraphs start with "Recommendation:");
- project status;
- agent instructions;
- future help text.

It is cited 144 times from 100 files, mostly by quoted section name. No check confirms that those sections exist, and three citations are already broken. Built and planned behaviour are not marked apart, and agents treat the spec as binding. A preprint (Xu and Wu, arXiv 2610.30571) found that agents follow a stale instruction file over the code in 90 % of convention choices.

The goal state:
- Reference pages describe what is built and are authoritative.
- Explanation pages say why.
- How-tos hold procedures for humans and agents alike.
- User docs feed both the offline in-app help and a website.
- `SPEC.md` shrinks to a tracking document for unbuilt work and is deleted when the project is finished.

## Goals

- **Structure by audience, then by Diátaxis mode:** a page that mixes modes is a defect; the folder follows the mode.
- **Readers:**
  - user docs in English (source) and German (required, always current);
  - further languages possible as optional translations;
  - developer docs in English only.
- **One source for help:** a user topic is written once per language and feeds the in-app help and the website.
- **Checkable references:** every cited file, anchor and spec section must resolve, and `npm run check` enforces it.
- **No hidden authority:**
  - docs and code never cite `SPEC.md`;
  - planned text cannot be mistaken for built behaviour;
  - `SPEC.md` is deleted at the end.
- **Visible procedures:** the developer procedures are docs pages, visible on the website and readable by every agent. The skills point to them.
- **Small steps:** each move is a small, reviewable branch, and `npm run check` passes after every step.

## Non-goals

- Translating developer docs. The layout leaves room for `docs/dev/de/`, but nobody writes it.
- Versioned docs per release on the website. Latest only; each downloaded HTML carries its own help.
- A published component gallery. It stays dev-only.
- Full-text German stemming in website search (see "Website").
- Rewriting the normative format references (`file-format.md`, `day-rules-format.md`, `holiday-data-format.md`). They move unchanged.

## Anti-goals

The work fails, even if it technically works, in any of these cases:
- **Two binding sources:** the same fact is binding in `SPEC.md` and in a reference page.
- **Planned text in reference:** a reference page describes planned behaviour as if it were built.
- **Unchecked citations:** a move breaks citations and no check notices.
- **An unbounded migration:** the migration stalls in an open-ended "when touched" state.
- **New outside dependencies:** the website or help adds tracking, external fonts or CDNs, or npm packages beyond the one approved parser.
- **Silent German fallback:** German help silently shows English text.
- **Edits nobody can review:** the maintainer has to make manual edits in the middle of a phase instead of once at setup.

## Constraints

From `AGENTS.md` and the repository:
- **English only for repository text:** code, comments and docs. UI and help texts come through catalogs or the help sources, never hard-coded. User docs follow the glossary terms.
- **The repository stands on its own:** no pointers to chats or outside files, and short references always carry a description. `docs/superpowers/` is outside the repository by rule, and nothing links to it.
- **Supply chain:**
  - only packages listed in the spec's dependency table;
  - exact versions, `npm ci`, `ignore-scripts=true`, `min-release-age=14`;
  - no `npx`; tools run through npm scripts;
  - new tools come from the Nix dev shell and need the maintainer's approval.
- **Security:** no `{@html}` with data, no `eval`, CSP `connect-src 'none'` in the delivered HTML, size limits on imports.
- **Size:** the single HTML has a 614,400-byte limit (`MAX_BYTES` in `scripts/build/vite-restlos.ts`); the build is 309,187 bytes today.
- **Browsers:** current Firefox ESR plus Chromium and WebKit.
- **REUSE:** every new file gets SPDX headers. Documentation is CC-BY-4.0, code EUPL-1.2, artwork CC-BY-SA-4.0 (decided; see "Logo and icon").
- **Git:** work on branches, never on `main`, never push, tag or sign. Commits use `git -c commit.gpgsign=false commit -m … -m …`. `main` has only squash merges.
- **Sandbox** (checked on 2026-11-14):
  - Bash can never write to `.claude/skills/`, `.claude/hooks/` or the settings files. The test write failed with "Das Dateisystem ist nur lesbar", and no `allowWrite` setting lifts it.
  - The Write and Edit tools treat `.claude/` as a protected path: they prompt in default and acceptEdits mode, and the classifier decides in auto mode.
  - Reads and writes under `docs/` need no prompt.

## Approaches considered

| Question | Options | Picked | Why |
| --- | --- | --- | --- |
| What happens to the spec | keep it; slim it to a "constitution"; transfer it fully and delete it; hybrid | **hybrid, temporary** | Built behaviour moves to reference, rationale to explanation, status to issues, help content to the help. `SPEC.md` keeps only planned work as tracking and is deleted when empty. Keeping it leaves two binding sources; a full transfer leaves no home for agreed but unbuilt design. |
| How to migrate | big-bang rewrite; mechanical split of the whole file, then rewrites; section by section | **section by section with guard rails** | Small diffs for one reviewer, and every page enters its mode folder already rewritten. A fixed, finite list of moves prevents a stall. Each move cuts the text from `SPEC.md` in the same commit. |
| How agents get the rules | `.claude/rules/`; a long `AGENTS.md`; a skill; a check | **style page + `docs` skill + short `AGENTS.md` section + check** | `.claude/rules/` is Claude-only and duplicates `AGENTS.md`. Procedures belong in a skill, the mechanical rules in a deterministic check, and the rules themselves on a page humans read too. |
| Where developer procedures live | skills; docs pages | **docs pages, skills as thin pointers** | Visible on the website, readable by agents that do not load `.claude/skills/`, and editable without the protected-path prompt. |
| Website generator | own `svelte/server` site; mdBook; Hugo; Zola; Zensical; Sphinx; GitHub links | **mdBook 0.5.2 from nixpkgs** | No site chrome to write, no npm packages, slow-moving. Hugo is better at languages but needs an own layout or a vendored theme with minified third-party JavaScript, and it releases breaking minor versions every few weeks. |
| Multilingual mdBook | mdbook-i18n-helpers (gettext); forked theme; three generated books plus a checked string rewrite | **three generated books plus a checked string rewrite** | gettext makes German a PO file tied to English sentences and needs an extra pass for the app. A forked theme is a merge on every upgrade. |
| Help rendering | a Svelte Markdown library; mdsvex; own typed tree plus one component | **own typed tree plus one component** | Every maintained library parses in the browser, so the parser ships in the 600 KB file. Several insert raw HTML with `{@html}` from `node_modules`, and none runs the project's checks. |
| Parser | marked; markdown-it; remark parser layer; Markdoc | **markdown-it 15.0.3, build-only, approved** | It parses like GitHub (CommonMark) and gives block line ranges for errors. Its `Token` format was unchanged from 14 to 15, and it drops `javascript:` and `data:` links. It adds 6 lockfile entries. |
| Languages | equal languages in lockstep; gettext; English source with German required | **English source, German required and current in the same commit, more languages optional** | Equal lockstep doesn't scale to a third language, and gettext puts the main audience's language into PO files. |
| Language in paths | suffix on every file; suffix on translations; language folders for user docs; language folders everywhere | **language folders everywhere, including `docs/dev/en/`** | One rule for all of `docs/`: clean trees for optional languages, ownership per folder, and room for translated developer docs. |

## Decided design

### 1. Layout and audiences

```
docs/
  user/                          end users → in-app help and website
    en/                          source
      tutorials/getting-started.md
      howto/<topic>.md
      reference/<topic>.md
      explanation/<topic>.md
    de/                          required: same paths, same commit
      tutorials/ howto/ reference/ explanation/
  dev/                           contributors and agents → website
    en/                          English only; a dev/de/ may be added later
      howto/          procedures (release, dependency-update, holiday-data, ui-texts, docs)
      reference/      file formats, glossary, documentation style, built behaviour from the spec
      explanation/    rationale; decisions/ for decision records
  SPEC.md                        temporary tracking of planned work: never cited, not published
  superpowers/                   outside the repository by rule: not published
```

- The pattern is `docs/<audience>/<language>/<quadrant>/<topic>.md`.
- **Folders appear with their first page:** no empty quadrant folders.
- **Topic IDs:** the topic ID is the file name. It is unique within an audience and never reused once retired.
- **Mirrored trees:** the trees under `docs/user/en/` and `docs/user/de/` mirror each other path for path.
- **Links:** user pages link to each other by topic ID (`[Tagesregeln](day-rules)`), not by file path. Moving a page between quadrants then breaks nothing.
- **Developer page links:** developer pages use normal relative links. The check resolves them.
- **Website URLs:**
  - user docs have no quadrant in the URL: `/docs/de/day-rules.html`, `/docs/en/day-rules.html`;
  - developer docs are under `/docs/dev/…`.
- **Meta pages stay where they are:** README, CONTRIBUTING, SUPPORT, SECURITY, CHANGELOG, `issues/`, the licence texts.

### 2. Languages

- **English is the source.** `docs/user/en/…/<topic>.md` is written first.
- **German is required and current.** The same path under `docs/user/de/` must exist and match the current English text, changed in the same commit.
- **A sync file records, per translation, a hash of the English text it matches.**
  - A German file whose recorded hash differs from the current English fails the check.
  - A German-only fix, such as a typo, changes nothing on the English side and passes.
  - A one-command acknowledge step re-records the hash after someone has checked the German. The exact form is the phase 5 plan's call.
- **Why hashes, not commits:** the hashes are of content, not of git commits. `main` has only squash merges, so a commit hash recorded on a branch never appears in `main`.
- **Further languages, for example `docs/user/fr/`, are optional.**
  - A mismatch or a missing file only warns.
  - The website marks an outdated page.
  - A missing page falls back to English.
- **Developer docs are English only.**
- **German style:**
  - "du";
  - gender-neutral wording without gender characters;
  - "z. B." with a non-breaking space;
  - no "wir" in tutorials;
  - no Konjunktiv in instructions.
  These rules apply to user docs and UI texts only.

### 3. Style rules

They live on one page, `docs/dev/en/reference/documentation-style.md` (CC-BY-4.0), which humans and agents share. It adapts the Diátaxis style that served as the model:

- **Audience first, then mode.** Mixing modes in one page is the defect. Fix it when you touch the page. Named homes for meta pages.
- **Voice:** do not sell or editorialise. Warn only where data or privacy can be lost: one sentence on what happens and how to avoid it.
- **Order:** what, then why, then how. Rationale lives in explanation and is linked, not inlined. Inside explanation: decision first, then why, then the rejected alternatives.
- **Sentence and paragraph length:**
  - English sentences: one idea each, about 15–20 words on average; split above 25 words.
  - German sentences: split above about 20 words, with at most one subordinate clause.
  - Paragraphs: one idea, at most five sentences.
  - Tables, code, paths and normative lists are exempt.
- **Cut:**
  - filler;
  - minimising words: simply, easily, just, merely, obviously, straightforward; in German einfach, eben, halt, natürlich, offensichtlich;
  - time-relative words (currently, now, soon, will be), except in CHANGELOG, `issues/` and status lines; elsewhere name the version;
  - Latin abbreviations in English;
  - metaphor, idiom, humour, exclamation marks.
- **Grammar:**
  - Active voice and present tense; passive is allowed when the actor does not matter.
  - Normative reference uses must, must not and may, defined once.
  - They/them for a hypothetical person.
- **Register per quadrant:**

  | Quadrant | Register |
  | --- | --- |
  | reference | indicative, terse, no rationale, no second person |
  | how-to | imperative, second person, no theory |
  | tutorial | second person; "we" allowed in English only; show expected output |
  | explanation | discursive; the only place for rejected alternatives |

  Agent files: `AGENTS.md` is reference, and skills and how-tos are how-to.

### 4. The spec as temporary tracking

- **Authority rule** for `AGENTS.md`. It replaces today's "Full specification … authoritative" and holds during the whole migration:
  > Reference pages in `docs/dev/en/reference/` describe what is built. They are authoritative: if code and reference disagree, or a page is unclear, ask. Until phase 2 moves them, the format references `docs/file-format.md`, `docs/day-rules-format.md` and `docs/holiday-data-format.md` are reference pages in place. `docs/SPEC.md` is being emptied. A section whose status line says "implemented" is authoritative until it moves; everything else in it is tracking for planned work. Follow `SPEC.md` when a task implements a part of it; move that part into reference in the same commit; never change existing code toward it unasked. Docs and code never cite `SPEC.md`: existing citations stay until their section moves. If new code or a new doc needs a spec section, move that section into reference first and cite the reference page. Issues may cite it. Explanation pages and decision records say why; they are not requirements.

  The `AGENTS.md` "File format" bullet becomes part of this rule, and its "`docs/SPEC.md` states the principles" goes. The same commit fixes `docs/ai-tooling.md` L16 ("Specification, authoritative").
- **Transition rule for new citations (decided 2026-11-14: strict).** New code and new docs never cite `SPEC.md`.
  - A change that needs to cite a spec section first moves that section into reference, in the same branch, then cites the reference page. That is one pure-move commit plus the rewrite of that section's existing citations.
  - The move is ticked off in the tracking issue, so moves can happen early in any feature branch.
  - The authority rule in `AGENTS.md` states this in one sentence.
- **Status lines:** every real `##` and `###` heading of `SPEC.md` gets one directly under it. There are 60; `## Projektstatus` and `## Project status` sit inside a code block and are not headings. A `##` line covers only its own intro text, and each `###` has its own line. If a `##` has no intro text, its line reads `Status: see the subsections.` The forms:
  - `Status: implemented.`
  - `Status: partly implemented; <what is missing>, planned for version N.` An issue is named with its short description where one exists; a missing issue is not created just for the status line.
  - `Status: planned for version N.`
  - `Status: not a requirement; moves to <destination> in phase N.` This is for sections that describe nothing to build: goals and scope, stages, risks and decisions, repository settings on GitHub, the hobby notice.

  An agent proposes them from code, issues and git history, and the maintainer confirms them in review.
- **When a part ships:** the feature commit moves it into reference, rewrites its citations to the reference page, and closes the issue. `SPEC.md` keeps a one-line pointer ("Moved to …") until the next cleanup.
- **The citation rule, in two stages, enforced like the existing rule for `docs/superpowers/`:**
  - **Stage 1, from phase 1:**
    - Covered: `docs/user/**`, `docs/dev/**` and `.claude/skills/**`. These must not mention `SPEC.md`. `.claude/skills/**` is switched on in the step that rewrites the skills, so `npm run check` passes after every step.
    - Exception, my call: an explicit, temporary allowlist, where each entry names the phase that removes it:
      - `dependency-update.md` keeps its citation of the package list in "Dependencies and supply chain" until phase 2;
      - `holiday-data.md` keeps its citation of "Holiday sources and work week" until phase 2;
      - `docs.md`, the docs how-to, names `SPEC.md` in its step on moving text out of it, until `SPEC.md` is deleted.
    - Pattern: the file name `SPEC.md` and the uppercase word `SPEC`. Lowercase "the spec" is too common in other senses ("the CommonMark spec"). Phase 1 greps the four indirect mentions once and lists them in the tracking issue, for example "SPEC, Security" in `src/engine/file/report.ts` L107 and "the spec's Limits bullet" in `docs/file-format.md` L411.
  - **Stage 2, after phase 4:** no mention of `SPEC.md` anywhere except `issues/` and the one rule in `AGENTS.md`.
- **Done issues** are history and keep their citations. Open issues may cite the spec section they implement.
- **When `SPEC.md` holds no planned work, it is deleted.**

### 5. Agent setup

- **`AGENTS.md` gets a "Documentation" section of four to six lines:**
  - the document sets (`docs/user/`, `docs/dev/`);
  - normative statements live only in reference, rationale only in explanation;
  - the style page;
  - procedures are in `docs/dev/en/howto/`, and the skills point to them.

  The "Repository-specific procedures" list changes accordingly. The hard rules stay in `AGENTS.md`: no npx, no new packages without approval, never push.
- **Pointer skills:** `dependency-update`, `holiday-data`, `release` and `ui-texts` become thin pointers, and a new `docs` skill is added. They keep their `name`, `description` (the trigger), `license` and `metadata`, and the SPDX comment after the frontmatter. The body follows this template:

  > Read `docs/dev/en/howto/<name>.md` completely (the path is from the repository root, not from this skill's folder), then follow it step by step. If the conversation was summarised since you read it, read it again before the next step.

  Two reasons for the wording:
  - Claude Code shows the model each skill's base directory, so a bare relative path could be resolved against the skill folder.
  - After a summary, only the skill text is re-attached, not the files it pointed to.
- **`triage`** stays as it is (`disable-model-invocation: true`, `allowed-tools: Read Grep Glob`).
- **The `docs` skill's how-to** (`docs/dev/en/howto/docs.md`) has about ten steps:
  1. Name the reader and their one need.
  2. Choose the mode, and use that mode's template.
  3. When moving text out of the spec, move it unchanged first, then rewrite it in a second commit.
  4. Update every citation in the same commit, and every file that names the authoritative source.
  5. Hand catalog strings to the `ui-texts` how-to.
  6. Write user pages in English and German in the same commit.
  7. Review what no check can see.
  8. Run `npm run check` last.

  The hard rules come first, one line each.
- **Setup is the maintainer's only manual step:**
  - The agent copies the procedures into `docs/dev/en/howto/`.
  - The agent writes the five skill files with the Write tool, and the maintainer approves the protected-path prompt once.
  - There is no hook.

  After that, procedures change only in `docs/dev/en/howto/`, which is writable without prompts.
- **What controls procedure changes:** procedures in `docs/` are agent-writable without a prompt, while the skills were not. The control is commit review. A how-to cannot grant permissions; the permission rules and the sandbox still apply.

### 6. Checks

All checks run in `npm run check`, are written in TypeScript like the existing ones, and add no npm package.

| Check | Where | Phase |
| --- | --- | --- |
| Every `docs/…` file path in tracked text resolves. Every Markdown anchor resolves to a heading. Every quoted section name after `SPEC.md,` names an existing `##` or `###` heading, or a bold run-in label. Bold labels are accepted only until their section moves in phase 4, where they become headings. Matching rules: a heading's text counts up to its first ":" or " (". Done issues are exempt. Folder paths (ending in `/`) and patterns (containing `<`, `>`, `*` or `…`) are not checked. A file path directly followed by ` (new)` is a planned page and is not checked; the tracking issue uses this for its target pages. | extend `scripts/reference-rules.ts` / `check-references.js` | 1 |
| Every skill's pointer target exists. | same | 1 |
| Spec citation rule, stage 1 (see 4) | same | 1 |
| Mechanical style rules, scoped to `docs/user/**` and `docs/dev/**` only (see below) | new `scripts/docs-rules.ts` + `scripts/check-docs.js` + tests | 1 |
| Every `docs/user/en/` file has its twin under `docs/user/de/`. Same headings, anchors, topic links and placeholders. Content-hash sync. | help check | 5 |
| Help converter checks: no raw HTML, links only to topic IDs or allowlisted `https:` URLs, placeholders resolve, unknown node types fail. Generated topic-ID types checked both ways. | help build | 5 |
| Spec citation rule, stage 2 | reference check | end of 4 |
| mdBook interface-string rewrite: version pin, every rule matches, no identical German and English text outside `<main>` | website build | 6 |

**Mechanical style rules, phase 1:**
- Latin abbreviations and exclamation marks in English files.
- Minimising and time-relative words.
- "we" outside tutorials, "you" in reference pages, and "Recommendation:" in reference pages.
- The German words only in `docs/user/de/`.
- Code blocks and code spans are skipped.
- Errors are reported as `path:line: what; instead`, like `reference-rules.ts`.
- The rules start small and strict, with tests for each, so false positives are rare.

Vale (in the pinned nixpkgs) is not used now. It comes back only if this check proves too weak.

### 7. In-app help (phase 5)

- **Pipeline:**
  1. A Vite plugin in the app's build parses `docs/user/en/**` and `docs/user/de/**` with markdown-it 15.0.3. It is build-only, imported from the package root, and uses `html: true` so raw HTML fails the build.
  2. A converter turns the tokens into the project's own closed, typed help tree, about ten node kinds.
  3. The checks run, with file and line from markdown-it's block ranges.
  4. The build embeds one JSON data block per language with `insertDataBlock`, which already escapes every `<`.
  5. `HelpTopic.svelte` renders the tree with two recursive snippets and no `{@html}`.
- **Help syntax:**
  - `{ui:catalog.key}` for UI labels, resolved per language at build time;
  - `{shortcut:action}` for keys, from one shortcut table in code that both the key handling and the help read; on macOS the help shows Cmd;
  - `{#id}` for anchors.
- **Seven design changes from practice:**
  1. Generated `HelpTopicId` types, checked in both directions.
  2. An alias list of old ID → new ID, which also feeds the website redirects.
  3. Shortcuts by action, with the table generated from code.
  4. Sync by content hash.
  5. The WAI-ARIA dialog pattern: focus the topic heading on open, Escape closes only the help, focus returns to the "?" that opened it, and a Back action between topics.
  6. Loud rejection of raw HTML.
  7. The link allowlist as the real defence.
- **Size:** about 90–150 KB of help for both languages, estimated, or 40–70 KB if stored compressed with `DecompressionStream`. Measure it against the budget.

### 8. Website (phase 6)

- **Pages layout:**
  - a landing page at `/<repo>/` with no service worker;
  - the app at `/<repo>/app/`, with its service worker and manifest scoped there;
  - docs at `/<repo>/docs/de/`, `/docs/en/` and `/docs/dev/`.
- **Deployment:** together with each release, from one folder, in one deploy.
- **Three mdBook books (0.5.2 from nixpkgs):** after the checks, the project's build writes them with generated `book.toml` and `SUMMARY.md` files. User pages come from the checked tree, as resolved Markdown. Developer pages come from `docs/dev/en/`, with links to source files rewritten to GitHub links at the release tag.
- **Language link:** each user page gets a link to its twin in the other language as its first line, `hreflang` set. It needs no JavaScript.
- **Redirects:** `[output.html.redirect]` is generated from the alias list.
- **German interface text:** after `mdbook build`, a Node step replaces mdBook's English strings in the German book with strings from a `docsSite.*` catalog group. That is about 25 strings plus 5 theme names. The step fails if:
  - the mdBook version differs from the pinned one;
  - a rule matches nowhere;
  - text outside `<main>` is identical in the German and English output.
- **Search:** per book. German has no stemming. If that proves too weak, try Pagefind over the output first.
- **Not published:** `SPEC.md`, `docs/superpowers/`, `issues/` and the component gallery.
- **A test build must confirm ten points before phase 6 is planned in detail:**
  1. the string list;
  2. the search script's file name;
  3. that the rewrite leaves page content alone;
  4. the identity check;
  5. the language links under the site URL;
  6. the redirects;
  7. a German 404 page;
  8. German search;
  9. no outside requests;
  10. Firefox ESR, Chromium, WebKit and Orca.
- **Fallbacks:** if the string rewrite proves unreliable, use Hugo with an own layout and Pagefind. Hugo also becomes the better choice if the site grows beyond help pages.

### 9. Logo and icon (separate small branch)

- **Licence:** the icon and logo SVGs are CC-BY-SA-4.0. The licence text is added with `reuse download CC-BY-SA-4.0`, `AGENTS.md`'s licensing rule gets one line for artwork, and the generator script stays EUPL-1.2.
- **Generator script fixes:**
  - prefix the clip-path IDs per file, because both use `c1`;
  - add SPDX headers;
  - write fixed-colour light and dark variants for README's `<picture>`, because the inline name uses `currentColor`;
  - round the numbers to two decimals.
- **Where they go:**
  - the help's "About/Licenses" chapter, with the Lexend (OFL-1.1) credit;
  - the landing page and the docs header;
  - the favicon and the manifest icons.
- **Not docs work:** the script's home and the start screen.

## Phases

Each phase is one or more small branches with `npm run check` passing.

- **Phase 0, decisions (done on 2026-11-14):** everything in this document.
- **Phase 1, guard rails and setup:** the first plan; see the scope below.
- **Phase 2, move what is already reference:** first the two spec sections the how-to allowlist depends on ("Dependencies and supply chain", "Holiday sources and work week"). Then:
  - move the three format references unchanged into `docs/dev/en/reference/`; they are cited by 18, 7 and 7 files;
  - move "Adding a country" into the holiday-data how-to;
  - cut the duplicate "Format" and "Sharing and validation" text from `SPEC.md`;
  - move the glossary to its own reference page and re-point `AGENTS.md` in the same commit;
  - keep one canonical copy each of the hobby notice (README), the release checklist (release how-to) and the holiday-data procedure;
  - remove the allowlist entries.
- **Phase 3, explanation and status:**
  - turn the 13 "Recommendation:" paragraphs into plain statements plus explanation pages;
  - move rejected alternatives to explanation;
  - write decision records only for decisions with serious alternatives: EUPL, single HTML plus Pages, Svelte and Vite, Typst for Pro, three file kinds, 480 units per day, no `Date` in the engine, and this documentation model;
  - fold in issue 0038 (keep what matters from the AI design documents);
  - move versions, risks and "still to check" items into issues or a short roadmap page.
- **Phase 4, built UI behaviour:**
  - move "Calendar interaction", "Day cell", "Screen sizes", "Problems", "Allowance display" and "Accessibility" into reference pages; they carry about 60 citations;
  - promote the bold labels "Detail view", "Leave bar" and "Range rules" to headings;
  - use one pure-move commit, then one rewrite commit;
  - then switch on stage 2 of the citation rule.
- **Phase 5, help foundation:** when the help is scheduled.
- **Phase 6, website:** with the first Pages release.
- **Ongoing:** a feature commit that builds a planned section moves it into reference. When `SPEC.md` holds no planned work, it is deleted.

## Phase 1 scope

One branch, `docs-rework`. Order of work, each as its own commit or small group of commits:

1. **Extend the reference check, test first:**
   - resolve `docs/…` paths, Markdown anchors and quoted spec section names (headings, plus bold run-in labels);
   - check that skill pointer targets exist;
   - add stage 1 of the spec citation rule with the two-entry allowlist;
   - fix what the check finds, at least "Main screen" (twice, in `e2e/allowance.spec.ts` L92 and `src/ui/screens/MainScreen.svelte` L351) and "Licensing" (`REUSE.toml` L41). The right target section is the builder's call after reading the spec.
2. **Fix the known stale lines:**
   - the two in `docs/ai-tooling.md` ("GitHub workflows are still missing"; the spec size "about 65 KB");
   - the spec's "As of" date;
   - the dead depscope.dev links in the spec's dependency table (HTTP 410);
   - the workflows table, which lists `templates`, `e2e` and `release` workflows that do not exist; mark them planned.
3. **Add status lines under every `##` and `###` section of `SPEC.md`** (section 4). The agent proposes them; the maintainer confirms them in review.
4. **Write the style page** `docs/dev/en/reference/documentation-style.md` (section 3).
5. **Write the how-tos in two commits:**
   - First, copy the procedures of `dependency-update`, `holiday-data`, `release` and `ui-texts` unchanged into `docs/dev/en/howto/<name>.md`, with SPDX headers.
   - Second, fix stale content and style. This includes the release how-to's schema check: `restlos/1`, not `urlaubsplaner/N`.

   Then write `docs/dev/en/howto/docs.md` (section 5).
6. **Write the skill files** with the Write tool: four pointers and the new `docs` skill. The maintainer approves the protected-path prompt.
7. **Update `AGENTS.md`:**
   - the "Documentation" section;
   - the new authority rule;
   - the procedures list pointing to the how-tos.

   The glossary pointer stays until phase 2.
8. **Add the docs style check:** `scripts/docs-rules.ts`, `scripts/check-docs.js` and tests, wired into `npm run check` in `package.json`.
9. **Write the tracking issue** in `issues/` from `issues/_template.md`.
   - It assigns every one of the 60 spec sections a destination and a phase. Built sections, and the built parts of partly built ones, move by the end of phase 4, so stage 2 can pass. Planned parts stay as tracking.
   - The phase lists in "Phases" are the anchors; the remaining sections go where their kind belongs:
     - phase 2: reference-shaped sections such as the counting model, date arithmetic, security and CSP, build and CI with the workflows and the NixOS release check, REUSE, the worker, repository settings;
     - phase 3: goals, stages and risks, the "Recommendation:" paragraphs;
     - phase 4: UI behaviour such as views 1 and 2, calendar weeks, colours, multilingual support, controls, icons and fonts, the view example, the built parts of first start.
   - Target pages are written as paths followed by ` (new)`.
   - The issue also lists the four indirect spec mentions.
10. **Put the decided design into the repository** (my call; `docs/superpowers/` may disappear, and nothing may depend on it):
    - **Docs model:** the style page carries the style rules and the German rules. The `AGENTS.md` "Documentation" section carries the layout, the topic-ID rule and the language model (English source, German required, more languages optional).
    - **Dependencies:** the spec's dependency table gets markdown-it 15.0.3 (approved; build-only; installed in phase 5) and mdBook 0.5.2 (a tool from the Nix dev shell; phase 6).
    - **Planned help and website:** the planned sections "Built-in help" and the Pages parts of "Delivery format" and "Build and CI" get the decided pipeline as planned work, in short form: help sources in `docs/user/`, the converter and checks, the typed tree with `HelpTopic.svelte`, the mdBook website with the language link and the string rewrite, and the Pages layout. These texts are tracking for planned work; they move to reference when they are built.
    - **Decision record:** the first one, `docs/dev/en/explanation/decisions/0001-documentation-model.md`, records the approaches table of this design: decision first, then why, then the rejected alternatives. The other decision records stay in phase 3.
11. **`npm run check` passes.** The new scripts are not engine code, so they need no performance scenario.

Done means:
- every `docs/…` citation, anchor and spec section name resolves;
- every spec section has a status line;
- the style page, five how-tos, five skill files and decision record 0001 exist;
- `AGENTS.md` carries the new rules;
- the spec's dependency table and planned sections carry the decided help and website design;
- the style and citation checks run in `npm run check`;
- the tracking issue assigns all 60 sections.

## Left to the builder

- The exact module structure and function names of the check scripts. Their regular expressions are tested.
- The section each broken citation should point to.
- The wording of the style page and the how-tos, within section 3. The procedures' substance must not change in the copy commit.
- Whether `README.md`'s pointer to `docs/SPEC.md` changes in phase 1 or phase 2. Stage 2 removes it in any case.
- Whether a CHANGELOG entry is needed for documentation-only changes.

## Open items (not blocking phase 1)

- **Logo branch:** the folders for the generator script and the SVG files, and whether README shows the logo now.
- **Help (phase 5):** the exact form of the content-hash sync file and its acknowledge command.
- **Website (phase 6):** the results of the test build.
