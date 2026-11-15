<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# restlos-urlaubsplaner – Specification (single-file HTML)

As of: 2026-11-14

## Goals and scope

Status: not a requirement; moves to docs/dev/en/explanation/ in phase 3.

A personal vacation planner as a single HTML file that runs offline: calculate public holidays, plan leave with a click, see the allowance live, export the plan as PDF and .ics. A plan file holds everything for one person's planning period, including a copy of the rules; rules can be shared as a rule set per company or collective agreement; the next year is created as a new file based on the old one.

**Must in version 1 (standard HTML)**

- One HTML file (everything inline), offline, no installation.
- German and English, properly internationalized.
- Country-neutral rule core including a country-specific work week; holiday data initially for Germany with regional special cases.
- Several iCal imports at the same time, each with its own name, type and color; also for showing days already taken from the previous year.
- Days with fractions (e.g. New Year's Eve = ½); a plan has exactly one allowance, without automatic carry-over.
- Two calendar views (month tiles, month columns), fluid from phone to widescreen.
- Light/dark mode, three built-in color schemes and a simple editor (one color per role).
- Plan file with rules, calendar sources, colors, own templates and one plan; rule set file with the same content without a plan, for colleagues; exportable device settings.
- Export .ics, `.typ` for PDF and browser print view; help with example template and example data for own templates.

**Must in version 2 (Pro HTML):** embedded Typst, PDF with one click, test compilation of loaded own templates with error message. No template editor.

**Non-goals**

- No team/approval workflow, no accounts, no server, no synchronization.
- No hour accounts, no automatic carry-over of remaining leave.
- No lunar or other non-Gregorian calendars in the rule core; such holidays come via iCal.
- No template editor in the app; templates are created with Typst outside the app.
- No desktop wrapper (.exe, Tauri, Electron); reasoning under "Delivery format".
- No comparison of several contracts in one view; other people's leave days (e.g. a partner's) come as a calendar source.
- No formal requirements management and no load-time targets; the size budgets and the release checklist apply.
- No legal advice: the user maps collective-agreement or company rules via day rules.

