<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Feasibility test pages

Temporary, hand-written browser pages that answer the version 1 feasibility questions of `docs/SPEC.md` (design: [`docs/superpowers/specs/2026-10-24-feasibility-tests-design.md`](../docs/superpowers/specs/2026-10-24-feasibility-tests-design.md)). The answers go into the spec; the pages are evidence only and are deleted at the end of the `feasibility` branch.

## Build

```sh
npm run feasibility
```

Empties and rebuilds `dist/feasibility/` and prints each written path. The builder (`scripts/feasibility-pages.ts`) inlines the scripts a page names in `data-inline`, computes their CSP hashes and inserts the policy as a meta tag.

## Run

Open a page from disk in each browser, with a fresh profile so no earlier setting changes the result. Use one new profile directory per browser, never the same one for two browsers (storage would carry over, and a newer Firefox would upgrade an ESR profile). Save each directory in its own variable, because some pages need the same profile again later; `echo` prints the paths so you can paste them literally in another terminal:

```sh
profile_esr=$(mktemp -d)
profile_ff=$(mktemp -d)
profile_chromium=$(mktemp -d)
echo "$profile_esr" "$profile_ff" "$profile_chromium"
firefox-esr --no-remote --profile "$profile_esr" <file>
firefox --no-remote --profile "$profile_ff" <file>
chromium --user-data-dir="$profile_chromium" <file>
```

Click "Copy results" on the page and paste the Markdown into the chat. The heading of each block names the page's path, query and hash, so several blocks can be told apart.

## T1 Storage and files (`storage/`)

`npm run feasibility` writes the same page three times: `dist/feasibility/storage/a/storage.html`, its sibling copy `storage/a/storage-copy.html` and `storage/b/storage.html` (same name, other folder). Per browser, start one test browser with its own fresh profile (`profile_esr`, `profile_ff` or `profile_chromium` from Run) and use that one running browser and profile for every step; open further files by pasting their `file://` path into its address bar. Each page writes a marker for its own path into localStorage and IndexedDB; the marker value names the load that wrote it (`load ""` for the plain path, `load "?query=1"`, `load "#hash"`). Keys all start with `feasibility:`.

**Click "Copy results" before every reload or navigation and before closing a tab**, and paste each block into the chat; a page's rows are gone after it reloads. Head each block with the browser name.

