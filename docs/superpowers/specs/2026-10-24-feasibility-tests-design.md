<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: version 1 feasibility tests

As of: 2026-10-24. Branch: `feasibility`. Implements the version 1 rows of the spec's table "Feasibility tests before implementation" (`docs/SPEC.md`, Architecture, technology and tests), in the order the maintainer set on 2026-10-18 (after `ci`, before the UI branch).

## Intent

The UI branch must not guess how browsers treat a single HTML file opened from disk. This branch answers the spec's four version 1 questions in the browsers and the calendar the maintainer has, and writes the answers into `docs/SPEC.md` as a concept the UI branch can build from. The concept is as user-friendly as possible: the friendliest behaviour wherever it works, and a calm fallback, chosen at runtime, wherever it doesn't. Nothing in it depends on behaviour nobody checked.

Research came first (five reports, 24 October 2026, summarized under "Research"), so the tests confirm documented behaviour instead of discovering it, and they focus on what the documentation leaves open.

## Decisions (maintainer, 2026-10-24)

1. **The outcome is the spec, not the pages.** `docs/SPEC.md` is updated with a concept for the UI branch; the test pages are the evidence.
2. **As user-friendly as possible** (see Intent).
3. **What gets tested:** Firefox (the current ESR 153 from the dev shell, and the current release) and Chromium. For calendars, only Thunderbird, in the maintainer's setup: a Nextcloud calendar (CalDAV) used through Thunderbird and on Android. Safari, Google Calendar, Outlook and Apple Calendar come from documentation only and are marked "not tested" in the spec.
4. **Updating restlos:** users may replace the HTML file under the same name or keep a new copy next to the old one under a new name. The concept supports both.
5. **The `.ics` `UID` is a one-way hash of the plan's random `id` and everything the exported event says**, not the contract ID with the date as the spec says today. Colleagues who use the same rule set share the contract ID, so their leave on the same day would collide in a shared calendar, and RFC 7986 asks for `UID`s that identify nothing.
   - **What goes in:** the plan's `id`, what the event is (own leave, mandatory leave, a holiday exported along, a source's entry), the source or rule it comes from (by `id`), its date or dates or repeat rule, its share and part, and later option B's times. Never an element's position in the file, which shifts when an earlier entry is added.
   - **What follows:** only an exact copy gives the same `UID`, and an exact copy says nothing new, so the export writes it once. An edit the event doesn't show (a source's colour, a note) keeps the `UID`; any edit it shows (full ↔ half day, another part, a moved day) gives a new one; "Save as" (a new `id`) gives all new ones. An event never changes under its `UID`. The `UID` looks random and shows no date.
   - **The trade-off, accepted:** apps that update events by `UID` (Google's re-import, Nextcloud's coming "replace" import) show a changed day twice, old and new, instead of updating it. The workflows the help recommends (empty and import, subscription) aren't affected.
   - **The hash is the browser's built-in WebCrypto** (`crypto.subtle.digest`, SHA-256; Node has it for the tests), called in the export step, which is asynchronous anyway; the engine supplies only the text to hash. No hash or crypto code of the project's own. The hash isn't a security feature: it only makes the `UID` opaque and repeatable.
   - **Fallback without WebCrypto** (it needs a secure context; S1 checks it on `file://`): random `UID`s for that export, from `crypto.getRandomValues`, which works without one. The export dialog then says why and what it means for the user, for example: "This browser doesn't offer the function restlos uses to give calendar events fixed IDs, so this export gets new ones. If you import it into a calendar that still holds an earlier export, every event appears twice: empty the calendar first, or subscribe to the file." (Wording through the catalogs in the UI branch.)
   - The exact form (encoding of the hashed text, UUID layout) is issue 0010's, with the review's findings below.
6. **The export's design and the help's calendar workflows belong to issue 0010**, not to this branch. The research on them goes into 0010's notes, including the maintainer's choice of workflows for CalDAV calendars such as Nextcloud: (1) a separate calendar for restlos, emptied and filled again after a change, and (2), as an option, subscribing to the exported file through a share link of a synced Nextcloud folder, with the caveat that the link is public.
7. **Crash recovery like LibreOffice.** A recovery copy is kept while a plan has unsaved changes. At the next start after an unclean end, a restore page offers to restore it. The app's own "Don't save" is a clean end and deletes the copy. Closing the tab with unsaved changes is an unclean end, because the page can't tell the browser's "Leave page" apart from a crash. The restore page has the option not to keep recovery copies any more, and the same switch is in the device settings. There is no info bar while working.
8. **The UX proposals from the research go into an issue for the UI branch**, not into the spec: they are proposals the maintainer hasn't seen in detail.
9. **The test pages don't stay in the repository.** Like the CI branch's experiment workflow, they are committed on this branch while the maintainer runs them and deleted in the branch's last commit; Git history keeps them, and the results stay in this document.
10. **Only what a version 1 question asks, or what the concept relies on, gets tested.** Installing the Pages version and its file association, non-Latin keyboard layouts, private windows, and the export's event layout (one event per day or per stretch, all-day or timed half days) are not tested here.