**License:** code and rule data under **EUPL-1.2** (copyleft for the whole work, unlike MPL-2.0's file-level copyleft, also when provided over a network). The EUPL compatibility clause (Art. 5) allows derivative works combined with code under a listed compatible license (e.g. GPL, LGPL, MPL-2.0) to be distributed under that license. No conflict with what is needed:

| Component | License | Relation to the EUPL |
| --- | --- | --- |
| Typst / typst.ts (Pro HTML) | Apache-2.0 | permissive, may be included in an EUPL work; pass on NOTICE |
| Svelte 5 | MIT | permissive, unproblematic |
| intl-messageformat | BSD-3-Clause | permissive, unproblematic; pass on the copyright notice |
| Lucide icons | ISC (icons derived from Feather: MIT) | permissive |
| Embedded fonts | SIL OFL | separate works, bundling allowed; include license text |
| ical.js (iCal import at runtime) | MPL-2.0 | file-level copyleft: ical.js stays MPL-2.0 inside the larger EUPL work (MPL-2.0 §3.3); the About page says where to get its source code |
| date-holidays data, python-holidays | CC BY-SA / MIT | tests only, not shipped |

Other licenses only where necessary: built-in PDF templates, example template and example data under **MIT-0** (own templates may be derived freely), help and documentation under **CC BY 4.0**. License information in the repository follows REUSE (see Project operations). The "About / Licenses" page names the source repository (the minified HTML is the executable form), contains the NOTICE and license texts of all components and says where to get the source code of MPL-2.0 components (ical.js). No legal advice; have it checked once before the first publication if doubts remain.

**Target group:** employees (initially in Germany) who plan their annual leave including bridge days and pass the plan on to their calendar, partner or boss.

## Delivery format

Status: partly implemented; the downloadable HTML file is built, the GitHub Pages version (the landing page, the app with manifest and service worker, the documentation website and their layout), saving, browser storage (IndexedDB), the message for a missing browser feature, the help's pointers for Safari and iPhone users, the embedded font and opening the user's own files (issue 0030 (open real files in the UI: rule sets and the read report) is open) are not, planned for version 1; WASM with the Pro HTML, planned for version 2.

| Variant | Size | Role |
| --- | --- | --- |
| Standard HTML for download (`file://`) | target under 600 KB | **main path on the computer** |
| Pro HTML for download | measure in feasibility test | version 2 |
| GitHub Pages with web app manifest and service worker | same as standard or Pro | **path for the phone** and quick start without download; usable offline after the first visit; installable as an app in Chrome/Edge on desktop with file association for `.urlaub.json` and `.regeln.json` |

**Pages layout:** a landing page at `/<repo>/` with no service worker; the app at `/<repo>/app/`, with its service worker and manifest scoped there; the documentation at `/<repo>/docs/de/`, `/docs/en/` and `/docs/dev/` (see Build and CI, "Documentation website").

**Supported browsers:** if a feature is missing, the app shows a clear message instead of a broken UI. The `file://` behaviour below was tested on 2026-11-02 in Firefox ESR 153, Firefox 159 and Chromium 147 (Playwright's headless build; Chrome and Edge are assumed to behave the same) unless it says otherwise ([results](feasibility.md)). Safari was not tested. According to its documentation, Safari probably keeps no storage for local files, and iOS probably doesn't run a local HTML file at all. The help therefore points Safari users, and every iPhone user, to the Pages version, and mentions that Safari deletes a website's storage after seven days without a visit. The app still works without storage there.

**Consequences of `file://` for the design**

- No `fetch()` on local files: fonts and WASM are embedded inline. The user's files only come in via the file picker or drag and drop.
- Saving: in Chrome/Edge the app writes directly back into the opened file via the File System Access API (on `file://` Chromium offers `showOpenFilePicker`, `showSaveFilePicker` and `getAsFileSystemHandle`; using them needs real dialogs and wasn't tested); Firefox and Safari don't have this interface ([web.dev](https://web.dev/articles/files/save-a-file)), there the file is downloaded, with the name of the opened file and the new revision as suggestion (see File operations). For Firefox, the help explains the setting "Always ask you where to save files": a save dialog then appears in which the original file can be overwritten, instead of collecting copies like "(1)" in the download folder. On the phone via download or the share menu.
- **Browser storage is a cache; the plan file is the only real record.** The app works fully when storage is empty, missing or throws, and checks everything it reads back like an imported file (size limits, schema, values).
- **Where storage is kept:** Firefox keeps one storage area per file path. A reload keeps it, and so do `?query` and `#hash`; a copy under a new name or the same name in another folder starts empty, and so does, according to the research, a renamed or moved file, while replacing the file under the same name keeps it (from the research, not tested). Chromium (Chrome, Edge) has one storage area for every HTML file opened from disk. It survives renaming, and every local HTML file can read and overwrite it. The GitHub Pages version has its own, stable storage (its own origin), separate from the downloaded file.
- **Empty storage is normal, not an error:** a fresh copy of restlos under a new name, another browser, Safari, a private window (not tested). The start screen then offers "Open plan file" and "Import device settings (`.einstellungen.json`)", which also brings the settings into a renamed copy.
- **IndexedDB, not localStorage:** localStorage refuses 10 MB in every tested browser, and after the browser was killed it lost values written 5 s earlier (Firefox) or 1 s earlier (Chromium). IndexedDB kept 10 MB, and kept both values written 1 s and 5 s before the kill (one trial each, `kill -9` of the browser, not a power loss). All records live in one IndexedDB database `urlaubsplaner` (object stores per record type). Every record carries the app version and the schema that wrote it. An older copy of restlos never overwrites a record that a newer one wrote, because in Chromium all local copies share storage.
- No network access at runtime; the service worker of the Pages version only loads the app's own files.

## Holiday sources and work week

Status: moved to `docs/dev/en/explanation/holiday-sources.md`.

### Rule types of the core

Status: moved to `docs/dev/en/reference/holiday-rules.md`.

### Work week per country

Status: planned for version 1.

- In the UI, the contract takes over the standard work week as a suggestion, and the work week is changeable.
- The week start in the UI is changeable.

### Region tree and German special cases

Status: planned for version 1.

After choosing the federal state, only its local rules appear, phrased as "applies at my **place of work**" (the place of work is decisive, not the place of residence; have it legally proofread before publication), with an explanatory text and a link to the official source.

### Multiple calendar sources (iCal)

Status: planned for version 1.

| Setting | Values |
| --- | --- |
| Priority | order via up/down buttons |

| Type | Effect on cost |
| --- | --- |
| Leave from another plan | The source can also be an .ics file. |

The same day with the same name from several sources or the built-in set is shown once and marked as a duplicate.

**Import (once):** choose file → preview of all recognized events with a checkbox per entry and a list **"not supported / skipped"** → set name, type, color → apply. Only the chosen events are stored, as entries; the `.ics` file is not kept. Import, update, editing and export are issue 0010 (iCal import and export of calendar sources).

- The user chooses the meaning, as easily as possible: the preview groups events by name (twelve "Schulferien" events or a repeating "Elternabend" are one decision) and offers every type, including Time off needed. Nothing is guessed silently; events that don't fit (e.g. 10:00–14:00, or shorter than `minUnit`) are the user's decision.
- Defaults without working hours: all-day events become full days; an event that ends by 12:00 suggests "½ start", one that starts at 12:00 or later "½ end"; one that spans noon gets no suggestion.
- Supported: all-day `VEVENT` (`DTSTART;VALUE=DATE`, `DTEND` exclusive, missing `DTEND` = 1 day), multi-day events, `DURATION`.
- Timed events are assigned to their calendar day in a time zone used only during the import: the browser's by default, changeable in the import dialog, never stored.
- Repeats: simple ones (weekly on weekdays, yearly on a date, with an end) become a `match`; anything else (exceptions, complex rules) is expanded to dates for a period chosen at import, and the preview says so. iCal exceptions (`EXDATE`) become `except` dates of the entry.

**Update source** imports again. Its preview shows the differences with checkboxes, marks entries the user changed and doesn't preselect those for replacement. For a source from another `.urlaub.json` it reports when the newer file has a different `id` or a lower `revision`, and when that plan itself contains an older copy of the current plan ("plan 2028 contains an older copy of this plan; update it there").

**Editing and export:** entries can be removed, added (by clicking days) and changed (share, part of the day); a source can be renamed, change its type and be created without any file. Every source can be exported as `.ics`, so the user doesn't maintain it in several programs: a `match` becomes a repeating event where iCal can express it, otherwise dates for a chosen period.

The help names sources, in this order:

1. **Kultusministerkonferenz (KMK, Standing Conference of the Ministers of Education):** official `.ics` file per federal state for the current school year ([KMK holiday calendar](https://www.kmk.org/service/ferienregelung/ferienkalender.html)).
2. **OpenHolidays API:** school holidays per federal state from 2020, also available as iCal ([openholidaysapi.org](https://www.openholidaysapi.org/en/)); the license of the data is not stated on the site.
3. Private offerings like schulferien.org: convenient, but without guarantee for the origin of the data.

The app doesn't download these files itself; the user imports the saved file.

### Reference models for tests

Status: moved to `docs/dev/en/reference/test-strategy.md`.

## Counting model (weights)

Status: moved to `docs/dev/en/explanation/counting-choices.md`.

### The one formula

Status: moved to `docs/dev/en/reference/counting-model.md`.

### Finer granularity: prepared, offered only in the leave bar

Status: planned for version 1.

The template interface must be built so that planning down to **1/32 day** works everywhere without data migration and without changing the calculation logic. Anyone working on the code must observe this:

| Area | Requirement from version 1 |
| --- | --- |
| Display | the central formatting function for shares shows a decimal number instead of mixed fractions, depending on the setting |
| .ics | Partial days as all-day events with share and part in the title, plus the machine-readable fields `X-RESTLOS-TAKE`, `X-RESTLOS-PART` and `X-RESTLOS-TYPE`; no working hours, no appointments with times. |
| Templates | The data interface delivers shares as a number and as a fraction string; built-in templates must not contain fixed "half" assumptions. |

What is still missing later is also UI: a calendar key and range actions for finer steps, and the `minUnit` setting in the contract dialog (issue 0048, a calendar key for finer leave steps, and the smallest leave unit in the contract dialog).

### How a day's required work comes about

Status: planned for version 1.

Dismissing a time-off need for one day adds the date to the entry's exceptions.

### Work week with validity

Status: planned for version 1.

The help explains the two common counting methods for part-time ("day off has required work 0, allowance reduced" vs. "required work ½") and that partial entitlements can be rounded according to § 5 BUrlG (Federal Leave Act); the user enters the allowance themselves.

### Date arithmetic

Status: moved to `docs/dev/en/reference/architecture.md`.

## Files: plan file, rule set and settings

Status: planned for version 1.

| File | Kind | Content | Typical use |
| --- | --- | --- | --- |
| `restlos.einstellungen.json` | device settings export | language, display options and own color schemes | moving personal settings to another browser or device |

The plan file is operated like a document in a normal desktop editor: New, Open, Save, Save as, Close. For the next year you create a new plan file based on the old one. Changes to a rule set are pulled in explicitly with "Update rules from rule set". Color schemes live in the device settings.

### Content of the files

Status: planned for version 1.

- **Own PDF templates**, individually exportable.

### File operations (editor behavior)

Status: partly implemented; only the bundled example opens, New, Open, Save, Save as, the rule set commands, Close, restore, the revision warning and the list of notes and manual changes are not built (issue 0030 (open real files in the UI: rule sets and the read report) is open), planned for version 1.

| Command | Behavior |
| --- | --- |
| **New** | Dialog: "Empty" (initial setup); "From rule set…": choose a `.regeln.json`, the initial setup takes its contract, calendar sources, templates and color scheme and asks only for the personal parts (see First start); if a plan file is open, "Based on the current file": takes over everything except the plan; plan empty, allowance empty, period shifted by one year. Every new file gets a new `id`. The last option offers to include the previous file as a source "Leave from another plan", so that e.g. January days from the previous year are visible. |
| **Open** | file picker, drag and drop or (installed web app in Chrome/Edge) double-click. Ctrl+O opens a small Open dialog of the app whose focused button "Choose file…" opens the file picker, because a key press can't open it in the Firefox ESR (that Enter on the button opens it there is to be checked in the UI branch). A plan file opens for planning; a rule set opens for editing: calendar with required work and calendar sources, without plan and allowance. |
| **Save** | raises `revision` by 1. Chrome/Edge: back into the same file, the name stays; Firefox/Safari: download with the suggestion `Name.revN.urlaub.json` (`N` the new revision, replacing an existing `.revN` in the name; for the Firefox note see Delivery format). The revision inside the file decides; the name is only a hint |
| **Save as** | new file name and a new `id` (revision 1), suggestion `ContractName_Year.urlaub.json` for a plan file, `ContractName.regeln.json` for a rule set |
| **Save as rule set** | in a plan file: writes contract, calendar sources (without "Leave from another plan" and "Time off needed"), templates and color scheme as a new `.regeln.json` with a new `id`; the plan is never included |
| **Update rules from rule set** | in a plan file: choose a `.regeln.json`; a preview lists every difference with a checkbox (like the iCal import). Parts copied from this rule set are updated, added or removed; parts added in the plan file itself are kept. The work week is not preselected, because it is often personal (part-time). The plan is never changed. |
| **Close** | back to the start screen |

- Exactly one file is open per browser tab; a second file is opened in a second tab.
- Unsaved changes: the title shows `• filename`. New, Open and Close ask "Save / Don't save / Cancel". When the tab is closed, a web page can only trigger the browser's generic warning dialog, without its own text and only after a user interaction ([beforeunload](https://docs.w3cub.com/dom/window/beforeunload_event)); the recovery copy catches the rest.
- **Restore (crash recovery, like LibreOffice):** while a plan has unsaved changes, a recovery copy is written to IndexedDB after each change, and again when the page is hidden (only an extra: in Chromium the IndexedDB write on `pagehide` didn't arrive in the test). It holds the plan file's content, the revision it is based on, the time and the app version. Saving and the app's own "Don't save" delete it; that is a clean end. Closing the tab with unsaved changes counts as an unclean end, because the page can't tell the browser's "Leave page" apart from a crash. There is no info bar while working.
  - Each open tab holds a Web Lock on its plan's `id`, so a plan open in another tab isn't offered for restore. Web Locks reach exactly the tabs that share storage: within one file in Firefox, across all local files in Chromium.
  - At start, if there are recovery copies of plans that no tab holds, a restore page lists them. For each it shows the plan's name (the name of the file it was opened from or last saved as, without `.revN` and the extension; for a plan never saved, the "Save as" suggestion), the time of the last change, the revision it is based on, and a warning when a newer revision was saved since (from the revision record). The page offers Restore or Discard, and a checkbox "Don't keep recovery copies anymore (you can change this in the settings)". On `file://` in Chromium, one more line says: "In Chrome and Edge, other HTML files you open from your computer can read these copies."
  - A restored plan is open with unsaved changes and is saved as usual. No file handle is kept for it, because whether a permission granted to one local file covers others was not tested. So in Chrome/Edge, too, Save after a restore asks where to save. Opening a file whose recovery copy is newer still offers the restore, as a second chance.
  - How several copies are restored at once (one tab per file) is left to the UI branch.
- **Revision warning:** the browser remembers per `id` the highest revision, the local date of saving it and a fingerprint of its content. Opening an older revision warns that a newer one was saved on that date; opening a file with the same `id` and revision but a different content warns that it is a different file. The file itself carries no date.
- **Notes and manual changes:** a list shows all notes and all manual changes of the required work of the plan, each to jump to or delete, so they can be cleaned up.
- There is no list of recently opened files: browsers don't allow access to file paths.

### What is stored where

Status: planned for version 1.

| Content | Location |
| --- | --- |
| Language, light/dark/automatic, active color scheme, own color schemes, view, "Align by weekday", show calendar weeks, "Recovery copies: on / off" | device settings (IndexedDB); exportable and importable as `.einstellungen.json` |
| Recovery copy of a plan with unsaved changes (see File operations, Restore) | IndexedDB, deleted on Save and "Don't save" |
| Revision record per `id` (highest revision, date, fingerprint) | IndexedDB |

"Recovery copies: off" writes no copies and shows no restore page; the browser's warning when closing a tab with unsaved changes stays. In Chromium on `file://`, the setting carries the same sentence as the restore page: other local HTML files can read these copies.

If a plan file or rule set contains a color scheme, the app asks on first opening "Use colors from file?"; on "Yes" the scheme is added to the own color schemes in the device settings and activated. The answer is remembered via the file's `id`.

### Format

Status: planned for version 1.

- "Update rules from rule set" uses `origin` to tell copied parts from parts added in the plan file.
- Files too old for this version are refused with the way out ("open it once with restlos 1.x and save it").
- The device settings export (`.einstellungen.json`) has `"kind": "settings"` and contains only the device settings listed above.

### Sharing and validation

Status: planned for version 1.

- **HTML self-copy** (version 3, after feasibility test): a copy of the app with an embedded rule set and without personal settings; opens directly in "New → From rule set".
- **No contract data in .ics.** In the PDF only on explicit request, and only the contract part without plan and notes.
- **Loading:** if the recovery copy of the same `id` is newer, the app offers to restore it (see File operations); then the revision warning applies. Opening runs in two steps in a Web Worker, with a progress bar from the start. **Reading:** its bar has no measure, and Cancel stops opening. **Checking:** its bar shows "rule n of N", Skip opens the file without the hints, and Cancel stops opening. The opened file shows the lists of reading and checking together, sorted by severity; with at least one Error the choice is "Open without these parts" or "Cancel", otherwise "OK".
- **Refused at once:** one message says why.
- **Refused with a list:** one dialog lists every Error reading found, each with its own message, so all of them can be fixed in one go.

## Operation (UI/UX)

Status: not a requirement; moves to docs/dev/en/explanation/ in phase 3.

Recommendation: one screen with a switchable calendar view and an always visible allowance display. Every action shows its cost immediately; nothing is blocked, overdraft is only marked.

### View 1: Month tiles

Status: implemented.

```text
Wireframe month tiles: calendar on the left, allowance always visible on the right
+----------------------------------------------------------------------+
| Profile: Bavaria, Agreement X | Period: Jan 2027 - Jan 2028 | Load · Save · Export |
+----------------------------------------------------------------------+
| [Jan 2027] [Feb] [Mar] [Apr]          | Allowance                    |
| [May]      [Jun] [Jul] [Aug]          | Plan allowance: 33           |
| ... further months up to Jan 2028     | Planned 24 ½ · Remaining 8 ½ |
|                                       | [#########......]            |
|                                       | Stretches                    |
|                                       | 21 Dec-3 Jan: 3 ½ -> 16 off  |
|                                       | 14-25 May: 6 -> 12 off       |
|                                       | Per calendar year            |
|                                       | 2027: 22 · 2028: 2 ½ (info)  |
|                                       | Legend: leave, weekend,      |
|                                       | holiday, half working day    |
+----------------------------------------------------------------------+
```

Classic calendar sheets per month (week start according to the country data, for DE Mon–Sun); the number per row adapts to the width. Good for planning individual weeks.

### View 2: Month columns

Status: partly implemented; the view, alignment by weekday and calendar weeks are built, storing both settings in the device settings and the templates' switches are not, planned for version 1.

```text
Wireframe month columns: one month per column, days as rows
Day | Jan | Feb | Mar | Apr | May | Jun | Jul ...
  1 | Fr  | Mo  | ...                       (weekday abbreviation in every cell)
  2 | Sa  | Tu  | ...
 .. |
 31 |
Narrow width: scroll horizontally, the day column stays fixed.
```

One month per column, days 1–31 as rows, weekday abbreviation in every cell, like a wall year planner. Good for an overview of 13 months and as the model for the year band PDF. The month names repeat in a row after the last row, so the end of a long column has them too; screen readers skip that row, since the column headers already name the months. Both views share selection, keyboard and context menu; switching keeps focus and scroll position on the current date.

**Option "Align by weekday":** instead of days 1–31, the rows show weeks (repeated from the configured week start, up to 6 weeks or 37 rows), so that all Mondays are at the same height and bridge days become comparable across months. A single toggle in the view menu, no additional control in the calendar. The setting is a personal display preference and is stored in the **device settings**, not in the plan file; the year band template gets the same switch as a template parameter.

**Calendar weeks:** both views can show ISO 8601 calendar weeks (month tiles: narrow column on the left; month columns: marker at the start of each week). Default: on. Label from the language catalog ("KW", "Wk"). Stored in the device settings; the print templates have the same switch as a parameter.

### Day cell: what is shown how

Status: partly implemented; every layer is drawn, the sources list that shows each source's colour and line style is not built, planned for version 1.

A cell in the month columns is only about 75 px wide on desktop, so a fixed ranking of the layers applies:

1. **Background:** required work (working day, weekend, holiday). A partly free day is split along the diagonal: the work block in the working-day colour where it lies (in the morning unless the free time is at the start), the free time with its pattern. A day that a holiday calendar frees, wholly or in part, counts as a holiday like a public holiday; the label names it after its entry, or after the calendar when the entry has no name. A worked one stays a working day.
2. **Fill:** own leave in blue, mandatory leave with its stripes. A kind fills the cell when it is the day's only leave and no work is left. Otherwise each share lies on the diagonal where it lies in the day, with its share of the cell's area: ½ stays the middle, ¼ at the start is a small corner. Own leave beside mandatory leave shows both, own leave only where no mandatory leave lies; half a day of mandatory leave alone leaves the working half white. The label names each kind with its amount and where it lies ("leave half, morning", "leave ¼, at the start of the day"; "halber Tag Urlaub, vormittags").
3. **Border:** days from sources of type "Leave from another plan" (dashed, no deduction).
4. **Lanes:** calendar sources as thin bars at the bottom of the cell, each on its own thin surface-coloured band that is drawn only where a line is (in month columns, vertically at the right edge). The day number moves to the top, so they never overlap. Consecutive days join into one bar. Lanes are packed per month: each run of days gets the lowest lane that no overlapping run uses. Each source has a colour and a line style (solid, dashed, dotted), which the sources list shows. Up to three lanes; beyond that, a "+" pattern marks the cell and the detail view lists all sources. The cell's label and the detail view name the sources; the detail view adds the names of the day's entries ("School holidays: Autumn break").
5. **Overlay:** today, focus, selection.

Day number and weekday abbreviation are always shown; the detail view shows everything else. A day with a problem has its number on a filled box (see Problems).

### Screen sizes

Status: implemented.

The **views** switch on the **width of the calendar area** (container queries), not of the whole window. The **allowance layout** (sidebar or top bar) switches on the **width of the app's main container**, because the sidebar takes its width from the calendar area and a rule on the calendar area would be circular. The table uses the same breakpoints for both: the view columns read them as the calendar area's width, the Allowance column as the app's width. The sidebar has a fixed width (20rem); the calendar area gets the rest. A row therefore doesn't describe one window: with the sidebar shown, the calendar area is 20rem narrower than the app, so an app of 1100 px shows the views of the 520–799 px row. The widths are px at the browser's default text size; the code uses rem (520 px = 32.5rem, 800 px = 50rem, 1100 px = 68.75rem), so with a larger text size the layout switches earlier, when the text needs the room.

| Width (views: calendar area; allowance: app) | Month tiles | Month columns | Allowance |
| --- | --- | --- | --- |
| ≥ 1100 px | 4 months per row | all columns that fit, at least 13; more scroll horizontally | sidebar at the inline end |
| 800–1099 px | 3 per row | scroll horizontally, day column fixed | sidebar at the inline end |
| 520–799 px | 2 per row | 6 columns visible | compact bar at the top, expandable |
| < 520 px | 1 per row (**default on phones**) | 3 columns visible | compact bar at the top, details as a bottom sheet |

The allowance and the hint line stay in view while the page scrolls: the compact bar with the hint line under it sticks to the top of the window; beside the sidebar, which sticks too, the hint line sticks to the top of the calendar area. The hint line keeps room for one line; a longer text grows over the calendar instead of pushing it down, so the cells stay under the pointer during a drag, and a day reached with the keyboard stops below the whole text. Dates and amounts in it don't break inside. In the selection mode the hint line moves into the action bar at the bottom.

After every change, by keyboard, mouse or touch, the hint line says the result, quietly (no band, not bold) so that it looks different from a preview: "15. Jan.: ganzer Tag Urlaub. 6 Tage übrig.", "5 Tage geändert. 6 Tage übrig.", "Rückgängig. 6 Tage übrig.", "Wiederholt. 6 Tage übrig."; past the allowance it ends with "3½ Tage über dem Kontingent." The result stays until the next preview or change replaces it, with no timer, so it stays true, and a language switch re-renders it. The hint line is the page's one polite live region, so screen readers hear every result; the same text twice is announced twice. The bottom sheet makes the page inert, so it says the result of its own actions in a live line of its own.

Minimum size for tap targets on touch devices: 40 × 40 px.

### First start

Status: partly implemented; the start screen offers only "View example", Open file, New and its steps are not built, planned for version 1.

1. Start screen: **Open file** · **New** · **View example**. If the HTML already contains a rule set (HTML self-copy, version 3), it starts directly with "New → From rule set".
2. On "New": language (preset), country/federal state.
3. Work week (suggestion from the country data, part-time adjustable).
4. Period: presets "Calendar year", "Year + January", "Custom".
5. Allowance: one number, hint "Include remaining days from the previous year here".
6. Local rules of the country; optionally "24 Dec and 31 Dec at most ½" with one click.

With "From rule set", country, region, local rules and day rules come from the rule set and steps 2 and 6 are skipped (only the language is asked); the work week is preset from the rule set and can be adjusted. A rule set that leaves out the federal state or the local rules asks for them. When the rule sets that come with restlos are offered as templates, each one shows its basis (agreement or law with the paragraph), the version, the date it was checked and the warning that users must check it against their own contract and that there is no guarantee.

### Calendar interaction

Status: partly implemented; the detail view doesn't set notes or change the required work yet, planned for version 1.

- **Mouse:**
  - Click = full leave day on/off; Shift-click = range up to the last clicked day.
  - **Drag to paint a range:** pressing on a day and dragging previews the range, and the hint line shows the working days, the cost, the resulting stretch and the remaining allowance. Releasing applies it, and the hint line then says the result. Starting on a day with own leave removes leave instead. A drag held near an edge of the visible calendar scrolls it, faster closer to the edge: the page below the sticky region and above the selection bar, and the month columns sideways at their ends. The range follows the day under the pointer while the calendar moves, also when the wheel scrolls it; the same goes for a drag in the selection mode.
  - A click on a **week number** sets the days of that week with required work, clipped to the plan period, or removes them when all are set.
  - Right-click = detail view (see below), with half day, note and change of required work for this date.
- **Touch:** tap = full on/off; long press = detail view. Ranges only in the **selection mode** (button in the bar), so that swiping to scroll and dragging to select don't collide. In it, both a drag and two taps (first and last day) select a range, and a tap on a week number selects that week's days with required work in the plan period. Nothing changes until an action bar confirms it: Full day, Half day, Remove leave, Clear selection. The bar looks the same with and without a selection; an X button at the end of its hint line leaves the mode. Escape clears the selection and, with nothing selected, leaves the mode. A day reached with the keyboard stops above the bar. In the mode only the day cells take the touch, so the headers, the day column and the gaps still scroll the page.
- **Keyboard:** the calendar is one widget with one Tab stop (ARIA grid, roving tabindex); arrow keys, Home/End and PageUp/PageDown move inside it. Home and End go to the start and the end of the week, in both views and also into the neighbouring month; Ctrl+Home and Ctrl+End (Cmd on macOS) go to the first and the last day of the month. No key moves the focus out of the plan period. Shift+arrow grows a visible selection; Space sets full days, H half days and Delete removes leave on the selection (on a single cell: Space = full, H = half); in a plan without half days (smallest leave unit `"1"`), H changes nothing and the hint line says so. Ctrl+Z/Ctrl+Y. In the month columns, Up and Down stop at the first and the last day of a month, since a month is one column; the other keys move between months. When there is no month in that direction inside the plan period, PageUp and PageDown, and Left and Right in the month columns, leave the focus where it is. Week numbers are buttons for the pointer; with the keyboard a week is selected with Shift+arrows and then planned with Space, H or Delete. Switching the view (V) or the alignment by weekday (W) keeps the focused day: an open detail closes, and the day is scrolled into view in the new layout and keeps the focus.
- **Range rules** (one function for drag, Shift-click, week click, keyboard and touch ranges):
  - **Setting** puts a full day on every day in the range that has required work above 0, lies in the plan period and is not wholly mandatory leave or wholly covered by "Leave from another plan". Half days in the range become full days. Days with ½ required work (24 and 31 Dec) get a full day and cost ½, the same as a click. Own leave lies at an edge of the day: H puts half a day at the end, unless the end half has no work, then at the start; on 24 December, whose afternoon is free, H books the morning, which frees the whole day for ½. A day that mandatory leave or another plan's leave covers in part gets own leave for the work they leave free (with H half a day of it at most), from the edge of the day that work reaches, directly or across time without work, as long as it is one stretch; a day with free work on both sides of such leave is left alone. For example, 24 December with mandatory leave in its first quarter leaves the work from ¼ to ½: Space books ¾ at the end and costs ¼. H never books half a day that frees no work. A day whose work leave covers wholly, with own leave on it, counts as set: setting full days (a drag or Shift-click that sets, Space on a selection, a week click, "Full day" in the selection bar) leaves it alone, but H still puts its half day there, so on 24 December H turns a full day into the morning. The detail's "Full day" checkbox sets full days by the same rules.
  - **Removing** removes all own leave in the range, whatever its share.
  - Days that wouldn't change are left alone, so the hint line counts only real changes. A gesture that changes nothing adds no undo step. One undo step undoes a range.
  - A week-number click covers the whole ISO week (starting on the country's week start), not just the visible row, and goes through the range rules. It removes leave instead when setting would change none of its days (each has a full day already, or own leave that leaves no work).
  - Every pointer action has a single-pointer alternative (WCAG 2.5.7): clicks, Shift-click, the keyboard and the touch taps.
- **Detail view:** from top to bottom: the date; the required work as a line ("Soll ½ Tag") and a bar over the full width with the day's work and free time in the month view's colours and patterns, one word per block ("arbeiten", "frei"); the leave as a line with all leave of the day and a "Ganzer Tag" checkbox, and the leave bar below it (see the next item), lined up with the bar above; what the day costs and the work left ("Restarbeitszeit"); each calendar of the day with its name and a bar of where it lies in the day; the reasons as "Name (kind): value", one per layer of the required work and then the mandatory leave and the other plans' leave, "Normaler Arbeitstag" when nothing changes the day and "frei" for no work; the day's problems as sentences in the overdraft colour. The value lines don't name the part of the day; screen readers hear it with the required work. A zero shows as a dash, which screen readers hear as words ("Kein Urlaub"). A day without work and without leave of any kind has no leave part, only "Kein Urlaub nötig", or "Außerhalb des Planzeitraums" outside the plan period. The checkbox fills all the work beside the other kinds of leave, or takes the own leave away when leave covers all the work of the day. On a day without required work or outside the plan period, own leave can only be taken away. Each click on the checkbox or the leave bar, and each drag along the bar, is one change and one undo step, and the detail stays open. On desktop a **popover** opened on demand by right-click, the context-menu key, Enter or a long press; on narrow widths a bottom sheet (a modal `<dialog>`). The popover doesn't shade the calendar, which stays usable while it is open: a click on free space only closes it, and a click on a day or a week number closes it and acts on that day or week. The bottom sheet shades the page and blocks it until it is closed. The hover title only repeats the cell's label and is not interactive: a hover tooltip that holds actions fails WCAG 1.4.13 and can't be reached reliably by keyboard.
- **Leave bar** of the detail view: the day in parts of the plan's smallest leave unit (`minUnit`): two halves ("vormittags", "nachmittags") with ½, four quarters with ¼, sixteen parts with 1/16, one part ("Ganzer Tag") with `"1"`; a unit that would give more than 32 parts uses the smallest multiple of it that gives at most 32 (1/48 → 1/24, 1/480 → 1/32). One element per segment, in the order of the day:
  - **Switches:** each part with work is a switch drawn only over its working time, grey where no leave is taken, with own, mandatory and other plans' leave drawn inside it where they lie (own and mandatory leave at the start or the end of the day as its `part` says, another plan's leave at its span). A press on a free part extends the own leave up to and including it, a press on a booked part shrinks it to just before it, and without own leave a press fills from the nearer edge of the day; no press books leave that would lie only on time without work.
  - **Fixed blocks:** time without work, and a part that mandatory leave or another plan's leave covers wholly. Time without work looks exactly like the free block of the Soll bar above it (the same fill and "frei"); mandatory leave and another plan's leave show in their colours and patterns, also on time without work. Neighbouring fixed blocks of one kind merge. So the afternoon of a ¾ day with unit ½ is a ¼ "nachmittags" switch beside a ¼ fixed block. Own leave that overlaps no work at all (from a file, a problem) turns the time without work it covers into pressed switches that take it away; once it is gone, that time is a fixed block again.
  - **Widths:** every segment is as wide as its share of the day, so the bar lines up with the Soll bar. With at most four parts (units `"1"`, ½, ⅓ and ¼) a switch is never narrower than 2.75rem, and the fixed blocks beside it give way. A segment too narrow for its text shows none (it is measured, so the same bar can show its names in one language and hide them in another); its name for screen readers stays. Finer parts go below the touch size (a 1/16 part is about 18 px wide in the 20rem detail); the accessibility checks (axe, with its target-size rule) cover the bar down to ¼. An equivalent control of full size for the finer parts, and the checks on them, are issue 0049 (leave bar parts below ¼ are under the target size).
  - **Names:** a switch is a toggle button (`aria-pressed`) named by its part, and its name doesn't change with its state: the halves "vormittags" and "nachmittags", the whole day "Ganzer Tag", a smaller part by its place and share ("4. Sechzehntel", "4th sixteenth"). A switch over time without work is named like the fixed block it stands for ("nachmittags: frei"), so no two switches of a bar share a name. A fixed block shows a short word and is read by where it lies and what it is ("nachmittags: frei", "13. bis 16. Sechzehntel: frei", "13th to 16th sixteenth: off", "vormittags bis nachmittags: frei" for time without work from inside the morning to the end of the day, "Ganzer Tag: aus anderem Plan").
  - **Keyboard:** the bar is one Tab stop (roving tabindex): the switch the focus was on last, else the first one. The arrow keys move to the next or the previous switch (left and right in the reading direction), Home and End to the first and the last, Space and Enter press. Fixed blocks are no stops; screen readers read them in browse mode. After a press the focus stays on the pressed switch, or goes to the switch nearest to it when that one is gone. "Ganzer Tag" is a Tab stop of its own.
  - **Touch and mouse:** a tap or click on a switch is a press. Pressing a switch and dragging along the bar sets how far the own leave reaches from its edge, snapping to the parts: from the edge own leave lies at when it is below a full day and the bar shows it, else from the edge nearer to the pressed part, as a press does (own leave that mandatory leave hides wholly is not shown), with the guards of a press. The pointer picks the switch nearest to it, also over a fixed block. A press becomes a drag only once the pointer is over another part and more than 10 px from where it was pressed (the same distance a long press on a day may move), so a finger that wobbles across the edge of a part still presses the part it went down on. Past either end of the bar the pointer still counts as on the bar and picks the end switch; it is off the bar only above or below it by more than the bar's own height. While dragging, the detail itself shows the preview: the bar, the leave line and "Ganzer Tag" draw the leave as it would be, and "Kostet" and "Restarbeitszeit" show the values the engine gives for it. The hint line doesn't, because on narrow screens the detail is a bottom sheet that shades it. The switches keep their state (`aria-pressed`, disabled) as the bar is until the drag ends; the preview shows only in their look. While a pointer is down on the bar, Space and Enter press neither a switch nor "Ganzer Tag"; its release decides. Releasing on the bar applies the change as one change and one undo step; the result is said once, by the hint line beside the popover or by the sheet's own status line, and screen readers hear only that result, not the steps of the drag. Escape (which then leaves the detail open), a cancelled pointer and a release off the bar end the drag without a change; while the pointer is off the bar, the bar shows no preview. Leaving the window ends it too, and the click of a release that comes back over the bar later does nothing. After a drag without a change, also one released where no leave can reach, the focus is on the pressed switch, or on the switch nearest to it when the preview took it away. While the engine can't give a preview, "Kostet" and "Restarbeitszeit" show the day's own values; the release still applies the change. A finger moved sideways on a switch drags; moved up or down it scrolls the sheet.

### Allowance display

Status: partly implemented; "Change allowance" in the overdraft line is not built, planned for version 1; bridge day hints, planned for version 3.

- Plan allowance, planned, remaining, progress bar; remaining < 0 clearly marked. No carry-over field.
- **Overdraft:** the bar is scaled to what is planned, with a tick at the allowance. The part over the allowance is hatched red (a pattern, not colour alone), and a warning line says by how much, with "Change allowance". Nothing is blocked.
- List of **stretches**: a stretch is unbroken time off without any work in it (even 15 minutes of work ends it), including weekends, holidays, paid closures and days from "Leave from another plan". Its first and last day may be partial. It shows the cost (the leave charged inside it) and the days off from its start to its end (from noon counts ½ for that day). It is listed when it contains leave that costs something or a paid closure (a paid-closure source or a day rule that frees the whole day), so a paid closure without leave appears with cost 0; it may extend beyond the plan period.
- **Totals per calendar year** as pure information.
- **Legend** as the last block: only what the calendar draws in the plan period (own leave, mandatory leave, leave from another plan, weekend, holiday, half working day, day off, the problem mark), each drawn as the cells draw it, then each visible calendar with a day in the period, by name with its line. On narrow widths it is in the details with the rest of the panel.
- All section headings of the panel (problems, stretches, totals per year, legend) look alike; only the problems heading has its own colour, the overdraft colour.
- Bridge day hints (version 3): working days that yield many days off with little leave; can be turned off.

### Problems

Status: partly implemented; issue 0043 (dismiss a time-off need for one day) is open, planned for version 1.

A problem is something on a day that can't be right; like the overdraft, it is only marked, nothing is blocked. The plan reports own leave outside the plan period, own leave on a day without required work, own leave on time that is off anyway (a day with required work whose work the leave doesn't overlap, such as the free afternoon of 24 December; it costs nothing), own leave on a day that another plan already has as leave, day rules that force contradicting values, and time off needed that is not covered. Each kind has one sentence ("Dieser Urlaub liegt auf einem freien Tag."), the same wherever it shows:

- **Day cell:** the day number on a filled box in the overdraft colour, the digit in the surface colour with a thin ring in the surface colour, so it stays legible on every fill, pattern and overlay; in forced colours the box takes the text colour. A mark in a corner would clash with small shares of leave there, and a frame around the number would vanish under the today and focus rings. The cell's label ends with the sentences ("…, Problem: Dieser Urlaub liegt auf einem freien Tag.").
- **Allowance panel:** a list "Probleme (n)" above the stretches, only while there are problems, in the order of the days: "13. Feb.: Dieser Urlaub liegt auf einem freien Tag." The row of a day in the plan period is a button: the details close where they cover the calendar (the compact bar's details and the bottom sheet), the day scrolls into view, takes the focus and opens its detail. A day outside the plan period isn't in the calendar, and own leave there is the only problem it can have: its row ends with "Urlaub entfernen", which removes that leave as one change and one undo step, said like any other change (in the bottom sheet by its own live line). The focus then moves to the row in its place, else to the row before, else to the stretches heading.
- **Compact bar:** "n Probleme" in the overdraft colour beside the remaining days; the list is in the details.
- **Detail view:** the day's problems as sentences in the overdraft colour.

Dismissing a problem of time off needed for one day is not built yet: issue 0043 (dismiss a time-off need for one day).

### Colors, light and dark mode

Status: partly implemented; the colour roles, the scheme "Standard" and the three modes are built, "High contrast", "Color vision deficiency", the editor and the print palette are not, planned for version 1; the editor's contrast check, planned for version 3.

- **Color roles:** working day, weekend, holiday, required work ½, leave full, leave half, mandatory leave, other plan, overdraft, today, focus, info band, accent 1–8 (for calendar sources).
- **Color scheme** = values for all roles, each for light and dark. Built in: "Standard", "High contrast", "Color vision deficiency" (Okabe-Ito); not changeable, only duplicable.
- **Mode:** light, dark, automatic (follows `prefers-color-scheme`, also when it changes). Technically: one custom property per colour role with `light-dark()` values; the mode is `color-scheme` on the root (`light`, `dark` or `light dark`). User schemes are written with `style.setProperty()`, one value per role for both modes; colours mixed from other roles (the second stripe of mandatory leave, the drag preview) are `color-mix()` of those roles, so they follow. A finished value per mode was tried and did not make a switch faster in Firefox ESR; what made it slow was a reduced-motion reset with a transition duration above 0 (issue 0032, light/dark switch not instant in Firefox ESR).
- **Neutral surfaces:** neutral grey, no hue. The tokens keep a hue and a chroma factor (`--nh`, `--nk`, both 0), so a tint stays a change of those two numbers.
- **Primary action colour:** navy, `oklch(37% 0.11 258)` in light mode and `oklch(50% 0.1 258)` with white text in dark mode. Both are darker and greyer than the leave blue, so a filled button never looks like a leave day. **Blue is reserved for leave.**
- **Editor in version 1:** choose a color per role and mode, preview on a sample month. Contrast check with warning only in version 3.
- Day types additionally differ by pattern, never by color alone.
- **Print/PDF** uses its own light print palette per scheme.

### Multilingual support (from the start)

Status: partly implemented; the catalogs, formatting, the language switch, the catalog check, the pseudo-locales and right-to-left readiness are built, the bilingual help and PDF templates, Intl.Collator for sorted lists and the locale's decimal separator in number fields are not, planned for version 1.

- All texts via message IDs in catalogs (`de.json`, `en.json`) in ICU MessageFormat, including plural rules; no composed sentence parts in code.
- Dates and month names via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`, plurals via `Intl.PluralRules` (also for 1.5 days). Week start from the country data, not from the browser.
- Language and country are independent. Holiday names are keys with translations; names from iCal and user texts stay unchanged.
- Files store only IDs and ISO values, never texts translated by the app; free texts (names, descriptions, rule labels and notes, reference titles) are plain strings or maps from language code to text (see Format).
- Language switch at runtime without reload; help and built-in PDF templates bilingual.
- CI checks for missing/unused keys; pseudo-localization reveals truncated layouts.
- **Ready for right-to-left languages from the first component,** although only DE and EN ship: logical CSS properties only (enforced by a check script), `dir` from the catalog, grid arrow keys that follow the visual direction, and a list of icons that mirror.
- **Two pseudo-locales** in the component gallery: `en-XA` (long, accented) and `en-XB` (right-to-left). Only the gallery registers them and its own texts, so the app ships German and English alone.
- No `text-transform: uppercase` on translated text. `Intl.Collator` for sorted lists; the locale's decimal separator is accepted in number fields; engine tests include a country with a Saturday week start.

**Glossary** (binding for UI, help, templates and code identifiers):

| German | English | Meaning |
| --- | --- | --- |
| Soll | Required work | share of a day that would have to be worked (e.g. 0, ½, 1; any multiple of 1/32 possible) |
| Genommen | Taken | share of the day taken off (in the UI full or half days, and the plan's smallest leave unit in the day detail's leave bar) |
| Restarbeitszeit | Work left | the required work of a day that no leave covers, own, mandatory or from another plan |
| Kontingent | Allowance | available leave days of a plan |
| Plan | Plan | period + allowance + selected days |
| Vertrag | Contract | rules of the employment: region, local rules, work week, day rules, smallest leave unit, with name, description and references; no time zone, no working hours |
| Plandatei | Plan file | `.urlaub.json`: copy of a rule set plus exactly one plan |
| Regelwerk | Rule set | `.regeln.json`: contract, calendar sources, templates and optional color scheme without a plan; shared per company or collective agreement |
| Geräte-Einstellungen | Device settings | language, display options and own color schemes; stored in the browser, exportable as `.einstellungen.json` |
| Arbeitswoche | Work week | required work per weekday, with validity |
| Tagesregel | Day rule | own rule that lowers or fixes the required work (`requiredAtMost`, `requiredExactly`) or marks mandatory leave (`mandatory`) |
| Kalenderquelle | Calendar source | named list of days (dates or repeating matches) with type and color; imported once from iCal or a .urlaub.json file, or created by hand |
| Pflichturlaub | Mandatory leave | charges the allowance automatically |
| Bezahlte Betriebsruhe | Paid closure | required work 0, costs nothing |
| Urlaub aus anderem Plan | Leave from another plan | is displayed, not counted |
| Freizeit nötig | Time off needed | days or parts of days on which the user must be free (e.g. Kita closure); never costs, reported when not free |
| Am Stück frei | Stretch | consecutive days off |
| Brückentag | Bridge day | working day between a holiday and the weekend |
| Sonderschalter | Local rule | regional exception, e.g. Augsburger Friedensfest |

### Accessibility

Status: partly implemented; issue 0040 (forced colours: day types and the allowance bar) is open, planned for version 1.

Contrast according to WCAG AA for the built-in schemes, a screen reader label per day ("Friday, 7 May 2027, working day, leave full, costs 1"), fully operable by keyboard, focus visible in both modes. Each view is an ARIA grid with a roving tabindex (one Tab stop, not 365); the selection is `aria-selected` and the leave state is part of the label. The slots before the first and after the last day of a month are empty grid cells, so every cell sits under its header. The allowance panel follows the calendar in the document, because the calendar is the main content. In forced colours (Windows contrast themes) the system colours replace the tokens; planned days and pressed buttons draw Highlight with HighlightText themselves, because the browser's backplate behind their text would hide it. What a screen reader gets is checked in two layers: e2e tests compare the accessibility tree with ARIA snapshots (the grid and its labels, the day detail, the allowance panel, the live regions), and before each release Orca's debug log is read after a fixed sequence of keys in the Firefox ESR (`npm run orca`, release checklist), for a result that wasn't said, a text said twice in a row and very long texts; nothing has to be heard. Orca 50 drops some results at random with its own filters (issue 0046, Orca 50 drops some hint line results), so the check lists those apart and fails only when the app didn't give Orca a result, when fewer than half were said or when a text was said twice. The live regions are divs: Orca 50 lets a live region's text change past its filter for changes that come many at once only from an element Firefox reports as a section, and every change updates many texts at the same time. axe-core checks the component gallery and the main screens; in the gallery it leaves out the whole group of day details in sixteenths (its heading, details and leave bars), because the parts of those leave bars are smaller than the target size of WCAG 2.5.8 (issue 0049, leave bar parts below ¼ are under the target size).

### Built-in help

Status: partly implemented; "View example" and the keys of the calendar, V, W and K are built, the help with its sources, build, checks and dialog, Ctrl+S, Ctrl+O, ? and catching a file dropped anywhere on the page are not, planned for version 1.

Offline, bilingual, context-sensitive ("?" on every dialog). Chapters: Getting started, Work week and part-time, Day rules, Calendar sources (incl. showing the previous year), Plan and allowance, Plan file, rule set and saving (incl. the Firefox setting for overwriting and installing the web app with file association), Colors, Keyboard shortcuts, Privacy (incl. what the browser stores: device settings, recovery copies and the revision record, and that in Chrome and Edge other local HTML files can read them), **Own PDF templates** (see Output), About/Licenses.

**Sources:** one Markdown file per topic. English is the source and is written first, under `docs/user/en/`; German is required and current, under the same path in `docs/user/de/`, changed in the same commit. A sync file records, per translation, a hash of the English text it matches: a German file whose recorded hash differs from the current English fails the check, a German-only fix such as a typo passes, and one command re-records the hash after someone has checked the German. The hashes are of content, not of git commits, because `main` has only squash merges. Further languages are optional: a mismatch or a missing file only warns, the website marks an outdated page, and a missing page falls back to English. The style rules for the help sources are on `docs/dev/en/reference/documentation-style.md`.

**Build:** a build-only Vite plugin parses both languages with markdown-it, imported from the package root, with `html: true`, so raw HTML fails the build loudly. A converter turns the tokens into the project's own closed, typed help tree of about ten node kinds; the checks run on that tree and report file and line from markdown-it's block ranges, and a link allowlist is the real defence. The build embeds one JSON data block per language with `insertDataBlock`, which escapes every `<`. `HelpTopic.svelte` renders the tree with two recursive snippets and no `{@html}`. Estimated size: about 90–150 KB for both languages, or 40–70 KB stored compressed with `DecompressionStream`; measured against the size budget.

**Help syntax:** `{ui:catalog.key}` for UI labels, resolved per language at build time; `{shortcut:action}` for keys, from one shortcut table in code that both the key handling and the help read, so the help's overview of the keyboard shortcuts is generated from it (on macOS the help shows Cmd); `{#id}` for anchors.

**Topic IDs:** generated `HelpTopicId` types, checked in both directions. An alias list maps old IDs to new ones and also feeds the website's redirects.

**Help dialog:** the WAI-ARIA dialog pattern: on open the topic heading has focus, Escape closes only the help, focus returns to the "?" that opened it, and a Back action leads between topics.

**Keyboard shortcuts** (in the help as an overview, in menus next to the entries):

| Key | Action |
| --- | --- |
| Arrow keys | move focus in the calendar |
| Home / End | start / end of the week |
| Ctrl+Home / Ctrl+End | first / last day of the month |
| PageUp / PageDown | same day in the previous / next month |
| Space / H | set or remove leave full / half |
| Shift + click or Shift + arrow key | extend range |
| Ctrl+Z / Ctrl+Y | undo / redo |
| Ctrl+S | save (taken over: the browser's "Save page" doesn't appear; tested in the Firefox ESR) |
| Ctrl+O | opens the app's Open dialog (see File operations, Open; taken over: the Firefox ESR doesn't open the file picker from a key press) |
| V | switch view (tiles / columns) |
| W | align month columns by weekday |
| K | calendar weeks on/off |
| ? | help |

New, Save as and Close are only available in the menu: Ctrl+N, Ctrl+T and Ctrl+W are reserved by the browser and don't reach the page ([Mozilla bug 1203059](https://bugzilla.mozilla.org/show_bug.cgi?id=1203059)), and Ctrl+Shift+S opens screenshots in Firefox ([Mozilla help](https://support.mozilla.org/en-US/kb/take-screenshots-firefox)). Save and Open stay visible as buttons, because Firefox users can stop pages from taking over shortcuts ("Override Keyboard Shortcuts" in Page Info). Shortcuts match `event.key`, falling back to `event.code` for non-Latin layouts. A file dropped anywhere on the page is caught, so the browser never navigates away from unsaved changes.

**View example:** the start screen opens a built-in, fictional plan file, `examples/plans/beispiel-gmbh-2027.urlaub.json`, made from the rule set `beispiel-gmbh.regeln.json`: "Beispiel GmbH" (Example Ltd) without a collective agreement in Bavaria (Assumption Day applies, not Augsburg), full-time, with an allowance of 30 days and the calendar year 2027 as its period. Its day rules give the afternoons of 24 and 31 Dec off ("at most ½") and close the company from 27 to 30 Dec (Mon–Fri, mandatory leave); an info source "Projektphase" (project phase) and a source "Leave from another plan" with January days from a 2026 plan are stored as entries. The plan has leave around Easter, on the bridge days after Ascension (7 May) and Corpus Christi (28 May) and two weeks in summer. Changes to the example are not saved automatically; "Save as own file" turns it into an own plan file.

### Controls, icons and fonts

Status: partly implemented; Open and Save, the File menu, colour picking, the order of calendar sources and the print font are not built, planned for version 1.

No component or icon library.

**Look and structure**

- **Styles:** our own CSS, no framework. Svelte's scoped component CSS on top of one token file, ordered with `@layer reset, tokens, base, layout, components`. A small check script (no package) fails on literal colours outside the token file, on physical properties, on `text-transform: uppercase` and on repeating gradients without `in srgb`: the tokens are oklch, so a gradient would interpolate in oklab, and Firefox without hardware rendering (headless, for example) drew the day patterns wrong that way.
- **Sizes follow the text size:** rem for font sizes, spacing, anything that holds text, and breakpoints, also the width limits in code; px only for what must not grow with the text (borders, outlines, shadows, patterns, marks up to 16 px). Users who raise the browser's text size need the boxes and breakpoints to grow with it, or text overflows fixed boxes. The check script fails on font sizes and breakpoints in px and on px boxes over 16 px.
- **Buttons:** tactile. A 1 px border at 3:1 contrast, a fill one step lighter than the surface, a 1 px darker bottom edge and a 6 px radius; pressing removes the edge. One filled primary button per area. A filled or pressed button keeps its strong 1 px border, so in dark mode the primary colour is never the only sign of its state.
- **File commands:** Open and Save are visible buttons, everything else is in a "File" menu button. No menubar (a `role="menubar"` would collide with the browser's Alt menu). On the phone the File menu merges into the menu button; Save stays visible.
- **More menu:** below 520 px app width, the toolbar moves the mode, the language and the checkboxes into a More menu. It opens as a bottom sheet on touch screens (`pointer: coarse`) and as a popover otherwise.
- **Settings switches** are native checkboxes; toggles in menus are `menuitemcheckbox` items with a check mark.


| Need | Solution |
| --- | --- |
| Icons (approx. 15: open, save, export, settings, help, light/dark, undo/redo, view, warning, close …) | selected SVGs from [Lucide](https://lucide.dev) (ISC, Feather-derived icons MIT; compatible with the EUPL) as files in the repository, license notice on the license page; no npm package |
| Dialogs, menus, detail popover and sheet | the browser's built-in `<dialog>` and popover elements, positioned with CSS anchor positioning and opened by small JS handlers (`showPopover()`, `showModal()`); invoker commands and `popover="hint"` are not relied on. The phone's bottom sheet is a modal `<dialog>` |
| Color picking | `<input type="color">` |
| Order of calendar sources | up/down buttons instead of dragging (reliable by touch and keyboard) |
| Date picking | not needed, the calendar itself is the selection |
| UI font | system fonts, 0 KB |
| Font for print/PDF | one embedded OFL font, only for Typst or the print view |

## Output: .ics and PDF

Status: not a requirement; moves to docs/dev/en/explanation/ in phase 3.

Recommendation: generate .ics ourselves. PDF with **Typst as the only template language**: the standard HTML exports a standalone `.typ` file and offers a browser print view; the **Pro HTML** contains Typst as WASM and creates the PDF with one click. Templates are created outside the app with Typst and loaded ready-made; there is no editor.

### .ics export (RFC 5545)

Status: planned for version 1.

- Mandatory: `VERSION:2.0`, `PRODID`, per event `UID` and `DTSTAMP`; TEXT values correctly escaped (`,` `;` `\`, line breaks).
- All-day events only: `DTSTART;VALUE=DATE`, `DTEND` exclusive. Partial days are all-day events with share and part in the title ("Leave (½, morning)") plus the machine-readable fields `X-RESTLOS-TAKE`, `X-RESTLOS-PART` and `X-RESTLOS-TYPE`, so restlos reads its own export back exactly. No working hours, no times, no `TZID` or `VTIMEZONE`.
- Default: **one event per leave day**. Stretches as one event are selectable; their `UID` changes when a stretch changes, which the dialog notes.
- **`UID`:** a one-way hash (SHA-256 via the browser's WebCrypto, `crypto.subtle.digest`) of the plan's random `id` and everything the event says: what it is (own leave, mandatory leave, a holiday exported along, a source's entry), the source or rule it comes from (by `id`), its date or dates or repeat rule, its share and part. It never contains an element's position in the file. It is not the contract ID, because colleagues with the same rule set share that, and RFC 7986 asks for `UID`s that identify nothing. So only an exact copy gets the same `UID`, and the export writes an exact copy only once. An edit the event doesn't show (a colour, a note) keeps the `UID`; any edit it shows (full ↔ half day, another part, a moved day) gives a new one; "Save as" (a new `id`) gives all new ones. An event never changes under its `UID`. The trade-off is accepted: apps that update events by `UID` show a changed day twice, old and new. The engine supplies the text to hash; the export step, which is asynchronous anyway, calls WebCrypto. The project has no hash code of its own. The exact encoding, and the fixed list of fields per kind of event, are issue 0010's.
- **Without WebCrypto** (it needs a secure context; `file://` is one in Firefox and Chromium): random `UID`s from `crypto.getRandomValues`. The export dialog then says why and what it means, for example: "This browser doesn't offer the function restlos uses to give calendar events fixed IDs, so this export gets new ones. If you import it into a calendar that still holds an earlier export, every event appears twice: delete that calendar first, or subscribe to the file."
- Leave: `TRANSP:OPAQUE`, `X-MICROSOFT-CDO-BUSYSTATUS:OOF`. Holidays exported along with it: `TRANSP:TRANSPARENT`, without OOF.
- Line folding after 75 octets, without splitting UTF-8 characters ("½" is 2 bytes); CRLF.
- Titles in the current UI language. No contract data in the .ics.
- The help says openly: import is not synchronization; deleted days must be removed from the calendar by hand, and some programs create duplicates on re-import. From documentation (not tested): Thunderbird refuses an event whose `UID` already exists and stops the import there; Nextcloud's web import refuses existing `UID`s; Google probably updates by `UID` but keeps deleted days; classic Outlook duplicates; Apple doesn't update. The workflow that works everywhere: a separate calendar for restlos, which is deleted and created again before importing a new export. The help doesn't recommend just emptying the calendar, because deleted events may still block their `UID`s (Nextcloud's trash bin; untested). The workflows themselves are issue 0010's.
- The exported .ics can be loaded again next year as a source "Leave from another plan"; `X-RESTLOS-TYPE` marks mandatory leave, so it comes back too.
- Calendar sources can be exported as .ics as well (see Multiple calendar sources).

### PDF: variants

Status: planned for version 1.

| Variant | Size | Role |
| --- | --- | --- |
| Browser print (`@media print`) | \~0 | fallback without Typst |
| `.typ` export, user compiles with `typst compile` | \~0 | standard HTML |
| Typst WASM in the page ([typst.ts](https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html)) | measure in feasibility test | Pro HTML |

Rejected: pdfmake and pdf-lib/jsPDF (a second template language or templates as JavaScript).

**Pro HTML feasibility test** (before version 2): pass WASM and fonts as bytes instead of loading them from the network; WASM gzip-compressed in a non-executed `<script type="application/octet-stream">`, unpacked with `DecompressionStream` on the first export; measure size and load time from `file://` in Firefox and Chromium. The browser has no system fonts, so fonts are bundled (with the OFL license text). `@preview` packages are not available offline.

**Typst version:** the build pins a Typst version. Templates declare a minimum version; the lower bound is **0.13**, because `pdf.embed` (file attachments in the PDF) was added there ([Typst 0.13 changelog](https://typst.app/docs/changelog/0.13.0/)). The exported `.typ` names the expected version and the bundled font names with fallback.

**Built-in templates** (MIT-0, bilingual): year band A4 landscape (13 months on one page, matches the month columns view), month tiles A4 portrait, request list with stretches, cost, remaining days and signature fields.

### Own templates: workflow and help

Status: planned for version 1.

Own templates are created outside the app. The help page "Create your own PDF template" (offline, bilingual) provides everything needed:

1. **Starter pack for download**: example template (\~40 commented lines) and a file with **example data** in the interface format; plus "Export current plan as data" to test with real data.
2. **Working with Typst locally**: `typst watch template.typ` shows changes immediately. The help names the required Typst version and the bundled fonts.
3. **Data interface**: reference of all fields (period, days with required work, selection, sources with colors, holiday names in the current language, stretches, totals, print colors, language, translations), generated from the schema at build time.
4. **Helper functions** in the bundled library: `t("key")` for translations, date and fraction formatting matching the language.
5. **Load a finished template**: the app checks the `api` version and the Typst minimum version. In the Pro HTML it is compiled once with example data; errors appear with line numbers. The template is saved in the plan file or rule set.
6. Built-in templates can be downloaded as a starting point.

## Architecture, technology and tests

Status: partly implemented; the About / Licenses page, the .ics, PDF and JSON outputs, help, templates and a font in the size budget, the iCal and PDF/Typst tests and the other planned parts of the test strategy are not built, planned for version 1; the Pro HTML and its feasibility test, planned for version 2; the feasibility test of the HTML self-copy, planned for version 3.

```text
Architecture: one engine calculates, all outputs read the same state

Built-in rules (Easter ± n, local rules) ---------\
Calendar sources (iCal; any number, type, color) ---> Calendar engine --> Plan state --> Calendar + bar
Plan/rule set (JSON; load, migration, validation) -/   (required work per     (selection,   --> .ics export
                                                        day as minimum,        undo,         --> print CSS / .typ
                                                        cost in 1/480 day,     recovery)     --> JSON + HTML copy
                                                        stretches, totals
                                                        per year; pure
                                                        functions, no UI)
```

All outputs (.ics, PDF, JSON) read the same computed state; no output recalculates costs itself.

**Worker:** the worker inherits the page's CSP: WebAssembly only with `'wasm-unsafe-eval'` (Pro HTML).

**Size budget:** standard HTML under 600 KB including help, templates and one font. The Pro HTML is a second build target from the same sources plus Typst WASM; its size is measured in the feasibility test.

**Licenses in the build:** third-party licenses and NOTICE files are collected automatically and embedded as the "About / Licenses" page with a link to the source repository.

**Feasibility tests before implementation**

| Test | Question | Before |
| --- | --- | --- |
| Browser storage with `file://` | Do local files share one storage? Does it survive renaming the file? (Firefox, Chromium) | version 1: **done** 2026-11-02 (see Delivery format) |
| CSP and keyboard shortcuts | Do all CSP directives work via `<meta>` in the Firefox ESR? Do Ctrl+S and Ctrl+O reach the page? | version 1: **done** 2026-11-02 (see Content Security Policy, Built-in help) |
| Web Worker from `file://` | Does a worker built into the HTML file start from `file://` with the CSP from `<meta>` (`worker-src blob:`) in the Firefox ESR, Chromium and Safari? How long does handing a 10 MB file's model to the page take? | version 1: **done** 2026-11-02 for Firefox and Chromium (see Architecture); Safari from documentation |
| Calendar import | Behavior of Thunderbird, Google, Outlook on re-import of the same `UID` | version 1: **from documentation only** (see .ics export) |
| Typst WASM offline | compressed size, load time, fonts as bytes, compiling from `file://` | version 2 |
| HTML self-copy | rewrite the app's original bytes unchanged (carry the app source along as `type="text/plain"`) | version 3 |

The version 1 tests ran automated and headless in Firefox ESR 153, Firefox 159 and Chromium 147 (Playwright's `chrome-headless-shell`, not a user's Chrome) on the reference machine, and Ctrl+S and Ctrl+O by hand in the Firefox ESR; the results are in [`docs/feasibility.md`](feasibility.md). Not tested, and taken from documentation: Safari and iOS, Chromium's File System Access API from `file://`, Firefox's "Override Keyboard Shortcuts" set to Block, dropping a file outside a drop zone, and every calendar app (Thunderbird, Nextcloud, Google, Outlook, Apple).

**Test strategy** (engine first, like a DUT against reference models)

| Level | What | Tool |
| --- | --- | --- |
| Plans | sources "Leave from another plan" (.ics) are displayed and never count | Vitest |
| Date arithmetic | daylight saving time changes | Vitest |
| iCal | round trip export → ical.js → same days; mandatory fields; UTF-8-safe folding; real example files (Google, Outlook, Thunderbird) | Vitest + ical.js |
| Files | migration, `revision` warning | Vitest + fast-check |
| Colors | contrast of the schemes | small check scripts |
| PDF/Typst | every template × DE/EN with example data, pinned Typst version | Typst CLI |
| End-to-end | Pro HTML via `file://` in Firefox (Playwright build), Chromium, WebKit | Playwright |
| Components, accessibility, keyboard | the component gallery shows every component in the three schemes | Playwright |

## Dependencies and supply chain

Status: moved to `docs/dev/en/explanation/supply-chain.md`.

### Dependencies

Status: moved to `docs/dev/en/reference/dependencies.md`.

### Measures against supply chain attacks

Status: moved to `docs/dev/en/reference/dependencies.md`.

## Security

Status: partly implemented; plan files and rule sets are treated as untrusted and the app has no network access; iCal files follow with the iCal import, planned for version 1; own templates run isolated with the Pro HTML, planned for version 2.

Recommendation: every file from outside is considered untrusted, the app has no network access, and templates run isolated. The worst a manipulated file can then cause is an error message.

### Threats and countermeasures

Status: partly implemented; the measures for plan files, rule sets and displayed text are built; those for iCal files, the .ics export, data passed to Typst, file names when saving and releases wait for their features, planned for version 1; running own templates isolated in Typst WASM, planned for version 2.

| Input / risk | Example | Countermeasure |
| --- | --- | --- |
| Plan file or rule set from a colleague | manipulated JSON, huge file, `__proto__` key | size limit (10 MB) and count limits (see Sharing and validation); `JSON.parse` followed by schema validation of every field; keys like `__proto__`/`constructor` are discarded; data in `Map` or objects without prototype |
| iCal file from the internet | script in event names, endless `RRULE`, millions of events | size limit (5 MB) and event limit; recurrences stored as a `match` or expanded only for a period chosen at import; names always displayed as text |
| Display of foreign text | HTML/script in names and notes | Svelte escapes text; `{@html}` is forbidden for data (ESLint rule `svelte/no-at-html-tags`) |
| Own Typst template | endless loop, file or network access | Typst runs as WASM in a Web Worker with a time limit; it only sees the passed data and the bundled fonts, no files, no network |
| Data in Typst | injecting Typst code via holiday or note names | data is never inserted into Typst source code, but passed as JSON input and read there |
| .ics export | broken lines due to commas, semicolons, line breaks | RFC 5545 escaping of all TEXT values, tested |
| File names when saving | path characters in the contract name | file names reduced to safe characters |
| HTML file from a foreign source | HTML self-copy or "release" by third parties with malicious code | the help warns: HTML only from the official repository or from people you trust; immutable releases with `SHA256SUMS`, GitHub build provenance (`actions/attest-build-provenance`) and GitHub's release attestation; verification instructions in the README |
| Compromised dependency | malicious code in the bundle | see supply chain; additionally network lock via CSP |

### Content Security Policy

Status: partly implemented; the policy of the downloadable HTML file is built and tested; the Pages version's additions, planned for version 1; 'wasm-unsafe-eval' for the Pro HTML, planned for version 2.

In the HTML's `<meta>` tag (GitHub Pages cannot set custom HTTP headers), as the first element after `<meta charset>`: a meta policy applies only to what comes after it.

- `default-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
- `script-src` only with the SHA-256 hashes of the embedded scripts, computed at build time over the LF-normalized script text; in the Pro HTML additionally `'wasm-unsafe-eval'` for WebAssembly. No `eval`, no `new Function`. Data blocks (`type="application/json"`, `application/octet-stream`) need no hash.
- `style-src 'unsafe-inline'` (embedded styles; low risk, since no foreign HTML is rendered), `img-src data: blob:`, `font-src data:`, `worker-src blob:`; in the Pages version `worker-src 'self' blob:` for the service worker.
- The Pages version additionally needs `manifest-src 'self'`: with `default-src 'none'` the web app manifest would otherwise be blocked and the app could not be installed.
- WebAssembly is compiled from embedded bytes (`WebAssembly.instantiate`), never fetched, since `connect-src 'none'` applies inside the worker too.
- **Tested** (2026-11-02, Firefox ESR 153, Firefox 159, Chromium 147, on `file://` and for the Pages policy on `http://127.0.0.1`): the directives are enforced from `<meta>`, also on `file://` in Firefox, except Firefox's `file:` requests (see Known gap); whether the manifest loads under `manifest-src 'self'` was not observed, and `font-src data:` only showed no violation. Hashed scripts run; scripts without a hash, event handler attributes, `eval`, `new Function`, `<object>`, `<embed>`, `<base href>`, form submits, `data:` workers and `fetch`/XHR of `blob:` and `data:` URLs are blocked, and WebAssembly runs only with `'wasm-unsafe-eval'`. The service worker registers, and the Pages version loads again offline.
- **Known gap:** on `file://`, Firefox let the page fetch its own file and show an image file next to it without a `connect-src` or `img-src` violation, where Chromium blocks both. The app never fetches and embeds all images, so this changes nothing for it; the policy is defence in depth, not the only barrier.

### Verification

Status: partly implemented; the plan file and rule set reader is fuzzed and SECURITY.md exists, the iCal and settings parsers don't exist yet and the CSP and network test runs only locally (issue 0029 (run the build and the end-to-end tests in CI) is open), planned for version 1.

- Fuzzing of the parsers (iCal, plan file, rule set, settings export, template metadata) with fast-check: random and broken inputs may only lead to error messages, never to crashes or wrong data.
- CI test: the built HTML contains the CSP, and no network request leaves the page (Playwright intercepts requests).
- `SECURITY.md` with private reporting via GitHub's "Private vulnerability reporting"; handled on a best-effort basis, without any deadline commitment.

## Build and CI (GitHub Free and local)

Status: implemented.

Recommendation: everything runs locally with one command; GitHub Actions only runs the same commands, as rarely as possible, with a cache for all downloads and minimal permissions. This way neither the npm registry nor any other server is hit again on every run, and the project stays buildable without GitHub.

**Local (NixOS):** a Nix flake with a dev environment (Node.js LTS with npm ≥ 11.10, Typst, Python for the python-holidays reference, Playwright browsers, Firefox ESR for the manual test, Valgrind on Linux for the performance gate). `nix develop`, then `npm ci`, `npm run check`, `npm run build`. `npm run plan -- <file>` prints what the engine reads and computes for a plan file or rule set. `npm run orca` prints the steps of the screen reader check, and `npm run orca -- <log>` checks what Orca said. `npm run perf` runs the performance gate; `npm run check` includes it. The flake lock file pins all tools; the README explains the commands for Nix beginners. CI uses a second, smaller shell, `devShells.ci` (`nix develop .#ci`), with only what `check` needs: Node.js, Valgrind and REUSE.

**GitHub Free, public repository:** standard runners are free ([GitHub docs](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)), GitHub Pages is available ([GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Free doesn't mean unlimited: runs are still kept sparse.

### Documentation website

Status: planned for version 1.

The user documentation and the developer documentation are published as a website on GitHub Pages (layout under Delivery format, "Pages layout").

- **Tool:** mdBook 0.5.2 from nixpkgs in the dev shell (approved 2026-11-14; no npm package).
- **Three books, de, en and dev:** after the checks, the project's build writes them with generated `book.toml` and `SUMMARY.md` files. User pages come from the help's checked tree, as resolved Markdown. Developer pages come from `docs/dev/en/`, with links to source files rewritten to GitHub links at the release tag.
- **Language link:** each user page gets a link to its twin in the other language as its first line, with `hreflang` set. It needs no JavaScript.
- **Redirects:** `[output.html.redirect]` is generated from the help's alias list of old topic IDs.
- **German interface text:** after `mdbook build`, a Node step replaces mdBook's English strings in the German book with strings from a `docsSite.*` catalog group, about 25 strings plus 5 theme names. The step fails if the mdBook version differs from the pinned one, if a rule matches nowhere, or if text outside `<main>` is identical in the German and English output.
- **Search:** per book. German has no stemming; if that proves too weak, Pagefind over the output is tried first (needs the maintainer's approval).
- **Not published:** `SPEC.md`, `issues/` and the component gallery.
- **Deployment:** together with each release, from one folder, in one deploy (see Workflows, `release`).
- **Test build first:** before the website is planned in detail, a test build confirms the string list, the search script's file name, that the rewrite leaves page content alone, the identity check, the language links under the site URL, the redirects, a German 404 page, German search, that there are no outside requests, and Firefox ESR, Chromium, WebKit and Orca.
- **Fallback:** if the string rewrite proves unreliable, Hugo with an own layout and Pagefind (both need the maintainer's approval). Hugo also becomes the better choice if the site grows beyond help pages.

### Workflows

Status: partly implemented; check, seed-cache and Dependency Review run, templates, e2e and release are not built (issue 0029 (run the build and the end-to-end tests in CI) is open), planned for version 1.

| Workflow | Trigger | Content |
| --- | --- | --- |
| `check` | push to `main`, pull requests; always the full check, without a path filter (a required check whose workflow a path filter skipped stays pending and blocks the merge) | inside `nix develop .#ci`: NixOS release check, `npm ci`, `npm run check` (lint, type check, Vitest, performance gate, the catalog, CSS, reference, citation, spec status and docs style checks, REUSE check); then, as separate steps, the app build with its size check and the gallery build |
| `seed-cache` | pushes to `main` that change `flake.nix`, `flake.lock`, `package-lock.json`, `.npmrc`, the Nix action or the workflow itself; weekly; by hand | the only workflow that writes caches: the Nix tarball, the Nix store cache and the npm cache, each fetched fresh from upstream; a separate read-only job runs the NixOS release check, so a failed weekly run reports an outdated release |
| `templates` (planned) | only on changes to templates or the Typst version | compile templates × DE/EN with the pinned Typst version |
| `e2e` (planned) | pull requests with the label `e2e`, before every release, otherwise once a week only if there were commits since the last run | Playwright in Firefox, Chromium, WebKit |
| `release` (planned) | manual (tag) | build; create a draft GitHub Release, attach standard and Pro HTML, `SHA256SUMS` and the SPDX bill of materials, then publish it (immutable release); Pages version (landing page, web app and documentation website, from one folder in one deploy) on GitHub Pages |
| Dependency Review | pull requests that change the lockfile | GitHub's own `dependency-review-action` reports new packages and known vulnerabilities |

**NixOS release check:** `npm run nixos-release` reads the release branch from `flake.lock`. NixOS supports a YY.05 release until 31 December and a YY.11 release until 30 June of the next year; its successor comes out about a month earlier. From the 1st of that last month CI warns that the successor is due; from the 16th, or for a branch that isn't a release branch, it fails, so the project moves while the old release is still supported.

### Consideration for upstream sources (caching)

Status: partly implemented; the Nix, npm and Dependabot parts are built, the caches for the Playwright browsers and the Typst CLI and the build artifact of check are not, planned for version 1.

- **Nix:** the release tarball of the pinned Nix version (the one the pinned nixpkgs ships) is cached with the version as key and checked against a SHA-256 pinned in `.github/actions/nix/action.yml` before it is installed. The dev shell comes from a `file://` binary cache kept in GitHub's cache, keyed on `flake.lock`, `flake.nix`, the action and the `seed-cache` workflow. `nix copy` keeps cache.nixos.org's signatures in it, so Nix checks every path against the `cache.nixos.org-1` key as it would on download; the shell's own `-env` output is rebuilt. CI also downloads the cheap wrappers that nixpkgs would otherwise build locally (`always-allow-substitutes`), so they too come signed. cache.nixos.org is the fallback on a miss; with a warm cache, the Nix setup needs neither it, releases.nixos.org nor github.com (checked on GitHub's runners on 2026-10-24; the checkout and the actions still come from GitHub). Signatures and the pinned hash detect altered content, not a poisoned cache entry: restoring an entry can write any file the runner can write, before Nix or the hash check looks at it. Only the single writer and the cache scopes keep such entries out (see "Avoid cache poisoning").
- **npm packages:** `~/.npm` is cached with the hash of `package-lock.json` and `.npmrc` as key; `check` restores it and runs `npm ci --prefer-offline`, which checks every package against the `integrity` in the lockfile. Registry access only happens when the lockfile changes.
- **Playwright browsers:** cached with the Playwright version as key; only WebKit system packages are installed if needed.
- **Typst CLI:** official release binary of a fixed version, checksum checked against a checked-in value, cached with the version as key.
- **REUSE tool:** comes from the dev shell (nixpkgs), like Node.js and Valgrind.
- **No fetching of external holiday sources in CI:** date-holidays comes from the npm cache, the python-holidays reference is checked in.
- **Dependabot:** once a month, grouped into one pull request, `cooldown` 14 days; GitHub Actions as a second ecosystem and Nix (`flake.lock`) as a third, also monthly. Within a release branch Dependabot updates `flake.lock`; once the next release branch exists, it opens a pull request that moves `flake.nix` to it. That pull request is only the notice: the move is made by hand on a branch of its own (dependency update procedure, see also the NixOS release check), and Dependabot's pull request is closed afterwards. `@playwright/test` is excluded (pinned to nixpkgs, see supply chain).
- **No pointless runs:** `concurrency` with `cancel-in-progress` cancels outdated runs of the same branch; path filters for `templates` and Dependency Review (not for `check`, see Workflows); no matrix over several Node versions (the app runs in the browser, Node is only for building); short `timeout-minutes`; no automatic retries.
- **Artifacts:** only the build result of `check`, with 3 days retention; releases live in GitHub Releases.

### Workflow security

Status: partly implemented; check, seed-cache and Dependency Review follow the rules, the release workflow with its write permissions (contents, pages, id-token, attestations), actions/attest-build-provenance and the Pages actions is not built, planned for version 1.

- Only actions from GitHub itself (`actions/checkout`, `actions/cache`, `actions/upload-artifact`, `actions/dependency-review-action`, `actions/attest-build-provenance`, Pages actions), each pinned by **commit SHA**, plus the repository's own composite action `.github/actions/nix`; Dependabot keeps the SHAs current. The repository settings enforce both: only actions created by GitHub are allowed, and a workflow using an action that isn't pinned to a full-length commit SHA doesn't start. Tools without an official GitHub action (Nix, Typst CLI) are installed with checksum pinning (see caching).
- `permissions: contents: read` as the default at workflow level; only `release` gets `contents: write`, `pages: write`, `id-token: write` and `attestations: write`.
- `actions/checkout` with `persist-credentials: false`.
- No `pull_request_target` (for public repositories GitHub blocks it by default from 2 November 2026, [workflow execution protections](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)), no secrets, nothing is published to npm.
- **Avoid cache poisoning** (the route of the TanStack attack): caches are written only by the `seed-cache` workflow, which restores nothing, takes everything fresh from upstream and runs no tests, no npm scripts and no pull-request code (only `main`'s flake, the Nix action and `npm ci` without install scripts). Every other workflow sets `cache-mode: read` (Dependency Review: `none`), which GitHub enforces with scoped tokens. Pull requests from forks only run after approval (setting "Require approval for all external contributors").
- **Nix:** installed single-user (`--no-daemon`) from the hash-checked tarball. `require-sigs` and `trusted-public-keys` stay at their defaults (only `cache.nixos.org-1`); never `trusted=true`, `--no-check-sigs` or `accept-flake-config`. The installed version must equal the one the pinned nixpkgs ships; otherwise the job fails and names the two values to update.
- Rulesets protect `main` (pull request and green `check` required) and the release tags; details under "Repository settings on GitHub".
- `npm ci` with `ignore-scripts` and `min-release-age` from the checked-in `.npmrc` applies in CI just as locally.

## Project operations and contributing

Status: not a requirement; moves to docs/dev/en/explanation/ in phase 3.

Recommendation: the expectations are stated visibly in one place, in short, friendly and clear words; GitHub's guide on balance for maintainers advises exactly this, to make your own boundaries public and to say "no" openly ([opensource.guide](https://github.com/github/opensource.guide/blob/main/_articles/maintaining-balance-for-open-source-maintainers.md)). The legal side (no warranty, no liability) is already covered by Art. 7 and 8 of the EUPL-1.2; the text below is the human side.

### Hobby project notice

Status: not a requirement; moves to README in phase 2.

In the README (at the top, short; German and English), in `SUPPORT.md` (German and English) and in `CONTRIBUTING.md` (English):

```markdown
## Projektstatus

restlos ist ein Hobbyprojekt, das ich in meiner Freizeit pflege.
Es gibt keine Zusagen zu Antwortzeiten, Fehlerbehebungen, neuen
Funktionen oder weiterer Pflege.

- Issues und Pull Requests sind willkommen. Ich schaue sie an, wenn ich
  Zeit und Lust habe, und schließe sie auch ohne ausführliche Begründung.
- Größere Änderungen bitte vorher in einem Issue besprechen.
- Die Software wird ohne Gewährleistung bereitgestellt (EUPL-1.2, Art. 7 und 8).
  Maßgeblich für deinen Urlaub sind dein Arbeitsvertrag und deine Personalabteilung.
- Wenn du mehr brauchst: Forken ist ausdrücklich erwünscht.
```

```markdown
## Project status

restlos is a hobby project I maintain in my spare time.
There are no promises about response times, bug fixes, new features
or continued maintenance.

- Issues and pull requests are welcome. I look at them when I have the
  time and energy, and I may close them without a detailed explanation.
- Please open an issue before starting larger changes.
- The software is provided without warranty (EUPL-1.2, Articles 7 and 8).
  Your employment contract and HR department are authoritative for your leave.
- If you need more: forking is explicitly welcome.
```

### Files in the repository

Status: partly implemented; every file exists, the README has no screenshot, download or Pages link and no verification of checksums and attestations yet, planned for version 1.

| File | Content |
| --- | --- |
| `README.md` | short description, screenshot, download/Pages link, project status notice, verification of checksums and attestations |
| `SUPPORT.md` | where to report bugs and ideas (issue templates); no channel for general questions; hobby project notice |
| `CONTRIBUTING.md` | process (issue first), tests must pass, source citation for holiday data, no entitlement to a merge, language conventions, license of contributions (code, data and configuration EUPL-1.2, templates and examples MIT-0, documentation CC BY 4.0) |
| `SECURITY.md` | private reporting, best effort, no deadlines |
| `CODE_OF_CONDUCT.md` | short code of conduct (e.g. Contributor Covenant); gives a basis for closing unfriendly contributions |
| `.github/ISSUE_TEMPLATE/` | bug report and feature request, each with a mandatory checkbox "I understand this is a hobby project without commitments"; blank issues disabled |
| `CHANGELOG.md` | changes per version (format "Keep a Changelog") |

### Repository settings on GitHub

Status: not a requirement; moves to docs/dev/en/reference/ in phase 2.

Recommendation: settings that exist only on GitHub are listed here, so the repository (or a fork with the same protection) can be set up again without guessing. They are set once by hand; labels as of October 2026.

| Settings → | Setting | Reason |
| --- | --- | --- |
| General → Features | Issues on; Wikis, Projects and Discussions off; pull requests open to everyone | no channel for general questions (see `SUPPORT.md`); contributions are welcome |
| General → Pull requests | squash merging only; delete head branches automatically | linear history on `main` |
| General → Releases | release immutability on | the tag and the files of a published release can't be changed or deleted, and GitHub adds a signed release attestation ([immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)) |
| Actions → General | allow only actions created by GitHub; require actions to be pinned to a full-length commit SHA | enforces the rules under "Workflow security" |
| Actions → General | approval for fork pull request workflows: all external contributors | protects runners and caches |
| Actions → General | workflow permissions read-only; GitHub Actions may not create or approve pull requests | least privilege; workflows request more only where needed |
| Advanced Security | private vulnerability reporting | reporting path of `SECURITY.md` |
| Advanced Security | dependency graph, Dependabot alerts with malware alerts, Dependabot security updates | known vulnerabilities and malicious packages are reported; version updates come from `dependabot.yml` |
| Advanced Security | secret scanning with push protection | the project has no secrets; catches tokens committed by mistake |
| Advanced Security | code scanning: CodeQL default setup (JavaScript/TypeScript, GitHub Actions) | finds e.g. script injection in workflows; runs on pushes, pull requests and weekly, free for public repositories; a deliberate exception to "as rarely as possible" |
| Rules → Rulesets | branch `main`: pull request required (0 approvals, since a sole maintainer can't approve their own), status check `check`, linear history, no force push, no deletion, no bypass | every change goes through `check` |
| Rules → Rulesets | tags `v*`: no update, no deletion | protects release tags before publication; published releases are immutable anyway |
| Pages | source "GitHub Actions" | deployment by the `release` workflow |
| Environments → `github-pages` | deployments also allowed from tags `v*` | Pages is deployed from the release tag; by default only the default branch may deploy |
| Moderation | "Interaction limits" for new accounts only if needed; no stale bot, issues are closed by hand | hobby project without commitments |

Nothing needs to be set for GitHub's workflow execution protections: the default rule for public repositories blocks `pull_request_target`, which the project doesn't use.

**Order when setting up:** create the repository empty (without README, license or `.gitignore`), push `main`, then create the rulesets; otherwise the pull request rule blocks the first push. The status check `check` is added to the ruleset once the workflow exists and has run once. After enabling SHA pinning, check that the runs managed by GitHub (Dependabot, CodeQL default setup) still start.

### License compliance with REUSE

Status: partly implemented; reuse lint runs locally and in CI, the SPDX bill of materials of a release and the About / Licenses page are not built, planned for version 1.

The repository follows the FSFE's [REUSE specification](https://reuse.software): every file has a machine-readable license and copyright statement, and all license texts used are in the `LICENSES/` folder.

| Component | License (SPDX) | Stated via |
| --- | --- | --- |
| Source code, holiday data, build scripts, configuration (incl. `REUSE.toml`) | `EUPL-1.2` | SPDX header in the file or `REUSE.toml` |
| PDF templates, example template, example data, example plan file and rule set | `MIT-0` | `REUSE.toml` |
| Documentation, help texts, agent instructions (`AGENTS.md`, `CLAUDE.md`) and skills (all Markdown) | `CC-BY-4.0` | SPDX header in the file or `REUSE.toml` |
| Generated files (`package-lock.json`, `flake.lock`) | `CC0-1.0` | `REUSE.toml` |
| Third-party files (Lucide SVGs, fonts) | original license (Lucide `ISC`, Feather-derived icons `MIT`; fonts e.g. `OFL-1.1`) with the original copyright | `REUSE.toml`, license text in `LICENSES/` |

- `reuse lint` runs in `npm run check` and in the CI workflow `check`; an error fails the build.
- New files get an SPDX header (`SPDX-FileCopyrightText`, `SPDX-License-Identifier`) when they are created, where the file format allows comments; otherwise an entry in `REUSE.toml`.
- Every release additionally contains an SPDX bill of materials (`reuse spdx`) of the repository files.
- REUSE covers the files in the repository. The npm packages bundled into the HTML are collected during the build and listed on the "About / Licenses" page (see License).

### AI tools in the repository

Status: implemented.

`AGENTS.md` is the shared instruction file for AI coding tools; `CLAUDE.md` includes it for Claude Code via `@AGENTS.md`. In addition there are `.claude/` (settings, skills), `.mcp.json` (Svelte MCP) and a local plugin for language servers. Agents commit unsigned on branches and never push; the maintainer reviews, signs and pushes over SSH. Follow-ups and open decisions are tracked as Markdown files in `issues/` (conventions in `issues/README.md`); this internal backlog is separate from GitHub issues, which stay the channel for bug reports and ideas from users. Rationale and setup are in `docs/ai-tooling.md`. Text in the repository stands on its own: no pointers to chats, sessions or files outside it, short references always with a description, and nothing links into `docs/superpowers/`, the design and plan documents written with AI tools, which may disappear at any time but which only the maintainer deletes (`AGENTS.md`, "Text in the repository"; `npm run check` enforces the links).

### Releases and updates

Status: partly implemented; the tools of the release checklist are built, the release workflow, the About page and the update notice of the Pages version are not, planned for version 1.

- Versions according to Semantic Versioning; the version and the data status of the holiday rules are shown on the "About" page.
- The downloaded HTML doesn't check for updates itself (no network); new versions are available via GitHub Releases with a changelog.
- The Pages version updates via the service worker and shows "New version available – reload".
- New versions read old files (migration); older versions reject newer files with a clear message.
- Releases are immutable (see repository settings): the `release` workflow creates a draft, attaches all files and only then publishes it. A published release can't be changed and its tag can't be moved or reused; mistakes are fixed with a new patch version.

**Release checklist** (lightweight, instead of formal acceptance criteria):

- [ ] `check`, `templates` and `e2e` green.
- [ ] Short manual test: open the standard HTML via `file://` in the current Firefox ESR from the dev shell (`firefox-esr`), load a file, set days, save, export .ics and `.typ`; open the Pages version on a phone.
- [ ] Largest file: `npm run perf -- --largest-file <path>` writes the worst crafted plan file within the limits; open it in the Firefox ESR on the reference machine and note the times for reading and checking (target: under 2 s together).
- [ ] Screen reader: `npm run orca` prints the steps (Orca with a debug log, a fixed sequence of keys in the Firefox ESR); `npm run orca -- <log>` passes.
- [ ] Size budget met.
- [ ] REUSE check green, SPDX bill of materials generated; changelog and version number updated, data status of the holiday rules checked.
- [ ] Release published by the `release` workflow as an immutable release with `SHA256SUMS`, SPDX bill of materials and build provenance.

### Maintaining holiday data

Status: planned for version 1.

- No obligation to review annually; the help says openly that data can become outdated and that own day rules or iCal files take precedence.

### Privacy

Status: planned for version 1.

In the help and README: no accounts, no tracking, no network access; all data stays in the browser or in the files you save yourself. The browser keeps the device settings, the revision record and, while a plan has unsaved changes, a recovery copy of it (it can be switched off in the settings). In Chrome and Edge, other HTML files opened from the computer can read them. The Pages version is served by GitHub; GitHub's terms apply to retrieving the page, but planning data doesn't leave the device.

## Stages, risks, decisions

Status: not a requirement; moves to docs/dev/en/explanation/ and issues in phase 3.

Recommendation: three versions; each is usable on its own. The must lists under "Goals and scope" apply to versions 1 and 2; version 3 is only described here.

**Versions**

1. **Version 1 (standard HTML + GitHub Pages):** rule core with DE data, work week per country and contract (with validity), local rules; DE/EN with glossary; both views responsive incl. touch selection mode; counting model: cost = the overlap of the leave with the working time; multiple calendar sources incl. mandatory leave and "Leave from another plan"; one plan with one allowance per file, file operations like in an editor; plan file with `revision` warning; rule sets with "Save as rule set" and "Update rules from rule set"; device settings with export; light/dark, three schemes, simple color editor; .ics export; `.typ` export and print view with three templates; help incl. template starter pack, keyboard shortcuts and example; security measures and CSP; Pages version with service worker; project files (README, SUPPORT, CONTRIBUTING, SECURITY).
2. **Version 2 (Pro HTML):** after the feasibility test, Typst WASM, PDF with one click in the Web Worker, loading finished own templates with error messages, optionally the contract part as a PDF attachment; also on Pages.
3. **Version 3 (comfort):** contrast check in the color editor, bridge day hints, HTML self-copy (after the feasibility test), further countries as data files.

**Risks**

| Risk | Impact | Countermeasure |
| --- | --- | --- |
| Holiday rules wrong or outdated | wrong costs | reference model tests, versioned rule data, iCal as an escape hatch |
| Municipality special cases incomplete | wrong required work on 1–2 days | switch "applies at my place of work" with a link to the official source; single dates can be overridden |
| Browser storage with `file://` unreliable | settings lost | plan file is the source of truth; settings exportable; IndexedDB with app version and schema per record; start screen offers the settings import (tested 2026-11-02, see Delivery format) |
| Old file versions in the download folder | user loads an old state | `revision`, the revision warning (see File operations), file name with the revision (`.revN`) |
| Month columns on narrow devices | poor UX on the phone | month tiles as the phone default, fixed day column, selection mode |
| Typst WASM large or not runnable offline | Pro HTML is delayed | feasibility test before version 2; the standard HTML is fully usable without Pro |
| Typst versions differ | templates break | pinned version, minimum version in templates, CI with the pinned version |
| iCal files inconsistent | wrong days | import preview with checkboxes and a list of skipped events |
| Translations drift apart | missing texts | CI check of the catalogs, pseudo-localization |

**Decided**

- Project name **restlos-urlaubsplaner** (repository and file name of the HTML); short name in the app "restlos", subtitle "Urlaub rund um Feiertage und Brückentage planen" (EN: "Vacation planner for bridge days and holidays").
- Country-neutral core incl. work week per country; data initially only for Germany.
- Only days, no hours: taken as a share (in the UI the day detail's leave bar offers the plan's smallest leave unit, H and the range actions half and full days; data model and engine down to 1/32), required work with fractions; cost = the overlap of the leave with the working time.
- One plan, one allowance; no automatic carry-over; days from sources "Leave from another plan" (.ics or .urlaub.json) are displayed here and counted in the other plan, not in this one.
- License EUPL-1.2 for code and data; templates and examples MIT-0; documentation CC BY 4.0.
- German and English from version 1, with a fixed glossary.
- Development language English (code, identifiers, file-format keys, comments, commits, developer documentation including this specification); user-facing texts (UI, help, templates, README, SUPPORT, issue templates) in German and English.
- Pro HTML with Typst is accepted; no template editor, templates are created with Typst outside the app.
- No online fetching of holidays, no contract data in .ics, no loading back from .ics except as a one-time import into calendar sources (stored as entries; the .ics file is not kept).
- Svelte 5, TypeScript, Vite with vite-plugin-singlefile, Vitest; ical.js for the import; no component or icon library (Lucide SVGs as files); hardening according to "Measures against supply chain attacks".
- Option "Align by weekday" in the month columns, stored in the device settings.
- Public repository on GitHub Free; distribution as a download and via GitHub Pages (installable, offline); everything also buildable locally, CI only mirrors.
- GitHub settings as listed under "Repository settings on GitHub", including immutable releases, enforced SHA pinning of actions, rulesets for `main` and release tags, Dependabot malware alerts and CodeQL default setup.
- Browser baseline: current Firefox ESR, plus current Chromium browsers and Safari.
- Hobby project without commitments, visible in README, SUPPORT, CONTRIBUTING and the issue templates.
- Three kinds of files without references between them: plan file `.urlaub.json`, rule set `.regeln.json`, device settings export `.einstellungen.json` (German like the established `.urlaub.json`). Rule sets are copied into plan files and updated explicitly. No separate color scheme file: schemes live in the device settings and can be embedded in plan files and rule sets.

**Still to check at project start:** npm package name (only relevant when publishing on npm) and a trademark search in the DPMA register for "restlos".

**Sources**

- [Bayerisches Feiertagsgesetz, Art. 1](https://www.gesetze-bayern.de/Content/Document/BayFTG-1)
- [Bayerisches Landesamt für Statistik: Mariä Himmelfahrt](https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/index.php)
- [Bayerische Staatsregierung: changes after the 2022 census](https://www.bayern.de/pdf/printpdf.php?id=172032)
- [KMK holiday calendar](https://www.kmk.org/service/ferienregelung/ferienkalender.html)
- [date-holidays (GitHub)](https://github.com/commenthol/date-holidays)
- [python-holidays: Germany](https://python-holidays.readthedocs.io/en/latest/_autosummary/holidays.countries.germany.html)
- [typst.ts all-in-one library](https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html)
- [Typst 0.13 changelog](https://typst.app/docs/changelog/0.13.0/)
- [Svelte releases](https://releases.sh/svelte/svelte-releases.md)
- depscope: svelte
- [Unit 42: npm supply chain attacks](https://unit42.paloaltonetworks.com/?p=179395)
- [npm min-release-age and Dependabot cooldown](https://dev.classmethod.jp/en/articles/npm-min-release-age-dependabot-cooldown/)
- [GitHub: billing for Actions](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)
- [GitHub: plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- [GitHub: immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [GitHub: workflow execution protections](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)
- [GitHub: Dependabot malware alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-malware-alerts)
- [Chrome: File Handling API](https://developer.chrome.com/articles/file-handling)
- [web.dev: saving files](https://web.dev/articles/files/save-a-file)
- [Mozilla: Firefox release calendar](https://whattrainisitnow.com/calendar/)
