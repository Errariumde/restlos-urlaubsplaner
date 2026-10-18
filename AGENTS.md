<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# AGENTS.md – restlos-urlaubsplaner

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, …) working in this repository.

## Project

restlos is an offline vacation planner delivered as a single HTML file (plus a GitHub Pages web app). German and English UI. Hobby project, open source.

- **Full specification:** `docs/SPEC.md`. It is authoritative. If code and spec disagree, or the spec is unclear, ask instead of guessing. Do not silently deviate from it.
- **AI tooling rationale:** `docs/ai-tooling.md`.

## Language conventions

- Code, identifiers, file-format keys, comments, commit messages, documentation, and issues/PRs you write: English.
- UI texts, help and bundled templates: German and English via message catalogs; never hard-code user-visible strings.
- Domain terms follow the glossary in `docs/SPEC.md` (e.g. Soll = required work, Kontingent = allowance).

## Working style

- Small, reviewable steps. Engine functions get tests before UI builds on them.
- Order of work: feasibility tests from the spec → engine (holidays, counting model, file format) → UI → exports.
- Run `npm run check` before declaring a task done.

## Hard rules

- **Counting model:** 1 day = 480 integer units. No floats for day fractions, no assumption "only 0, ½, 1". Cost per day = min(taken, required). Required work = minimum of all lowering layers, then forced rules, then manual override. UI v1 offers only full and half days, but data model and engine must work down to 1/32.
- **Dates:** the engine uses integer day numbers, never JavaScript `Date` (enforced by ESLint).
- **File formats:** plan file `.urlaub.json` = copy of a rule set + exactly one plan; rule set `.regeln.json` = the same without a plan (never with "leave from another plan" sources); device settings export `.einstellungen.json`. No references between files; a `kind` field identifies the file. Language-neutral values (IDs, ISO dates, decimal point). Weights such as `take` are written as fraction strings (`"1/2"`); decimal strings (`"0.5"`) are accepted on read.
- **i18n:** ICU MessageFormat catalogs (de, en); no string concatenation of sentences.
- **Security:** no `{@html}` with data, no `eval`/`new Function`, no network access at runtime (CSP `connect-src 'none'`), data passed to Typst only as JSON input, size limits on all imports.
- **Dependencies:** only packages listed in the spec. Ask before adding any package. Exact versions, `npm ci`, `.npmrc` keeps `ignore-scripts=true` and `min-release-age=14`. `@playwright/test` must match the `playwright-driver` version from the Nix dev shell.
- **Git:** commit on a branch, never directly on `main`. Never push, tag or sign: the maintainer reviews, signs and pushes. If a commit fails because it can't be signed, use `git -c commit.gpgsign=false commit …`, never the maintainer's keys or SSH agent.
- **npm usage:** run tools through npm scripts (`npm run …`), never `npx`: without a TTY, npx installs missing packages without asking, bypassing the lockfile. `ignore-scripts=true` also skips `pre*`/`post*` scripts, so don't rely on them.
- **Browsers:** only features available in the current Firefox ESR. Playwright's Firefox is not the ESR; check ESR behaviour manually with `firefox-esr` from the dev shell.
- **Licensing (REUSE):** every new file gets SPDX headers (`SPDX-FileCopyrightText`, `SPDX-License-Identifier`) or an entry in `REUSE.toml`. Code, data and configuration: EUPL-1.2; templates/examples: MIT-0; documentation (Markdown, including agent instructions and skills): CC-BY-4.0; generated lockfiles: CC0-1.0. Missing license texts are added with `reuse download <SPDX-ID>`. `reuse lint` must pass.

## Environment

- Work inside the Nix dev shell (`nix develop`, or direnv with `use flake`). It provides Node.js, Typst, REUSE, language servers, Firefox ESR and Playwright browsers.
- Commands: `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run check` (all of these plus `reuse lint`). `npm run build` and `npm run test:e2e` follow with the UI. `npm run reference:python` regenerates the python-holidays reference after rule changes.

## Repository-specific procedures

Step-by-step procedures live as skills in `.claude/skills/*/SKILL.md` (Agent Skills format, plain Markdown, usable by any agent):

- `holiday-data` – adding or changing holiday rules
- `ui-texts` – adding or changing UI texts in both languages
- `dependency-update` – updating npm packages and the Nix dev shell safely
- `release` – release checklist