## Calls made in this design (designer's calls, for the maintainer to check)

- **Hand-written test pages, no new packages**, no Vite, no Svelte, no Playwright. A small Node script assembles the pages, computes the CSP hashes and generates the test data, so a hash can't be wrong by hand.
- **Each page shows its own results** and has a "Copy results" button. The maintainer pastes them into the chat; the results go into this document's Results section and into the spec.
- **The restore page uses a checkbox**, "Don't keep recovery copies anymore (you can change this in the settings)", because restoring this time and keeping copies in future are separate decisions. Ticking it stops writing copies, since a copy that is never offered would only sit in storage. In Chromium, where other local files can read browser storage, one line under the checkbox says so.
- **The Pages variant's policy is checked on `localhost`** (P1): it adds `'self'` sources for the service worker and the manifest that `file://` can't show.
- **The plan's name on the restore page** is the name of the file the plan was opened from or last saved as, without `.revN` and the extension; a plan never saved uses the "Save as" suggestion (`ContractName_Year`). A plan file has no name of its own, and this needs no change to the file format.
- **The worker decision rule** (W3): if receiving the whole model blocks the page for more than 100 ms (the usual budget for responding to an input) in the Firefox ESR on the maintainer's machine, the model stays in the worker and the page gets only what it shows. The maintainer judges the numbers with the spec update.
- **A kept file handle is used only for the recovery copy**: in Chromium, a restored plan can be saved back into its original file after the browser's permission prompt. There's no list of recent files (the spec excludes it). If S7 shows that a permission granted to one local file applies to every local file, no handle is kept on `file://`, and Save after a restore asks where to save.
- **The UX proposals' issue** is created on this branch (decision 8), from the list under "UX proposals for the UI branch".

## Research (2026-10-24)

Five research reports read browser and calendar source code, bug trackers, specs and vendor documentation. Nothing was run. What they found, and what is still open, per test:

**Storage from `file://`**

