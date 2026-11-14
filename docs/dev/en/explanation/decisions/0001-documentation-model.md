<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# 0001: Documentation model

## Decision

The documentation is sorted by audience, then by Diátaxis mode, in `docs/<audience>/<language>/<quadrant>/<topic>.md`. Reference pages describe what is built and are binding, explanation pages say why, and how-to pages hold procedures for humans and agents alike. User docs are written in English, with a German page that is required and current; developer docs are English only. The specification moves into these pages section by section, after the checks are in place, and is deleted once it holds no planned work.

The rules for writing the pages are on the [documentation style](../../reference/documentation-style.md) page.

## Why

Three kinds of reader need different text: people who plan their leave, in German and English; contributors; and AI agents. When this decision was taken, one file, the specification, served all three. It held 23,254 words that mixed five kinds of text: normative reference, rationale, project status, agent instructions and future help text.

The specification was cited 144 times from 100 files, mostly by quoted section name. No check confirmed that those sections existed, and three citations were already broken. Built and planned behaviour were not marked apart. Agents treated the whole file as binding. A preprint by Xu and Wu (arXiv 2610.30571) found that agents follow a stale instruction file over the code in 90 % of convention choices.

Sorting by audience first lets each reader find their kind of text. Sorting by mode second keeps reference free of rationale and plans, so a reference page can be authoritative. The folder names the mode, so the register of a page is visible from its path. A check can then apply the register rules per folder.

English is the source because equal languages in lockstep do not scale to a third language. German is required because the main audience reads German. German help must never fall back to English text in silence. More languages stay optional, so a third language never blocks a change.

The rules of style live on one page that humans and agents share. A deterministic check enforces the mechanical rules, so an agent that skips the page still gets the same result.

The move happens section by section because one maintainer reviews every diff. A fixed, finite list of moves keeps the migration from stalling. Each move cuts the text from the specification in the same commit, so no fact is binding in two places.

## Approaches considered

| Question | Options | Picked | Why |
| --- | --- | --- | --- |
| What happens to the specification | keep it; slim it to a "constitution"; transfer it fully and delete it; hybrid | **hybrid, temporary** | Built behaviour moves to reference, rationale to explanation, status to issues, help content to the help. The specification keeps only planned work as tracking and is deleted when empty. Keeping it leaves two binding sources; a full transfer leaves no home for agreed but unbuilt design. |
| How to migrate | big-bang rewrite; mechanical split of the whole file, then rewrites; section by section | **section by section with guard rails** | Small diffs for one reviewer, and every page enters its mode folder already rewritten. A fixed, finite list of moves prevents a stall. Each move cuts the text from the specification in the same commit. |
| How agents get the rules | `.claude/rules/`; a long `AGENTS.md`; a skill; a check | **style page + `docs` skill + short `AGENTS.md` section + check** | `.claude/rules/` is Claude-only and duplicates `AGENTS.md`. Procedures belong in a skill, the mechanical rules in a deterministic check, and the rules themselves on a page humans read too. |
| Where developer procedures live | skills; docs pages | **docs pages, skills as thin pointers** | Visible on the website, readable by agents that do not load `.claude/skills/`, and editable without the protected-path prompt. |
| Website generator | own `svelte/server` site; mdBook; Hugo; Zola; Zensical; Sphinx; GitHub links | **mdBook 0.5.2 from nixpkgs** | No site chrome to write, no npm packages, slow-moving. Hugo is better at languages but needs an own layout or a vendored theme with minified third-party JavaScript, and it releases breaking minor versions every few weeks. |
| Multilingual mdBook | mdbook-i18n-helpers (gettext); forked theme; three generated books plus a checked string rewrite | **three generated books plus a checked string rewrite** | gettext makes German a PO file tied to English sentences and needs an extra pass for the app. A forked theme is a merge on every upgrade. |
| Help rendering | a Svelte Markdown library; mdsvex; own typed tree plus one component | **own typed tree plus one component** | Every maintained library parses in the browser, so the parser ships in the 600 KB file. Several insert raw HTML with `{@html}` from `node_modules`, and none runs the project's checks. |
| Parser | marked; markdown-it; remark parser layer; Markdoc | **markdown-it 15.0.3, build-only, approved** | It parses like GitHub (CommonMark) and gives block line ranges for errors. Its `Token` format was unchanged from 14 to 15, and it drops `javascript:` and `data:` links. It adds 6 lockfile entries. |
| Languages | equal languages in lockstep; gettext; English source with German required | **English source, German required and current in the same commit, more languages optional** | Equal lockstep doesn't scale to a third language, and gettext puts the main audience's language into PO files. |
| Language in paths | suffix on every file; suffix on translations; language folders for user docs; language folders everywhere | **language folders everywhere, including `docs/dev/en/`** | One rule for all of `docs/`: clean trees for optional languages, ownership per folder, and room for translated developer docs. |

## Status

Status: accepted, 2026-11-14.
