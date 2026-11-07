<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Feasibility tests of version 1

Before the UI was built, small test pages checked what browsers allow a single HTML file that is opened from disk (`file://`): storage, the Content Security Policy from `<meta>`, keyboard shortcuts, the policy of the Pages version and a Web Worker. `docs/SPEC.md` builds on these results in "Delivery format", "What is stored where", "Content Security Policy" and "Architecture, technology and tests". The test pages were used once and are not in the repository.

## How the tests ran

- On 2026-11-02, automated and headless: WebDriver BiDi for Firefox and the Chrome DevTools Protocol for Chromium drove the unchanged pages. They clicked the buttons, set the file input, killed the browser with `kill -9` and read the results tables. Ctrl+S and Ctrl+O (K1 and K2) were checked by hand in Firefox ESR.
- Browsers, each with a fresh profile: Firefox ESR 153.5.0esr from the dev shell, Firefox 159.0, and Chromium 147.0.7727.15 (Playwright's `chrome-headless-shell`, not a user's Chrome). "All three" below means these three.
- Machine: Intel Core i7-8650U (the spec's reference machine), 8 threads, NixOS, on mains power.
- Limits: every script call ran with user activation, Chromium's downloads ran under the DevTools download behaviour `allow`, and S3 had one trial per delay.
- A trap for anyone repeating this: Firefox's remote agent sets "recommended preferences", among them `security.fileuri.strict_origin_policy = false`, so every local file then shares one storage area. With `remote.prefs.recommended = false` in the profile, Firefox behaves like a user's Firefox: one storage area per file path, the same as a run without any automation. The results below come from such a run.

## Not tested

Taken from documentation instead: S7 (Chromium's file pickers need real dialogs), S8 with "Always ask where to save files", whether `persist()` shows a prompt, K3, K4, whether Chromium fetches the manifest, and the calendar re-import I1 to I4. Safari and iOS were not tested at all.

## Storage and files

| Id | Check | Result |
| --- | --- | --- |
| S1 | Origin, secure context, and which storage and crypto APIs exist | All three: `isSecureContext` true; `localStorage`, `indexedDB`, `navigator.storage`, `navigator.locks` and `crypto.subtle` present (a SHA-256 digest works). `self.origin` is `"null"` everywhere; `location.origin` is `"null"` in Firefox and `"file://"` in Chromium. A fallback for `.ics` `UID`s without `crypto.subtle` isn't needed in these browsers. |
| S2 | Which storage a page sees: the same file reloaded, with `?query` and `#hash`, a sibling copy, the same name in another folder, a copy under a new name | Firefox ESR and Firefox: storage per file path. A reload, `?query` and `#hash` keep it; the sibling copy, the same name in another folder and a copy under a new name (made with `cp`, so a true rename or move wasn't run) each start empty. Chromium: one storage area for every local file; each new path saw the markers of every path opened before it. |
| S3 | What survives a restart, closing the tab, and `kill -9` 1 s and 5 s after a write | IndexedDB kept the value after `kill -9` in all three. localStorage lost it in both Firefox versions at 1 s and 5 s; Chromium lost it at 1 s and kept it at 5 s. A normal restart kept both. A `pagehide` write was found after a navigation in both stores in Firefox, but in Chromium only in localStorage. After closing the tab it was found only in Chromium (the Firefox tabs were closed through BiDi, which may skip it). **Consequence:** the recovery copy and everything else that must survive go to IndexedDB, written after each change; `pagehide` is only an extra. |
| S4 | Whether 10 MB (the largest plan) fit; `estimate()`, `persisted()`, `persist()` | localStorage refuses 10 MB in all three (`QuotaExceededError`); IndexedDB stores and reads back 10 MB in all three. `estimate()`: quota 10 GiB (Firefox), 264 GiB (Chromium). `persisted()` is false everywhere; `persist()` answered false in Chromium and didn't settle in headless Firefox. **Consequence:** records live in IndexedDB. |
| S5 | The `storage` event, BroadcastChannel and Web Locks between two tabs of one file and between two files | Between two tabs of the same file, in all three: BroadcastChannel and the `storage` event arrive, a Web Lock held in one tab is refused to the other (`ifAvailable`), `locks.query()` shows it, and the other tab gets it after release. Between two different files: shared in Chromium, separate in Firefox, which matches S2: whatever shares storage also shares locks. **Consequence:** Web Locks mark a plan as in use; no fallback needed. |
| S7 | Chromium's File System Access API from `file://` | `showOpenFilePicker`, `showSaveFilePicker` and `DataTransferItem.getAsFileSystemHandle` exist. Using them (pickers, permissions, kept handles) was not tested. |
| S8 | Reading a file with `<input type="file">`; the name a Blob download keeps | All three: the input reads the file (UTF-8 text); the download keeps the name `Beispiel.rev3.urlaub.json` with the default download setting. Drag and drop and Firefox's "Always ask" were not tested. |

## Content Security Policy from `<meta>` and keyboard shortcuts

The standard page carried the app's policy from the spec as the first element after `<meta charset>`; the Pro page added `'wasm-unsafe-eval'`.

| Id | Check | Result |
| --- | --- | --- |
| C1, C2 | A hashed inline module script runs; an unhashed inline script and an `onclick` attribute don't; `eval` and `new Function` throw | As expected in all three, on both pages. The meta policy is enforced on `file://` in Firefox too. |
| C3 | `fetch` and `XMLHttpRequest` of the page's own file, a `blob:` URL and a `data:` URL | `blob:` and `data:` are blocked in all three. The page's own file: blocked in Chromium, **allowed in both Firefox versions without a violation** (`connect-src 'none'` doesn't cover a `file:` request to the page itself). |
| C4 | Images from `data:`, `blob:` and next to the page; a font from `data:`; `<style>` and `style` attributes | Images from `data:` and `blob:` show, a font from `data:` causes no `font-src` violation, and styles apply, in all three. The image file next to the page: blocked in Chromium, **allowed in Firefox** (as C3). **Consequence:** images are embedded (`data:` or `blob:`), so the app works the same in both. |
| C5 | `<object>`, `<embed>`, `<base href>` and a form submit | Blocked or ignored in all three. |
| C6 | Workers from `blob:` and `data:` URLs | A `blob:` worker starts, a `data:` worker is blocked, in all three. |
| C7 | Compiling WebAssembly; `DecompressionStream("gzip")` on an embedded block | WebAssembly is blocked on the standard page and allowed on the Pro page, in all three; `DecompressionStream` unpacks the block everywhere. |
| C8 | Reading a `type="application/json"` data block without a hash | Works in all three. |
| K1 | Ctrl+S: the page takes it over | Firefox ESR, by hand: no "Save page" dialog appeared. |
| K2 | Ctrl+O, and `input.click()` from the key handler | Firefox ESR, by hand: no dialog at all, neither Firefox's Open dialog nor the page's file picker. **Consequence:** Ctrl+O can be taken over but can't open the file picker; it opens the app's own Open dialog, whose button opens the picker. |
| K3, K4 | Firefox's "Override Keyboard Shortcuts" set to Block; a file dropped outside a drop zone | Not tested. |
| P1 | The Pages policy (`worker-src 'self' blob:`, `manifest-src 'self'`) served from `http://127.0.0.1` | All three: a secure context; C1 to C8 as on `file://`, except that the page's own file and the image file are now blocked in Firefox too. The service worker registers without a violation, controls the page after a reload, and the page loads again with the server stopped. The manifest link causes no violation; that the manifest is fetched wasn't seen. |

## Web Worker from `file://`

The page embedded the model of the largest plan within the file limits: about 13.2 MB as JSON (73,867 positions, 485 day results).

| Id | Check | Result |
| --- | --- | --- |
| W1 | A classic and a module worker from a `blob:` URL; the time to the first message | A classic worker starts in all three, 5 to 13 ms to the first message. A module worker starts in both Firefox versions and **not in Chromium** (an error event without a message). **Consequence:** a classic worker. |
| W2 | Inside the worker: `eval`, `new Function`, `fetch` and `importScripts` of a `blob:` URL, WebAssembly | All blocked in all three, except WebAssembly under the Pro policy. |
| W3 | Handing the whole model to the page, median of 10: (a) structured clone, (b) JSON text, (c) UTF-8 bytes in a transferred buffer, (d) only what one year shows; the page's longest block | Firefox ESR: (a) 120 to 152 ms, (b) 72 to 85 ms, (c) 107 to 118 ms. Firefox 159: (a) 110 to 128 ms, (b) 69 to 75 ms, (c) 103 to 110 ms. Chromium: (a) 128 to 129 ms, (b) 81 to 82 ms, (c) 89 to 90 ms. Until the whole model is usable: 158 to 325 ms. Only one year (d): 0.3 to 2 ms in all three. Single handovers reached 250 ms in the ESR. **Decision** (maintainer, 2026-11-02): the model stays in the worker, and the page gets only what it shows. Only (b) stays under 100 ms in the ESR, and only in its median, on the reference machine. |
| W4 | `JSON.parse` of the 13.2 MB text in the worker and on the page | 83 to 103 ms in the worker, 77 to 97 ms on the page, in all three. |

## Calendar re-import

| Id | Check | Result |
| --- | --- | --- |
| I1 to I4 | Importing an `.ics` into a Nextcloud calendar through Thunderbird, importing it again with the same `UID`s, importing a changed version, and importing after deleting all events (which go to Nextcloud's trash bin) | Not tested. The spec relies on documentation: Thunderbird refuses existing `UID`s and stops at the first one. The help therefore says to delete the calendar and import into a new one, not to empty it, since the trash bin case is unchecked. |