- Firefox: since version 68 every local file is its own origin (`self.origin` is `"null"`), and storage is kept per full file path. Renaming or moving the file starts with empty storage; replacing it under the same name keeps it. Before Firefox 92, localStorage was kept per directory. Likely (source code and user reports).
- Chromium: all local files share one storage area. It survives renaming, but every HTML file opened from disk can read and overwrite it. MDN claims the opposite. Likely (source code).
- Safari: storage for local files is probably blocked unless the Develop menu's "Disable Local File Restrictions" is set; iOS probably doesn't run a local HTML file at all. Safari also deletes a website's storage after seven days of use without visiting it, which affects the Pages version.
- Chromium's File System Access API should work from `file://` (a file origin is not opaque, and `file:` is a secure context), including keeping a file handle in IndexedDB; not documented. Firefox and Safari have no access to real files; they download.
- BroadcastChannel is per file path in Firefox and probably shared by all local files in Chromium.
- Open: everything above in a real browser; Web Locks on `file://` (Firefox's opaque origin may refuse them); whether a 10 MB plan fits; whether writes survive a crash.

**CSP via `<meta>`**

- A meta policy is valid only in `<head>` and only for what comes after it, so it goes right after `<meta charset>`. Meta policies ignore `report-uri`, `frame-ancestors` and `sandbox`; `base-uri` and `form-action` work. Support: meta delivery Firefox 45, `worker-src` 58, `'wasm-unsafe-eval'` 102. Confirmed.
- A hash covers the script's text exactly, after the parser has turned CRLF into LF. Inline module scripts need only the hash, no `'strict-dynamic'`. Data blocks (`type="application/json"`, `application/octet-stream`) are never checked against `script-src`. Confirmed.
- Open: whether a meta policy is enforced on `file://` in Firefox at all (documented only for Chromium, through Electron).

**Workers**

- A worker created from a `blob:` URL inherits the page's policy (CSP 3; Firefox bug 1490165). `worker-src blob:` allows creating it; inside, the page's rules apply (no `eval`, `connect-src 'none'` blocks `fetch`, WebAssembly needs `'wasm-unsafe-eval'` in the page's policy). `data:` workers get an opaque origin and are blocked by this policy. Vite's inline-worker wrapper falls back to a `data:` URL, which this CSP blocks, so the UI branch needs its own `blob:` wrapper. Confirmed.
- Safari (WebKit bug 258443): a blob worker from `file://` starts but can't read Blobs; pass ArrayBuffers or strings.
- Handover: no benchmark exists for a 10 MB object graph. The published numbers (surma.dev 2019, Chrome 2011, a Chrome 139 benchmark) suggest it is noticeably slow, so the likely concept keeps the model in the worker and sends the page only what it shows. Open: the actual times.

**Keyboard shortcuts**

- Ctrl+S and Ctrl+O are not reserved in Chromium or Firefox, so a page can take them over. In Firefox the user can block that per site (Page Info, "Override Keyboard Shortcuts") or everywhere (`permissions.default.shortcuts`), so visible buttons stay necessary. A page that doesn't take over Ctrl+O or a dropped file is navigated away, and unsaved changes are lost. Match `event.key`, falling back to `event.code` for non-Latin layouts. Safari: unclear.
- Open: whether opening the file picker from the key handler works (user activation), and Firefox with the permission set to Block.

**Calendar re-import of the same `UID`**

- Thunderbird never updates an existing event on import: the import refuses an existing `UID`, and according to its code (`CalendarFileImporter.sys.mjs`) it stops at the first refused event. `SEQUENCE` makes no difference; bug 325449 has been open since 2006.
- Nextcloud's web import refuses existing `UID`s and adds only new ones; a "replace existing events" option was approved on 2026-10-22 but isn't released.
- Google probably updates events by `UID` on re-import, but doesn't remove deleted days. Classic Outlook's import into an existing calendar duplicates; Outlook opens a file with `X-WR-CALNAME` or several events as a new calendar. Apple doesn't update.
- The only workflow that works in every app: a separate calendar, deleted and imported again after a change.
- The full calendar research (Nextcloud subscriptions, DAVx5 and ICSx5, iTIP, RFC 5545/5546/7986, what the export should write) goes into issue 0010's notes (decision 6).

Main sources: [Mozilla bug 1500453](https://bugzilla.mozilla.org/show_bug.cgi?id=1500453), [Firefox `ContentPrincipal.cpp`](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/caps/ContentPrincipal.cpp), [Chromium storage_util.cc](https://chromium.googlesource.com/chromium/src/+/ef290da170d481d1ef1c9ca4e11d156cfaf09afe/content/renderer/storage_util.cc), [WebKit r197858](https://trac.webkit.org/r197858), [HTML: CSP pragma](https://html.spec.whatwg.org/multipage/semantics.html), [CSP 3](https://www.w3.org/TR/CSP3/), [MDN: Using web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [WebKit bug 258443](https://bugs.webkit.org/show_bug.cgi?id=258443), [surma.dev: Is postMessage slow?](https://surma.dev/things/is-postmessage-slow/), [Chromium `browser_command_controller.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/browser_command_controller.cc), [Mozilla bug 1203059](https://bugzilla.mozilla.org/show_bug.cgi?id=1203059), [Mozilla bug 325449](https://bugzilla.mozilla.org/show_bug.cgi?id=325449), [Nextcloud calendar #1508](https://github.com/nextcloud/calendar/issues/1508), [Microsoft MS-STANOICAL](https://learn.microsoft.com/en-us/openspecs/exchange_standards/ms-stanoical/2637212b-2ddc-4706-8202-c796fb3f748b), [Google Calendar import](https://support.google.com/calendar/answer/37118), [RFC 7986](https://www.rfc-editor.org/rfc/rfc7986).

## The tests

Every check has an id, so results and the spec can refer to it. "Each browser" means Firefox ESR 153 (dev shell), the current Firefox and Chromium, each with a fresh profile.

### T1 Storage and files from `file://` (`storage.html`)

The build writes the same page several times, so the maintainer only opens files and doesn't have to copy any: `storage/a/storage.html`, a sibling copy `storage/a/storage-copy.html` (a new version saved next to the old one), and `storage/b/storage.html` (the same name in another folder). Each page writes a marker under its own path into localStorage and IndexedDB and lists every marker it can see.

| Id | Check, in each browser |
| --- | --- |
| S1 | `location.origin`, `self.origin`, `isSecureContext`, and whether `localStorage`, `indexedDB`, `navigator.storage`, `navigator.locks` and `crypto.subtle` exist or throw (`crypto.subtle` decides the `UID` fallback of decision 5) |
| S2 | Which markers each page sees: the same file reloaded; with `?query` and `#hash`; the sibling copy; the same name in another folder; the original after renaming it (the README gives the command) |
| S3 | The marker survives a browser restart; a value written on `pagehide` survives closing the tab; a value written 1 s and 5 s before the browser is killed (`kill -9`) survives the restart |
| S4 | A 10 MB string (the size of the largest plan) fits into localStorage and into IndexedDB, or which error comes; `navigator.storage.estimate()`, `persisted()`, and `persist()` with whether a prompt appears |
| S5 | Between two tabs of the same file and between two different files (original and sibling copy): the `storage` event, BroadcastChannel, and Web Locks (does a lock held in one tab block the other; does `navigator.locks.query()` show it) |
| S7 | Chromium only: `showOpenFilePicker` and `showSaveFilePicker` from `file://`; writing back into the opened file; the handle kept in IndexedDB still works after a reload (`queryPermission`, `requestPermission`, whether "Allow on every visit" is offered, and whether a permission granted to one local file applies to another); `getAsFileSystemHandle` on a dropped file |
| S8 | `<input type="file">` and drag and drop read a file; a Blob download keeps the suggested name `Beispiel.rev3.urlaub.json`, with Firefox's default download setting and with "Always ask where to save files" |

(S6, private windows, was dropped by decision 10.)

What it decides: where settings, recovery copies and the revision record live, and what the start screen does with empty storage (S1–S4); how a tab tells a crash from a plan open in another tab (S5); Save in Chromium and the download fallback (S7, S8).

### T2 CSP via `<meta>` and keyboard shortcuts (`csp.html`, `csp-pro.html`)

`csp.html` carries the standard HTML's policy from the spec, as the first element after `<meta charset>`. `csp-pro.html` is the same page with `'wasm-unsafe-eval'` added. Every probe reports allowed or blocked, and a `securitypolicyviolation` listener lists each violation with its directive, so an unexpected block is visible.

| Id | Check, in each browser |
| --- | --- |
| C1 | The hashed inline module script runs; an inline script without a hash and an inline event handler attribute don't |
| C2 | `eval` and `new Function` throw |
| C3 | `fetch` and `XMLHttpRequest` of the page's own file, a `blob:` URL and a `data:` URL fail |
| C4 | Images from `data:` and `blob:` show, an image file next to the page doesn't; a font from `data:` loads; `<style>` and `style` attributes apply |
| C5 | `<object>` and `<embed>` are blocked; a `<base href>` is ignored; submitting a form is blocked |
| C6 | A worker from a `blob:` URL starts; one from a `data:` URL is blocked |
| C7 | Compiling a tiny WebAssembly module fails on `csp.html` and works on `csp-pro.html`; `DecompressionStream("gzip")` unpacks a gzip data block embedded as `type="application/octet-stream"` (the Pro HTML's plan for Typst) |
| C8 | A `type="application/json"` data block without a hash can be read |
| K1 | Ctrl+S: the page receives it, `preventDefault()` stops the browser's "Save page" |
| K2 | Ctrl+O: the same; and calling `input.click()` from the key handler opens the file picker, or doesn't |
| K3 | Firefox only: K1 and K2 again with "Override Keyboard Shortcuts" set to Block for the page (Page Info → Permissions): what the user and the page see |
| K4 | A file dropped anywhere on the page, outside a drop zone, doesn't navigate away |

What it decides: the final policy list for the standard and Pro HTML, and how the app takes over Save and Open and guards against navigating away.

### T2b The Pages policy on `localhost` (`pages/`)

| Id | Check, in each browser |
| --- | --- |
| P1 | The same probes as C1–C8 with the Pages policy (`worker-src 'self' blob:`, `manifest-src 'self'`), served from `localhost` (a secure context like GitHub Pages; `python3 -m http.server` from the dev shell): the manifest loads without a violation, the service worker registers, and the page reloads with the server stopped |

### T3 Worker from `file://` (`worker.html`, `worker-pro.html`)

The page embeds, as a JSON data block, the model of the largest plan within the limits: the file from `npm run perf -- --largest-file`, read by the engine's `readFile` in Node, plus what the counting model computes for it (as in the `readAndCompute` perf scenario). `positions` is written as an entries array and turned back into a `Map` in the worker. The worker's code is a data block too, started from a `blob:` URL as the UI branch would. The model is about 13.2 MB as JSON (73,867 positions, 485 day results; measured by the design review).

| Id | Check, in each browser |
| --- | --- |
| W1 | A classic worker from a `blob:` URL starts from `file://` under the policy; a module worker too, or not; the time from `new Worker` to its first message |
| W2 | Inside the worker: `eval`, `fetch` and `importScripts` of a `blob:` URL are blocked; WebAssembly fails in `worker.html` and works in `worker-pro.html` |
| W3 | Four ways to hand the model over, median of 10 runs after a warm-up: (a) the object posted as is (structured clone); (b) posted as JSON text, parsed on the page; (c) posted as UTF-8 bytes in a transferred ArrayBuffer, decoded and parsed on the page; (d) only what one year of the calendar shows, as a transferred `Int32Array`. For each, two times: until the model is usable on the page, and how long the page itself was blocked (the time in the message handler, including decoding and parsing, and the longest gap between timer ticks on the page during the handover, since Firefox has no Long Tasks API) |
| W4 | For comparison: `JSON.parse` of the embedded text in the worker, and on the page (how long the page would freeze without a worker) |

The page shows the CPU's thread count (`navigator.hardwareConcurrency`) and the README asks for the CPU model, since the spec's reference machine is an Intel Core i7-8650U. What it decides: whether opening runs in a worker as the spec says, and whether the page gets the whole model or only what it shows (the decision rule is under "Calls made in this design").

### T4 Calendar re-import in Thunderbird (`calendar/`)

The spec's question: how does a calendar treat an `.ics` imported again with the same `UID`s? The build writes two files of a small fictional plan: `plan-v1.ics`, and `plan-v2.ics`, exported later from the same plan, with one day moved, one full day turned into a half day, one day deleted and one added. Both use `UID`s formed as in decision 5, so unchanged days keep theirs. Restlos has no iCal code yet (issue 0010), so the build script writes these files. The maintainer works in a throwaway calendar `restlos-test` in Nextcloud, used through Thunderbird.

| Id | Step | Record |
| --- | --- | --- |
| I1 | Import `plan-v1.ics` into the empty calendar | all events arrive |
| I2 | Import `plan-v1.ics` again | the message; whether anything is duplicated; whether the import stops at the first existing event |
| I3 | Import `plan-v2.ics` into the same calendar | what changed, what was refused, what was added, whether the deleted day stayed |
| I4 | Delete all events of the calendar in Thunderbird (they go to Nextcloud's trash bin), then import `plan-v2.ics` | the calendar matches v2, including the days whose `UID`s are in the trash bin |

What it decides: the spec's calendar row (Thunderbird tested, Google, Outlook and Apple from documentation) and the input issue 0010 takes for its workflows. I4 checks the review's finding 2 in the maintainer's setup; if it fails, the help says "delete the calendar, not its events".

## How the tests run

1. `npm run feasibility` builds every page into `dist/feasibility/` (ignored by Git): it inlines the scripts, puts the policy right after `<meta charset>`, computes the SHA-256 hashes over the LF-normalized script text, writes the storage copies, the worker's model and the two `.ics` files.
2. `feasibility/README.md` lists, per test, how to start each browser with a fresh profile (`firefox-esr` from the dev shell, the current Firefox, Chromium), the steps, and what to paste back.
3. Each page shows a results table (check id, result, details) and a "Copy results" button that copies it as Markdown, headed by the page, the browser's user agent and the date. For T4, the README has the table to fill in.
4. The maintainer pastes the results into the chat. They go into the Results section of this document, and the concept into the spec.
5. The branch's last commit deletes `feasibility/`, `scripts/feasibility.js` and the `feasibility` npm script (decision 9).

## Concept for the spec

What the spec says after this branch. The parts below are decided; the Results fill in the measured details marked "per Sx".

**Storage**

- The plan file is the only real record; browser storage is a cache. The app works fully when storage is empty, missing or throws, and checks everything it reads back like an imported file (size limits, schema, values).
- Empty storage is normal, not an error: a fresh copy of restlos under a new name, another browser, Safari, a private window. The start screen offers "Open plan file" and "Import device settings (`.einstellungen.json`)", which also brings the settings into a renamed copy.
- Every stored record carries the app version and the schema that wrote it. An older copy of restlos never overwrites a record a newer one wrote (in Chromium, all local copies share storage).
- Where records live, localStorage or IndexedDB, per S4.

**Crash recovery** (decision 7)

- While a plan has unsaved changes, a recovery copy is written after each change and when the page is hidden. It holds the plan file's content, the revision it is based on, the time and the app version. Saving and the app's "Don't save" delete it.
- Each open tab marks its plan as in use, per S5 (Web Locks, or a fallback that works there).
- At start, if there are recovery copies of plans not in use, a restore page lists them: the plan's name (see "Calls made in this design"), the time of the last change, the revision it is based on, and a warning when a newer revision was saved since (from the revision record). Restore or Discard, a checkbox "Don't keep recovery copies anymore (you can change this in the settings)", and in Chromium from `file://` one line: "In Chrome and Edge, other HTML files you open from your computer can read these copies."
- A restored plan is open with unsaved changes and is saved as usual; in Chromium, back into its original file if the kept handle allows it (per S7). Opening a file whose recovery copy is newer still offers the restore, as a second chance.
- The device settings have "Recovery copies: on / off", with the same sentence about Chromium. Off: no copies, no restore page; the browser's warning when closing a tab with unsaved changes stays.
- How several copies are restored at once (one tab per file) is left to the UI branch.

**Safari**

From documentation only: Safari probably keeps no storage for local files, and iOS probably doesn't run a local HTML file. The help points Safari users, and every iPhone user, to the Pages version, and mentions that Safari deletes a website's storage after seven days without a visit. The app still works without storage there.

**CSP**

The meta policy is the first element after `<meta charset>`. The final directive list, and whether it is enforced on `file://` in each browser, per C1–C8 and P1. WebAssembly is compiled from bytes (`WebAssembly.instantiate`), never fetched, since `connect-src 'none'` applies inside the worker too.

**Worker**

Opening runs in a worker started from a `blob:` URL (not Vite's `data:` fallback), per W1–W2. Whether the page receives the whole model or only what it shows, per W3–W4, stated with the measured times. Data to and from a worker are strings or ArrayBuffers, never Blobs (WebKit bug 258443).

**Save, Open and shortcuts**

Ctrl+S and Ctrl+O are taken over where the browser lets the page (per K1–K3); the buttons stay, because Firefox users can block it. A dropped file never navigates away (K4). Save in Chromium per S7; elsewhere a download with the suggested name per S8.

**Calendar**

The feasibility row records what I1–I3 show for Thunderbird and what the research found for Google, Outlook and Apple. The `.ics` export's `UID` bullet changes to decision 5 (the exact form is issue 0010's). The rest of the export and the help's workflows are issue 0010's (decision 6).

**Spec sections touched:** Delivery format (supported browsers, consequences of `file://`), File operations (Restore), What is stored where, Sharing and validation (Loading), Architecture (Worker), the feasibility table (version 1 rows marked done with the date, untested platforms named), Content Security Policy, .ics export (`UID`), Built-in help (Privacy: recovery copies), the keyboard shortcuts table.

## Components

| File | Responsibility |
| --- | --- |
| `feasibility/README.md` | How to build and run each test, browser start commands, steps, what to paste back (CC-BY-4.0); deleted at the end |
| `feasibility/*.html`, `feasibility/*.js` | The pages' sources: one HTML skeleton per page plus its script(s), shared helpers for the results table and "Copy results" (EUPL-1.2); deleted at the end |
| `scripts/feasibility.js` | Assembles the pages into `dist/feasibility/`: inlines scripts, inserts the policy, computes hashes; writes the storage copies, the worker's model (through the engine) and the two `.ics` files; deleted at the end |
| `package.json` | `"feasibility"` script; removed at the end |
| `docs/SPEC.md` | The concept, after the results |
| `issues/0010-ical-import-and-export.md` | Notes: the calendar research, decision 5 with the `UID` review's findings, decision 6's workflows |
| `issues/0024-…` | The UX proposals from the research, each with its source (decision 8) |
| this document | Results |

## Non-goals

- UI code, Svelte, Vite or any new package; automating the pages with Playwright.
- The iCal parser and exporter, the export's event layout and the help's calendar workflows (issue 0010); this branch only writes two fixture files.
- Safari, Google Calendar, Outlook, Apple Calendar, macOS (Cmd), Windows (path spellings), iOS: documentation only.
- Installing the Pages version and its file association, non-Latin keyboard layouts, private windows (decision 10).
- The Pro HTML's Typst WASM (version 2 feasibility test); C7 only checks the policy and `DecompressionStream`.
- Deciding the UX proposals (decision 8).

## Anti-goals

- A concept that relies on behaviour nobody tested, without a fallback chosen at runtime.
- A fallback that loses data silently.
- Test pages that need the network, or a server other than `localhost` for T2b.

## Left to the builder

The pages' layout and wording; how the scripts are split and named; the marker key format; the number of warm-up runs; the exact fictional plan for T4 (within the description above); whether the build script's hash function gets a unit test (a wrong hash shows up anyway as a C1 failure); how the README phrases the steps.

## UX proposals for the UI branch

From the research on single-file and local-file web apps (TiddlyWiki, Feather Wiki, Excalidraw, draw.io, Photopea, Google's `browser-fs-access`, local-first software). Issue 0024 lists them, with their sources, for the maintainer to decide in the UI branch; none of them is in the concept above unless marked.

1. First start: say plainly that the plan lives in a file and the browser keeps only a recovery copy that "can be cleared unexpectedly"; make the first save part of creating a plan. ([Excalidraw's texts](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json), [TiddlyWiki: Getting started](https://tiddlywiki.com/static/GettingStarted.html))
2. Show the unsaved state all the time, with "Last saved 14:32 as Name.rev3.urlaub.json"; clicking it saves. ([TiddlyWiki forum: avoiding frustration for newbies](https://talk.tiddlywiki.org/t/avoiding-frustration-for-newbies/5830), [draw.io: URL parameters](https://www.drawio.com/doc/faq/supported-url-parameters))
3. Register `beforeunload` only while there are unsaved changes and don't rely on it; write the recovery copy when the page is hidden (`visibilitychange`). Partly in the recovery concept. ([MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event))
4. The restore page says "not yet saved to a file" and has "Save as file" next to Restore. Partly in the recovery concept. ([Photopea: opening old files](https://www.photopea.com/tuts/photopea-opens-up-old-files/), [draw.io: open a diagram file](https://www.drawio.com/doc/faq/open-diagram-file))
5. After each download, say where the file went and how to turn on Firefox's "Always ask where to save files". ([TiddlyWiki: HTML5 saver](https://tiddlywiki.com/static/Saving%2520with%2520the%2520HTML5%2520saver.html))
6. Ask for read and write permission together when opening in Chromium, and only inside a click, so Save doesn't prompt again. The research also suggests offering "Save as" only in Chromium; that conflicts with the spec, where "Save as" also gives the file a new `id`, so it stays in every browser. ([Chrome: browser-fs-access](https://developer.chrome.com/docs/capabilities/browser-fs-access), [Chrome: persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api))
7. Suggest exporting the device settings before updating restlos. ([MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage))
8. Show the version and the build date in the app; after some months, a gentle note that a newer version may exist, with the address as text. The interval has no source. ([CyberChef](https://cc.flab.cesnet.cz/))
9. Treat the installed web app's file association as an extra on top of the Open button, and don't claim plain `.json`; whether operating systems match the compound extensions `.urlaub.json` and `.regeln.json` is unverified, so check it once the Pages version exists. ([Chrome: File Handling](https://developer.chrome.com/docs/capabilities/web-apis/file-handling))

Already in the spec, confirmed by the research: the warning before opening over unsaved changes, the revision warning, and taking over Ctrl+S.

## Review of the `UID` concept

Requested by the maintainer, 2026-10-24. The review looked at a first version of decision 5, which hashed only an element's identity (its source and date). The concept holds; the maintainer's answer to finding 1 and 6 is in decision 5 as it stands now, and the rest goes into issue 0010's notes for the iCal branch:

1. **A source's entries can collide.** The format allows several entries of one source on the same date (`examples/plans/muster-ag-2028.urlaub.json` has two on 2027-12-24), and two repeating entries can share a `match` with different validity. Two events with one `UID` in a file make Thunderbird stop the import and Nextcloud merge or refuse them. The review proposed numbering ties; the maintainer chose to hash everything the event says instead (decision 5), so only exact copies collide and the export writes them once. The exporter still checks that every `UID` in a file is unique, with a property test over random plans.
2. **Deleted events may block the same `UID`s.** Nextcloud keeps deleted events in a trash bin, and Google reportedly skips re-imported `UID`s it deleted before. The calendar research found that Nextcloud handles a deleted and re-imported event; Google is documentation only. I4 checks it; if it fails, the help says "delete the calendar, not its events".
3. **The plan's `id` isn't always unique.** A plan file copied in the file manager, or handed to a colleague and saved, keeps its `id`, so two people's leave can share `UID`s in a team calendar. Mitigation: the help says to share rule sets, not plan files (as the spec already does); the bundled examples are saved under a new `id`.
4. **Consecutive plans overlap.** Plan 2027 (January 2027 to January 2028) and plan 2028 both contain the closure around New Year. Fix: a plan's export writes only what this plan charges, never the days of a "Leave from another plan" source, as the counting model does.
5. **The key must be encoded unambiguously and never change.** IDs may contain any character, so fields are joined as a JSON array with a version tag, a `match` gets a fixed form for the key, and test vectors pin the result.
6. **The engine is synchronous, WebCrypto isn't, and WebCrypto needs a secure context.** The review proposed a small SHA-1 of the project's own; the maintainer ruled out any crypto code of the project's own. Decision 5 calls WebCrypto in the export step instead, with random `UID`s as the fallback, which S1 decides.
7. **A repeating entry is written in one form only** (`RRULE` or dates), or its `UID`s change between exports. (The review's point about a rising `SEQUENCE` no longer applies: an event never changes under its `UID`.)
8. **What goes into the hashed text still needs a fixed list per kind of event:** a holiday exported along (its rule's `id` and the date), a stretch exported as one event (its dates), a source exported on its own (its own scope, so it can't match the same days in a plan's export), option B's time blocks.

Fine as designed: several events on one day, since their kind and content differ; colleagues' plans with their own random `id`s; rule `id`s, which "Update rules from rule set" keeps; "Save as", where subscriptions and the empty-and-import workflow come out right and only a re-import over the old events duplicates them (a help note); privacy, since a `UID` reveals nothing the event's date doesn't.

## Results (2026-11-02)

**How the tests ran.** The manual round (about three hours) was too much for the maintainer, so on 2026-11-02 the maintainer decided: the pages run headless and automated, T4 is dropped, and the maintainer checks only what needs a person's eyes (K1 and K2 in the Firefox ESR). This replaces the non-goal "automating the pages". A throwaway driver in the session's scratch directory, with no package, drove the unchanged pages: WebDriver BiDi over Node's built-in WebSocket for Firefox, the Chrome DevTools Protocol for Chromium. It clicked the buttons, set the file input, killed the browser with `kill -9` and read the results tables. Browsers: Firefox ESR 153.5.0esr (dev shell), Firefox 159.0, Chromium 147.0.7727.15 (Playwright's `chrome-headless-shell`), each with a fresh profile. Machine: Intel Core i7-8650U (the spec's reference machine), 8 threads, NixOS, mains power.

**A trap, for anyone repeating this:** Firefox's remote agent sets "recommended preferences", among them `security.fileuri.strict_origin_policy = false`, so in a first run every local file shared one storage area. With `remote.prefs.recommended = false` in the profile, Firefox behaved like a user's Firefox: one storage area per file path, the same as a run without any automation (`firefox --headless --screenshot`; `storage/default/` then holds one directory per file path). Only the second run's Firefox results are used below.

**Not tested** (from documentation, as the concept says): S7 (Chromium's file pickers need real dialogs), S8 with "Always ask where to save files", whether `persist()` shows a prompt, K3, K4, whether Chromium fetches the manifest, and all of T4 (Thunderbird and Nextcloud).

| Id | Result |
| --- | --- |
| S1 | All three: `isSecureContext` true; `localStorage`, `indexedDB`, `navigator.storage`, `navigator.locks` and `crypto.subtle` present (a SHA-256 digest works). `self.origin` is `"null"` everywhere; `location.origin` is `"null"` in Firefox and `"file://"` in Chromium. The random `UID` fallback of decision 5 isn't needed in these browsers. |
| S2 | Firefox ESR and Firefox: storage per file path. A reload, `?query` and `#hash` keep it; the sibling copy, the same name in another folder and the renamed original each start empty. Chromium: one storage area for every local file; each page saw the markers of all four paths. As the research said. |
| S3 | After `kill -9`, 1 s and 5 s after the write: IndexedDB kept the value in all three browsers. localStorage lost it in both Firefox versions at 1 s and 5 s; Chromium lost it at 1 s and kept it at 5 s. A normal restart kept both. A `pagehide` write was found after a navigation in all three, and after closing the tab only in Chromium (the Firefox tabs were closed through BiDi, which may skip it). **For the concept:** the recovery copy and everything else that must survive go to IndexedDB, written after each change; `pagehide` is only an extra. |
| S4 | 10 MB: localStorage refuses it in all three (`QuotaExceededError`); IndexedDB stores and reads back 10 MB in all three. `estimate()`: quota 10 GiB (Firefox), 264 GiB (Chromium). `persisted()` false everywhere; `persist()` answered false in Chromium and didn't settle in headless Firefox. **For the concept:** records live in IndexedDB. |
| S5 | Between two tabs of the same file, in all three: BroadcastChannel and the `storage` event arrive, a Web Lock held in one tab is refused to the other (`ifAvailable`), `locks.query()` shows it, and the other tab gets it after release. Between two different files: shared in Chromium (the lock blocked the sibling copy), separate in Firefox, which matches S2: whatever shares storage also shares locks. **For the concept:** Web Locks mark a plan as in use; no fallback needed. |
| S7 | Not tested. |
| S8 | All three: `<input type="file">` reads the file (UTF-8 text, 15 characters); the Blob download keeps the name `Beispiel.rev3.urlaub.json` with the default download setting. Drag and drop and Firefox's "always ask" not tested. |
| C1–C2 | All three, both pages: the hashed inline module script runs; an inline script without a hash and an `onclick` attribute are blocked; `eval` and `new Function` throw. The meta policy is enforced on `file://` in Firefox too, which the research had left open. |
| C3 | `blob:` and `data:` fetches and XHRs are blocked in all three. Fetching the page's own file: blocked in Chromium, **allowed in both Firefox versions without a violation** (`connect-src 'none'` doesn't cover a `file:` request to the page itself). |
| C4 | Images from `data:` and `blob:` show, a font from `data:` loads, `<style>` and `style` attributes apply, in all three. The image file next to the page: blocked in Chromium, **allowed in Firefox** (as C3). **For the concept:** images are embedded (`data:` or `blob:`), so the app works the same in both; Firefox's gap for `file:` is noted in the spec. |
| C5 | `<object>`, `<embed>` and the form submit are blocked, `<base href>` is ignored, in all three. |
| C6 | A `blob:` worker starts, a `data:` worker is blocked, in all three. |
| C7 | WebAssembly compile blocked on `csp.html` and allowed on `csp-pro.html`, in all three; `DecompressionStream("gzip")` unpacks the embedded block everywhere. |
| C8 | The JSON data block is read in all three. |
| K1 | Firefox ESR, by the maintainer: after Ctrl+S, no "Save page" dialog appeared. The page can take Ctrl+S over. |
| K2 | Firefox ESR, by the maintainer: after Ctrl+O, no dialog at all: neither Firefox's Open dialog nor the page's file picker from `input.click()` in the key handler. **For the concept:** Ctrl+O can be taken over, but can't open the file picker; it opens the app's own Open dialog, whose button opens the picker. |
| K3, K4 | Not tested. |
| P1 | All three, on `http://127.0.0.1`: a secure context; C1–C8 as on `file://`, except that the page's own file and the image file are now blocked in Firefox too (no `'self'` in `connect-src` and `img-src`); the service worker registers without a violation, controls the page after a reload, and the page loads again with the server stopped. The manifest link causes no `manifest-src` violation; that the manifest is fetched wasn't seen (Firefox desktop doesn't fetch it, and headless Chromium didn't either). |
| W1 | A classic worker from a `blob:` URL starts in all three, 5–13 ms to the first message. A module worker from a `blob:` URL starts in both Firefox versions and **not in Chromium** (an error event without a message; the research expected the cross-origin redirect refusal). **For the concept:** a classic worker. |
| W2 | Inside the worker, in all three: `eval`, `new Function`, `fetch` of a `blob:` URL and `importScripts` of a `blob:` URL are blocked; WebAssembly is blocked under `worker.html` and allowed under `worker-pro.html`. |
| W3 | The page's longest block per handover of the whole model (13.2 MB), median of 10: Firefox ESR (`worker.html` and `worker-pro.html`) (a) structured clone 120–152 ms, (b) JSON text 72–85 ms, (c) UTF-8 bytes 107–118 ms; Firefox 159 (`worker.html`) (a) 110 ms, (b) 69 ms, (c) 110 ms; Chromium (a) 128–129 ms, (b) 81–82 ms, (c) 89–90 ms. Until the whole model is usable: 158–325 ms. Only what one year shows (d): 0.3–2 ms in all three. Single handovers reached 250 ms in the ESR. **For the concept** (the maintainer's decision of 2026-11-02, by the rule under "Calls made in this design"): the model stays in the worker, and the page gets only what it shows. Only (b) stays under 100 ms in the ESR, and only in its median, on the reference machine. |
| W4 | `JSON.parse` of the 13.2 MB text, median: 83–103 ms in the worker, 77–97 ms on the page, in all three. |
| I1–I4 | Not tested (T4 dropped on 2026-11-02). The spec relies on the research: Thunderbird refuses existing `UID`s and stops at the first one. The help therefore says to delete the calendar and import into a new one, not to empty it, since I4 (`UID`s in Nextcloud's trash bin) is unchecked. |
