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

The authority rule in `AGENTS.md` (the "Authority" bullet under "Project"): reference pages are authoritative; `docs/SPEC.md` is being emptied; a section whose status line says "implemented" is authoritative until it moves; docs and code never cite the spec, and existing citations stay until their section moves. Every `##` and `###` section of the spec has a status line directly under its heading, and `npm run check` enforces it.

This issue is the single list that gives every spec section its destination and the phase that moves it.

## Acceptance criteria

- Every row of the table below is done.
- Stage 2 of the citation rule is on: no mention of `SPEC.md` anywhere except `issues/` and the one rule in `AGENTS.md`.
- The six indirect mentions listed under Notes are reworded to cite the page their text moved to.

## Notes

### Phases

Each phase is one or more small branches, with `npm run check` passing after every commit. Phase 1 set up the guard rails: the status lines, the style page, the how-tos, the reference and citation checks, and this issue.

- **Phase 2, move what is already reference.** First the two spec sections the how-to allowlist of the citation check depends on, "Dependencies and supply chain" and "Holiday sources and work week". Then:
  - move the three format references, `docs/file-format.md`, `docs/day-rules-format.md` and `docs/holiday-data-format.md`, unchanged into `docs/dev/en/reference/`;
  - move the "Adding a country" section of `docs/holiday-data-format.md` into the holiday-data how-to, `docs/dev/en/howto/holiday-data.md`;
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
  - One pure-move commit, then one rewrite commit of the citations.
  - Then stage 2 of the citation rule goes on.
- **Phase 5, help foundation:** when the help is scheduled. Help content goes to `docs/user/<language>/`.
- **Phase 6, website:** with the first GitHub Pages release.
- **Ongoing:** a feature commit that builds a planned part moves it into reference in the same commit and rewrites its citations.

### The citation rule

- **Stage 1 (on since phase 1):** no mention of `SPEC.md` in `docs/user/`, `docs/dev/` and `.claude/skills/`, except the files on the check's allowlist. Each allowlist entry names what removes it.
- **Stage 2 (after phase 4):** no mention of `SPEC.md` anywhere except `issues/` and the one rule in `AGENTS.md`. Besides the code comments that cite moved sections, this also needs the README's two pointers to the spec, the glossary and "Sizes" pointers in `AGENTS.md` and the spec row of `docs/ai-tooling.md` rewritten.

### Doing a row early

A feature branch may do a row before its phase: it moves the section (one pure-move commit, then the rewrite of its citations) and ticks the row in this file in the same branch, by changing `[ ]` to `[x]`. A row is done when its built parts have moved and their citations point to the new page; planned parts that stay as tracking don't keep a row open.

### Destinations

- A path followed by ` (new)` is a page that doesn't exist yet. Several sections may share a page.
- "stays as tracking": planned work, which stays in the spec until a feature commit builds it and moves it.
- A partly built row names the page for its built part and its phase; its planned parts stay as tracking.
- "help": text users read, written into `docs/user/<language>/` in phase 5. Help text about features that are still planned stays as tracking until they are built.
- A `##` row covers only its own intro text; its subsections have rows of their own.

### Sections

