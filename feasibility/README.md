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

Open a page from disk in each browser, with a fresh profile so no earlier setting changes the result:

```sh
firefox-esr --no-remote --profile "$(mktemp -d)" <file>
firefox --no-remote --profile "$(mktemp -d)" <file>
chromium --user-data-dir="$(mktemp -d)" <file>
```

Click "Copy results" on the page and paste the Markdown into the chat.

## T1 Storage and files (`storage/`)

`npm run feasibility` writes the same page three times: `dist/feasibility/storage/a/storage.html`, its sibling copy `storage/a/storage-copy.html` and `storage/b/storage.html` (same name, other folder). Use a fresh profile per browser (see Run) and the same profile for every step of one browser. Each page writes a marker for its own path into localStorage and IndexedDB and lists the markers it sees (rows S2-*). Keys all start with `feasibility:`.

Copy the results of every page you opened ("Copy results") and paste them together, headed by the browser name.

1. **S1, S2, S4, S8** (every browser). Open `a/storage.html`: S1 rows show the environment. Click the "with ?query" link, then "with #hash", then reload. Open `a/storage-copy.html` and `b/storage.html` (same profile), then reload `a/storage.html` again and copy its rows. Rename the original and open it:

   ```sh
   mv dist/feasibility/storage/a/storage.html dist/feasibility/storage/a/storage-renamed.html
   ```

   Open `a/storage-renamed.html` and copy its rows. S4: click "Write 10 MB, then remove it" (rows S4-*), answer S4-prompt after "Request persistent storage". S8: choose a file with the file input, drop a file on the drop zone, click "Download" and type the name the file got into S8-name. Do the download twice in Firefox: with the default setting and with "Always ask where to save files".
2. **S3 persistence.** Open `a/storage.html`, click "Write crash value", wait 1 s, then kill the browser: `pkill -9 -f firefox-esr` (Firefox current: `pkill -9 -f firefox`, Chromium: `pkill -9 -f chromium`). Start the browser again with the same profile directory and open `a/storage.html`: rows S3-found-* list the earlier marker, crash value and pagehide value with their times. Repeat with 5 s of waiting. For the pagehide value, close the tab normally first (and restart the browser) in one run.
3. **S5 between tabs.** Open `a/storage.html` in tab 1 and again in tab 2: S5-broadcast and S5-storage in tab 1 list what tab 2 did. Click "Send BroadcastChannel ping" and "Write storage ping" in each tab and compare. In tab 1 click "Hold lock"; in tab 2 click "Try lock" and "Query locks" (then "Release lock" in tab 1 and "Try lock" again). Repeat with tab 2 on `a/storage-copy.html` (two different files). Copy both tabs' rows.
4. **S7 (Chromium only).** In `a/storage.html` click showOpenFilePicker and pick a text file, answer S7-every-visit if the permission prompt had that option, click "Write back" (the file now contains `restlos feasibility <time>`), click showSaveFilePicker and save a file. Reload and click "Use kept handle" (rows S7-kept-on-load, S7-kept-use). Open `a/storage-copy.html` and click "Use kept handle" there too, and pick a second file there to see if the permission applies to it. Drop a file on the drop zone (S7-drop). In Firefox these rows say "not available".
