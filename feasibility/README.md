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

Open a page from disk in each browser, with a fresh profile so no earlier setting changes the result. Save the profile directory in a variable, because some pages need the same profile again later:

```sh
profile=$(mktemp -d)
firefox-esr --no-remote --profile "$profile" <file>
firefox --no-remote --profile "$profile" <file>
chromium --user-data-dir="$profile" <file>
```

Click "Copy results" on the page and paste the Markdown into the chat. The heading of each block names the page's path, query and hash, so several blocks can be told apart.

## T1 Storage and files (`storage/`)

`npm run feasibility` writes the same page three times: `dist/feasibility/storage/a/storage.html`, its sibling copy `storage/a/storage-copy.html` and `storage/b/storage.html` (same name, other folder). Per browser, start one test browser with a fresh profile (`profile=$(mktemp -d)`, then the command from Run) and use that one running browser and profile for every step; open further files by pasting their `file://` path into its address bar. Each page writes a marker for its own path into localStorage and IndexedDB; the marker value names the load that wrote it (`load ""` for the plain path, `load "?query=1"`, `load "#hash"`). Keys all start with `feasibility:`.

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
3. **S3 persistence.** Open `a/storage.html`, click "Write crash value", wait 1 s, then kill only the test browser by its profile directory: `pkill -9 -f -- "$profile"`. Start it again with the same profile and open `a/storage.html`. If the browser restores the old tab (Firefox does, and a file given on the command line loads the page a second time), copy the tab opened last. Rows S3-found-* list the earlier marker, pagehide and crash values with their times. Repeat with 5 s of waiting. For the pagehide value, in one run close the tab normally and restart the browser (close it, start it again with the same profile). The pagehide values are written on the IndexedDB connection opened at load (row S3-db-open).
4. **S5 between tabs.** Open `a/storage.html` in tab 1 and again in tab 2. Click "Send BroadcastChannel ping" and "Write storage ping" in each tab. In tab 1 click "Hold lock"; in tab 2 click "Try lock" (row S5-lock-try-1) and "Query locks". Then "Release lock" in tab 1 and "Try lock" again in tab 2 (S5-lock-try-2). Copy both tabs. Repeat with tab 2 on `a/storage-copy.html`: open it in a new tab 3 instead of navigating tab 2, so tab 2's rows aren't lost, and copy tab 3.
5. **S7 (Chromium only).** In `a/storage.html` click showOpenFilePicker and pick a text file, click "Write back" (the file now contains `restlos feasibility <time>`) and answer S7-every-visit-write: was "Allow on every visit" offered? Click showSaveFilePicker and save a file. Copy, then reload. Click "Use kept handle", answer S7-every-visit-kept, click "Write back" (row S7-writeback-kept: the kept handle still writes after the reload) and copy. Open `a/storage-copy.html` in a new tab, click "Use kept handle" there, and pick a second file in the same way to see whether a permission granted to one local file applies to another. Drop a file on the drop zone (row S7-drop). In Firefox these rows say "not available".