| Section | Status | Destination | Phase |
| --- | --- | --- | --- |
| [ ] Goals and scope | not a requirement | `docs/dev/en/explanation/goals-and-scope.md` (new) | 3 |
| [ ] Delivery format | partly implemented | the browsers and the consequences of `file://`: `docs/dev/en/reference/browsers-and-file-urls.md` (new), phase 2; the recommendation and "No desktop wrapper": `docs/dev/en/explanation/delivery-format.md` (new), phase 3; the Pages version and the Pages layout stay as tracking | 2, 3 |
| [ ] Holiday sources and work week | see the subsections | the recommendation: `docs/dev/en/explanation/holiday-rules.md` (new) | 2 |
| [ ] Rule types of the core | implemented | `docs/dev/en/reference/holiday-rules.md` (new) | 2 |
| [ ] Work week per country | partly implemented | `docs/dev/en/reference/holiday-rules.md` (new); planned parts stay as tracking | 2 |
| [ ] Region tree and German special cases | partly implemented | `docs/dev/en/reference/holiday-rules.md` (new); planned parts stay as tracking | 2 |
| [ ] Multiple calendar sources (iCal) | partly implemented | the source types and their effects: `docs/dev/en/reference/calendar-sources.md` (new); planned parts stay as tracking | 2 |
| [ ] Reference models for tests | implemented | `docs/dev/en/reference/test-strategy.md` (new) | 2 |
| [ ] Counting model (weights) | see the subsections | the recommendation: `docs/dev/en/explanation/counting-model.md` (new) | 3 |
| [ ] The one formula | implemented | `docs/dev/en/reference/counting-model.md` (new) | 2 |
| [ ] Finer granularity: prepared, offered only in the leave bar | partly implemented | `docs/dev/en/reference/counting-model.md` (new); planned parts stay as tracking | 2 |
| [ ] How a day's required work comes about | partly implemented | `docs/dev/en/reference/counting-model.md` (new); planned parts stay as tracking | 2 |
| [ ] Work week with validity | partly implemented | `docs/dev/en/reference/counting-model.md` (new), phase 2; the text on part-time counting and § 5 BUrlG: help, phase 5 | 2, 5 |
| [ ] Date arithmetic | implemented | `docs/dev/en/reference/architecture.md` (new) | 2 |
| [ ] Files: plan file, rule set and settings | see the subsections | the three kinds of files and the editor model: `docs/dev/en/reference/files.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/file-kinds.md` (new), phase 3 | 2, 3 |
| [ ] Content of the files | partly implemented | `docs/dev/en/reference/file-format.md` (new); planned parts stay as tracking | 2 |
| [ ] File operations (editor behavior) | partly implemented | opening the bundled example: `docs/dev/en/reference/start-screen.md` (new); planned parts stay as tracking | 4 |
| [ ] What is stored where | partly implemented | `docs/dev/en/reference/file-format.md` (new); planned parts stay as tracking | 2 |
| [ ] Format | partly implemented | cut where the file format reference says it already, the rest to `docs/dev/en/reference/file-format.md` (new); planned parts stay as tracking | 2 |
| [ ] Sharing and validation | partly implemented | cut where the file format reference says it already, the rest to `docs/dev/en/reference/file-format.md` (new); the worker and the handover to the page: `docs/dev/en/reference/architecture.md` (new); planned parts stay as tracking | 2 |
| [ ] Operation (UI/UX) | see the subsections | the recommendation: `docs/dev/en/explanation/ui-principles.md` (new) | 3 |
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
| [ ] Output: .ics and PDF | see the subsections | the recommendation: `docs/dev/en/explanation/pdf-with-typst.md` (new) | 3 |
| [ ] .ics export (RFC 5545) | planned | stays as tracking | – |
| [ ] PDF: variants | planned | the rejected alternatives: `docs/dev/en/explanation/pdf-with-typst.md` (new); the rest stays as tracking | 3 |
| [ ] Own templates: workflow and help | planned | stays as tracking | – |
| [ ] Architecture, technology and tests | partly implemented | the engine, the worker, the single-file build and the size budget: `docs/dev/en/reference/architecture.md` (new), phase 2; the test strategy: `docs/dev/en/reference/test-strategy.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/architecture.md` (new), phase 3; the open feasibility tests: issues or the roadmap page, phase 3; planned parts stay as tracking | 2, 3 |
| [ ] Dependencies and supply chain | see the subsections | the recommendation: `docs/dev/en/explanation/supply-chain.md` (new) | 2 |
| [ ] Dependencies | partly implemented | `docs/dev/en/reference/dependencies.md` (new), with the approved packages that aren't installed yet marked as such | 2 |
| [ ] Measures against supply chain attacks | implemented | `docs/dev/en/reference/dependencies.md` (new) | 2 |
| [ ] Security | see the subsections | the recommendation: `docs/dev/en/explanation/security.md` (new) | 3 |
| [ ] Threats and countermeasures | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Content Security Policy | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Verification | partly implemented | `docs/dev/en/reference/security.md` (new); planned parts stay as tracking | 2 |
| [ ] Build and CI (GitHub Free and local) | implemented | the local setup and its commands: `docs/dev/en/reference/build-and-ci.md` (new), phase 2; the recommendation: `docs/dev/en/explanation/build-and-ci.md` (new), phase 3 | 2, 3 |
| [ ] Documentation website | planned | stays as tracking; `docs/dev/en/reference/documentation-website.md` (new) once it is built | 6 |
| [ ] Workflows | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new), with the NixOS release check; planned parts stay as tracking | 2 |
| [ ] Consideration for upstream sources (caching) | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new); planned parts stay as tracking | 2 |
| [ ] Workflow security | partly implemented | `docs/dev/en/reference/build-and-ci.md` (new); planned parts stay as tracking | 2 |
| [ ] Project operations and contributing | see the subsections | the recommendation: `docs/dev/en/explanation/hobby-project.md` (new) | 3 |
| [ ] Hobby project notice | not a requirement | `README.md`, the canonical copy | 2 |
| [ ] Files in the repository | partly implemented | `docs/dev/en/reference/repository-files.md` (new); planned parts stay as tracking | 2 |
| [ ] Repository settings on GitHub | not a requirement | `docs/dev/en/reference/github-settings.md` (new) | 2 |
| [ ] License compliance with REUSE | partly implemented | `docs/dev/en/reference/licensing.md` (new); planned parts stay as tracking | 2 |
| [ ] AI tools in the repository | implemented | `docs/ai-tooling.md`, cut where it says it already | 2 |
| [ ] Releases and updates | partly implemented | the release checklist: `docs/dev/en/howto/release.md`, the canonical copy; the version and update rules: `docs/dev/en/reference/releases.md` (new); planned parts stay as tracking | 2 |
| [ ] Maintaining holiday data | partly implemented | `docs/dev/en/howto/holiday-data.md`, the canonical copy, phase 2; the notice that data can become outdated: help, phase 5 | 2, 5 |
| [ ] Privacy | planned | help and `README.md` | 5 |
| [ ] Stages, risks, decisions | not a requirement | the versions and risks: `docs/dev/en/explanation/roadmap.md` (new) and issues; the decisions: decision records in `docs/dev/en/explanation/decisions/` | 3 |

### Indirect mentions

Found with `git grep -n -i -E "the spec('s)?\b|\bSPEC\b"` in `src`, `scripts`, `e2e`, `tests` and `docs`: these lines refer to `docs/SPEC.md` without its file name, so the citation check doesn't see them. Each is reworded when the text it points to moves.

- `src/engine/file/report.ts` L107: "(SPEC, Security)", the prototype keys of "Threats and countermeasures".
- `tests/engine/file/severity.test.ts` L9: "the severity the spec fixes"; the severities per code are listed in `docs/file-format.md`.
- `tests/scripts/build-html.test.ts` L37: "in the spec's order", the order of the directives in "Content Security Policy".
- `docs/feasibility.md` L14: "the spec's reference machine", from the limits of "Sharing and validation".
- `docs/feasibility.md` L36: "the app's policy from the spec", the policy of "Content Security Policy".
- `docs/file-format.md` L411: "the spec's Limits bullet", the "Limits" bullet of "Sharing and validation".

Two more lines name the spec in a rule, not a citation, and go when `docs/SPEC.md` is deleted: `docs/dev/en/howto/docs.md` L18 ("Docs never cite the spec") and `docs/ai-tooling.md` L67 ("text from the spec moved unchanged").
