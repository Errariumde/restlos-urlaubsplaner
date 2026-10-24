<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Version 1 Feasibility Tests: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-contained test pages and two `.ics` files answer the spec's four version 1 feasibility questions in Firefox ESR 153, the current Firefox, Chromium and Thunderbird; the answers go into `docs/SPEC.md` as a concept for the UI branch, and the pages are deleted again.

**Architecture:**
- Page sources live in `feasibility/`: one HTML skeleton per page plus plain scripts. `npm run feasibility` assembles them into `dist/feasibility/`, inlining the scripts, inserting the CSP right after `<meta charset>` and computing the script hashes.
- A small TypeScript module (`scripts/feasibility-pages.ts`) does the assembly and hashing, so it can be unit-tested. Two more generate the worker's model through the engine and the two `.ics` files. A thin `scripts/feasibility.js` CLI writes the files.
- Each page records its checks in a results table with a "Copy results" button. The maintainer pastes the results into the chat; Claude writes them into the design and the concept into the spec. The last task deletes `feasibility/`, the scripts, their tests and the npm script.

**Tech Stack:** plain browser JavaScript (no packages), Node 24 with `node:crypto` and `node:zlib`, the engine's `readFile`/`computePlan`, Vitest 5.0.3, Firefox ESR 153.5 (`firefox-esr` from the dev shell), Firefox, Chromium, Thunderbird with Nextcloud and DAVx5.

**Spec:**
- `docs/superpowers/specs/2026-10-24-feasibility-tests-design.md` (decisions 1–10, calls, the tests with their ids, the concept). Read it before any task; check ids (S1, C1, W3, I4 …) refer to it.
- `docs/SPEC.md`, "Feasibility tests before implementation", "Content Security Policy", "Delivery format", "File operations", "Sharing and validation", ".ics export".

## Who does what, and when

| When | Claude | You |
| --- | --- | --- |
| now | | review this plan |
| then | Tasks 1–6: build tool, the four test pages, the `.ics` files, the two issues | |
| round 1 | | steps Y1–Y5, roughly 1½ hours: run each page in the three browsers, the Thunderbird steps, paste the results |
| then | Task 7: results into the design, concept into the spec; Task 8: delete the test code | |

A second round is needed only if a result is unclear or contradicts the research; then I ask for the one check to repeat.

## Global Constraints

- **Git:** branch `feasibility`; commit with `git -c commit.gpgsign=false commit` if signing fails; never push, tag or sign; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No new packages**, no Vite, Svelte or Playwright; never `npx`.
- **Policies** (spec, "Content Security Policy"), as the meta tag's `content`, directives in this order:
  - standard: `default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src <hashes>; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:`
  - pro: the same, with `'wasm-unsafe-eval'` after the hashes in `script-src`
  - pages: the standard policy with `worker-src 'self' blob:` and `manifest-src 'self'` appended
