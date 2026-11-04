<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# UI base and main screen: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The built `dist/restlos-urlaubsplaner.html`, opened from disk, shows a start screen with "View example". It opens the Beispiel GmbH 2027 plan in a main screen with both calendar views, the allowance panel and the detail popover. You plan leave by drag, click, Shift-click, week-number click, keyboard selection or the touch selection mode, with undo.

**Architecture:**
- **Svelte 5 page:** a Svelte 5 (runes) page talks to the engine through its own classic Web Worker, started from a `blob:` URL. The worker reads the embedded example with `readFile`, keeps the plan file and the undo history, and returns `computePlan` results and previews.
- **Pure UI logic:** the page decides which days a gesture touches (`rangeChanges`), lays out months, packs source lanes and builds labels. These are all pure modules with Vitest tests. Costs only ever come from the worker.
- **Build:** Vite with `vite-plugin-singlefile` builds one HTML file. A project plugin embeds the worker and the example and writes the CSP with script hashes. A dev-only gallery page shows every component in every state. Playwright tests the built files via `file://`.

**Tech Stack:**
- svelte 5.57.2, vite 8.3.4 (already locked), @sveltejs/vite-plugin-svelte 7.3.1, vite-plugin-singlefile 2.3.4
- svelte-check 4.7.7, eslint-plugin-svelte 3.23.1
- intl-messageformat 12.1.4
- @playwright/test 1.59.1, axe-core 4.14.0
- Lucide icons from lucide-static 1.60.0 as files
- Vitest 5.0.3, TypeScript 6.0.3
- Firefox ESR 153.5 from the dev shell

**Spec:**
- `docs/superpowers/specs/2026-11-04-ui-main-screen-design.md`, the design: goals 1–10, the decisions and calls, including the range rules. Read it before any task.
- `issues/0026-ui-groundwork-decisions.md`: D1–D15, the binding look and behaviour.
- `docs/SPEC.md`: "Operation (UI/UX)", "Content Security Policy", "Architecture, technology and tests" (Worker, Size budget) and "Multilingual support".
- The groundwork report's mockups (claude.ai artifact "restlos UI Groundwork", version 9) are the visual reference. The maintainer can show them; tokens and layouts follow them where this plan doesn't pin values.

## Who does what, and when

| When | Claude | You |
| --- | --- | --- |
| now | | review this plan; confirm the package versions under Global Constraints |
| then | Tasks 1–15 | answer questions if a task gets stuck |
| end | Task 16 | a short guided check in the Firefox ESR, a few minutes, one step at a time in the chat |

## Global Constraints

- **Git:**
  - branch `ui`
  - commit with `git -c commit.gpgsign=false commit -m … -m …` and nothing else on the line
  - never push, tag or sign
  - every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **Packages:** only the exact versions in Tech Stack, added with `npm install --save-dev --save-exact` after the maintainer confirmed them. `@playwright/test` must equal the dev shell's `playwright-driver` (1.59.1). Never use `npx`, and run tools through npm scripts. `.npmrc` stays unchanged. Icons come from `npm pack lucide-static@1.60.0`: only the SVG files are copied, and the package is not installed.
- **Licences:**
  - intl-messageformat is BSD-3-Clause, not MIT as the spec's licence table says. Task 1 corrects the table.
  - axe-core is MPL-2.0 and dev only.
  - Every new file gets SPDX headers or a `REUSE.toml` entry:
    - code, data, configuration and CSS: EUPL-1.2
    - Markdown: CC-BY-4.0
    - Lucide SVGs: ISC, under `SPDX-FileCopyrightText = "Lucide Contributors"` plus "Cole Bemis" for the Feather-derived ones (`reuse download ISC`)
  - `reuse lint` passes.
- **Browsers:** only Firefox ESR 153 features. No invoker commands (`command`/`commandfor`) and no `popover="hint"`. Popovers and dialogs open with `showPopover()`/`showModal()`. CSS anchor positioning, `light-dark()`, container queries and `:has()` are allowed.
- **Security:**
  - no `{@html}`, no `eval`/`new Function`, no network
  - **CSP**, exactly in this order:
    - standard: `default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src <hashes>; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:`
    - The `<meta http-equiv="Content-Security-Policy">` is the first element after `<meta charset="utf-8">`.
    - Hashes are `'sha256-<base64>'` over the LF-normalized text of every executable inline `<script>`. Data blocks (`type="application/json"`) get no hash.
- **Worker:** classic, from `URL.createObjectURL(new Blob([source], { type: "text/javascript" }))`. No module worker, no `data:` URL. Messages are plain objects only, never Blobs, functions or class instances.
- **Engine boundary:**
  - The page never calls `computePlan`, `planInput` or `readFile`.
  - The page may import engine types and these pure helpers: `days.ts` (`dayFromYmd`, `ymdFromDay`, `weekdayOf`, `daysInMonth`, `isoFromDay`), `weight.ts` (`UNITS_PER_DAY`) and `file/text.ts` (`textFor`).
  - `src/engine/**` stays unchanged except where a task says otherwise.
- **CSS (D1, D2, D14):**
  - layers `@layer reset, tokens, base, layout, components;`, declared once in `src/ui/styles/layers.css`
  - colours only as tokens from `src/ui/styles/tokens.css`
  - logical properties only (`margin-inline-start`, `inset-block-end`, `inline-size`, …)
  - no `text-transform: uppercase`
  - The mode is `color-scheme` on `<html>`: `light`, `dark` or `light dark`.
- **Colours:**
  - **Neutral surfaces (D11):** `--nh: 0; --nk: 0;` and the surfaces as `oklch(L calc(var(--nk) * C) var(--nh))`.
  - **Primary (D15):** `--r-primary: light-dark(oklch(37% 0.11 258), oklch(50% 0.1 258))` with `--r-on-primary: white` in both modes.
  - **Blue** is reserved for leave (`--r-leave-full`, `--r-leave-half`).
- **Buttons (D5):** a 1 px border with 3:1 contrast to the surface, a fill one step lighter than the surface, a 1 px darker bottom edge (`border-block-end-color`) and `border-radius: 6px`. `:active` removes the edge. One filled primary button per area. Month-column cells have no rounded corners.
- **Texts:**
  - every user-visible string comes from `src/ui/i18n/de.json` and `en.json` (ICU)
  - keys follow the `ui-texts` skill: English, dot-separated, informal German "du", plain sentence-case English
  - day amounts through `formatDays`, never through `#`
  - keys appear literally in code (`t("plan.remaining", …)`), so the catalog check can find them; the only exceptions are the holiday data's `nameKey`s
- **Commands:**
  - `npm run check` (lint, typecheck including svelte-check, test, perf, CSS check, catalog check, `reuse lint`) passes before every commit
  - `npm run test:e2e` passes before the commit of every task that touches it
  - the dev shell's Playwright browsers are used (`PLAYWRIGHT_BROWSERS_PATH` is set)
- **Svelte:** every new or changed `.svelte` file passes the Svelte MCP `svelte-autofixer` with no issues. Use the LSP diagnostics after edits.
- **No wall-clock assertions.** Playwright waits on state (`expect(locator).toHaveAttribute(...)`), never on time.

## Review Focus

These inputs are implied by the design but not covered by any single feature test. Each has its test in the task named.

