<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: the UI base and the main screen with the example plan

As of: 2026-11-04. Branch: `ui` (its first commit records the groundwork decisions in issue 0026). Builds on `docs/SPEC.md`, "Operation (UI/UX)", and the decisions D1–D15 in `issues/0026-ui-groundwork-decisions.md`.

## Intent

This branch is the first real, lasting part of the restlos UI. It is not a throwaway prototype. In the maintainer's words, at the end of the branch you can "open the example plan and plan leave with drag". You open the built HTML file from disk in Firefox, choose "View example" on the start screen, and land on the main screen with the built-in plan of Beispiel GmbH 2027. There you plan leave, mainly by dragging across days, and the allowance panel shows the result straight away.

Everything later branches build on starts here: the build into one HTML file, the CSS tokens and layers, the message catalogs, the engine worker, the component gallery and the UI test setup. These must be built the way the decisions say, because later branches will copy their patterns.

## Goals

1. **Build and delivery:** `npm run build` produces one self-contained HTML file (Vite, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`). It has the CSP `<meta>` from the spec as the first element after `<meta charset>`, with SHA-256 hashes of the embedded scripts computed at build time. Vite's `build.target` is the Firefox ESR. It runs from `file://` in Firefox and Chromium. The size stays within the 600 KB budget, and the build reports its size.
2. **Engine in a worker:** a classic Web Worker started from a `blob:` URL, through the project's own small wrapper (spec, "Worker"). The worker reads the embedded example file with `readFile`, keeps the model, applies leave edits and returns the `computePlan` results. Messages are strings, plain objects or ArrayBuffers. The page never computes costs itself.
3. **Start screen:** the app name and subtitle, and "View example". It opens `examples/plans/beispiel-gmbh-2027.urlaub.json`, embedded at build time as a non-executed data block.
4. **Main screen:**
   - **A toolbar:**
     - the plan's name and period
     - a clear "Example – changes are not saved" note
     - a view switch (tiles or columns)
     - undo and redo
     - light, dark or automatic mode
     - the language (DE or EN)
     - a toggle for calendar weeks
     - in the month columns, a toggle for "Align by weekday"
   - **Both calendar views,** month tiles and month columns, with the breakpoints of the "Screen sizes" table as container queries on the calendar area.
   - **Day cells** drawn in the spec's layers (background, fill, border, source lanes, overlay):
     - the hatch pattern for mandatory leave
     - a dashed border for days from another plan
     - lanes for calendar sources (D12)
     - week numbers as decided in the groundwork (grey, small and rectangular)
     - a screen-reader label per cell
   - **The allowance panel:** allowance, planned and remaining, the overdraft bar (D13), the stretches and the totals per calendar year. On wide screens it is a sidebar, on narrow screens a compact bar at the top that expands (spec table).
5. **Interaction:**
   - **Mouse (D8):**
     - drag to paint a range, with a live hint line (working days, cost, the resulting stretch, the remaining allowance)
     - starting on a day with leave removes leave
     - a range only sets days with required work and skips mandatory leave
     - click toggles a full day
     - Shift-click extends from the last clicked day
     - a click on a week number sets Monday to Friday of that week, or removes them if all are set
   - **Keyboard (D4):** an ARIA grid with a roving tabindex and one Tab stop per view. The arrow keys (in the visual direction), Home/End and PageUp/PageDown move. Space sets a full day, H a half day, Shift+arrow extends. Ctrl+Z and Ctrl+Y undo and redo, V switches the view, W aligns by weekday, K toggles calendar weeks.
   - **Touch (D8):** tap toggles a full day and a long press opens the detail sheet. A "Select" button enters the selection mode, where both a drag and two taps (first and last day) pick a range, confirmed or cancelled in an action bar.
   - **Undo:** one undo step per action. A drag, a week-number click or a confirmed touch range is one step.
6. **Detail popover (D7):** it opens on right-click, the context-menu key, Enter or a long press. On a phone-sized calendar it is a bottom sheet (a modal `<dialog>`).
   - **It shows:** the date, the required work and where it comes from (work week, holiday, day rule, override), all sources on that day, the leave and its cost, and the problems on that day.
   - **Its actions:** full day, half day (morning or afternoon), and remove.
   - **The hover title** only repeats the cell's label.
7. **Look (D1, D2, D5, D11, D15):**
   - one token file with `light-dark()` role properties, ordered `@layer reset, tokens, base, layout, components`
   - the mode set by `color-scheme` on the root
   - neutral grey surfaces, keeping `--nh`/`--nk`
   - navy primary actions, with blue kept for leave
   - tactile buttons
   - Lucide SVGs as files in the repository
   - system fonts only
   - only the colour scheme "Standard" in this branch, but built as a scheme (all role values in one place), so the other two built-in schemes are only data
8. **i18n (D14):**
   - ICU catalogs `de.json` and `en.json` through intl-messageformat, switchable at runtime without reload
   - `dir` from the catalog
   - logical CSS properties only
   - `Intl` for dates, numbers and plurals (including ½ days)
   - holiday names from the holiday data's translations
   - two pseudo-locales (long and accented, RTL) for the gallery and the tests, not offered in the app
9. **Review and tests (D9):**
   - **A component gallery page:** a dev-only Vite entry, not in the build. It shows every component in every state, in light and dark, in DE, EN and both pseudo-locales.
   - **Vitest** for the UI's pure logic:
     - range resolution (which days a drag or week click sets or removes)
     - lane packing
     - the cell label
     - the hint line values
     - the undo history
   - **Playwright end-to-end tests** on the built file via `file://` in Playwright's Firefox and Chromium, at the container widths 375, 768, 1100 and 1920 px:
     - opening the example
     - drag, click, Shift-click, week click
     - keyboard only
     - undo
     - the popover
     - the touch selection mode
     - the language and mode switch
     - no network request leaves the page
     - the CSP is present
   - **axe-core** on the gallery and on both views.
   - **Screenshots** of the gallery and the main screen.
   - **Check scripts (no packages):**
     - CSS: literal colours outside the token file, physical properties and `text-transform: uppercase` fail
     - catalogs: missing and unused keys, identical key sets in DE and EN
10. **Spec:** `docs/SPEC.md` gets the decisions D1–D15 as listed in issue 0026's acceptance criteria. That's the second commit on the branch. Issue 0026 is closed when the spec and the branch follow it.

## Non-goals (later branches)

- Opening and saving own files, the Open dialog, drag and drop of files, Ctrl+S/Ctrl+O, recovery copies and IndexedDB, the setup steps for a new plan, "Save as own file". The start screen therefore shows only "View example".
- Editing sources, day rules, the work week, overrides and notes, as well as settings and the colour editor. The other two built-in schemes and their switch also wait.
- Storing the device settings. In this branch the view, mode, language, calendar weeks and alignment reset on reload.
- Exports (.ics, `.typ`, print view), the help, the About/Licenses page, the Pages version and its service worker.
- The nine UX proposals of issue 0024. Most of them are about files and are decided in the files branch.
- Engine issues 0007, 0012, 0013 and 0017. The example plan doesn't hit 0007. The others belong to the screens that add sources or open files.

## Anti-goals

- Anything that doesn't look like a button but is one, or controls that only show on hover (the groundwork's main rule).
- One Tab stop per day, or `role="application"`.
- Costs computed outside the engine, or a UI that blocks an overdraft.
- A CSS or component framework, global button styles that reach the day cells, or literal colours outside the token file.
- Hard-coded user-visible strings, or sentences built from pieces.
- Dragging or a long press as the only way to do something (WCAG 2.5.7): every action also works by click, tap or keyboard.
- Test assertions on wall-clock time.