1. **S1, S2** (every browser).
   1. Open `a/storage.html` (plain). Copy.
   2. Click "with ?query" (a real load). Copy. The row to read is S3-found-localStorage / S3-found-indexedDB: its "own marker before this load" shows which load wrote the marker this load found (a `?query` load that finds `load ""` shares storage with the plain load).
   3. Click "plain" (a real load). Copy.
   4. From the plain page click "with #hash (new tab)". Copy that tab's rows, then close the tab.
   5. Open `a/storage-copy.html` and `b/storage.html` in new tabs. Copy each. Their S2-seen rows list every path that wrote a marker; their S3-found rows show whether they found a marker under their own path (they shouldn't).
   6. Close the other tabs, rename the original, open it, copy and put it back:

      ```sh
      mv dist/feasibility/storage/a/storage.html dist/feasibility/storage/a/storage-renamed.html
      ```

      open `a/storage-renamed.html`, copy its rows, then restore the name (`mv dist/feasibility/storage/a/storage-renamed.html dist/feasibility/storage/a/storage.html`) or run `npm run feasibility` again (it empties `dist/feasibility/`; the open browser keeps working).
2. **S4, S8** (every browser; reading and downloading in the same copy).
   - S4: click "Write 10 MB, then remove it" (rows S4-*), then "Request persistent storage" and answer S4-prompt.
   - S8: choose a file with the file input and drop a file on the drop zone (rows S8-input and S8-drop show name, size and the number of characters read). Click "Download" and type the name the file got into S8-name-default. In Firefox, repeat the download with "Always ask where to save files" set (Settings, General, Files and Applications) and type that name into S8-name-ask. Copy.
3. **S3 persistence.** Open `a/storage.html`, click "Write crash value", wait 1 s, then kill only the test browser by its profile directory, with the variable of that browser: `[ -n "$profile_esr" ] && pkill -9 -f -- "$profile_esr"` (or `$profile_ff`, `$profile_chromium`). The guard matters: with an empty variable `pkill -f` would match every process of yours; in another terminal paste the literal path printed by `echo` instead. Start it again with the same profile and open `a/storage.html`. If the browser restores the old tab (Firefox does, and a file given on the command line loads the page a second time), copy the tab opened last. Rows S3-found-* list the earlier marker, pagehide and crash values with their times. Repeat with 5 s of waiting. For the pagehide value, in one run close the tab normally and restart the browser (close it, start it again with the same profile). The pagehide values are written on the IndexedDB connection opened at load (row S3-db-open).
4. **S5 between tabs.** Open `a/storage.html` in tab 1 and again in tab 2. Click "Send BroadcastChannel ping" and "Write storage ping" in each tab. In tab 1 click "Hold lock"; in tab 2 click "Try lock" (row S5-lock-try-1) and "Query locks". Then "Release lock" in tab 1 and "Try lock" again in tab 2 (S5-lock-try-2). Copy both tabs. Repeat with tab 2 on `a/storage-copy.html`: open it in a new tab 3 instead of navigating tab 2, so tab 2's rows aren't lost, and copy tab 3.
5. **S7 (Chromium only).** In `a/storage.html` click showOpenFilePicker and pick a text file, click "Write back" (the file now contains `restlos feasibility <time>`) and answer S7-every-visit-write: was "Allow on every visit" offered? Click showSaveFilePicker and save a file. Copy, then reload. Click "Use kept handle", answer S7-every-visit-kept, click "Write back" (row S7-writeback-kept: the kept handle still writes after the reload) and copy. Open `a/storage-copy.html` in a new tab, click "Use kept handle" there, and pick a second file in the same way to see whether a permission granted to one local file applies to another. Drop a file on the drop zone (row S7-drop). In Firefox these rows say "not available".

## T2 CSP via meta and keyboard shortcuts (`csp.html`, `csp-pro.html`)

`npm run feasibility` writes `dist/feasibility/csp.html` (the standard policy) and `csp-pro.html` (the same page with `'wasm-unsafe-eval'`), plus `pixel.png` next to them (the image file for C4). Open each from disk in every browser (Run block, per-browser profile variable). The page runs C1 to C8 by itself and lists every `securitypolicyviolation` event in the row `violations`. Result words: `allowed`, `blocked` (the request failed and the directive reported a violation), `failed-other` (it failed without a violation: another reason, such as Firefox refusing `file://` requests). A font that fails to decode is expected in C4-font; only a `font-src` violation counts as blocked.

**Click "Copy results" before every reload, navigation or tab close**, and head each pasted block with the browser name and the page (`csp.html` or `csp-pro.html`).

1. **C1 to C8** (both pages, every browser). Open the page, wait about 5 s until the rows stop appearing, click "Copy results" and paste. C7-wasm-compile should differ between the two pages.
2. **K1, K2.** Press Ctrl+S: a row `K1-received-1` appears and the row `K1-dialog` asks whether the browser's own save dialog appeared; answer it. Press Ctrl+S again if you like (`K1-received-2`, ...; the question can be answered once per load). Then press Ctrl+O: `K2-received-1`, and the rows `K2-picker` and `K2-browser-open`; answer both. If a picker opened, cancel it or choose a file (rows `K2-cancel-N` or `K2-picked-N`). Copy. On macOS also try Cmd+S and Cmd+O.
3. **K3 (Firefox only).** In the same load, open Page Info (Ctrl+I), Permissions, set "Override Keyboard Shortcuts" to Block (untick "Use default"). Click "Start K3", then press Ctrl+S and Ctrl+O again, and answer `K3-dialog`, `K3-picker` and `K3-browser-open`. Rows `K3-received-ctrl-s-N` and `K3-received-ctrl-o-N` show what the page saw; no row after a key press means the page got no event. Copy.
4. **K4.** Drop a file from your file manager somewhere on the page outside the dashed zone, then once inside the zone. Rows `K4-drop-N` say where it landed; the page must stay. Copy.
5. **C5 form probe, last.** Click "Run the form probe last (may leave the page)", which sits below the results table. Do this only after the Copy of step 1; the page may navigate away and lose its rows. Copy again if the page is still there (row `C5-form`).

## T2b The Pages policy on `localhost` (`pages/`)

`npm run feasibility` writes `dist/feasibility/pages/` with `index.html` (the same page with the Pages policy: `worker-src 'self' blob:`, `manifest-src 'self'`, and a `<link rel="manifest">`), `manifest.webmanifest`, `sw.js` and `pixel.png`. Serve it from `localhost`:

```sh
python3 -m http.server --directory dist/feasibility/pages 8000
```

Open `http://localhost:8000/` in each browser with its profile variable from Run, and head each pasted block with the browser name and "localhost run".

1. **C1 to C8 and P1.** Wait about 5 s, then copy. P1 rows: `P1-context`, `P1-controller` (not controlled on the first load), `P1-service-worker` (registration), `P1-manifest` (violations of `manifest-src`, and whether the link element is present) and `P1-controller-after`. Answer `P1-offline` only on the load in step 3.
2. **Reload once** (the service worker has cached the page by then): copy; `P1-controller` should say `controlled`.
3. **Offline.** Stop the server (Ctrl+C in its terminal), reload the page in the browser, answer `P1-offline` with Yes or No, and copy. Start the server again for the next browser; unregister the worker or use a fresh profile per browser.
4. Do K1 to K4 and the C5 form probe as in T2 only if a difference to `file://` is of interest; they are not part of T2b.