1. **A drag that ends outside the grid** (released over the toolbar, outside the window, or with `pointercancel`) applies or discards exactly once. It never leaves a stuck preview or a half-applied range. *Task 11.*
2. **Worker answers arriving after newer requests.** During a fast drag, an old preview never overwrites a newer one, and an `apply` result always wins over pending previews. *Task 5.*
3. **A range that crosses a month gap in the tiles or the end of the plan period.** Dragging from 30 Jan to 2 Feb across two tiles sets the days in between. Dragging into January 2028 (margin days) sets nothing outside the period. *Tasks 6 and 11.*
4. **A gesture that changes nothing** (a drag over weekends only, a week click on a week that's all holidays) adds no undo step and doesn't mark the plan as changed. *Tasks 5 and 6.*
5. **The phone width with long texts:** at 375 px viewport width with the long pseudo-locale, the page has no horizontal scroll outside the month columns' own scroller, and every toolbar control stays visible or is in the overflow menu. *Task 15.*

---

### Task 1: Write the groundwork decisions into the spec

**Files:**
- Modify: `docs/SPEC.md`, these sections:
  - "Day cell: what is shown how"
  - "Screen sizes"
  - "Calendar interaction"
  - "Allowance display"
  - "Colors, light and dark mode"
  - "Multilingual support"
  - "Controls, icons and fonts"
  - "Accessibility"
  - "Architecture, technology and tests" (the test strategy, End-to-end row)
  - "Dependencies" (the table)
  - "Goals and scope" (the licence table)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write each acceptance criterion of issue 0026 into the spec**
  - **D7:** the detail view is a popover on desktop, opened by right-click, the context-menu key, Enter or a long press. The bottom sheet is used on narrow widths. The hover title only repeats the cell's label.
  - **D8:**
    - Mouse: drag to paint a range, with the hint line. Starting on own leave removes it. A click on a week number sets the week's days with required work, clipped to the period, or removes them when all are set. Shift-click extends.
    - Keyboard: Shift+arrow grows a visible selection. Space sets full days, H half days and Delete removes leave on the selection.
    - Touch: the selection mode with a drag or two taps and an action bar (Full day, Half day, Remove, Cancel).
    - Add the range rules from the design's "Calls made while writing".
  - **D9:** in the test strategy's End-to-end row, add the component gallery, axe-core and keyboard tests. Add axe-core to the Dependencies table: "accessibility checks | no | MPL-2.0, dev only, pinned exactly; approved 2026-11-04".
  - **D11/D15:** the colour section names the neutral grey surfaces (hue and chroma factor kept as tokens), navy as the primary action colour with both values, and that blue is reserved for leave.
  - **D12:** in "Day cell", item 4 becomes "Lanes", with the D12 text in short form.
  - **D13:** the allowance display describes the bar scaled to what is planned, the tick at the allowance, the hatched red overdraft and the warning line.
  - **D14:** Multilingual support adds RTL readiness (logical properties only, `dir` from the catalog, arrow keys that follow the visual direction, mirrored icons), the two pseudo-locales `en-XA` (long, accented) and `en-XB` (RTL), and no `text-transform: uppercase`.
  - **D1–D6, D10:** one bullet each under "Controls, icons and fonts", or a new short "Look and structure" paragraph there.
  - **"Screen sizes":** the allowance layout switches on the app's width; the views switch on the calendar area's width.
  - **The licence table:** intl-messageformat is BSD-3-Clause.

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: passes (reuse lint and the Markdown are unchanged in structure).

- [ ] **Step 3: Commit**

```bash
git add docs/SPEC.md
git -c commit.gpgsign=false commit -m "Write the UI groundwork decisions into the spec" -m "D1–D15 from issue 0026: popover detail view, drag to paint and the range rules, visible keyboard and touch selections, lanes, the overdraft bar, neutral grey and navy, RTL readiness and pseudo-locales, the gallery and axe-core. intl-messageformat is BSD-3-Clause.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Issue 0026 stays `open` until Task 16.

---

### Task 2: Build an empty single-file app with the CSP

**Files:**
- Modify:
  - `package.json` (devDependencies, scripts)
  - `package-lock.json`
  - `tsconfig.json` (exclude `src/ui`, `e2e`)
  - `eslint.config.js` (svelte)
  - `REUSE.toml`
- Create:
  - `tsconfig.ui.json`
  - `vite.config.ts`
  - `svelte.config.js`
  - `index.html`
  - `src/ui/main.ts`
  - `src/ui/App.svelte`
  - `scripts/build/html.ts`
  - `scripts/build/vite-restlos.ts`
  - `playwright.config.ts`
  - `e2e/helpers.ts`
  - `e2e/shell.spec.ts`
- Test: `tests/scripts/build-html.test.ts`

**Interfaces:**
- Produces:
  - `scripts/build/html.ts`:
    - `export function scriptHashes(html: string): string[]` returns `'sha256-…'` for each `<script>` without a `type` or with a JavaScript `type`, in document order.
    - `export function insertCsp(html: string, policy: string): string`
    - `export function standardPolicy(hashes: readonly string[]): string`
    - `export function insertDataBlock(html: string, id: string, json: string): string` inserts `<script type="application/json" id="…">` before `</body>`, escaping `<` as `\u003c` so the JSON can't close the tag.
  - `scripts/build/vite-restlos.ts`: `export function restlos(): Plugin[]`. Task 2 adds the CSP and size parts, Task 5 the worker module `virtual:restlos-worker`, and Task 8 the example data block (read from `examples/plans/beispiel-gmbh-2027.urlaub.json`).
  - The build output is `dist/restlos-urlaubsplaner.html`.
  - `e2e/helpers.ts`: `export const APP_URL: string` (the file URL of the built app) and `export async function openApp(page: Page): Promise<void>`. It records every request that isn't `file:` or `blob:` and fails the test on any of them.
  - npm scripts:
    - `"build": "vite build"`
    - `"build:gallery": "vite build --mode gallery"` (Task 9 fills it in)
    - `"gallery": "vite --mode gallery"`
    - `"test:e2e": "npm run build && npm run build:gallery && playwright test"`
    - `"typecheck": "tsc && svelte-check --tsconfig ./tsconfig.ui.json --fail-on-warnings"`

- [ ] **Step 1: Install the confirmed packages**

Run: `npm install --save-dev --save-exact svelte@5.57.2 @sveltejs/vite-plugin-svelte@7.3.1 vite-plugin-singlefile@2.3.4 svelte-check@4.7.7 eslint-plugin-svelte@3.23.1 intl-messageformat@12.1.4 @playwright/test@1.59.1 axe-core@4.14.0 vite@8.3.4`
Expected: the lockfile changes, nothing runs install scripts, and `npm ls rollup` shows rollup not installed (an optional peer). Report any new deprecation or audit warning to the maintainer in the task summary.

- [ ] **Step 2: Write the failing build-helper tests** in `tests/scripts/build-html.test.ts`

```ts
it("hashes executable inline scripts only", () => {
  const html = `<script>a()\r\n</script><script type="application/json">{}</script><script type="module">b()</script>`;
  expect(scriptHashes(html)).toEqual([sha256Base64("a()\n"), sha256Base64("b()")]);
});
it("puts the policy right after meta charset", () => {
  const out = insertCsp(`<head><meta charset="utf-8"><title>x</title>`, "default-src 'none'");
  expect(out).toMatch(/^<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'">/);
});
it("writes the standard policy in the spec's order", () => {
  expect(standardPolicy(["'sha256-A'"])).toBe("default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'sha256-A'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:");
});
it("escapes < in data blocks", () => {
  expect(insertDataBlock("<body></body>", "x", `{"a":"</script>"}`)).toContain(`{"a":"\\u003c/script>"}`);
});
```

`sha256Base64` is a test-local helper using `node:crypto`.

- [ ] **Step 3: Run the tests to make sure they fail**

Run: `npm test -- tests/scripts/build-html.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `scripts/build/html.ts`**, and `restlos()` with a `transformIndexHtml` hook (`order: "post"`, after singlefile's inlining) that computes the hashes and inserts the CSP. A `closeBundle` hook fails the build when the HTML is over 614 400 bytes and prints its size in KB otherwise.
  - **`vite.config.ts`:**
    - plugins `svelte()`, `viteSingleFile()`, `restlos(...)`
    - `build.target: "firefox153"`
    - `build.outDir: "dist"`
    - the output file renamed to `restlos-urlaubsplaner.html` (`rollupOptions.input` from `index.html` plus a rename in `closeBundle`, or a `generateBundle` rename)
  - **`index.html`:** `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>restlos</title>`, `<div id="app"></div>`.
  - **`App.svelte`:** an `<h1>` with the text "restlos" for now. Task 3 moves it into the catalog.

- [ ] **Step 5: Set up the tooling configs**
  - **tsconfig and ESLint:**
    - `tsconfig.ui.json` extends `tsconfig.json`, with `lib: ["es2023", "dom", "dom.iterable"]`, `types: ["svelte"]`, and includes `src/ui`, `e2e`, `vite.config.ts` and `playwright.config.ts`.
    - The root `tsconfig.json` excludes `src/ui` and `e2e`.
    - ESLint adds `eslint-plugin-svelte`'s recommended config for `**/*.svelte`, with the TypeScript parser.
  - **`playwright.config.ts`:**
    - `testDir: "e2e"`
    - projects `firefox`, `chromium` and `webkit`, each at the viewport widths 375, 768, 1100 and 1920 px only where a test asks for them. The default viewport is 1280×800.
    - `forbidOnly: true`, `retries: 0`
    - no `webServer`
  - Add a `REUSE.toml` entry for `tsconfig.ui.json` if it isn't covered by `tsconfig*.json` (it is).

- [ ] **Step 6: Write `e2e/shell.spec.ts`**

```ts
test("the built file carries the CSP first and makes no network request", async ({ page }) => {
  await openApp(page);
  const first = await page.evaluate(() => document.head.children[1]?.outerHTML ?? "");
  expect(first).toContain('http-equiv="Content-Security-Policy"');
  await expect(page.locator("h1")).toHaveText("restlos");
});
```

- [ ] **Step 7: Run everything**

Run: `npm run check` and `npm run test:e2e`
Expected: both pass in the firefox, chromium and webkit projects. If the dev shell's WebKit doesn't start, drop the project, note it in issue 0025 (Safari stays untested) and report it.

- [ ] **Step 8: Commit** with the message "Build the app into one HTML file with its content security policy". Include `package.json`, the lockfile, the configs, `scripts/build/`, `src/ui/`, `e2e/`, `tests/scripts/build-html.test.ts` and `REUSE.toml`.

---

### Task 3: Message catalogs, formatting and the catalog check

**Files:**
- Create:
  - `src/ui/i18n/de.json`, `src/ui/i18n/en.json`
  - `src/ui/i18n/i18n.svelte.ts`
  - `src/ui/i18n/format.ts`
  - `src/ui/i18n/pseudo.ts`
  - `scripts/catalog-rules.ts`, `scripts/check-catalogs.js`
- Modify: `package.json` (`check` gains `node --import ./scripts/ts-hooks.js scripts/check-catalogs.js`), `src/ui/App.svelte`, `REUSE.toml` (`src/ui/i18n/*.json` is EUPL-1.2)
- Test: `tests/ui/i18n/format.test.ts`, `tests/ui/i18n/pseudo.test.ts`, `tests/scripts/catalog-rules.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = "de" | "en" | "en-XA" | "en-XB"`
  - `i18n.svelte.ts`: `export const i18n: { locale: Locale; readonly dir: "ltr" | "rtl"; readonly lang: string; t(key: string, args?: Record<string, string | number>): string }`. It's a `$state` object; changing `locale` re-renders without reload. `dir` comes from the catalog key `meta.dir`, and `lang` from `meta.lang`. Formatters are cached per locale and key.
  - `format.ts`:
    - `export function formatDays(units: Units, locale: Locale): string` gives "1½", "½", "3", "−2½". Whole and half days use `½`. Any other fraction falls back to `Intl.NumberFormat` with up to two decimals.
    - `export function formatDate(day: DayNumber, locale: Locale, style: "long" | "short" | "weekday" | "month"): string` uses `Intl.DateTimeFormat` in `timeZone: "UTC"` from the day's UTC midnight.
    - `export function dayCount(units: Units): number` (the plural selector, `units / 480`)
  - `pseudo.ts`: `export function pseudoCatalog(en: Catalog, kind: "long" | "rtl"): Catalog`. "long" swaps the letters for accented ones and pads each message by 40 % with `·`, keeping ICU placeholders and syntax untouched. "rtl" wraps each message in U+202E … U+202C and sets `meta.dir` to `rtl`.
  - `catalog-rules.ts`: `export function checkCatalogs(input: { de: Catalog; en: Catalog; sources: readonly { path: string; text: string }[]; dataKeys: readonly string[] }): string[]` returns the error lines. Errors cover:
    - a key in only one catalog
    - a key used in a source (a `t("…")` literal) that's missing
    - a key never used and not in `dataKeys`
    - a message that fails ICU parsing
    - a message using `#`
  - `dataKeys` are every `nameKey` and `explanationKey` in `src/data/holidays/*.json`.

- [ ] **Step 1: Write the failing tests**

```ts
it("formats day amounts with ½", () => {
  expect(formatDays(720, "de")).toBe("1½");
  expect(formatDays(240, "en")).toBe("½");
  expect(formatDays(-1200, "de")).toBe("−2½");
  expect(formatDays(14400, "en")).toBe("30");
});
it("formats a date in UTC regardless of the machine's zone", () => {
  expect(formatDate(dayFromYmd(2027, 5, 7), "en", "long")).toBe("Friday, 7 May 2027");
  expect(formatDate(dayFromYmd(2027, 5, 7), "de", "long")).toBe("Freitag, 7. Mai 2027");
});
it("pads and accents the long pseudo-locale but keeps placeholders", () => {
  const out = pseudoCatalog({ "a": "{count, plural, one {{days} day} other {{days} days}} left", "meta.dir": "ltr", "meta.lang": "en" }, "long");
  expect(out["a"]).toContain("{days}");
  expect(out["a"]!.length).toBeGreaterThan(40 * 1.4 - 1);
  expect(() => new IntlMessageFormat(out["a"]!, "en")).not.toThrow();
});
it("marks the rtl pseudo-locale as rtl", () => { expect(pseudoCatalog({ "meta.dir": "ltr", "meta.lang": "en" }, "rtl")["meta.dir"]).toBe("rtl"); });
it("reports missing, unused, broken and # messages", () => {
  const errors = checkCatalogs({ de: { "x.a": "A", "x.b": "#" }, en: { "x.a": "A" }, sources: [{ path: "a.svelte", text: `t("x.a") t("x.c")` }], dataKeys: [] });
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringContaining("x.b: only in de"), expect.stringContaining("x.c: used in a.svelte but missing"),
    expect.stringContaining("x.b: never used"), expect.stringContaining("x.b: uses #"),
  ]));
});
```

`meta.*` keys count as used.

- [ ] **Step 2: Run the tests to make sure they fail** (`npm test -- tests/ui/i18n tests/scripts/catalog-rules.test.ts`). The Vitest config may need `tests/ui/**` with `environment: "node"`, which is fine.

- [ ] **Step 3: Implement** the four modules and `scripts/check-catalogs.js`. The CLI reads the catalogs, every file under `src/ui/**/*.{ts,svelte}` and the holiday data keys, and prints the errors and exits 1 if there are any.

- [ ] **Step 4: Fill in the catalogs**
  - **`meta.*`:** `meta.dir`, `meta.lang`.
  - **`app.*`:** `app.name` ("restlos"), `app.subtitle` (the spec's subtitle in DE and EN).
  - **Holiday data:** all 51 `nameKey`/`explanationKey` values, with German and English names. For holidays, use the official German names and the common English names that python-holidays uses (`tests/reference/`).
  - `App.svelte` shows `t("app.name")` and sets `<html lang dir>` from `i18n`.

- [ ] **Step 5: Run** `npm run check`. Expected: passes, including the catalog check.

- [ ] **Step 6: Commit**, with the message "Add the message catalogs, day and date formatting and the catalog check".

---

### Task 4: Tokens, base styles and the CSS check

**Files:**
- Create:
  - `src/ui/styles/layers.css`
  - `src/ui/styles/reset.css`
  - `src/ui/styles/tokens.css`
  - `src/ui/styles/base.css`
  - `src/ui/styles/layout.css`
  - `scripts/css-rules.ts`, `scripts/check-css.js`
- Modify: `src/ui/main.ts` (imports the styles in layer order), `package.json` (`check` gains the CSS check)
- Test: `tests/scripts/css-rules.test.ts`

**Interfaces:**
- Produces:
  - **Tokens:**
    - **Role properties (`--r-*`)**, each `light-dark(<light>, <dark>)`:
      - surfaces: `surface`, `surface-raised`, `surface-sunken`, `border`, `border-strong`
      - text: `text`, `text-muted`
      - actions: `primary`, `on-primary`, `focus`
      - day types: `workday`, `weekend`, `holiday`, `half-required`, `leave-full`, `leave-half`, `mandatory`, `other-plan`
      - states: `overdraft`, `today`, `selection`, `info-band`
      - sources: `accent-1` … `accent-8`
    - **Scales:** `--space-1`…`--space-6`, `--radius-control: 6px`, `--font-size-0`…`--font-size-4`.
    - **Neutral surfaces:** `--nh`, `--nk`.
    - All values live inside `@layer tokens` on `:root`. The scheme "Standard" is this file. `light-dark()` needs `color-scheme` on the root: `html { color-scheme: light dark }` by default.
  - **`base.css`:**
    - the body uses the system font stack and `var(--r-surface)`/`var(--r-text)`
    - `:focus-visible` gets a 2 px `var(--r-focus)` outline with an offset
    - `@media (forced-colors: active)` keeps borders as `CanvasText` and focus as `Highlight`
  - **`layout.css`:** Every Layout primitives as classes `.stack`, `.cluster`, `.sidebar-layout`, with `--gap` custom properties.
  - **`css-rules.ts`:** `export function checkCss(files: readonly { path: string; text: string }[]): string[]`. The CLI scans `src/ui/**/*.css` and the `<style>` blocks of `src/ui/**/*.svelte`. Errors are:
    - a literal colour (`#hex`, `rgb(`, `hsl(`, `oklch(`, `oklab(`, a named colour other than `transparent`, `currentColor`, the forced-colours system colours and `white`/`black` inside `tokens.css`) outside `tokens.css`
    - a physical property or value: `left`, `right`, `top`, `bottom` as properties; `margin-left|right|top|bottom` and the same for padding, border and inset; `width`/`height` outside `@media print`; `text-align: left|right`; `float: left|right`
    - `text-transform: uppercase`

- [ ] **Step 1: Write the failing tests**

```ts
it("flags literal colours outside the token file", () => {
  expect(checkCss([{ path: "src/ui/x.css", text: "a { color: #fff; background: oklch(50% 0 0) }" }])).toHaveLength(2);
  expect(checkCss([{ path: "src/ui/styles/tokens.css", text: ":root { --r-text: oklch(20% 0 0) }" }])).toEqual([]);
});
it("flags physical properties and uppercase", () => {
  const errors = checkCss([{ path: "src/ui/A.svelte", text: "<style>.a { margin-left: 1px; width: 2px; text-transform: uppercase; inset-inline-start: 0 }</style>" }]);
  expect(errors).toHaveLength(3);
});
it("allows var() colours and logical properties", () => {
  expect(checkCss([{ path: "src/ui/x.css", text: ".a { color: var(--r-text); padding-inline: var(--space-2); inline-size: 100% }" }])).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to make sure they fail**, then **implement** the rules and write the five CSS files.
  - **Colour values:**
    - neutral surfaces: `oklch(98% calc(var(--nk) * 0.01) var(--nh))` in light and about `oklch(20% …)` in dark
    - leave blue: about `oklch(62% 0.15 250)` in light and `oklch(68% 0.13 250)` in dark
    - mandatory leave: a deeper blue-violet, with its stripes as `color-mix(in oklab, var(--r-mandatory) 72%, var(--r-text))`
  - The values follow the report's mockups. Text tokens reach at least 4.5:1, and borders and day-type fills at least 3:1 against their surface (checked in Task 15 by axe and in the gallery).

- [ ] **Step 3: Run** `npm run check`. Expected: passes.

- [ ] **Step 4: Commit**, with the message "Add the design tokens, base styles and the CSS check".

---

### Task 5: The engine worker and its client

**Files:**
- Create:
  - `src/ui/worker/protocol.ts`
  - `src/ui/worker/session.ts`
  - `src/ui/worker/engine-worker.ts`
  - `src/ui/worker/client.ts`
- Modify: `scripts/build/vite-restlos.ts` (the worker part), `vite.config.ts`
- Test: `tests/ui/worker/session.test.ts`, `tests/ui/worker/client.test.ts`, `e2e/shell.spec.ts` (the worker starts)

**Interfaces:**
- Consumes: `readFile`, `planInput`, `computePlan`, `textFor`, `PlanFile`, `LeaveDay`, `PlanResult`, `Stretch`, `Units` from the engine.
- Produces (`protocol.ts`):

```ts
export type LeaveChange = { readonly day: DayNumber; readonly take: 0 | 240 | 480; readonly part?: Part }; // take 0 = remove own leave
export interface SourceMeta { readonly id: string; readonly name: Text; readonly type: FileSource["type"]; readonly color: Color; readonly visible: boolean }
export interface PlanMeta {
  readonly name: Text | undefined;          // contract.name
  readonly countryNameKey: string; readonly regionNameKey: string | undefined;
  readonly weekStart: Weekday; readonly weekend: readonly Weekday[];
  readonly period: PlanPeriod; readonly allowance: Units; readonly sources: readonly SourceMeta[];
  readonly example: boolean;
}
export interface PlanState { readonly meta: PlanMeta; readonly result: PlanResult; readonly canUndo: boolean; readonly canRedo: boolean; readonly changed: boolean }
export interface Hint { readonly days: number; readonly cost: Units; readonly remaining: Units; readonly stretch: Stretch | undefined }
export type Request =
  | { readonly id: number; readonly type: "open"; readonly text: string; readonly example: boolean }
  | { readonly id: number; readonly type: "apply" | "preview"; readonly changes: readonly LeaveChange[] }
  | { readonly id: number; readonly type: "undo" | "redo" };
export type Response =
  | { readonly id: number; readonly type: "state"; readonly state: PlanState }
  | { readonly id: number; readonly type: "hint"; readonly hint: Hint }
  | { readonly id: number; readonly type: "refused"; readonly code: string }
  | { readonly id: number; readonly type: "failed"; readonly message: string };
```

- `session.ts` (pure, no `self`): `export class Session { open(text: string, example: boolean): PlanState | { refused: string }; apply(changes): PlanState; preview(changes): Hint; undo(): PlanState; redo(): PlanState }`.
  - It keeps the `PlanFile` and an undo stack of leave lists, at most 200 steps.
  - `apply` with changes that leave `plan.days` identical pushes no step.
  - `changed` is true when the current leave differs from the opened one.
  - **The hint:**
    - `days` is the number of changes that alter a day
    - `cost` is `planned(after) − planned(before)`
    - `remaining` is after the change
    - `stretch` is the listed stretch of the after-result that contains the first changed day, or `undefined`
- `engine-worker.ts`: `self.onmessage` hands each `Request` to one `Session` and posts the `Response`. Exceptions become `failed`.
- `client.ts`: `export function startEngine(source: string): Engine` with this interface:

```ts
interface Engine {
  open(text: string, example: boolean): Promise<PlanState>;
  apply(changes): Promise<PlanState>;
  undo(): Promise<PlanState>;
  redo(): Promise<PlanState>;
  preview(changes): Promise<Hint | undefined>;
  stop(): void;
}
```

  - **`preview` coalescing:** while a preview is in flight, only the latest requested one is sent next. Superseded previews resolve with `undefined`.
  - **Order:** any `apply`, `undo` or `redo` resolves after all earlier requests. A `hint` whose id is older than the newest `apply` sent resolves with `undefined`.
  - **The transport is injectable for tests:** `startEngine(source, makeWorker = (url) => new Worker(url))`.
- **The worker source** comes from `import workerSource from "virtual:restlos-worker"`. The plugin builds `src/ui/worker/engine-worker.ts` with Vite's `build()` API (`lib`, format `iife`, `write: false`, the same target) and exports the code as a string.

- [ ] **Step 1: Write the failing session tests.** They use the text of `examples/plans/beispiel-gmbh-2027.urlaub.json`, read with `node:fs` in the test.

```ts
const s = new Session(); const opened = s.open(example, true) as PlanState;
it("opens the example with its period and allowance", () => {
  expect(opened.meta.period).toEqual({ from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } });
  expect(opened.meta.allowance).toBe(30 * 480);
  expect(opened.canUndo).toBe(false);
});
it("applies, undoes and redoes a change", () => {
  const day = dayFromYmd(2027, 6, 14); // Monday, a working day
  const after = s.apply([{ day, take: 480 }]);
  expect(after.result.totals.planned).toBe(opened.result.totals.planned + 480);
  expect(s.undo().result.totals.planned).toBe(opened.result.totals.planned);
  expect(s.redo().result.totals.planned).toBe(opened.result.totals.planned + 480);
});
it("adds no undo step when nothing changes", () => {          // Review Focus 4
  const fresh = new Session(); fresh.open(example, true);
  const state = fresh.apply([]);
  expect(state.canUndo).toBe(false); expect(state.changed).toBe(false);
});
it("previews without changing the plan", () => {
  const fresh = new Session(); const start = fresh.open(example, true) as PlanState;
  const hint = fresh.preview([14, 15, 16].map((d) => ({ day: dayFromYmd(2027, 6, d), take: 480 as const })));
  expect(hint).toMatchObject({ days: 3, cost: 3 * 480, remaining: start.result.totals.remaining - 3 * 480 });
  expect(fresh.apply([]).result.totals.planned).toBe(start.result.totals.planned);
});
it("refuses a broken file", () => { expect(new Session().open("{", false)).toEqual({ refused: "notJson" }); });
```

  Check the example's period and allowance against the file, and fix the expectations if the file says otherwise. The spec says calendar year 2027 and 30 days.

- [ ] **Step 2: Write the failing client tests** with a fake worker that answers when the test tells it to:
  - `it("drops a preview superseded while another is in flight")`: send three previews before the first answer; the second resolves `undefined`, and only the first and third reach the worker. *Review Focus 2.*
  - `it("drops a hint that arrives after a newer apply")`.
  - `it("resolves requests in send order")`.

- [ ] **Step 3: Run the tests to make sure they fail**, then **implement** the four modules and the plugin part.

- [ ] **Step 4: Extend `e2e/shell.spec.ts`** with `test("the engine worker starts from file://")`. For now `main.ts` exposes nothing; the test opens the app and expects `[data-engine="ready"]` on `<body>`, which `main.ts` sets after `startEngine(workerSource)` answers an `open` of the example. Task 8 replaces this with the start screen, and the test changes there.

- [ ] **Step 5: Run** `npm run check` and `npm run test:e2e`. Expected: pass. In the Firefox and Chromium projects there's no CSP violation in the console (`page.on("console")` collects errors and the test asserts there are none).

- [ ] **Step 6: Commit**, with the message "Run the engine in a classic worker from a blob URL".

---

### Task 6: Range rules and week clicks

**Files:**
- Create: `src/ui/calendar/range.ts`
- Test: `tests/ui/calendar/range.test.ts`

**Interfaces:**
- Consumes: `PlanResult`, `DayResult`, `LeaveChange`.
- Produces:
  - `export type RangeAction = "full" | "half" | "remove"`
  - `export function actionForDrag(result: PlanResult, startDay: DayNumber): "full" | "remove"`: `"remove"` when the start day has own leave.
  - `export function rangeChanges(result: PlanResult, from: DayNumber, to: DayNumber, action: RangeAction): LeaveChange[]`: `from`/`to` in either order, ascending output.
    - **Setting** applies to days where:
      - `inPeriod`
      - `required.value > 0`
      - the day has no mandatory leave piece
      - the day has no `otherPlan` piece
      - the day's own leave isn't already the same take (full: 480; half: 240 with part `"end"`)
    - **"half"** gives `{ take: 240, part: "end" }`.
    - **"remove"** gives `take: 0` on every in-period day with own leave.
  - `export function weekChanges(result: PlanResult, weekStartDay: DayNumber): LeaveChange[]`: the 7 days from `weekStartDay` go through `rangeChanges(…, "full")`. When that's empty and at least one of the days has own leave, the week's own leave is removed instead.
  - `export function toggleDay(result: PlanResult, day: DayNumber): LeaveChange[]`: a click. Full is set when the day has no own leave, and removed when it has any. A click on a day without required work, or on mandatory or another plan's leave, changes nothing.

- [ ] **Step 1: Write the failing tests**, using a `computePlan` result of the example built in the test through the engine (`readFile`, `planInput`, `computePlan`). Each test below is one case.
  - **The week of 14–20 June 2027:** `rangeChanges(r, 14 Jun, 20 Jun, "full")` gives 5 changes (Mon–Fri).
  - **Reversed order:** `rangeChanges(r, 20 Jun, 14 Jun, "full")` gives the same 5.
  - **Holidays and weekends:** a range over Corpus Christi (27 May 2027) and its weekend skips the holiday and the weekend.
  - **Mandatory leave:** a range over 27–30 Dec 2027 gives no changes.
  - **Leave from another plan:** a range over 4–5 Jan 2027 gives no changes (example's other-plan days).
  - **Half required work:** 24 Dec 2027 (Friday, ½ required) gives `{ take: 480 }`.
  - **An existing half day** becomes full; the same full day again gives no change.
  - **Remove:** after leave on 14–18 Jun, "remove" over 14–20 Jun gives five `take: 0`.
  - **Month gap in the tiles:** a range 29 Jan → 2 Feb includes 1 Feb (Mon) and 2 Feb. *Review Focus 3.*
  - **Period end:** a range 30 Dec 2027 → 5 Jan 2028 sets nothing in 2028. *Review Focus 3.*
  - **Week click:**
    - `weekChanges` for the week of 14 Jun sets 5 days; after applying them, the same click removes 5.
    - A week click on an all-holiday-and-weekend week gives `[]`. *Review Focus 4.*
  - **`toggleDay`:** on Saturday 19 Jun it gives `[]`.

  Check each date against the example file and the holiday data, and adjust a date if the example differs: the leave planned in the example (Easter, 7 May, 28 May, summer) must not overlap the test days.

- [ ] **Step 2: Run the tests to make sure they fail**, then **implement**. **Run them again** to make sure they pass.

- [ ] **Step 3: Commit**, with the message "Decide which days a range, a week click and a click change".

---

### Task 7: Month layout, lanes, labels and grid navigation

**Files:**
- Create:
  - `src/ui/calendar/months.ts`
  - `src/ui/calendar/lanes.ts`
  - `src/ui/calendar/label.ts`
  - `src/ui/calendar/grid-nav.ts`
- Test: `tests/ui/calendar/months.test.ts`, `lanes.test.ts`, `label.test.ts`, `grid-nav.test.ts`

**Interfaces:**
- Produces:
  - **`months.ts`:**
    - `export interface MonthBlock { year: number; month: number; first: DayNumber; last: DayNumber }`
    - `export function periodMonths(period: PlanPeriod): MonthBlock[]`
    - `export interface TileWeek { isoWeek: number; startDay: DayNumber; cells: (DayNumber | null)[] }`: 7 cells, with `null` outside the month.
    - `export function tileWeeks(month: MonthBlock, weekStart: Weekday): TileWeek[]`
    - `export function isoWeek(day: DayNumber): number`
    - `export function columnRows(months: readonly MonthBlock[], alignByWeekday: boolean, weekStart: Weekday): (DayNumber | null)[][]`: rows × months. Without alignment it gives 31 rows by day of month. With alignment it gives rows by weekday position from `weekStart`, up to 37 rows, with each month offset so its first day falls on its weekday's row.
  - **`lanes.ts`:**
    - `export interface LaneRun { sourceId: string; first: DayNumber; last: DayNumber; lane: 0 | 1 | 2 | "more" }`
    - `export function packLanes(month: MonthBlock, sourceDays: ReadonlyMap<string, readonly DayNumber[]>, order: readonly string[]): LaneRun[]`:
      - consecutive days of one source form one run, cut at the month's edges
      - runs are placed in `order` (the sources' file order), then by first day
      - each run gets the lowest lane free over its whole span
      - a run with no free lane among 0–2 gets `"more"`
  - **`label.ts`:** `export function cellLabel(day: DayResult, meta: PlanMeta, i18n: { t: …; locale: Locale }): string`. One ICU message, `day.label`, with selects:
    - weekday and date (formatted)
    - the kind (`workday`, `weekend`, `holiday` with its name, `halfRequired`)
    - the leave (`none`, `full`, `half`, `mandatory`, `otherPlan`)
    - the cost (formatted days)
    - the source names joined with `Intl.ListFormat`

    Example EN: "Friday, 7 May 2027, working day, leave full, costs 1".
  - **`grid-nav.ts`:**
    - `export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown"`
    - `export function nextDay(view: "tiles" | "columns", key: NavKey, day: DayNumber, ctx: { dir: "ltr" | "rtl"; weekStart: Weekday; period: { from: DayNumber; to: DayNumber }; alignByWeekday: boolean }): DayNumber`
    - **In the tiles:**
      - left and right move by ∓1 day, mirrored in RTL
      - up and down move by ∓7 days
      - Home and End go to the start and end of the week row
      - PageUp and PageDown go to the same day of the previous or next month, clamped to its length
    - **In the columns:**
      - up and down move by ∓1 day
      - left and right go to the same row in the previous or next month (in aligned mode the same weekday row, else the same day-of-month clamped), mirrored in RTL
      - Home and End go to the first and last day of the month
      - PageUp and PageDown go to the previous or next month
    - The result is clamped to the period.

- [ ] **Step 1: Write the failing tests:**
  - **Tile weeks:** `tileWeeks` for January 2027 with `mon` gives 5 rows, and the first row has 4 nulls (1 Jan 2027 is a Friday) and ISO week 53.
  - **ISO weeks:** `isoWeek(4 Jan 2027) === 1` and `isoWeek(31 Dec 2026) === 53`.
  - **Columns:**
    - `columnRows` without alignment has 31 rows, and February's rows 29–31 are null.
    - With alignment and `mon`, January 2027's 1st lies in row 4 (index 4, Friday) and February's 1st in row 0.
    - The row count is ≤ 37.
  - **Lanes:**
    - two sources with overlapping runs get lanes 0 and 1
    - a later run that doesn't overlap gets lane 0 again
    - a fourth overlapping run gets `"more"`
    - a run crossing the month end is cut at the last day
  - **`cellLabel`:** in EN, a planned working day reads "Friday, 7 May 2027, working day, leave full, costs 1". The DE version is "Freitag, 7. Mai 2027, Arbeitstag, Urlaub ganz, kostet 1". Assert both after writing the catalog entries.
  - **`nextDay`:**
    - ArrowRight in RTL tiles moves −1
    - ArrowDown in the columns moves +1
    - ArrowRight in the columns from 31 Jan goes to 28 Feb 2027
    - PageDown from 31 Dec stays at the period end

- [ ] **Step 2: Run the tests to make sure they fail**, then **implement** and add the `day.label` keys to both catalogs. **Run** `npm run check`.

- [ ] **Step 3: Commit**, with the message "Lay out months, pack source lanes, label days and move through the grid".

---

### Task 8: Start screen, app state and the example

**Files:**
- Create:
  - `src/ui/state/app.svelte.ts`
  - `src/ui/screens/StartScreen.svelte`
  - `src/ui/screens/MainScreen.svelte` (a placeholder with the toolbar from Task 10)
- Modify:
  - `src/ui/App.svelte`, `src/ui/main.ts`
  - `scripts/build/vite-restlos.ts` (embed the example as the data block `example-plan`)
  - the catalogs
- Test: `e2e/start.spec.ts` (replaces the worker check of Task 5)

**Interfaces:**
- Consumes: `startEngine`, `Engine`, `PlanState`, `LeaveChange`, `Hint`.
- Produces (`app.svelte.ts`):

```ts
export const app: {
  screen: "start" | "main";
  state: PlanState | undefined;          // last state from the worker
  view: "tiles" | "columns";
  mode: "light" | "dark" | "auto";      // sets <html style="color-scheme">
  weeks: boolean;                        // calendar weeks, default true
  align: boolean;                        // align columns by weekday, default false
  focusDay: DayNumber | undefined;
  selection: { anchor: DayNumber; head: DayNumber } | undefined;
  hint: Hint | undefined;
  openExample(): Promise<void>;
  apply(changes: readonly LeaveChange[]): Promise<void>;   // no worker call when changes is empty
  preview(changes: readonly LeaveChange[]): Promise<void>; // sets hint unless superseded
  undo(): Promise<void>; redo(): Promise<void>;
};
```

  `openExample` reads `document.getElementById("example-plan")!.textContent`. The initial `focusDay` is today if it's in the period, else the period's first day.

- [ ] **Step 1: Write `e2e/start.spec.ts`:**
  - `test("the start screen offers the example and opens it")` checks:
    - the heading has the app name and the subtitle
    - exactly one button, "View example" (DE "Beispiel ansehen"), with `role=button`
    - clicking it shows the main screen with the toolbar text "Beispiel GmbH" and the note "Example – changes are not saved"
  - `test("the language switch changes texts without reload")` is added in Task 10.

- [ ] **Step 2: Run** the test to make sure it fails (`npm run test:e2e -- e2e/start.spec.ts`), then **implement**. The start screen centres the name, the subtitle and one primary button. The default UI language is DE when `navigator.language` starts with "de", else EN.

- [ ] **Step 3: Run** `npm run check` and `npm run test:e2e`.

- [ ] **Step 4: Commit**, with the message "Open the built-in example from the start screen".

---

### Task 9: Controls, icons and the component gallery

**Files:**
- Create:
  - `src/ui/controls/Button.svelte`
  - `src/ui/controls/IconButton.svelte`
  - `src/ui/controls/Segmented.svelte`
  - `src/ui/controls/Checkbox.svelte`
  - `src/ui/controls/Popover.svelte`
  - `src/ui/controls/Sheet.svelte`
  - `src/ui/controls/Icon.svelte`
  - `src/ui/icons/*.svg`
  - `gallery.html`
  - `src/gallery/main.ts`, `src/gallery/Gallery.svelte`
- Modify: `vite.config.ts` (`mode === "gallery"` uses the `gallery.html` input, `outDir: "dist-gallery"`, no singlefile and no CSP), `REUSE.toml`, `LICENSES/ISC.txt`, `eslint.config.js` ignores (`dist-gallery/`), the catalogs
- Test: `e2e/gallery.spec.ts`

**Interfaces:**
- Produces:
  - `Button.svelte`: props `{ variant?: "default" | "primary"; type?: "button"; pressed?: boolean; onclick; children }`. `pressed` sets `aria-pressed`.
  - `IconButton.svelte`: props `{ icon: IconName; label: string; onclick; pressed?: boolean }`. It's visibly a button (D5) with the icon, and `label` goes into `aria-label` and the `title`.
  - `Segmented.svelte`: props `{ label: string; options: { value: string; label: string; icon?: IconName }[]; value: string; onchange }`, a group of buttons with `aria-pressed` inside a `role="group"` with `aria-label`.
  - `Checkbox.svelte`: native `<input type="checkbox">` with a label (D10).
  - `Popover.svelte`: props `{ id: string; anchor: HTMLElement | undefined; open: boolean; onclose; label: string; children }`.
    - It renders `<div popover="auto" role="dialog" aria-label>`.
    - It sets `anchor-name` on the anchor element and positions itself with `position-anchor`, `position-area: block-end span-inline-end` and `position-try-fallbacks: flip-block, flip-inline`.
    - It opens and closes with `showPopover()`/`hidePopover()`. `toggle` events call `onclose`.
    - On close, focus goes back to the anchor.
  - `Sheet.svelte`: the same props, as a `<dialog>` with `showModal()`, docked to the block end, closed by Escape, a backdrop click or the close button.
  - **Icons:**
    - `type IconName = "undo" | "redo" | "tiles" | "columns" | "sun" | "moon" | "sun-moon" | "languages" | "select" | "close" | "warning" | "check" | "more"`
    - from the Lucide files `undo-2`, `redo-2`, `layout-grid`, `columns-3`, `sun`, `moon`, `sun-moon`, `languages`, `square-dashed-mouse-pointer`, `x`, `triangle-alert`, `check`, `ellipsis`
    - `Icon.svelte` imports them `?raw` and renders them as an `<svg>` built from parsed path data, not with `{@html}`. A small build-time parse of the files into `{ viewBox, elements: { tag, attrs }[] }` in `src/ui/icons/index.ts` is fine.
    - `undo` and `redo` mirror in RTL (`:dir(rtl) { scale: -1 1 }`).
  - **The gallery** shows every control in every state (default, hover via a class, pressed, focus-visible, disabled where it exists) in a grid. Each section repeats for light and dark × the locales de, en, en-XA and en-XB. Tasks 11 to 14 add the day cell, the hint line, the allowance panel and the two main-screen sections to it. The URL parameters `section`, `locale` and `mode` (for example `?section=controls&locale=en-XB&mode=dark`) show only that one combination, for tests and screenshots.

- [ ] **Step 1: Copy the icons:** `npm pack lucide-static@1.60.0` into `$TMPDIR`. Extract only `package/icons/<name>.svg` for the 13 names into `src/ui/icons/`. Check every file contains only `<svg>`, `<path>`, `<circle>`, `<rect>`, `<line>` and `<polyline>`. Add the licence with `reuse download ISC`, and a `REUSE.toml` entry for `src/ui/icons/*.svg` (ISC, "Lucide Contributors"; Feather-derived: "Cole Bemis").

- [ ] **Step 2: Write `e2e/gallery.spec.ts`** (Chromium and Firefox projects; the gallery is opened from `dist-gallery/gallery.html`):
  - `test("every gallery section passes axe")` injects `axe-core/axe.min.js` with `page.addScriptTag({ path })` in a context with `bypassCSP: true`. It runs `axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })` and expects `violations` to equal `[]`.
  - `test("the gallery screenshots")` saves `toHaveScreenshot` per section and mode. The baselines go in `e2e/__screenshots__/` and are committed, with a `REUSE.toml` entry (EUPL-1.2).
  - `test("buttons keep a visible border in forced colours")` uses `page.emulateMedia({ forcedColors: "active" })` and expects the computed `border-block-start-width` of a default `Button` to be ≥ 1 px.

- [ ] **Step 3: Run** the tests to make sure they fail, then **implement** the controls and the gallery. Run each `.svelte` file through `svelte-autofixer` until it reports no issues.

- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e`.

- [ ] **Step 5: Commit**, with the message "Add the tactile controls, icons, popover, sheet and the component gallery".

---

### Task 10: The toolbar and its switches

**Files:**
- Create: `src/ui/screens/Toolbar.svelte`, `src/ui/state/keys.ts`
- Modify: `src/ui/screens/MainScreen.svelte`, the catalogs, `src/gallery/Gallery.svelte`
- Test: `tests/ui/state/keys.test.ts`, `e2e/toolbar.spec.ts`

**Interfaces:**
- Consumes: `app`, `i18n`, the controls.
- Produces:
  - `keys.ts`: `export function shortcut(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): "undo" | "redo" | "view" | "align" | "weeks" | undefined`.
    - Ctrl/⌘+Z gives undo. Ctrl/⌘+Y and Ctrl/⌘+Shift+Z give redo.
    - V, W and K without modifiers give view, align and weeks.
    - It matches `key` case-insensitively and falls back to `code` (`KeyZ`, `KeyY`, `KeyV`, `KeyW`, `KeyK`) when `key` isn't a Latin letter.
  - **The toolbar,** in one `role="toolbar"`:
    - the plan name (`textFor(meta.name, lang)`) and the period ("Jan – Dec 2027")
    - the example note
    - Segmented view (tiles, columns)
    - Checkbox "Calendar weeks"
    - Checkbox "Align by weekday", shown only in the columns view
    - IconButtons undo and redo, disabled from `canUndo`/`canRedo`
    - Segmented mode (light, dark, auto)
    - Segmented language (DE, EN)
  - **Below 520 px app width,** mode, language and the checkboxes move into a "More" IconButton that opens a Popover (a Sheet on the phone).
  - **Shortcuts:** a `keydown` listener on `window` calls `shortcut` and ignores events from text inputs.

- [ ] **Step 1: Write the failing tests:**
  - `keys.test.ts`:
    - Ctrl+Z gives undo, and Ctrl+Shift+Z gives redo
    - `key` "я" with `code` "KeyV" gives view
    - V with Ctrl gives undefined
  - `toolbar.spec.ts`:
    - `test("the language switch changes texts without reload")`: click EN, the note reads "Example – changes are not saved", and `<html lang>` is `en`. Check there was no navigation with `page.on("framenavigated")`.
    - `test("the mode switch sets color-scheme")`: click dark, and `getComputedStyle(document.documentElement).colorScheme` is `dark`.
    - `test("V switches the view")`

- [ ] **Step 2: Run** the tests to make sure they fail, then **implement**. **Run** `npm run check` and `npm run test:e2e`.

- [ ] **Step 3: Commit**, with the message "Add the toolbar with view, weeks, alignment, undo, mode and language".

---

### Task 11: Day cell and the month tiles view, with pointer gestures

**Files:**
- Create:
  - `src/ui/calendar/DayCell.svelte`
  - `src/ui/calendar/MonthTiles.svelte`
  - `src/ui/calendar/WeekNumber.svelte`
  - `src/ui/calendar/gestures.svelte.ts`
  - `src/ui/calendar/HintLine.svelte`
- Modify: `MainScreen.svelte`, `Gallery.svelte`, the catalogs
- Test: `e2e/tiles.spec.ts`

**Interfaces:**
- Consumes:
  - `rangeChanges`, `actionForDrag`, `toggleDay`, `weekChanges`
  - `tileWeeks`, `isoWeek`, `packLanes`, `cellLabel`
  - `app`
- Produces:
  - **`DayCell.svelte`:**
    - **Props:**
      - `day: DayResult`
      - `meta: PlanMeta`
      - `lanes: readonly { lane: 0 | 1 | 2 | "more"; sourceId: string; joinStart: boolean; joinEnd: boolean }[]`
      - `orientation: "row" | "column"`
      - `focused: boolean`, `selected: boolean`, `today: boolean`
      - `previewed: boolean`
    - **Element:** `<div role="gridcell" data-day={day.day} tabindex={focused ? 0 : -1} aria-selected={selected} aria-label={cellLabel(…)} title={same}>`.
    - **Layers, in order:**
      - the background by required work, with `half-required` as a diagonal split
      - the fill: full leave fills the cell, half leave the half given by its part, mandatory leave is hatched
      - a dashed border for other-plan days
      - the lane bands at the bottom (rows) or at the inline end (columns): each a 5 px `--r-surface` band drawn only where a run is, with the 3 px line in the source's accent and its line style, solid, dashed or dotted by the source's position mod 3; `"more"` draws a "+" pattern
      - the overlay ring for today, focus, selection and preview, as a `.ring` span above the fill
    - **Text:** the day number sits at the block start. In the columns, the weekday abbreviation sits next to it.
  - **`MonthTiles.svelte`:** one `role="grid"` with `aria-label` "Calendar" around all months.
    - Each month is a `role="rowgroup"` with a heading. Week rows are `role="row"`, and the week number is a `role="rowheader"` `<button>` styled as in the groundwork (grey, 18 px wide, 3 px radius, 10 px bold).
    - Clicking the week number applies `weekChanges`.
    - Tiles per row come from the calendar area's width (container queries): 4, 3, 2 or 1 at ≥ 1100, 800–1099, 520–799 and < 520 px.
  - **`gestures.svelte.ts`:** `export function calendarGestures(node: HTMLElement, options: { getResult: () => PlanResult; app: typeof app }): { destroy(): void }`, a Svelte action on the grid.
    - **Mouse and pen:**
      - **`pointerdown` on a cell** sets pointer capture. It records the start day and the action (`actionForDrag`).
      - **`pointermove`** finds the day under the pointer with `document.elementFromPoint` and `closest("[data-day]")`. It skips gaps between tiles by keeping the last day found, then sets `previewed` on the range and calls `app.preview(rangeChanges(...))`.
      - **`pointerup`:** when the pointer never left the start cell, it's a click. Shift-click applies `rangeChanges(lastClicked, day, "full")`, and a plain click applies `toggleDay`. Otherwise it applies the range.
      - **`pointercancel` or `lostpointercapture`** without a `pointerup` discards the preview. *Review Focus 1.*
      - Escape during a drag discards it.
    - **Touch outside the selection mode:**
      - a tap toggles the day
      - a press held 500 ms without moving more than 10 px opens the detail (Task 13 hooks it up)
      - moving lets the page scroll, so the grid has `touch-action: auto`
    - **Right-click (`contextmenu`)** opens the detail (Task 13).
  - **`HintLine.svelte`:** `aria-live="polite"`, one ICU message `hint.range` with days, cost, remaining and the stretch (dates and days off). It's empty when there's no hint.

- [ ] **Step 1: Write `e2e/tiles.spec.ts`** at 1280 px:
  - `test("dragging from Mon 14 Jun to Fri 18 Jun plans five days")`:
    - uses `page.mouse` down on `[data-day="<14 Jun>"]`, moves in steps to 18 Jun, and releases
    - during the move, the hint line contains "5"
    - after release, the five cells' `aria-label`s contain "leave full" (the allowance figures are tested in Task 12)
  - `test("a drag that starts on leave removes it")`
  - `test("click toggles, Shift-click extends")`
  - `test("a week-number click sets the week and a second click removes it")`
  - `test("a drag released outside the window applies once; pointercancel discards")`. Release over the toolbar and expect the range applied once, so a single undo restores it. Dispatch `pointercancel` with `page.dispatchEvent` and expect no change and an empty hint. *Review Focus 1.*
  - `test("a drag from 29 Jan into 2 Feb across the tile gap sets the days in between")`. *Review Focus 3.*
  - `test("undo removes the whole drag in one step")`
  - **RTL,** on the gallery section `?section=main-tiles&locale=en-XB` (created in this task, see Step 2):
    - `test("in RTL the week number sits at the visual right of its row")`: its bounding box `x` is greater than that of every cell in the row
    - `test("in RTL ArrowRight moves to the previous day")`
    - `test("in RTL a drag from right to left sets the days in between")`: drag from 14 Jun to 18 Jun, which runs from right to left, plans 5 days

  Day numbers are computed in the test with `dayFromYmd`.

- [ ] **Step 2: Run** the tests to make sure they fail, then **implement**. Add the gallery section `main-tiles`: it renders `MainScreen` in the tiles view with the example, through the real worker, in the locale and mode from the URL. Add a DayCell section to the gallery: every layer and state, full, half (start and end), mandatory, other plan, ½ required, holiday, weekend, 1 to 3 lanes and "more", today, focus, selected, previewed.

- [ ] **Step 3: Run** `npm run check` and `npm run test:e2e`, and run `svelte-autofixer` on each component.

- [ ] **Step 4: Commit**, with the message "Draw day cells and the month tiles, and plan leave by drag, click and week number".

---

### Task 12: The allowance panel

**Files:**
- Create: `src/ui/allowance/AllowancePanel.svelte`, `src/ui/allowance/AllowanceBar.svelte`, `src/ui/allowance/bar.ts`
- Modify: `MainScreen.svelte` (layout), `Gallery.svelte`, the catalogs
- Test: `tests/ui/allowance/bar.test.ts`, `e2e/allowance.spec.ts`

**Interfaces:**
- Produces:
  - `bar.ts`: `export function barGeometry(allowance: Units, planned: Units): { scale: Units; plannedShare: number; tickShare: number; overShare: number }`
    - `scale = max(allowance, planned, 1)`
    - `plannedShare = min(planned, allowance) / scale`
    - `tickShare = allowance / scale`
    - `overShare = max(0, planned − allowance) / scale`
  - **`AllowanceBar`:** a `role="meter"` with `aria-valuenow` = planned, `aria-valuemin` 0, `aria-valuemax` the scale and `aria-valuetext` (formatted). It shows the planned fill, a tick at the allowance and the overdraft hatched in `--r-overdraft`. Below it, the warning line `allowance.over` ("2½ days over the allowance") appears when the remaining allowance is below 0.
  - **`AllowancePanel`:**
    - **The figures:** allowance, planned and remaining, with `data-testid="allowance" | "planned" | "remaining"`.
    - **The bar.**
    - **The stretches list:** only `listed` stretches, each showing its first and last day, its cost and its days off. A start or end at noon shows "from noon" or "until noon".
    - **Totals per calendar year,** marked as information.
  - **Layout:**
    - from 800 px app width, the panel is a sidebar at the inline end (`.sidebar-layout`)
    - below that, it's a compact bar at the top (remaining and the bar) with an "Details" disclosure button (`aria-expanded`) that shows the full panel
    - below 520 px, the details open in a Sheet

- [ ] **Step 1: Write the failing tests:**
  - **`barGeometry`:**
    - `(14400, 7200)` gives `{ scale: 14400, plannedShare: 0.5, tickShare: 1, overShare: 0 }`
    - `(14400, 18000)` gives a scale of 18000, `tickShare` 0.8 and `overShare` 0.2
    - `(0, 0)` doesn't divide by zero
  - **`allowance.spec.ts`:**
    - the example shows an allowance of 30, and the planned figure equals the sum the engine gives (read from the session test's value)
    - dragging 5 days lowers the remaining figure by 5
    - planning past the allowance shows the warning line and an `aria-valuetext` above 30
    - at 600 px viewport width, the compact bar is shown and "Details" expands the panel

- [ ] **Step 2: Run** the tests to make sure they fail, then **implement**. Add the bar's states (under, exact, over) and the panel to the gallery.

- [ ] **Step 3: Run** `npm run check` and `npm run test:e2e`.

- [ ] **Step 4: Commit**, with the message "Show the allowance, the overdraft bar, stretches and yearly totals".

---

### Task 13: Keyboard grid, selection and the detail popover

**Files:**
- Create: `src/ui/calendar/keyboard.svelte.ts`, `src/ui/calendar/DayDetail.svelte`, `src/ui/calendar/detail.ts`
- Modify: `MonthTiles.svelte`, `gestures.svelte.ts` (the long-press and contextmenu hooks), the catalogs, `Gallery.svelte`
- Test: `tests/ui/calendar/detail.test.ts`, `e2e/keyboard.spec.ts`, `e2e/detail.spec.ts`

**Interfaces:**
- Consumes: `nextDay`, `rangeChanges`, `app.selection`, `app.focusDay`, `Popover`, `Sheet`.
- Produces:
  - **`keyboard.svelte.ts`:** `export function calendarKeyboard(node: HTMLElement, options: { view: () => "tiles" | "columns"; app: typeof app; openDetail: (day: DayNumber, anchor: HTMLElement) => void }): { destroy(): void }`.
    - **Navigation keys** go through `nextDay` and focus the new cell (roving tabindex). Shift+navigation grows `app.selection` from its anchor (or the focused day) and previews `rangeChanges(…, "full")`.
    - **Applying:**
      - Space applies `"full"` on the selection, or toggles the focused day when there's no selection
      - H applies `"half"` on the selection or the focused day
      - Delete and Backspace apply `"remove"`
      - each of these clears the selection
    - **Enter and the ContextMenu key** open the detail. Escape clears the selection and the preview.
    - **Home/End and PageUp/PageDown** move as `nextDay` says.
  - **`detail.ts`:** `export function dayDetail(day: DayResult, meta: PlanMeta, problems: readonly Problem[]): { requiredReason: { key: string; args: Record<string, string | number> }; sources: SourceMeta[]; leave: "none" | "full" | "halfStart" | "halfEnd" | "mandatory" | "otherPlan" | "partial"; cost: Units; problems: Problem["code"][] }`.
    - It maps `required.decidedBy.kind` to a catalog key (`detail.required.workWeek`, `….publicHoliday` with the holiday name key, `….holidaySource`, `….paidClosure`, `….ruleAtMost`/`ruleExactly` with the rule's label, `….override`).
    - `problems` is `result.problems`; it keeps those of this day.
  - **`DayDetail.svelte`:** a Popover (or a Sheet when the calendar area is < 520 px).
    - It shows the date, the required work and its reason, the sources (colour swatch, line style, name), the leave, the cost and the problems.
    - Its actions are the Buttons "Full day", "Half day – morning", "Half day – afternoon" and "Remove", each applying one change.
    - Focus moves into the popover on open, and goes back to the cell on close.

- [ ] **Step 1: Write the failing tests:**
  - **`detail.test.ts`:**
    - Corpus Christi 2027 gives `publicHoliday` with its `nameKey`
    - 24 Dec 2027 gives `ruleAtMost` with the example rule's label
    - 4 Jan 2027 lists the other-plan source and `leave: "otherPlan"`
  - **`keyboard.spec.ts`** (keyboard only, no mouse):
    - Tab reaches the grid in one stop, and the next Tab leaves it
    - the arrows move the focus, Shift+→ ×4 then Space plans 5 days, and the selection is gone
    - H on a working day gives "leave half"
    - Ctrl+Z restores
    - Escape clears a selection
    - PageDown moves to the next month
  - **`detail.spec.ts`:**
    - right-click on 24 Dec shows the popover with the reason and the "at most ½" rule label
    - "Half day – morning" sets `part: "start"`, visible in the cell's label
    - Escape closes and focus returns to the cell
    - Enter on a focused cell opens it
    - `test("in RTL the popover opens toward the inline end and stays on screen")` on `?section=main-tiles&locale=en-XB`: opened on a cell in the leftmost tile, its bounding box lies fully inside the viewport, and its right edge is not right of the cell's right edge, unless it had to flip

- [ ] **Step 2: Run** the tests to make sure they fail, then **implement**. **Run** `npm run check` and `npm run test:e2e`, and run `svelte-autofixer`.

- [ ] **Step 3: Commit**, with the message "Move through the calendar by keyboard, select ranges and show the detail popover".

---

### Task 14: Month columns view and the touch selection mode

**Files:**
- Create: `src/ui/calendar/MonthColumns.svelte`, `src/ui/calendar/SelectionBar.svelte`
- Modify: `MainScreen.svelte`, `gestures.svelte.ts` (selection mode), `keyboard.svelte.ts` (columns), `Toolbar.svelte` (the "Select" button), the catalogs, `Gallery.svelte`
- Test: `e2e/columns.spec.ts`, `e2e/touch.spec.ts`

**Interfaces:**
- Consumes: `columnRows`, `packLanes`, `DayCell` (`orientation: "column"`), `calendarGestures`, `calendarKeyboard`.
- Produces:
  - **`MonthColumns.svelte`:**
    - **Structure:** one `role="grid"`. A header row has the month names (`role="columnheader"`), and a fixed day column has the row headers (day 1–31, or the weekday in aligned mode).
    - **Week numbers:** the week-number button appears in the cell where a week starts, at the block start, when weeks are on.
    - **Scrolling:** horizontally in an `overflow-x: auto` container whose first column is `position: sticky; inset-inline-start: 0`.
    - **Visible columns:**
      - ≥ 1100 px calendar width: all 13 columns
      - 800–1099 px: scroll
      - 520–799 px: 6 visible
      - < 520 px: 3 visible
    - Cells have no rounded corners. Lanes run vertically at the inline end.
    - Switching views keeps `app.focusDay` and scrolls it into view.
  - **The selection mode:** `app.selectMode: boolean`, toggled by the toolbar's "Select" IconButton (`aria-pressed`), shown when the device has a coarse pointer (`(pointer: coarse)`) or the app is < 800 px wide.
    - In this mode the grid has `touch-action: none`. A touch drag sets `app.selection`. Two taps (first and last day) set the anchor, then the head.
    - **`SelectionBar.svelte`** is fixed at the block end: the hint line and the Buttons "Full day" (primary), "Half day", "Remove" and "Cancel". Each applies `rangeChanges` with its action, then clears the selection, while the mode stays on.
    - Leaving the mode clears the selection.

- [ ] **Step 1: Write the failing tests:**
  - **`columns.spec.ts`** (1920 px):
    - the 12 month headers of the example are visible without scrolling
    - drag down the column from 14 to 18 June plans 5 days
    - W aligns by weekday and 1 Feb 2027 is in the first row
    - K hides the week numbers
    - V keeps the focused day
    - **RTL,** on the gallery section `?section=main-columns&locale=en-XB` (added in this task: `MainScreen` in the columns view, at 900 px so the columns scroll):
      - `test("in RTL the day column stays fixed at the right while the months scroll")`: after `scrollLeft` moves the scroller, the day column's bounding box is unchanged and at the visual right
      - `test("in RTL ArrowLeft moves to the next month")`
  - **`touch.spec.ts`:**
    - **Setup:** project Chromium with `hasTouch: true, isMobile: true` and viewport 375×800; WebKit too if it runs. It uses `page.touchscreen.tap` and dispatches touch-type `pointer*` events for the drag.
    - **Without the selection mode:** a tap toggles a day, and a swipe doesn't plan anything.
    - **The selection mode:**
      - tap 14 Jun, then 18 Jun, then "Full day" plans 5
      - a touch drag with "Half day" plans halves
      - "Cancel" changes nothing
    - **Long press:** it opens the detail Sheet (a `dialog[open]`).

- [ ] **Step 2: Run** the tests to make sure they fail, then **implement**. **Run** `npm run check` and `npm run test:e2e`, and run `svelte-autofixer`.

- [ ] **Step 3: Commit**, with the message "Add the month columns view and the touch selection mode".

---

### Task 15: Full-screen gallery sections, axe on both views, screenshots

**Files:**
- Modify: `e2e/gallery.spec.ts` (the sections `main-tiles` and `main-columns` from Tasks 11 and 14 now also run in every mode and locale)
- Create: `e2e/a11y.spec.ts`, `e2e/narrow.spec.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the tests:**
  - `a11y.spec.ts`:
    - axe (as in Task 9) on the built app after "View example", in the tiles view, the columns view, with the detail popover open and with the selection bar open, at 1280 and 375 px, in light and dark
    - `violations` must equal `[]`
  - `gallery.spec.ts` gains screenshots of the main screen sections at 375, 768, 1100 and 1920 px.
  - The RTL screenshots of both main-screen sections, and the axe run on them (the RTL behaviour tests are in Tasks 11, 13 and 14).
  - `test("in RTL the allowance sidebar is at the visual left")` on `main-tiles` at 1280 px.
  - `narrow.spec.ts`: at 375 px viewport width, on the gallery's "Main screen – tiles" section in `en-XA` (the gallery's locale is a URL parameter, `?locale=en-XA&mode=light&section=main-tiles`, which only the gallery reads):
    - `document.scrollingElement.scrollWidth <= innerWidth`
    - every toolbar control is visible or inside "More"
    - *Review Focus 5.*

- [ ] **Step 2: Run** `npm run test:e2e`. Fix every violation in the components; never disable an axe rule. Where a colour fails contrast, change the token, not the component.

- [ ] **Step 3: Run** `npm run check`. Commit with the message "Check both views with axe and add full-screen gallery screenshots".

---

### Task 16: Close out the branch

**Files:**
- Modify:
  - `issues/0026-ui-groundwork-decisions.md` (`status: done`, `closed: <date>`, `branch: ui`)
  - `issues/0025-…md` (WebKit result, if Task 2 found one)
- Create: `issues/0027-run-the-build-and-e2e-tests-in-ci.md` (from `issues/_template.md`). If other follow-ups came up, add them as issues as well and name them in the summary.

**Interfaces:** none.

- [ ] **Step 1: Run** `npm run check`, `npm run build` (note the size) and `npm run test:e2e`. Expected: all pass, and the HTML is under 600 KB.

- [ ] **Step 2: The guided manual check in the Firefox ESR,** with the maintainer, one step at a time in the chat. Each step is one action and one thing to look at.
  1. Run `firefox-esr dist/restlos-urlaubsplaner.html`.
  2. Click "View example".
  3. Drag over a week in June and check the hint line and the remaining allowance.
  4. Right-click a day and check the popover's position.
  5. Press Ctrl+Z.
  6. Switch to dark mode and the columns view.

  Write any finding into an issue or fix it, if it's in the scope.

- [ ] **Step 3: Commit**, with the message "Close issue 0026 and record the follow-ups of the UI branch". It includes the issue files.
