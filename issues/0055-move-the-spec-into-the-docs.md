---
status: open
priority: 2
area: docs
branch:
created: 2026-11-15
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Move the spec into the docs

## Problem

`docs/SPEC.md` still holds built behaviour, rationale and project status, and code, tests and docs cite it. It should hold only planned work: built behaviour belongs in reference pages under `docs/dev/en/reference/`, rationale in explanation pages under `docs/dev/en/explanation/`, procedures in how-tos under `docs/dev/en/howto/`, and what users read in the help under `docs/user/<language>/`. When the spec holds no planned work, it is deleted.

## Context

The authority rule in `AGENTS.md` (the "Authority" bullet under "Project"): reference pages are authoritative; `docs/SPEC.md` is being emptied; a section whose status line says "implemented" is authoritative until it moves; docs and code never cite the spec, and existing citations stay until their section moves. Every `##` and `###` section of the spec has a status line directly under its heading, and `npm run check` enforces it. A section whose text has fully moved keeps its heading and one line, ``Status: moved to `<path>`.``, with the repository path of the page it moved to.

This issue is the single list that gives every spec section its destination and the phase that moves it.

## Acceptance criteria

- Every row of the table below is done.
- Stage 2 of the citation rule is on: no mention of `SPEC.md` anywhere except `issues/` and the one rule in `AGENTS.md`.
- The five indirect mentions listed under Notes are reworded to cite the page their text moved to.

## Notes

### Phases

Each phase is one or more small branches, with `npm run check` passing after every commit. Phase 1 set up the guard rails: the status lines, the style page, the how-tos, the reference and citation checks, and this issue.

- **Phase 2, move what is already reference.** First the two spec sections the how-to allowlist of the citation check depends on, "Dependencies and supply chain" and "Holiday sources and work week". Then:
  - move the three format references unchanged into `docs/dev/en/reference/`, as `docs/dev/en/reference/file-format.md`, `docs/dev/en/reference/day-rules-format.md` and `docs/dev/en/reference/holiday-data-format.md`;
  - move the "Adding a country" section of `docs/dev/en/reference/holiday-data-format.md` into the holiday-data how-to, `docs/dev/en/howto/holiday-data.md`;
  - cut the text of the spec's "Format" and "Sharing and validation" that the file format reference already says;
  - move the glossary to its own reference page and re-point `AGENTS.md` to it in the same commit;
  - keep one canonical copy each of the hobby project notice (`README.md`), the release checklist (`docs/dev/en/howto/release.md`) and the holiday-data procedure (`docs/dev/en/howto/holiday-data.md`);
  - remove the allowlist entries of the citation check for those two sections.
- **Phase 3, explanation and status.**
  - The "Recommendation:" paragraphs become plain statements plus explanation pages; rejected alternatives move to explanation.
  - Decision records under `docs/dev/en/explanation/decisions/`, only for decisions with serious alternatives.
  - Fold in issue 0038 (keep what matters from the AI design documents).
  - Versions, risks and "still to check" items go into issues or a short roadmap page.
- **Phase 4, built UI behaviour.**
  - Calendar interaction, Day cell, Screen sizes, Problems, Allowance display and Accessibility move into reference pages.
  - The bold labels "Detail view", "Leave bar" and "Range rules" become headings.
  - Each move is one commit with the unchanged text and every citation update, then one commit that rewrites the moved text.
  - Then stage 2 of the citation rule goes on.
- **Phase 5, help foundation:** when the help is scheduled. Help content goes to `docs/user/<language>/`.
- **Phase 6, website:** with the first GitHub Pages release.
- **Ongoing:** a feature commit that builds a planned part moves it into reference in the same commit and rewrites its citations.

### The citation rule