- **The meta tag** is `<meta http-equiv="Content-Security-Policy" content="…">`, the element directly after `<meta charset="utf-8">`, before any script, style or link.
- **Hashes:** `'sha256-<base64>'` over the script's text with CRLF and lone CR turned into LF (what the HTML parser hands the browser). Executable inline scripts (no `type`, `type="module"`, `type="text/javascript"`) are hashed unless they carry `data-no-hash`; every other `type` is a data block and is never hashed.
- **Page scripts** are plain scripts without `import`/`export` (a page can't load modules from `file://` under this policy); the build concatenates them in the order listed. Each `.js` file in `feasibility/` starts with the SPDX header and a `/* global … */` comment naming the browser globals and the helpers from `results.js` it uses, like `scripts/*.js` do for Node globals. No ESLint configuration change.
- **No network:** pages never contact a host. T2b uses only `python3 -m http.server` on `localhost`.
- **REUSE:** `.js`/`.ts` files start with `// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors` and `// SPDX-License-Identifier: EUPL-1.2`; `.html` files with the same two lines in an HTML comment after `<!doctype html>`; Markdown CC-BY-4.0 as in the existing docs. Generated files live in `dist/` (ignored by Git) and need none.
- **Node types:** the project has no `@types/node`. Node functions used from TypeScript get a declaration in `tests/node-crypto.d.ts`, like `tests/node-fs.d.ts`. File writing stays in the `.js` CLI.
- **Perf baseline:** unchanged; no engine code changes, so no new perf scenario.
- **Verification before each commit:** `npm run check` passes (lint, typecheck, test, perf, `reuse lint`); for a commit that changes only Markdown, `reuse lint` is enough.

## Review Focus

1. **A script text with CRLF line endings, or one that contains `</script`:** the hash must match what the browser computes (CRLF→LF), and the assembler must refuse a script or data block containing `</script` (case-insensitive) instead of writing a broken page. Pinned in Task 1.
2. **A page opened when storage throws** (`localStorage` access raising `SecurityError`, as Safari or a blocked-site-data setting would): the storage page must still render and record the error as the result, not stop at the first exception. Pinned in Task 2 (every probe wrapped, one failing probe never stops the others).
3. **A probe that unexpectedly succeeds and navigates away** (the form submission in C5, a dropped file in K4): the results recorded so far must not be lost. Pinned in Task 3 (the form probe runs last, behind its own button; drops are caught on `document`).
4. **Two exports with identical events in one file:** every `UID` in an `.ics` file must be unique, and an unchanged event must keep its `UID` between v1 and v2. Pinned in Task 5.
5. **The 13 MB model containing a `Map`:** `JSON.stringify` silently turns a `Map` into `{}`; `positions` must be written as an entries array, and no other `Map` or `Set` may hide in the model. Pinned in Task 4.

---

### Task 1: The page builder

**Files:**
- Create: `scripts/feasibility-pages.ts`
- Create: `scripts/feasibility.js`
- Create: `feasibility/results.js`
- Create: `feasibility/README.md`
- Create: `tests/scripts/feasibility-pages.test.ts`
- Create: `tests/node-crypto.d.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces, in `scripts/feasibility-pages.ts`:
  - `type Variant = "standard" | "pro" | "pages"`
  - `cspHash(scriptText: string): string` → `"'sha256-<base64>'"` over the LF-normalized text
  - `policy(variant: Variant, hashes: readonly string[]): string` → the meta tag's `content` (Global Constraints); `script-src 'none'` (plus `'wasm-unsafe-eval'` for pro) when `hashes` is empty
  - `assemblePage(source: string, files: ReadonlyMap<string, string>, variant: Variant): string`: replaces every `<script … data-inline="a.js b.js"></script>` with the same element (without `data-inline`) holding the named files' contents joined by `"\n"`; hashes the executable scripts (Global Constraints); inserts the meta tag directly after `<meta charset="utf-8">`. Throws an `Error` naming the problem when the source has no `<meta charset="utf-8">`, already has a CSP meta tag, names a file missing from `files`, or a script or data block contains `</script` (case-insensitive).
- Produces, in `feasibility/results.js` (concatenated before each page's own script):
  - `record(id, result, details)`: one table row; `result` is `"pass"`, `"fail"`, `"blocked"`, `"allowed"`, `"error"` or free text; a second call with the same `id` replaces the row
  - `observe(id, question)`: a row with Yes/No buttons the maintainer clicks for what only a person sees (a dialog, a prompt)
  - `observeText(id, question)`: a row with a text field (for example, the name a download got)
  - `probe(id, fn)`: runs `fn` (sync or async), records its returned `{ result, details }`, and records `"error"` with the exception's name and message if it throws, so one failing probe never stops the others
  - The "Copy results" button copies Markdown: a heading with the page's file name, `navigator.userAgent`, the local date and time, then a table `| Id | Result | Details |`; with `navigator.clipboard.writeText`, falling back to selecting the text in a `<textarea>`.
- Produces, in `scripts/feasibility.js`: `npm run feasibility` empties and rebuilds `dist/feasibility/` from a `PAGES` list (output path, source HTML, variant, generated files) that later tasks extend; prints each written path.

- [ ] **Step 1: Write the failing tests** in `tests/scripts/feasibility-pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assemblePage, cspHash, policy } from "../../scripts/feasibility-pages";

const page = (body: string): string => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`;

describe("cspHash", () => {
  it("hashes the text the browser sees, with CRLF turned into LF", () => {
    expect(cspHash("a\nb")).toBe("'sha256-fhj3NzEbLcOy8mndeDlrA1HxT7Zu+oefdoyyMYGIPHg='");
    expect(cspHash("a\r\nb")).toBe(cspHash("a\nb"));
    expect(cspHash("a\rb")).toBe(cspHash("a\nb"));
  });
});

describe("policy", () => {
  it("writes the standard policy with the hashes", () => {
    expect(policy("standard", ["'sha256-x'"])).toBe(
      "default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'sha256-x'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:",
    );
  });
  it("adds 'wasm-unsafe-eval' for pro and the self sources for pages", () => {
    expect(policy("pro", ["'sha256-x'"])).toContain("script-src 'sha256-x' 'wasm-unsafe-eval';");
    expect(policy("pages", ["'sha256-x'"])).toMatch(/worker-src 'self' blob:; manifest-src 'self'$/);
  });
});

describe("assemblePage", () => {
  const files = new Map([["a.js", "console.log(1);"], ["b.js", "console.log(2);"], ["d.json", "{\"x\":1}"]]);

  it("inlines the named files and puts the policy right after the charset", () => {
    const html = assemblePage(page('<script type="module" data-inline="a.js b.js"></script>'), files, "standard");
    expect(html).toContain('<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="');
    expect(html).toContain('<script type="module">console.log(1);\nconsole.log(2);</script>');
    expect(html).toContain(cspHash("console.log(1);\nconsole.log(2);"));
    expect(html).not.toContain("data-inline");
  });
  it("leaves data blocks and data-no-hash scripts out of the hashes", () => {
    const html = assemblePage(
      page('<script type="application/json" data-inline="d.json"></script><script data-no-hash>window.x = 1;</script>'),
      files,
      "standard",
    );
    expect(html).toContain('<script type="application/json">{"x":1}</script>');
    expect(html).toContain("script-src 'none';"); // no executable script was hashed
    expect(html).not.toContain(cspHash('{"x":1}'));
    expect(html).not.toContain(cspHash("window.x = 1;"));
  });
  it("hashes a script written directly in the page", () => {
    expect(assemblePage(page("<script>window.y = 2;</script>"), files, "standard")).toContain(cspHash("window.y = 2;"));
  });
  it("refuses what would give a broken or misleading page", () => {
    expect(() => assemblePage("<html><head></head></html>", files, "standard")).toThrow(/charset/);
    expect(() => assemblePage(page('<script data-inline="missing.js"></script>'), files, "standard")).toThrow(/missing\.js/);
    const closing = new Map([["c.js", "x = '</SCRIPT>';"]]);
    expect(() => assemblePage(page('<script data-inline="c.js"></script>'), closing, "standard")).toThrow(/<\/script/i);
    const twice = page('<meta http-equiv="Content-Security-Policy" content="x">');
    expect(() => assemblePage(twice, files, "standard")).toThrow(/Content-Security-Policy/);
  });
});
```