## Constraints

- Everything in `AGENTS.md`'s hard rules: no network at runtime, no `{@html}` with data, no `eval`, Firefox ESR features only (popover, `<dialog>` and anchor positioning are available from Firefox 147; no invoker commands, no `popover="hint"`), REUSE headers, no `npx`, and exact versions with `npm ci`.
- **New packages.** The spec lists all of them, and the maintainer approved axe-core in D9. The plan names the exact versions, and the maintainer confirms them before the first `npm install`:
  - `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`
  - `svelte-check`, `eslint-plugin-svelte`
  - `intl-messageformat`
  - `@playwright/test` (the dev shell's `playwright-driver` version)
  - `axe-core`

  Vite is already in the lockfile, at 8.3.4. The intl-messageformat dependency tree is checked first; if it's heavy, the plan says so, and the alternative is `@messageformat/core` (spec).
- Svelte 5 runes. Components are checked with the Svelte MCP autofixer.
- **The `npm run check` gate:** it gains svelte-check, the CSS check and the catalog check. `npm run build` and `npm run test:e2e` are new scripts. The e2e tests are not part of `check` in this branch, and adding them to CI is a follow-up issue.
- The engine stays DOM-free. The UI calls the engine only through the worker, except for pure helpers like day-number arithmetic and formatting.
- Changes to the example stay in memory.

## Decided in this conversation

- **Scope** (maintainer): the base plus the main screen with the example plan, planning leave by drag, with both views, the allowance panel, keyboard and undo, touch, and no file handling.
- **Detail popover** (maintainer): included, with half day, the reason for the required work and the sources.
- **Keyboard and touch ranges keep a visible selection** (maintainer). The grid has a selection state separate from leave, exposed as `aria-selected`.
  - **Keyboard:** Shift+arrow grows the selection from the focused day, and the hint line shows the cost of setting it. Space sets full days, H sets half days (afternoon) and Delete removes own leave on every selected day. Each is one undo step and clears the selection. Escape clears the selection.
  - **Touch:** in the selection mode, a drag or two taps make the selection. The action bar offers Full day, Half day, Remove and Cancel.
  - **Mouse drag:** unchanged. It paints straight away (full days, or removal when it starts on own leave).
  - Every action on a selection goes through the range rules below. "Half day" picks the same days as "Full day", but gives each one a half day instead.

## Calls made while writing (the maintainer can override them)

- **The start screen** shows only "View example", rather than buttons that don't work yet.
- **The H key** sets a half day in the afternoon (`part: "end"`). The popover lets you pick morning or afternoon.
- **Device settings are not stored** in this branch.
- **Only the "Standard" scheme ships,** built as data.
- **The e2e tests are not part of `npm run check`.** CI follows in an issue.
- **The note line** "Example – changes are not saved" stands in for the unsaved-changes indicator of issue 0024, proposal 2.
- **WebKit e2e:** it runs only if the dev shell provides a working WebKit. Otherwise Safari stays untested and is noted in issue 0025.
- **Range rules.** One pure function covers drag, Shift-click, week click, and keyboard and touch ranges.
  - **Setting** puts a full day on every day in the range that:
    - has required work above 0
    - lies in the plan period
    - is not mandatory leave
    - is not covered by "Leave from another plan"
  - **Half days** in the range become full days.
  - **Days with ½ required work** (24 and 31 Dec) get a full day and cost ½, the same as a click.
  - **Removing** (a drag that starts on a day with own leave) removes all own leave in the range, full or half.
  - **Days that wouldn't change** are left alone, so the hint line counts only real changes.
- **Week-number click:** it covers the whole ISO week (starting on the country's week start), not just the visible row, clipped to the plan period, and goes through the range rules. So "Monday to Friday" means the days of that week with required work. It removes leave instead when every day the rules would set already has a full day.
- **"Change allowance"** in the overdraft warning line waits until editing the allowance comes, with the plan settings. The warning line itself ships, without a disabled placeholder.
- **Breakpoints:**
  - The allowance layout (sidebar or top bar) switches on the width of the app's main container.
  - The views switch on the width of the calendar area (container queries).
  - This resolves the spec's circular rule: the sidebar takes its width from the calendar area. The D1–D15 commit clarifies "Screen sizes" in the spec.
  - The e2e widths are viewport widths.

## Left to the builder

- The component breakdown, the file layout under `src/ui/`, and the message protocol between the page and the worker (it must be plain data, and a drag preview must stay responsive while the pointer moves).
- How drag previews are computed: in the worker as a hypothetical plan, coalesced to the latest request.
- Exact token values, apart from the colours decided in D11 and D15, and the mockups of the groundwork report (version 9) as the visual reference.
- The order of the tasks, as long as the base (build, worker, tokens, catalogs, gallery, tests) comes before the views.

## Done when

- `npm run check`, `npm run build` and `npm run test:e2e` pass. axe-core reports no violations on the gallery and both views.
- The built HTML opened from disk in the Firefox ESR shows the example and lets you plan leave by drag. This is a short guided manual check at the end, with the maintainer.
- `docs/SPEC.md` contains D1–D15, and issue 0026 is closed in the commit that completes it.