- **Stage 1 (on since phase 1):** no mention of `SPEC.md` in `docs/user/`, `docs/dev/` and `.claude/skills/`, except the files on the check's allowlist. Each allowlist entry names what removes it.
- **Stage 2 (after phase 4):** no mention of `SPEC.md` anywhere except `issues/` and the one rule in `AGENTS.md`. Besides the code comments that cite moved sections, these lines need rewriting by then:
  - `README.md` L12 and L41, the pointers to the spec;
  - `AGENTS.md` L21 (the glossary, phase 2), L40 ("feasibility tests from the spec") and L61 (the reason for "Sizes", phase 4 with "Controls, icons and fonts");
  - `CONTRIBUTING.md` L26 ("including `docs/SPEC.md`") and L28 (the glossary, phase 2);
  - `docs/ai-tooling.md` L16 (the spec's row in the table of instruction files);
  - `docs/feasibility.md` L8 (which spec sections build on the results).

### Doing a row early

A feature branch may do a row before its phase. The steps of a move are in `docs/dev/en/howto/docs.md`: one commit moves the unchanged text, updates every citation and ticks the row by changing `[ ]` to `[x]`, so `npm run check` passes after it; a second commit rewrites the moved text. A row is done when its built parts have moved and their citations point to the new page; planned parts that stay as tracking don't keep a row open.

### Destinations

- A path followed by ` (new)` is a page that doesn't exist yet. Several sections may share a page.
- "stays as tracking": planned work, which stays in the spec until a feature commit builds it and moves it.
- A partly built row names the page for its built part and its phase; its planned parts stay as tracking.
- "help": text users read, written into `docs/user/<language>/` in phase 5. Help text about features that are still planned stays as tracking until they are built.
- A `##` row covers only its own intro text; its subsections have rows of their own.
- "counting-model", "architecture", "security" and "build-and-ci" appear as both a reference and an explanation page, so each explanation page gets another name when its row moves: `counting-choices.md` for the counting model.

### Sections

| Section | Status | Destination | Phase |
| --- | --- | --- | --- |
| [ ] Goals and scope | not a requirement | `docs/dev/en/explanation/goals-and-scope.md` (new) | 3 |
| [ ] Delivery format | partly implemented | the browsers and the consequences of `file://`: `docs/dev/en/reference/browsers-and-file-urls.md` (new), phase 2; the recommendation and "No desktop wrapper": `docs/dev/en/explanation/delivery-format.md` (new), phase 3; the Pages version, the Pages layout, saving and browser storage (IndexedDB) stay as tracking | 2, 3 |
| [x] Holiday sources and work week | not a requirement | the recommendation: `docs/dev/en/explanation/holiday-sources.md` | 2 |
| [x] Rule types of the core | implemented | `docs/dev/en/reference/holiday-rules.md` | 2 |
| [x] Work week per country | partly implemented | `docs/dev/en/reference/holiday-rules.md`; planned parts stay as tracking | 2 |
| [x] Region tree and German special cases | partly implemented | `docs/dev/en/reference/holiday-rules.md`; planned parts stay as tracking | 2 |
| [x] Multiple calendar sources (iCal) | partly implemented | cut where `docs/dev/en/reference/file-format.md` or the spec's "Day cell: what is shown how" says it already; the rest to `docs/dev/en/reference/file-format.md` and `docs/dev/en/reference/holiday-rules.md`; planned parts stay as tracking | 2 |
| [ ] Reference models for tests | implemented | `docs/dev/en/reference/test-strategy.md` (new) | 2 |
| [x] Counting model (weights) | not a requirement | the recommendation: `docs/dev/en/explanation/counting-choices.md` | 2 |
| [x] The one formula | implemented | `docs/dev/en/reference/counting-model.md` | 2 |
| [x] Finer granularity: prepared, offered only in the leave bar | partly implemented | `docs/dev/en/reference/counting-model.md`; planned parts stay as tracking | 2 |
| [x] How a day's required work comes about | partly implemented | `docs/dev/en/reference/counting-model.md`; planned parts stay as tracking | 2 |
| [x] Work week with validity | partly implemented | `docs/dev/en/reference/counting-model.md`, phase 2; the text on part-time counting and § 5 BUrlG: help, phase 5 | 2, 5 |
| [ ] Date arithmetic | implemented | `docs/dev/en/reference/architecture.md` (new) | 2 |
| [x] Files: plan file, rule set and settings | partly implemented | the use of each file and what is stored where: `docs/dev/en/reference/files.md`; the recommendation: `docs/dev/en/explanation/file-kinds.md`; planned parts stay as tracking | 2 |
| [x] Content of the files | partly implemented | `docs/dev/en/reference/file-format.md`; planned parts stay as tracking | 2 |
| [ ] File operations (editor behavior) | partly implemented | opening the bundled example: `docs/dev/en/reference/start-screen.md` (new); planned parts stay as tracking | 4 |
| [x] What is stored where | partly implemented | `docs/dev/en/reference/files.md`; planned parts stay as tracking | 2 |
| [x] Format | partly implemented | cut where the file format reference says it already, the rest to `docs/dev/en/reference/file-format.md`; planned parts stay as tracking | 2 |
| [ ] Sharing and validation | partly implemented | cut where the file format reference says it already (done); what remains, the worker and the handover to the page: `docs/dev/en/reference/architecture.md` (new), phase 2; planned parts stay as tracking | 2 |
| [ ] Operation (UI/UX) | not a requirement | the recommendation: `docs/dev/en/explanation/ui-principles.md` (new) | 3 |
| [ ] View 1: Month tiles | implemented | `docs/dev/en/reference/calendar-views.md` (new) | 4 |
| [ ] View 2: Month columns | partly implemented | `docs/dev/en/reference/calendar-views.md` (new), with "Align by weekday" and calendar weeks; planned parts stay as tracking | 4 |
| [ ] Day cell: what is shown how | partly implemented | `docs/dev/en/reference/day-cell.md` (new); planned parts stay as tracking | 4 |
| [ ] Screen sizes | implemented | `docs/dev/en/reference/screen-sizes.md` (new) | 4 |
| [ ] First start | partly implemented | `docs/dev/en/reference/start-screen.md` (new); planned parts stay as tracking | 4 |
| [ ] Calendar interaction | partly implemented | `docs/dev/en/reference/calendar-interaction.md` (new), with "Range rules" as a heading; "Detail view" and "Leave bar" as headings of `docs/dev/en/reference/day-detail.md` (new); planned parts stay as tracking | 4 |
| [ ] Allowance display | partly implemented | `docs/dev/en/reference/allowance-display.md` (new); planned parts stay as tracking | 4 |
| [ ] Problems | partly implemented | `docs/dev/en/reference/problems.md` (new); planned parts stay as tracking | 4 |
| [ ] Colors, light and dark mode | partly implemented | `docs/dev/en/reference/colors.md` (new); planned parts stay as tracking | 4 |
| [ ] Multilingual support (from the start) | partly implemented | the glossary: `docs/dev/en/reference/glossary.md` (new), phase 2; the rest: `docs/dev/en/reference/multilingual-support.md` (new), phase 4; planned parts stay as tracking | 2, 4 |
| [ ] Accessibility | partly implemented | `docs/dev/en/reference/accessibility.md` (new); planned parts stay as tracking | 4 |
| [ ] Built-in help | partly implemented | the calendar's keys, V, W and K: `docs/dev/en/reference/keyboard-shortcuts.md` (new), phase 4; "View example": `docs/dev/en/reference/start-screen.md` (new), phase 4; the chapters: help, phase 5; planned parts (sources, build, syntax, topic IDs, dialog) stay as tracking | 4, 5 |
| [ ] Controls, icons and fonts | partly implemented | `docs/dev/en/reference/controls.md` (new); planned parts stay as tracking | 4 |
| [ ] Output: .ics and PDF | not a requirement | the recommendation: `docs/dev/en/explanation/pdf-with-typst.md` (new) | 3 |
| [ ] .ics export (RFC 5545) | planned | stays as tracking | – |
| [ ] PDF: variants | planned | the rejected alternatives: `docs/dev/en/explanation/pdf-with-typst.md` (new); the rest stays as tracking | 3 |
| [ ] Own templates: workflow and help | planned | stays as tracking | – |
| [ ] Architecture, technology and tests | partly implemented | the engine, the worker, the single-file build and the size budget: `docs/dev/en/reference/architecture.md` (new), phase 2; the test strategy: `docs/dev/en/reference/test-strategy.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/architecture.md` (new), phase 3; the open feasibility tests: issues or the roadmap page, phase 3; planned parts stay as tracking | 2, 3 |
| [x] Dependencies and supply chain | not a requirement | the recommendation: `docs/dev/en/explanation/supply-chain.md` | 2 |
| [x] Dependencies | partly implemented | the whole table to `docs/dev/en/reference/dependencies.md`: it is the list of approved packages, and an approval applies today also for a package that isn't installed yet (ical.js, markdown-it, mdBook, typst.ts); the page marks which packages are installed. The same commit re-points `AGENTS.md` L58 ("only packages listed in the spec") to that page | 2 |
| [x] Measures against supply chain attacks | implemented | `docs/dev/en/reference/dependencies.md` | 2 |
| [ ] Security | partly implemented | that files from outside are untrusted and that the app has no network access: `docs/dev/en/reference/security.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/security.md` (new), phase 3; planned parts stay as tracking | 2, 3 |
| [ ] Threats and countermeasures | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Content Security Policy | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Verification | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Build and CI (GitHub Free and local) | implemented | the local setup and its commands: `docs/dev/en/reference/build-and-ci.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/build-and-ci.md` (new), phase 3 | 2, 3 |
| [ ] Documentation website | planned | stays as tracking; `docs/dev/en/reference/documentation-website.md` (new) once it is built | 6 |
| [ ] Workflows | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new), with the NixOS release check; planned parts stay as tracking | 2 |
| [ ] Consideration for upstream sources (caching) | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new); planned parts stay as tracking | 2 |
| [ ] Workflow security | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new); planned parts stay as tracking | 2 |
| [ ] Project operations and contributing | not a requirement | the recommendation: `docs/dev/en/explanation/hobby-project.md` (new) | 3 |
| [ ] Hobby project notice | not a requirement | `README.md`, the canonical copy | 2 |
| [ ] Files in the repository | partly implemented | `docs/dev/en/reference/repository-files.md` (new); planned parts stay as tracking | 2 |
| [ ] Repository settings on GitHub | not a requirement | `docs/dev/en/reference/github-settings.md` (new) | 2 |
| [ ] License compliance with REUSE | partly implemented | `docs/dev/en/reference/licensing.md` (new); planned parts stay as tracking | 2 |
| [ ] AI tools in the repository | implemented | `docs/ai-tooling.md`, cut where it says it already | 2 |
| [ ] Releases and updates | partly implemented | the release checklist: `docs/dev/en/howto/release.md`, the canonical copy, which keeps what only the spec's checklist has: its ".ics and `.typ`" export (the how-to says "PDF and .ics export"), the size budget, checking the data status of the holiday rules and opening the Pages version on a phone; the version and update rules: `docs/dev/en/reference/releases.md` (new); planned parts stay as tracking | 2 |
| [x] Maintaining holiday data | partly implemented | `docs/dev/en/howto/holiday-data.md`, the canonical copy, phase 2; the notice that data can become outdated: help, phase 5 | 2, 5 |
| [ ] Privacy | planned | help and `README.md`; unbuilt parts stay as tracking | 5 |
| [ ] Stages, risks, decisions | not a requirement | the versions and risks: `docs/dev/en/explanation/roadmap.md` (new) and issues; the decisions: decision records in `docs/dev/en/explanation/decisions/` | 3 |