`policy` writes `'none'` when the hash list is empty, so the directive stays valid.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/scripts/feasibility-pages.test.ts`
Expected: FAIL (module `scripts/feasibility-pages` not found).

- [ ] **Step 3: Add `tests/node-crypto.d.ts`** declaring only `createHash(algorithm: "sha256"): { update(data: string): …; digest(encoding: "base64" | "hex"): string }` for `node:crypto`, with the comment style of `tests/node-fs.d.ts`.

- [ ] **Step 4: Implement `scripts/feasibility-pages.ts`** with the three functions above. Parse with regular expressions over the known source shape (the sources are ours); no HTML parser package.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/scripts/feasibility-pages.test.ts`
Expected: PASS

- [ ] **Step 6: Write `feasibility/results.js`** with the interface above, and `scripts/feasibility.js` with an empty `PAGES` list; add `"feasibility": "node --import ./scripts/ts-hooks.js scripts/feasibility.js"` to `package.json`. Start `feasibility/README.md` with: what the pages are for (link to the design), `npm run feasibility`, how to start each browser with a fresh profile (`firefox-esr --no-remote --profile "$(mktemp -d)" <file>`, `firefox --no-remote --profile "$(mktemp -d)" <file>`, `chromium --user-data-dir="$(mktemp -d)" <file>`), "Copy results, paste into the chat", and that the pages are deleted at the end of the branch.

- [ ] **Step 7: Verify:** `npm run feasibility` runs and prints nothing to write; `npm run check` passes.

- [ ] **Step 8: Commit** "Add the builder for the feasibility test pages" (the files above).

---

### Task 2: T1, storage and files from `file://`

**Files:**
- Create: `feasibility/storage.html`, `feasibility/storage.js`
- Modify: `scripts/feasibility.js` (`PAGES`), `feasibility/README.md` (section T1)

**Interfaces:**
- Consumes: `assemblePage` (variant `"standard"`), `record`, `probe`, `observe`, `observeText` (Task 1).
- Produces: `dist/feasibility/storage/a/storage.html`, `dist/feasibility/storage/a/storage-copy.html`, `dist/feasibility/storage/b/storage.html` (the same assembled page three times).

The page implements S1–S5, S7 and S8 of the design (S6 is dropped); S1 exactly as the design's table, including `crypto.subtle`. Keys all start with `feasibility:`; the page never touches other keys. Specifics the design leaves open:

- **Markers (S2, S3):** on load, the page writes `feasibility:marker:<location.pathname>` = the ISO time into localStorage and the same pair into IndexedDB (database `feasibility`, store `markers`, key = pathname), then records which markers it can see in each, as a list of paths. It shows links to itself with `?query` and `#hash`.
- **Persistence (S3):** on `pagehide`, write `feasibility:pagehide:<pathname>` (both stores); a button "Write crash value" writes `feasibility:crash:<pathname>` with the time. On load, the page records the pagehide and crash values it finds, with their times. The README gives the steps: click, wait 1 s (then, in a second run, 5 s), `pkill -9 -f firefox-esr` (or `firefox`, `chromium`), start the browser again with the same profile directory.
- **Capacity (S4):** a button writes a 10,485,760-character string to localStorage and to IndexedDB, records success or the error's `name` and `message` for each, removes both again, and records `navigator.storage.estimate()`, `persisted()` and `persist()`; `observe("S4-prompt", "Did a permission prompt appear?")`.
- **Between tabs (S5):** a BroadcastChannel `feasibility` that announces the page's path on load and records the paths it hears; a `storage` event listener recording the keys and the path that changed them; buttons "Hold lock" (`navigator.locks.request("feasibility-plan", …)` held until "Release lock") and "Try lock" (`ifAvailable: true`, records whether it got it) and "Query locks" (records `navigator.locks.query()`).
- **Files in Chromium (S7):** buttons for `showOpenFilePicker` (keeps the handle in IndexedDB store `handles`, key `kept`), "Write back" (`createWritable`, writes `restlos feasibility <time>\n`), `showSaveFilePicker`, and "Use kept handle" (after a reload, or from another page: records `queryPermission({ mode: "readwrite" })`, then `requestPermission` on click). `observe("S7-every-visit", "Was 'Allow on every visit' offered?")`. A drop zone records `getAsFileSystemHandle` for a dropped file. In Firefox these buttons record "not available".
- **Reading and downloading (S8):** an `<input type="file">` and the drop zone record the file's name and size; a "Download" button downloads a small Blob with `download="Beispiel.rev3.urlaub.json"`; `observeText("S8-name", "What name did the downloaded file get?")`.
- **Every probe** goes through `probe()`, and each storage API is touched inside `try` (Review Focus 2).