### Indirect mentions

Found with `git grep -n -i -E "the spec('s)?\b|\bSPEC\b"` in `src`, `scripts`, `e2e`, `tests` and `docs`: these lines refer to `docs/SPEC.md` without its file name, so the citation check doesn't see them. Each is reworded when the text it points to moves.

- `src/engine/file/report.ts` L107: "(SPEC, Security)", the prototype keys of "Threats and countermeasures".
- `tests/scripts/build-html.test.ts` L37: "in the spec's order", the order of the directives in "Content Security Policy".
- `docs/feasibility.md` L36: "the app's policy from the spec", the policy of "Content Security Policy".
- `docs/feasibility.md` L67: "The spec relies on documentation", the calendar apps' behaviour on re-import in ".ics export (RFC 5545)" and the feasibility table of "Architecture, technology and tests"; planned, so it rewords when the .ics export is built.
- `docs/ai-tooling.md` L136: "(see the specification)", the SHA pinning of actions in "Workflow security".

More lines name the spec in a rule or in the description of a check, not as a citation, and go when `docs/SPEC.md` is deleted:

- `docs/dev/en/howto/docs.md` L18 ("Docs never cite the spec");
- `docs/ai-tooling.md` L21 ("The specification is deliberately not imported") and L67 ("text from the spec moved unchanged");
- `AGENTS.md` L28 (the check fails on spec section names that don't resolve and on citations of the spec), L35 and L68 (the spec status check).