- [ ] **Step 1: Write `feasibility/storage.html`** (title "restlos feasibility: storage", one `<script type="module" data-inline="results.js storage.js">`, the buttons and the drop zone) **and `feasibility/storage.js`.**
- [ ] **Step 2: Add the three outputs to `PAGES`.**
- [ ] **Step 3: Smoke check:** `npm run feasibility`, then `chromium --headless=new --user-data-dir="$(mktemp -d)" --dump-dom "file://$PWD/dist/feasibility/storage/a/storage.html"`. Expected: the dumped DOM has rows for S1 and S2 with results, and no row says the page's own script was blocked. If headless Chromium can't start in the sandbox, say so in the task report and rely on the maintainer's run.
- [ ] **Step 4: Write README section T1:** the order of opening the three files and the renamed original (`mv dist/feasibility/storage/a/storage.html dist/feasibility/storage/a/storage-renamed.html`), the two-tab steps for S5, the restart and kill steps for S3, the Chromium-only S7 steps, and which pages' results to copy.
- [ ] **Step 5: Verify:** `npm run check` passes.
- [ ] **Step 6: Commit** "Add the storage feasibility page (T1)".

---

### Task 3: T2 and T2b, CSP via `<meta>`, keyboard shortcuts and the Pages policy

**Files:**
- Create: `feasibility/csp.html`, `feasibility/csp.js`, `feasibility/sw.js`
- Modify: `scripts/feasibility.js` (`PAGES`, generated files), `feasibility/README.md` (sections T2, T2b)

**Interfaces:**
- Consumes: `assemblePage` (variants `"standard"`, `"pro"`, `"pages"`), the helpers from `results.js` (Task 1).
- Produces: `dist/feasibility/csp.html` (standard), `dist/feasibility/csp-pro.html` (pro), `dist/feasibility/pixel.png` next to them; `dist/feasibility/pages/index.html` (pages), `pages/manifest.webmanifest`, `pages/sw.js`, `pages/pixel.png`.

The page implements C1–C8 and K1–K4; when `location.protocol` is `http:` (T2b) it also runs P1. A `securitypolicyviolation` listener on `document` records each violation (`violatedDirective`, `blockedURI`) under the id `violations`. Specifics:

- **C1:** the main script records that it ran; a second inline script with `data-no-hash` sets a flag, and an `<img src="data:," onerror="…">` attribute handler sets another; the main script records both flags after `load` (`blocked` when unset).
- **C3:** `fetch` and `XMLHttpRequest` of `location.href`, of a `blob:` URL the page made, and of `data:text/plain,x`; each records `blocked` or `allowed`, with whether a `connect-src` violation came (Firefox refuses `file://` fetches even without a policy; the violation tells the two apart).
- **C4:** `data:` and `blob:` images and `pixel.png` next to the page (the CLI writes a 1×1 PNG from fixed bytes); `new FontFace("probe", "url(data:font/woff2;base64,AAAA)")`: `allowed` when no `font-src` violation comes (the bytes aren't a real font, so a decoding error is expected and fine); `<style>` and a `style` attribute applied (computed style).
- **C5:** `<object data="data:text/plain,x">` and `<embed>`; `<base href="https://example.invalid/">` added by the script, then `document.baseURI` unchanged; the form probe (`requestSubmit()` on `<form action="data:text/plain,x">`) runs only from its own button "Run the form probe last (may leave the page)", after "Copy results" (Review Focus 3).
- **C6:** a worker from a `blob:` URL posts back; `new Worker("data:text/javascript,postMessage(1)")` records `blocked` on a throw, an error event or a violation.
- **C7:** `WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))` (the smallest valid module): expected `blocked` on `csp.html`, `allowed` on `csp-pro.html` and recorded either way; a `<script type="application/octet-stream" id="gz">` block holding base64 of gzip of the text `restlos feasibility` (the CLI makes it with `node:zlib`'s `gzipSync`), unpacked with `DecompressionStream("gzip")` through `new Blob([bytes]).stream()` and compared.
- **C8:** a `<script type="application/json" id="data">{"ok":true}</script>` read with `JSON.parse`.
- **K1, K2:** a `keydown` listener on `window` matching Ctrl or Meta plus `event.key.toLowerCase()` `"s"` / `"o"` (with `event.code` `"KeyS"` / `"KeyO"` as fallback) records receipt and calls `preventDefault()`; for Ctrl+O it also calls `click()` on a hidden `<input type="file">`; `observe("K1-dialog", "Did the browser's own save dialog appear?")`, `observe("K2-picker", "Did a file picker appear?")`, `observe("K2-browser-open", "Did the browser's own open dialog appear?")`.
- **K3:** the README tells the maintainer to repeat K1–K2 in Firefox with Page Info → Permissions → "Override Keyboard Shortcuts" → Block, and record the observations again under `K3-*` ids (the page offers the same three `observe` rows as `K3-dialog`, `K3-picker`, `K3-browser-open`).
- **K4:** `dragover` and `drop` on `document` call `preventDefault()`; a drop outside the drop zone records that the page caught it.
- **P1 (pages only):** `<link rel="manifest" href="manifest.webmanifest">` in `csp.html` is written by the build only into the pages variant (the source carries it in a `<!-- pages-only … -->` comment the CLI uncomments for that variant, or the CLI inserts it; your choice); the page registers `sw.js` and records `allowed`/`blocked`, and records whether the manifest caused a `manifest-src` violation. `sw.js` caches `index.html`, `manifest.webmanifest` and `pixel.png` on install and answers from the cache; the README step: load, stop the server, reload, `observe("P1-offline", "Did the page load with the server stopped?")`. The CLI writes `manifest.webmanifest` (`name`, `start_url: "."`, `display: "standalone"`, no icons).

- [ ] **Step 1: Write `feasibility/csp.html`, `feasibility/csp.js` and `feasibility/sw.js`.**
- [ ] **Step 2: Add the outputs to `PAGES`**, with the gzip block, the PNG and the manifest generated in the CLI.
- [ ] **Step 3: Smoke check** as in Task 2 on `dist/feasibility/csp.html` and `csp-pro.html`. Expected: C1 main script `pass`, the unhashed script and the attribute handler `blocked`; C7 compile differs between the two pages.
- [ ] **Step 4: Write README sections T2 and T2b:** the keyboard steps (press Ctrl+S, answer the observe rows, the same for Ctrl+O), K3 in Firefox, the drop for K4, the form probe last; for T2b `python3 -m http.server --directory dist/feasibility/pages 8000` and `http://localhost:8000/` in each browser.
- [ ] **Step 5: Verify:** `npm run check` passes.
- [ ] **Step 6: Commit** "Add the CSP and keyboard feasibility pages (T2, T2b)".

---

### Task 4: T3, the worker and the model handover

**Files:**
- Create: `scripts/feasibility-model.ts`, `tests/scripts/feasibility-model.test.ts`
- Create: `feasibility/worker.html`, `feasibility/worker-page.js`, `feasibility/worker-code.js`
- Modify: `scripts/feasibility.js` (`PAGES`), `feasibility/README.md` (section T3)

**Interfaces:**
- Consumes: `entriesPlan`, `fillToLimits`, `earlyEasterRangesOffWeekday` from `tests/engine/file/shapes.ts` (as `scripts/perf.js` does); `readFile` (`src/engine/file/read`), `planInput` (`src/engine/file/model`), `computePlan` (`src/engine/counting/plan`); `assemblePage` (variants `"standard"`, `"pro"`).
- Produces, in `scripts/feasibility-model.ts`: `largestModelJson(): string` → `JSON.stringify({ read, plan })`, where `read` is the `ReadResult` of the largest plan (`entriesPlan(fillToLimits(earlyEasterRangesOffWeekday))`) with `positions` as an array of `[path, offset]` pairs, and `plan` is `computePlan(planInput(file))`. Throws if the file is refused or not a plan.
- Produces: `dist/feasibility/worker.html` (standard), `dist/feasibility/worker-pro.html` (pro), each embedding the model as `<script type="application/json" id="model">` and the worker's code as `<script type="text/plain" id="worker-code">` (data blocks, not hashed).

- [ ] **Step 1: Write the failing test** in `tests/scripts/feasibility-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { largestModelJson } from "../../scripts/feasibility-model";

/** Paths to every Map or Set below `value` (JSON.stringify would write them as {}). */
function hiddenCollections(value: unknown, path = "$"): string[] {
  if (value instanceof Map || value instanceof Set) return [path];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => hiddenCollections(child, `${path}.${key}`));
}

describe("largestModelJson", () => {
  it("writes the read result with positions as pairs, and the computed plan", () => {
    const model = JSON.parse(largestModelJson()) as { read: { ok: boolean; positions: [string, number][] }; plan: { days: unknown[] } };
    expect(model.read.ok).toBe(true);
    expect(model.read.positions.length).toBeGreaterThan(70_000);
    expect(model.read.positions.every(([path, offset]) => typeof path === "string" && Number.isInteger(offset))).toBe(true);
    expect(model.plan.days.length).toBeGreaterThan(0);
  });
});
```

Add a second test that builds the same `{ read, plan }` object without stringifying (export a helper `largestModel()` that `largestModelJson` uses, returning the object with `positions` already converted) and asserts `hiddenCollections(largestModel())` is `[]` (Review Focus 5). Reading and computing the largest plan takes seconds: build the model once at the top of the `describe` and give both tests a 60 s timeout (`it(name, fn, 60_000)`).

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/scripts/feasibility-model.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/feasibility-model.ts`** (`largestModel()`, `largestModelJson()`).

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test -- tests/scripts/feasibility-model.test.ts`
Expected: PASS. Record the JSON's length in the task report (the design review measured about 13.2 MB, 73,867 positions, 485 day results).

- [ ] **Step 5: Write the pages.** Specifics the design leaves open:
  - **Setup (not measured):** the page encodes the embedded model text to UTF-8 and transfers it to the worker; the worker parses it, turns `positions` back into a `Map` and keeps the model.
  - **W1:** a classic worker and a module worker (`{ type: "module" }`) from a `blob:` URL of the `worker-code` block; time from `new Worker` to the first message. `worker-code.js` has no `import`/`export`, so it runs as both.
  - **W2:** the worker reports `eval`, `new Function`, `fetch` of a `blob:` URL it made, `importScripts` of a `blob:` URL (classic only) and `WebAssembly.compile` of the 8-byte module; expected blocked except the last on `worker-pro.html`.
  - **W3:** for (a)–(d), one warm-up and 10 measured runs, median and maximum. "Until usable" runs from the page's request to the end of the page-side decoding and parsing, in the page's clock. "Blocked" is the time spent in the page's `message` handler (including reading `event.data`, decoding and parsing) and, separately, the longest gap between ticks of a `MessageChannel` ping loop on the page during the handover. (b) posts the model as `JSON.stringify` text; (c) posts its UTF-8 bytes as a transferred `ArrayBuffer`; (d) posts an `Int32Array` of 8 values per day for the first 366 entries of `plan.days` (the day number, then the day's numbers the implementer picks from `DayResult`, padded with 0), transferred.
  - **W4:** the worker times `JSON.parse` of the model text; the page times `JSON.parse` of the embedded text.
  - The page records `navigator.hardwareConcurrency`, and `observeText("W-cpu", "CPU model (lscpu, 'Model name')")`.
  - A "Run" button starts W3 and W4, so the page stays usable while it loads.
- [ ] **Step 6: Add both outputs to `PAGES`**, with `largestModelJson()` as the generated `model.json`.
- [ ] **Step 7: Smoke check** as in Task 2 on `dist/feasibility/worker.html` (W1 and W2 rows only; W3 needs the button). Expected: the classic worker starts.
- [ ] **Step 8: Write README section T3:** open each page, wait for "ready", press Run, wait for the W3/W4 rows, fill in the CPU, copy.
- [ ] **Step 9: Verify:** `npm run check` passes.
- [ ] **Step 10: Commit** "Add the worker feasibility page (T3)".

---

### Task 5: T4, the two `.ics` files for Thunderbird

**Files:**
- Create: `scripts/feasibility-ics.ts`, `tests/scripts/feasibility-ics.test.ts`
- Modify: `scripts/feasibility.js` (writes `dist/feasibility/calendar/plan-v1.ics` and `plan-v2.ics`), `feasibility/README.md` (section T4)

**Interfaces:**
- Produces, in `scripts/feasibility-ics.ts`:
  - `PLAN_ID = "6f1c2b9e-4a7d-4e2b-9c3a-1d5e8f7a2b40"` (fictional)
  - `type IcsEvent = { kind: "leave" | "holiday"; date: string; take: "1" | "1/2"; part?: "start" | "end"; rule?: string; summary: string }`
  - `PLAN_V1: readonly IcsEvent[]`, `PLAN_V2: readonly IcsEvent[]`
  - `eventUid(planId: string, event: IcsEvent): string`: SHA-256 (`node:crypto`) of `JSON.stringify(["restlos-ics/feasibility", planId, kind, date, take, part ?? null, rule ?? null])`, its first 32 hex digits written as `8-4-4-4-12`. Everything the event says goes in, nothing about its position (design decision 5; the final form is issue 0010's). The `summary` is left out: it follows from the other fields and the UI language.
  - `planIcs(events: readonly IcsEvent[], dtstamp: string): string`: the calendar text.

The events (German titles, as for a German UI; 2027-05-06 is Ascension Day):

| Event | v1 | v2 |
| --- | --- | --- |
| holiday 2027-05-06 "Christi Himmelfahrt" (rule `ascension`) | yes | yes |
| leave 2027-05-07, full, "Urlaub" | yes | deleted |
| leave 2027-08-02, full | yes | ½ start, "Urlaub (½, vormittags)" |
| leave 2027-08-03 to 2027-08-05, full, one event per day | yes | yes |
| leave 2027-08-06, full | yes | moved to 2027-08-09 |
| leave 2027-10-29, full | no | added |
| leave 2027-12-23, ½ start, "Urlaub (½, vormittags)" | yes | yes |
| leave 2027-12-31, ½ end, "Urlaub (½, nachmittags)" | yes | yes |

The calendar: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//restlos//feasibility//DE`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `NAME:restlos-test`, `X-WR-CALNAME:restlos-test`. Each event: `UID`, `DTSTAMP` (v1 `20261024T120000Z`, v2 `20261101T120000Z`), `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` (the next day, exclusive), `SUMMARY`, then for leave `TRANSP:OPAQUE`, `X-MICROSOFT-CDO-BUSYSTATUS:OOF`, `X-RESTLOS-TAKE`, `X-RESTLOS-PART` (only for a part), `X-RESTLOS-TYPE:leave`; for the holiday `TRANSP:TRANSPARENT`, `X-RESTLOS-TYPE:holiday`. No `SEQUENCE` (an event never changes under its `UID`). Lines end with CRLF, including the last; no line is longer than 75 octets.

- [ ] **Step 1: Write the failing tests** in `tests/scripts/feasibility-ics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PLAN_ID, PLAN_V1, PLAN_V2, eventUid, planIcs } from "../../scripts/feasibility-ics";
import { utf8Length } from "../../src/engine/file/limits";

const uids = (text: string): string[] => [...text.matchAll(/^UID:(.+)\r$/gm)].map((m) => m[1] ?? "");
const v1 = planIcs(PLAN_V1, "20261024T120000Z");
const v2 = planIcs(PLAN_V2, "20261101T120000Z");

describe("the feasibility .ics files", () => {
  it("give every event its own opaque UID", () => {
    for (const text of [v1, v2]) {
      expect(new Set(uids(text)).size).toBe(uids(text).length);
      expect(uids(text).every((uid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid))).toBe(true);
    }
    expect(uids(v1)).toHaveLength(9);
    expect(uids(v2)).toHaveLength(9);
  });
  it("keep the UID of an unchanged event and change it for a changed one", () => {
    const shared = uids(v1).filter((uid) => uids(v2).includes(uid));
    expect(shared).toHaveLength(6); // the holiday, 08-03 to 08-05, 12-23, 12-31
    const full = PLAN_V1.find((e) => e.date === "2027-08-02");
    const half = PLAN_V2.find((e) => e.date === "2027-08-02");
    if (full === undefined || half === undefined) throw new Error("fixture lost 2027-08-02");
    expect(eventUid(PLAN_ID, full)).not.toBe(eventUid(PLAN_ID, half));
  });
  it("write valid calendar lines", () => {
    for (const text of [v1, v2]) {
      expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
      expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
      expect(text.split("\r\n").every((line) => utf8Length(line) <= 75)).toBe(true);
      expect(text).not.toMatch(/[^\r]\n/);
      expect(text).toContain("METHOD:PUBLISH\r\n");
      expect(text).not.toContain("SEQUENCE");
    }
    expect(v1).toContain("DTSTART;VALUE=DATE:20270507\r\nDTEND;VALUE=DATE:20270508\r\n");
    expect(v2).not.toContain("DTSTART;VALUE=DATE:20270507"); // the deleted day (the holiday's DTEND is 20270507)
    expect(v2).toContain("X-RESTLOS-TAKE:1/2\r\nX-RESTLOS-PART:start\r\n");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/scripts/feasibility-ics.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/feasibility-ics.ts`** (extend `tests/node-crypto.d.ts` only if a further function is needed).

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test -- tests/scripts/feasibility-ics.test.ts`
Expected: PASS

- [ ] **Step 5: Write both files from the CLI** and **README section T4:** create the throwaway calendar `restlos-test` in Nextcloud and let it appear in Thunderbird; I1–I4 exactly as the design's table; the table to fill in (`| Id | What happened |`) for pasting.
- [ ] **Step 6: Verify:** `npm run feasibility` writes both files; `npm run check` passes.
- [ ] **Step 7: Commit** "Add the calendar files for the Thunderbird feasibility test (T4)".

---

### Task 6: The two issues

**Files:**
- Create: `issues/0024-ux-proposals-for-the-ui-branch.md`
- Modify: `issues/0010-ical-import-and-export.md`

- [ ] **Step 1: Create issue 0024** from `issues/_template.md`: `status: open`, no priority (the maintainer sets it), `area: UI`, `created: 2026-10-24`. Problem: the research of 2026-10-24 found UX practice for single-file apps the spec doesn't have yet. Context: the design doc's section "UX proposals for the UI branch". Acceptance criteria: each of the nine proposals is decided (adopted into the spec, changed, or rejected). Notes: the nine proposals with their sources, copied from the design, and the sentence on what the spec already has.
- [ ] **Step 2: Add to issue 0010's Notes**, under a heading "Feasibility branch, 2026-10-24":
  - decision 5 of the design, as it stands (what goes into the hashed text, what follows, the accepted trade-off, WebCrypto in the export step, the random fallback and its message);
  - decision 6's workflows (CalDAV: separate calendar emptied and filled again; optional subscription to a share link, the link is public);
  - the `UID` review's findings 2–8 from the design;
  - the calendar research: Thunderbird refuses existing `UID`s and stops at the first one (`CalendarFileImporter.sys.mjs`, bug 325449); Nextcloud's web import refuses existing `UID`s, `supersede` approved 2026-10-22 (calendar PR #8483); Nextcloud subscriptions to a share link (`/download`), read-only, daily refresh by default, DAVx5 → ICSx5 on Android, Thunderbird by hand, private addresses blocked unless `webcalAllowLocalAccess`; Google updates by `UID` but doesn't remove deleted days, 1 MB import limit; classic Outlook duplicates on import, opens a file with `X-WR-CALNAME` as a new calendar; Outlook.com subscriptions every ~3 h; Apple doesn't update; iTIP only for mail invitations; RFC 5545/5546/7986 points (stable unique `UID` that identifies nothing, `METHOD:PUBLISH` without `ORGANIZER`/`ATTENDEE`, `NAME`/`X-WR-CALNAME`, `REFRESH-INTERVAL`); the only universal workflow, a separate calendar deleted and imported again. With the source links from the design.
  - Leave its acceptance criteria and status unchanged; a note that "Export" there must follow decision 5.
- [ ] **Step 3: Verify:** `reuse lint` passes.
- [ ] **Step 4: Commit** "Record the UX proposals and the iCal findings in issues 0024 and 0010".

---

### Round 1: your steps

- [ ] **Y1:** `npm run feasibility` in the dev shell.
- [ ] **Y2:** T1, T2, T3 in Firefox ESR, Firefox and Chromium as `feasibility/README.md` describes; T2b in each with `python3 -m http.server`. Copy each page's results into the chat (several pages per message is fine).
- [ ] **Y3:** T4 in Thunderbird and Nextcloud, I1–I4; paste the filled table.
- [ ] **Y4:** Anything that looked odd, in a sentence.
- [ ] **Y5:** The CPU model, if no page asked for it.

---

### Task 7: Results into the design, the concept into the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-feasibility-tests-design.md` (section Results)
- Modify: `docs/SPEC.md` (the sections in the design's "Spec sections touched")

- [ ] **Step 1: Fill in the design's Results** as the CI design did: per check id, one line per browser with the result and the browser version from the user agent, the date, and the CPU. A result that contradicts the research gets a sentence on what that means for the concept.
- [ ] **Step 2: Stop if a result breaks a decided part of the concept** (for example, no storage or no worker on `file://` in a tested browser, or I4 failing): tell the maintainer what fails and what the concept would do instead, and wait.
- [ ] **Step 3: Update `docs/SPEC.md`** with the design's "Concept for the spec", filling every "per Sx" with the result, section by section:
  - Delivery format: supported browsers (Safari and iOS from documentation, pointed to the Pages version), consequences of `file://` (storage per S1–S4, saving per S7–S8);
  - File operations: Restore becomes the crash recovery of decision 7; What is stored where: the recovery copy and the setting "Recovery copies: on / off", records with app version and schema;
  - Sharing and validation, Loading: the worker per W1–W4 and the decision rule, with the measured times;
  - Architecture: the worker started from a `blob:` URL, strings or ArrayBuffers across it; the feasibility table: the version 1 rows marked done with the date and a link to the design's Results, the untested platforms named;
  - Content Security Policy: placement, the final directive list per C1–C8 and P1, WebAssembly from bytes;
  - .ics export: the `UID` bullet becomes decision 5 (hash of the plan's `id` and everything the event says, WebCrypto, random fallback with its message; exact form in issue 0010);
  - Built-in help: the Privacy chapter mentions recovery copies; the keyboard shortcuts row for Ctrl+S / Ctrl+O per K1–K3.
- [ ] **Step 4: Verify:** `npm run check` passes.
- [ ] **Step 5: Commit** "Write the feasibility results into the spec".

---

### Task 8: Delete the test code

**Files:**
- Delete: `feasibility/` (all files), `scripts/feasibility.js`, `scripts/feasibility-pages.ts`, `scripts/feasibility-model.ts`, `scripts/feasibility-ics.ts`, `tests/scripts/feasibility-pages.test.ts`, `tests/scripts/feasibility-model.test.ts`, `tests/scripts/feasibility-ics.test.ts`, `tests/node-crypto.d.ts`
- Modify: `package.json` (remove the `feasibility` script), `docs/superpowers/specs/2026-10-24-feasibility-tests-design.md` (one line under Results: the pages were deleted in this commit and can be restored from the commit before it)

- [ ] **Step 1: Delete the files and the script.**
- [ ] **Step 2: Verify:** `git grep -n feasibility -- ':!docs' ':!issues'` prints nothing; `npm run check` passes.
- [ ] **Step 3: Commit** "Remove the feasibility test pages".
