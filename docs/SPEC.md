<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# restlos-urlaubsplaner – Specification (single-file HTML)

As of: 2026-10-17

## Goals and scope

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
| Svelte 5, intl-messageformat | MIT | permissive, unproblematic |
| Lucide icons | ISC (icons derived from Feather: MIT) | permissive |
| Embedded fonts | SIL OFL | separate works, bundling allowed; include license text |
| ical.js (iCal import at runtime) | MPL-2.0 | file-level copyleft: ical.js stays MPL-2.0 inside the larger EUPL work (MPL-2.0 §3.3); the About page says where to get its source code |
| date-holidays data, python-holidays | CC BY-SA / MIT | tests only, not shipped |

Other licenses only where necessary: built-in PDF templates, example template and example data under **MIT-0** (own templates may be derived freely), help and documentation under **CC BY 4.0**. License information in the repository follows REUSE (see Project operations). The "About / Licenses" page names the source repository (the minified HTML is the executable form), contains the NOTICE and license texts of all components and says where to get the source code of MPL-2.0 components (ical.js). No legal advice; have it checked once before the first publication if doubts remain.

**Target group:** employees (initially in Germany) who plan their annual leave including bridge days and pass the plan on to their calendar, partner or boss.

## Delivery format

Recommendation: two distribution channels from the same build. A **downloadable HTML file** for offline use from your own computer, and a **hosted version on GitHub Pages** (free for public repositories) that can be installed as a web app on the phone and then also runs offline. In both cases the data stays on the device.

| Variant | Size | Role |
| --- | --- | --- |
| Standard HTML for download (`file://`) | target under 600 KB | **main path on the computer** |
| Pro HTML for download | measure in feasibility test | version 2 |
| GitHub Pages with web app manifest and service worker | same as standard or Pro | **path for the phone** and quick start without download; usable offline after the first visit; installable as an app in Chrome/Edge on desktop with file association for `.urlaub.json` and `.regeln.json` |

**No desktop wrapper.** A local server .exe, Tauri and Electron were evaluated. The only real gain would be saving into the same file and opening by double-click in any browser. The installed Pages version in Chrome/Edge already covers that ([File Handling API](https://developer.chrome.com/articles/file-handling), from version 102, desktop only); for Firefox a browser setting helps (see below). The costs of a wrapper (builds for three operating systems, signing warnings, a second supply chain with Rust crates, a local server as attack surface) don't fit a stable hobby project.

**Supported browsers:** the current **Firefox ESR** (currently 153, as of 2026-10-17; ESR 140 received its last update on 2026-09-29, see [Mozilla's release calendar](https://whattrainisitnow.com/calendar/)) and current Firefox, the two newest versions of Chromium browsers (Chrome, Edge) and Safari (macOS, iOS). The ESR is decisive: only browser features available there are used (among others container queries, `<dialog>`, popover, `DecompressionStream`, Web Workers, WebAssembly; checked against the ESR before project start). Vite's `build.target` is set to the current ESR. Playwright's Firefox is a patched Playwright build, not the ESR; ESR compatibility is therefore checked manually with `firefox-esr` from the dev shell. If a feature is missing, the app shows a clear message instead of a broken UI.

**Consequences of `file://` for the design**

- No `fetch()` on local files: holiday data, fonts and WASM are embedded inline. The user's files only come in via the file picker or drag and drop.
- Saving: in Chrome/Edge the app writes directly back into the opened file via the File System Access API; Firefox and Safari don't have this interface ([web.dev](https://web.dev/articles/files/save-a-file)), there the file is downloaded, with the name of the opened file as suggestion. For Firefox, the help explains the setting "Always ask you where to save files": a save dialog then appears in which the original file can be overwritten, instead of collecting copies like "(1)" in the download folder. On the phone via download or the share menu.
- Browser storage (`localStorage`) is unreliable: depending on the browser, all local HTML files share one storage or each path has its own (feasibility test). Keys with the prefix `urlaubsplaner:v1:`; with empty storage, the app offers to import a `.einstellungen.json`; the plan file is the source of truth. The GitHub Pages version has its own, stable storage (own origin), separate from the downloaded file.
- No network access at runtime; the service worker of the Pages version only loads the app's own files.

## Holiday sources and work week

Recommendation: a **country-neutral rule core** with embedded data initially only for Germany, plus **any number of calendar sources** from iCal files. Country-neutral costs hardly any extra effort as long as the core is limited to Gregorian and Easter-based rules.

### Rule types of the core

| Rule type | Example | Needed for DE? |
| --- | --- | --- |
| Fixed date | 3 Oct, Tag der Deutschen Einheit (German Unity Day) | yes |
| Easter ± n (Western) | Whit Monday = Easter + 50 | yes |
| Weekday before/after date | Buß- und Bettag (Day of Repentance and Prayer) = Wednesday before 23 Nov | yes |
| Valid from/until year | International Women's Day in Berlin from 2019, Mecklenburg-Vorpommern from 2023 | yes |
| One-off date | Reformation Day 2017 nationwide | yes |
| n-th weekday in month | common in many countries | no, cheap |
| Easter ± n (Orthodox) | countries with Orthodox Easter | no, cheap |
| Substitute day on weekend | "falls on Sunday → Monday off"; refers to the country's weekend | no, cheap |

A fixed date "02-29" is only allowed with an explicit behavior for non-leap years (dropped, or 28 Feb / 1 Mar).

### Work week per country

Countries define the work week differently: weekend Sat/Sun (DE), Fri/Sat (some countries in the Middle East), only one day off (six-day week), week start Monday, Sunday or Saturday. Therefore:

- The country data contains the **standard work week** (required work per weekday) and the **week start**.
- Substitute-day rules refer to the country's weekend, not fixed to Sat/Sun.
- The contract takes over the standard work week as a suggestion and can override it (part-time, shift model, six-day week).
- The week start in the UI comes from the country data or a separate table, not from the browser (its week info is missing in Firefox); the default for DE is Monday, changeable.

### Region tree and German special cases

Region tree country → region → optional sub-areas (e.g. DE → BY → "City of Augsburg", "Assumption Day applies"). Holiday names are translation keys. Further countries come later as a data file without code changes.

- Augsburger Friedensfest (Augsburg Peace Festival, 8 August): only the City of Augsburg ([Bayerisches Feiertagsgesetz, Art. 1](https://www.gesetze-bayern.de/Content/Document/BayFTG-1)).
- Mariä Himmelfahrt (Assumption Day) in Bavaria: only in predominantly Catholic municipalities; determined by the [Bayerisches Landesamt für Statistik](https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/index.php) (Bavarian State Office for Statistics), since 2025 based on the 2022 census (according to [bayern.de](https://www.bayern.de/pdf/printpdf.php?id=172032), a change in eight municipalities). In Saarland the day applies statewide.
- Fronleichnam (Corpus Christi) in Saxony and Thuringia only in certain municipalities.

After choosing the federal state, only its local rules appear, phrased as "applies at my **place of work**" (the place of work is decisive, not the place of residence; have it legally proofread before publication), with an explanatory text and a link to the official source. Municipality lists are not embedded.

### Multiple calendar sources (iCal)

Each imported file becomes a **calendar source**:

| Setting | Values |
| --- | --- |
| Name | free, e.g. "Company 2027", "Leave 2026" |
| Type | Holiday · Paid closure · Mandatory leave · Info · Leave from another plan |
| Effect | follows from the type (table below); for Holiday additionally required work 0 or ½ per event name |
| Color | reference to a slot of the color palette (e.g. "Accent 3"), optionally an own color |
| Priority | order via up/down buttons, only for the display order |
| Visible | on/off |

| Type | Effect on cost |
| --- | --- |
| Holiday | lowers the required work (to 0 or ½), can never raise it |
| Paid closure | required work 0, costs nothing |
| Mandatory leave | day counts as taken, charges the plan's allowance |
| Info (e.g. school holidays) | none, only a background band |
| Leave from another plan | none; shows e.g. in January the days already planned in the previous year, they are counted there. The source is an .ics or directly another .urlaub.json file |

Conflicts: all sources of a day are displayed (the detail view lists them, the cell shows up to three color dots). The same day with the same name from several sources or the built-in set is shown once and marked as a duplicate.

Import: choose file → preview of all recognized days with a checkbox per entry and a list **"not supported / skipped"** → set name, type, color → apply. **Update** replaces only the content of a source.

- Supported: all-day `VEVENT` (`DTSTART;VALUE=DATE`, `DTEND` exclusive, missing `DTEND` = 1 day), multi-day events, `DURATION`.
- Recurrences (`RRULE`, `RDATE`, `EXDATE`) are evaluated by ical.js in the visible period ± 1 year; whatever can't be evaluated is skipped and listed.
- Timed events are converted to the contract's time zone and assigned to the calendar day there; optionally ignored.
- The file content is saved in the plan file or rule set.

**School holidays** are not built in, because the dates are set anew every year. They come as a calendar source of type Info. The help names sources, in this order:

1. **Kultusministerkonferenz (KMK, Standing Conference of the Ministers of Education):** official `.ics` file per federal state for the current school year ([KMK holiday calendar](https://www.kmk.org/service/ferienregelung/ferienkalender.html)).
2. **OpenHolidays API:** school holidays per federal state from 2020, also available as iCal ([openholidaysapi.org](https://www.openholidaysapi.org/en/)); the license of the data is not stated on the site.
3. Private offerings like schulferien.org: convenient, but without guarantee for the origin of the data.

The app doesn't download these files itself; the user imports the saved file.

### Reference models for tests

| Source | Role |
| --- | --- |
| [date-holidays](https://github.com/commenthol/date-holidays) (code ISC, data CC BY-SA 3.0) | reference model in CI, not embedded |
| [python-holidays](https://python-holidays.readthedocs.io/en/latest/_autosummary/holidays.countries.germany.html) (MIT; in version 0.97 Assumption Day in BY and Corpus Christi in SN and TH are in the opt-in category "catholic", and Augsburg is its own subdivision) | second reference model in CI |

date-holidays is a development dependency and runs directly in the Vitest tests (all 16 federal states, 2000–2100); deviations are bugs or are on a documented exception list. python-holidays serves only as an occasional second cross-check: a script generates a reference file on rule changes, which is checked in. No online fetching at runtime.

## Counting model (weights)

Recommendation: every day has a **required work** value (how much work is owed), the user takes a **full** or **half** day off, and the cost is the smaller of the two. Internal calculation in integer units (1 day = 480), so that sums stay exact and planning down to 1/32 day is possible later without restructuring.

### The one formula

Cost of a day = min(taken, required work), with taken as a share of the day; the UI currently offers only 1 (full) and ½ (half).

| Day | Required work | Taken | Cost | Result |
| --- | --- | --- | --- | --- |
| normal Tuesday | 1 | full | 1 | full day off |
| normal Tuesday | 1 | half | ½ | half day off, ½ is worked |
| New Year's Eve (half day off by collective agreement) | ½ | half | ½ | **full day off** |
| New Year's Eve (half day off by collective agreement) | ½ | full | ½ | full day off |
| Holiday, weekend | 0 | – | 0 | not selectable as leave |

Whether morning or afternoon is only a note for display and .ics; it doesn't change the cost.

### Finer granularity: prepared, not implemented

Version 1 offers only **full** and **half** in the UI. Engine, file format and template interface are built so that planning down to **1/32 day** (15 minutes at 8 hours) is possible later without data migration and without changing the calculation logic. Anyone working on the code must observe this:

| Area | Requirement from version 1 |
| --- | --- |
| Unit | 1 day = 480 integer units (480 = 2⁵ · 3 · 5); thus ½, ⅓, ¼, ⅕, ⅙, ⅛, 1/16 and 1/32 are exact. Never floats, never the assumption "only 0, ½, 1". |
| Data model | `take` is a share of the day, written as a fraction string (`"1"`, `"1/2"`, later e.g. `"3/32"`), not `"full"`/`"half"`; on reading, decimal strings (`"0.5"`) are accepted too (see Date arithmetic). Morning/afternoon is an optional, separate field `part`. |
| Contract | The field `minUnit` (smallest leave unit) already exists, default `"1/2"`; loading checks that all values are multiples of it. Version 1 allows only `"1"` and `"1/2"` in the UI. |
| Engine | Cost = min(taken, required work) for arbitrary multiples of 1/32; no special cases for ½. |
| Display | one central formatting function for shares (mixed fractions like "12 ¾" or a decimal number, depending on the setting) that handles every denominator up to 32; the day cell draws its fill proportionally to the share, not just "half" or "full". |
| Operation | The choices in the day menu are generated from `minUnit` (today: – / ½ / full), not hard-wired. |
| .ics | Partial days as an all-day event with the share in the title; as an appointment with times only for ½ with `part`. |
| Templates | The data interface delivers shares as a number and as a fraction string; built-in templates must not contain fixed "half" assumptions. |
| Tests | Property tests calculate with random multiples of 1/32, although the UI offers only ½. |

What is still missing later is only UI: choosing finer steps in the menu, one more key and the `minUnit` setting in the contract dialog.

### How a day's required work comes about

1. **Base value** from the contract's work week (e.g. Mon–Fri = 1, Sat/Sun = 0; part-time Friday = 0 or ½).
2. **Lowering layers:** built-in holidays (0), calendar sources of type Holiday (0 or ½) and Paid closure (0), own day rules (e.g. "24 Dec and 31 Dec: at most ½"). The **minimum** of all applicable values applies. A rule can therefore never make a Sunday or holiday more expensive; if New Year's Eve falls on a Sunday, it stays 0.
3. **Force** (rare, explicitly marked): a rule sets the required work to a fixed value, e.g. working Saturday = 1. Forced rules apply after step 2.
4. **Manual override** of a single date applies last.

**Mandatory leave** (e.g. company-wide leave 27–30 Dec) is not a required-work value but marks days as taken; they charge the allowance with min(1, required work) and can only be changed via their rule or source. Paid closure, on the other hand, is required work 0.

### Work week with validity

The work week is a list with start dates, e.g. full-time until 30 June, four days from 1 July. This way a contract with a switch to part-time stays one file. The help explains the two common counting methods for part-time ("day off has required work 0, allowance reduced" vs. "required work ½") and that partial entitlements can be rounded according to § 5 BUrlG (Federal Leave Act); the user enters the allowance themselves.

### Date arithmetic

The engine calculates only with calendar days as integer day numbers (days since a fixed reference date), never with JavaScript `Date` and the local time zone. This prevents shifts by one day around daylight saving time changes; a lint rule forbids `Date` in the engine module.

In files, weights are strings: readers accept fraction strings (`"1/2"`) and decimal strings with a decimal point (`"0.5"`); writers always write fraction strings. Values that cannot be represented exactly in 1/480 are rejected on loading with a message.

## Files: plan file, rule set and settings

Recommendation: **three kinds of files**, each self-contained, without references between them. The app can neither remember nor reopen file paths, so a reference would make users open two files every time.

| File | Kind | Content | Typical use |
| --- | --- | --- | --- |
| `Name.urlaub.json` | plan file | a copy of a rule set (contract, calendar sources, templates, optional color scheme), personal changes to it and **exactly one plan** | one person's leave planning for one period, e.g. 2027 |
| `Name.regeln.json` | rule set | the same content **without a plan** | shared per company or collective agreement as the starting point for colleagues' plan files |
| `restlos.einstellungen.json` | device settings export | language, display options and own color schemes | moving personal settings to another browser or device |

The plan file is operated like a document in a normal desktop editor: New, Open, Save, Save as, Close. For the next year you create a new plan file based on the old one. A rule set is never referenced, only copied: a plan file stays usable on its own, and changes to a rule set are pulled in explicitly with "Update rules from rule set". There is no separate color scheme file; color schemes live in the device settings and can be embedded in plan files and rule sets.

### Content of the files

- **Contract:** country/region, local rules, work week with validity, day rules, time zone, working hours for half days, smallest leave unit (`minUnit`).
- **Calendar sources** incl. file content, name, type and color slot. A rule set never contains sources of type "Leave from another plan" (personal data).
- **Own PDF templates** (`.typ` text), individually exportable.
- **Color scheme** (optional), embedded for sharing, e.g. company colors.
- **Only in the plan file:**
  - **One plan:** period (start and end month), **one number of available days**, selected days, notes. Someone with a 30-day entitlement and 3 remaining days enters 33; there is no automatic carry-over.
  - The reference to the rule set it was created from or last updated from (ID, name, date).

In a plan file every copied part can be changed, e.g. a part-time work week or additional own calendar sources.

### File operations (editor behavior)

| Command | Behavior |
| --- | --- |
| **New** | Dialog: "Empty" (initial setup); "From rule set…": choose a `.regeln.json`, the initial setup takes its contract, calendar sources, templates and color scheme and asks only for the personal parts (see First start); if a plan file is open, "Based on the current file": takes over everything except the plan; plan empty, allowance empty, period shifted by one year. The last option offers to include the previous file as a source "Leave from another plan", so that e.g. January days from the previous year are visible. |
| **Open** | file picker, drag and drop or (installed web app in Chrome/Edge) double-click. A plan file opens for planning; a rule set opens for editing: calendar with required work and calendar sources, without plan and allowance. |
| **Save** | Chrome/Edge: back into the same file; Firefox/Safari: download with the name of the opened file (for the Firefox note see Delivery format) |
| **Save as** | new file name, suggestion `ContractName_Year.urlaub.json` for a plan file, `ContractName.regeln.json` for a rule set |
| **Save as rule set** | in a plan file: writes contract, calendar sources (without "Leave from another plan"), templates and color scheme as a new `.regeln.json`; the plan is never included |
| **Update rules from rule set** | in a plan file: choose a `.regeln.json`; a preview lists every difference with a checkbox (like the iCal import). Parts copied from this rule set are updated, added or removed; parts added in the plan file itself are kept. The work week is not preselected, because it is often personal (part-time). The plan is never changed. |
| **Close** | back to the start screen |

- Exactly one file is open per browser tab; a second file is opened in a second tab.
- Unsaved changes: the title shows `• filename`. New, Open and Close ask "Save / Don't save / Cancel". When the tab is closed, a web page can only trigger the browser's generic warning dialog, without its own text and only after a user interaction ([beforeunload](https://docs.w3cub.com/dom/window/beforeunload_event)); the autosave catches the rest.
- **Restore:** autosave in browser storage under `urlaubsplaner:v1:<id>`. The next time the same file is opened and its autosave is newer, the app asks "Restore unsaved changes from …?".
- There is no list of recently opened files: browsers don't allow access to file paths.

### What is stored where

| Content | Location |
| --- | --- |
| Contract, calendar sources, templates, color scheme (optional), plan | plan file `.urlaub.json` |
| Contract, calendar sources, templates, color scheme (optional), without plan | rule set `.regeln.json` |
| Language, light/dark/automatic, active color scheme, own color schemes, view, "Align by weekday", show calendar weeks | device settings (browser storage); exportable and importable as `.einstellungen.json` |

Calendar sources store a **color slot** of the palette (e.g. "Accent 3"), not a fixed color; a fixed color is possible as an exception. If a plan file or rule set contains a color scheme, the app asks on first opening "Use colors from file?"; on "Yes" the scheme is added to the own color schemes in the device settings and activated. The answer is remembered via the file's `id`.

### Format

JSON with a `schema` version and a `kind` (`"plan"`, `"ruleSet"` or `"settings"`); the app recognizes a file by its content, not by its extension. All values language-neutral (IDs, ISO dates, decimal point); keys in English according to the glossary. Sketch of a plan file:

```json
{
  "schema": "urlaubsplaner/1", "kind": "plan",
  "id": "6f1c…-uuid", "savedAt": "2026-10-17T14:02:00Z", "revision": 12,
  "ruleSet": { "id": "a93e…-uuid", "name": "Company X", "savedAt": "2026-09-30T08:00:00Z" },
  "contract": { "name": "Company X",
    "region": { "country": "DE", "state": "BY", "options": { "assumption": true, "augsburg": false } },
    "timeZone": "Europe/Berlin", "minUnit": "1/2", "workHours": { "am": "08:00-12:00", "pm": "13:00-17:00" },
    "week": [ { "from": "2020-01-01", "required": { "mon": "1", "tue": "1", "wed": "1", "thu": "1", "fri": "1", "sat": "0", "sun": "0" } } ],
    "rules": [ { "id": "new-years-eve", "origin": "a93e…-uuid", "match": { "fixed": "12-31" }, "max": "1/2", "label": { "de": "Silvester", "en": "New Year's Eve" } } ] },
  "sources": [ { "id": "previous-year", "name": "Company X 2026", "type": "otherPlan", "color": { "slot": "accent-3" }, "visible": true,
    "format": "urlaub.json", "content": "{…}" } ],
  "templates": [ { "id": "my-band", "name": "My year band", "api": 1, "typst": ">=0.13", "typ": "…" } ],
  "theme": null,
  "plan": { "range": { "from": "2027-01", "to": "2028-01" }, "allowance": "33",
    "days": [ { "date": "2027-05-07", "take": "1", "note": "Bridge day" } ] }
}
```

- Day rules, calendar sources and templates copied from a rule set carry its ID in `origin`; parts added in the plan file have none. "Update rules from rule set" uses this to tell them apart.
- A rule set (`.regeln.json`) has the same structure with `"kind": "ruleSet"`, without `ruleSet`, `plan` and `origin`, and never with sources of type `otherPlan`.
- The device settings export (`.einstellungen.json`) has `"kind": "settings"` and contains only the device settings listed above.

### Sharing and validation

- **Rule set for colleagues:** "Save as rule set" (see File operations): contract, sources, templates and color scheme, no leave days.
- **HTML self-copy** (version 3, after feasibility test): a copy of the app with an embedded rule set and without personal settings; opens directly in "New → From rule set".
- **No contract data in .ics.** In the PDF only on explicit request, and only the contract part without plan and notes.
- **Loading:** if the autosave of the same `id` is newer, the app offers to restore it (see File operations). Schema version, `kind`, unknown fields, invalid data and weights are reported as a list; a file whose content doesn't match its `kind` (e.g. a rule set with a plan) is rejected; apply partially or cancel; older schema versions via migration.

## Operation (UI/UX)

Recommendation: one screen with a switchable calendar view and an always visible allowance display. Every action shows its cost immediately; nothing is blocked, overdraft is only marked.

### View 1: Month tiles

```text
Wireframe month tiles: calendar on the left, allowance always visible on the right
+----------------------------------------------------------------------+
| Profile: Bavaria, Agreement X | Period: Jan 2027 - Jan 2028 | Load · Save · Export |
+----------------------------------------------------------------------+
| [Jan 2027] [Feb] [Mar] [Apr]          | Allowance                    |
| [May]      [Jun] [Jul] [Aug]          | Plan allowance: 33           |
| ... further months up to Jan 2028     | Planned 24 ½ · Remaining 8 ½ |
|                                       | [#########......]            |
| Legend: weekend, holiday,             | Stretches                    |
| required ½ (diagonal), leave, ½ leave | 21 Dec-3 Jan: 3 ½ -> 16 off  |
|                                       | 14-25 May: 6 -> 12 off       |
|                                       | Per calendar year            |
|                                       | 2027: 22 · 2028: 2 ½ (info)  |
+----------------------------------------------------------------------+
```

Classic calendar sheets per month (week start according to the country data, for DE Mon–Sun); the number per row adapts to the width. Good for planning individual weeks.

### View 2: Month columns

```text
Wireframe month columns: one month per column, days as rows
Day | Jan | Feb | Mar | Apr | May | Jun | Jul ...
  1 | Fr  | Mo  | ...                       (weekday abbreviation in every cell)
  2 | Sa  | Tu  | ...
 .. |
 31 |
Narrow width: scroll horizontally, the day column stays fixed.
```

One month per column, days 1–31 as rows, weekday abbreviation in every cell, like a wall year planner. Good for an overview of 13 months and as the model for the year band PDF. Both views share selection, keyboard and context menu; switching keeps focus and scroll position on the current date.

**Option "Align by weekday":** instead of days 1–31, the rows show weeks (repeated from the configured week start, up to 6 weeks or 37 rows), so that all Mondays are at the same height and bridge days become comparable across months. A single toggle in the view menu, no additional control in the calendar. The setting is a personal display preference and is stored in the **device settings**, not in the plan file; the year band template gets the same switch as a template parameter.

**Calendar weeks:** both views can show ISO 8601 calendar weeks (month tiles: narrow column on the left; month columns: marker at the start of each week). Default: on. Label from the language catalog ("KW", "Wk"). Stored in the device settings; the print templates have the same switch as a parameter.

### Day cell: what is shown how

A cell in the month columns is only about 75 px wide on desktop, so a fixed ranking of the layers applies:

1. **Background:** required work (working day, weekend, holiday, required work ½ as a diagonal split).
2. **Fill:** own leave (full or half), mandatory leave with a pattern.
3. **Border:** days from sources of type "Leave from another plan" (dashed, no deduction).
4. **Dots:** up to three calendar sources; more only in the detail view.
5. **Overlay:** today, focus, selection.

Day number and weekday abbreviation are always shown; the detail view shows everything else.

### Screen sizes

The breakpoints apply to the **width of the calendar area** (container queries), not of the whole window:

| Calendar width | Month tiles | Month columns | Allowance |
| --- | --- | --- | --- |
| ≥ 1100 px | 4 months per row | all columns (up to 13) | sidebar on the right |
| 800–1099 px | 3 per row | scroll horizontally, day column fixed | sidebar on the right, narrow |
| 520–799 px | 2 per row | 6 columns visible | compact bar at the top, expandable |
| < 520 px | 1 per row (**default on phones**) | 3 columns visible | compact bar at the top, details as a bottom sheet |

Minimum size for tap targets on touch devices: 40 × 40 px.

### First start

1. Start screen: **Open file** · **New** · **View example**. If the HTML already contains a rule set (HTML self-copy, version 3), it starts directly with "New → From rule set".
2. On "New": language (preset), country/federal state.
3. Work week (suggestion from the country data, part-time adjustable).
4. Period: presets "Calendar year", "Year + January", "Custom".
5. Allowance: one number, hint "Include remaining days from the previous year here".
6. Local rules of the country; optionally "24 Dec and 31 Dec at most ½" with one click.

With "From rule set", country, region, local rules and day rules come from the rule set and steps 2 and 6 are skipped (only the language is asked); the work week is preset from the rule set and can be adjusted.

### Calendar interaction

- **Mouse:** click = full leave day on/off; Shift-click = range up to the last clicked day; drag = range; right-click = menu (half, note, change required work for this date, details).
- **Touch:** tap = full on/off; long press = detail view with all information and actions; ranges only in **selection mode** (button in the bar), so that swiping to scroll and dragging to select don't collide.
- **Keyboard:** arrow keys, Space = full, H = half, Ctrl+Z/Ctrl+Y.
- **Detail view** (tooltip on desktop, sheet on the phone): date, required work and where it comes from, all sources, cost.

### Allowance display

- Plan allowance, planned, remaining, progress bar; remaining < 0 clearly marked. No carry-over field.
- List of **stretches**: leave days → consecutive days off (incl. weekends, holidays and days from "Leave from another plan").
- **Totals per calendar year** as pure information.
- Bridge day hints (version 3): working days that yield many days off with little leave; can be turned off.

### Colors, light and dark mode

- **Color roles:** working day, weekend, holiday, required work ½, leave full, leave half, mandatory leave, other plan, overdraft, today, focus, info band, accent 1–8 (for calendar sources).
- **Color scheme** = values for all roles, each for light and dark. Built in: "Standard", "High contrast", "Color vision deficiency" (Okabe-Ito); not changeable, only duplicable.
- **Mode:** light, dark, automatic (follows `prefers-color-scheme`).
- **Editor in version 1:** choose a color per role and mode, preview on a sample month. Contrast check with warning only in version 3.
- Day types additionally differ by pattern, never by color alone.
- **Print/PDF** uses its own light print palette per scheme.

### Multilingual support (from the start)

- All texts via message IDs in catalogs (`de.json`, `en.json`) in ICU MessageFormat, including plural rules; no composed sentence parts in code.
- Dates and month names via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`, plurals via `Intl.PluralRules` (also for 1.5 days). Week start from the country data, not from the browser.
- Language and country are independent. Holiday names are keys with translations; names from iCal and user texts stay unchanged.
- Files store only IDs and ISO values, never translated texts; own rule names optionally multilingual.
- Language switch at runtime without reload; help and built-in PDF templates bilingual.
- CI checks for missing/unused keys; pseudo-localization reveals truncated layouts.

**Glossary** (binding for UI, help, templates and code identifiers):

| German | English | Meaning |
| --- | --- | --- |
| Soll | Required work | share of a day that would have to be worked (e.g. 0, ½, 1; any multiple of 1/32 possible) |
| Genommen | Taken | share of the day taken off (UI currently: full or half) |
| Kontingent | Allowance | available leave days of a plan |
| Plan | Plan | period + allowance + selected days |
| Vertrag | Contract | rules of the employment: region, local rules, work week, day rules, time zone, working hours |
| Plandatei | Plan file | `.urlaub.json`: copy of a rule set plus exactly one plan |
| Regelwerk | Rule set | `.regeln.json`: contract, calendar sources, templates and optional color scheme without a plan; shared per company or collective agreement |
| Geräte-Einstellungen | Device settings | language, display options and own color schemes; stored in the browser, exportable as `.einstellungen.json` |
| Arbeitswoche | Work week | required work per weekday, with validity |
| Tagesregel | Day rule | own rule that lowers or forces the required work |
| Kalenderquelle | Calendar source | imported iCal or .urlaub.json file with name, type, color |
| Pflichturlaub | Mandatory leave | charges the allowance automatically |
| Bezahlte Betriebsruhe | Paid closure | required work 0, costs nothing |
| Urlaub aus anderem Plan | Leave from another plan | is displayed, not counted |
| Block | Stretch | consecutive days off |
| Brückentag | Bridge day | working day between a holiday and the weekend |
| Sonderschalter | Local rule | regional exception, e.g. Augsburger Friedensfest |

### Accessibility

Contrast according to WCAG AA for the built-in schemes, a screen reader label per day ("Friday, 7 May 2027, working day, leave full, costs 1"), fully operable by keyboard, focus visible in both modes.

### Built-in help

Offline, bilingual, context-sensitive ("?" on every dialog). Chapters: Getting started, Work week and part-time, Day rules, Calendar sources (incl. showing the previous year), Plan and allowance, Plan file, rule set and saving (incl. the Firefox setting for overwriting and installing the web app with file association), Colors, Keyboard shortcuts, Privacy, **Own PDF templates** (see Output), About/Licenses.

**Keyboard shortcuts** (in the help as an overview, in menus next to the entries):

| Key | Action |
| --- | --- |
| Arrow keys | move focus in the calendar |
| Space / H | set or remove leave full / half |
| Shift + click or Shift + arrow key | extend range |
| Ctrl+Z / Ctrl+Y | undo / redo |
| Ctrl+S / Ctrl+O | save / open (intercepted; check in Firefox and Chromium in the feasibility test) |
| V | switch view (tiles / columns) |
| W | align month columns by weekday |
| K | calendar weeks on/off |
| ? | help |

New, Save as and Close are only available in the menu: Ctrl+N, Ctrl+T and Ctrl+W are reserved by the browser and don't reach the page ([Mozilla bug 1203059](https://bugzilla.mozilla.org/show_bug.cgi?id=1203059)), and Ctrl+Shift+S opens screenshots in Firefox ([Mozilla help](https://support.mozilla.org/en-US/kb/take-screenshots-firefox)).

**View example:** the start screen opens a built-in, fictional plan file "Beispiel GmbH, Bayern, Vollzeit" (Example Ltd, Bavaria, full-time) with an allowance of 30 days, the day rule "24 Dec/31 Dec at most ½", a calendar source "Betriebsurlaub" (company-wide leave; mandatory leave 28–30 Dec), an info source "Projektphase" (project phase), a source "Leave from another plan" with January days from 2026 and the plan 2027 with bridge days. Changes to the example are not saved automatically; "Save as own file" turns it into an own plan file.

### Controls, icons and fonts

No component or icon library:

| Need | Solution |
| --- | --- |
| Icons (approx. 15: open, save, export, settings, help, light/dark, undo/redo, view, warning, close …) | selected SVGs from [Lucide](https://lucide.dev) (ISC, Feather-derived icons MIT; compatible with the EUPL) as files in the repository, license notice on the license page; no npm package |
| Dialogs, menus, tooltips, detail sheet | the browser's built-in `<dialog>` and popover elements |
| Color picking | `<input type="color">` |
| Order of calendar sources | up/down buttons instead of dragging (reliable by touch and keyboard) |
| Date picking | not needed, the calendar itself is the selection |
| UI font | system fonts, 0 KB |
| Font for print/PDF | one embedded OFL font, only for Typst or the print view |

## Output: .ics and PDF

Recommendation: generate .ics ourselves. PDF with **Typst as the only template language**: the standard HTML exports a standalone `.typ` file and offers a browser print view; the **Pro HTML** contains Typst as WASM and creates the PDF with one click. Templates are created outside the app with Typst and loaded ready-made; there is no editor.

### .ics export (RFC 5545)

- Mandatory: `VERSION:2.0`, `PRODID`, per event `UID` and `DTSTAMP`; TEXT values correctly escaped (`,` `;` `\`, line breaks).
- All-day events: `DTSTART;VALUE=DATE`, `DTEND` exclusive. Half days optionally all-day with the title "Leave (½, morning)" or as an appointment with the working hours from the contract, then with `TZID` and a generated `VTIMEZONE`.
- Default: **one event per leave day** with a `UID` from contract ID and date. Stretches as one event are selectable, but their `UID` changes when a stretch grows; note in the dialog.
- Leave: `TRANSP:OPAQUE`, `X-MICROSOFT-CDO-BUSYSTATUS:OOF`. Holidays exported along with it: `TRANSP:TRANSPARENT`, without OOF.
- Line folding after 75 octets, without splitting UTF-8 characters ("½" is 2 bytes); CRLF.
- Titles in the current UI language. No contract data in the .ics.
- The help says openly: import is not synchronization; deleted days must be removed from the calendar by hand, and some programs create duplicates on re-import.
- The exported .ics can be loaded again next year as a source "Leave from another plan".

### PDF: variants

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

Own templates are created outside the app. The help page "Create your own PDF template" (offline, bilingual) provides everything needed:

1. **Starter pack for download**: example template (\~40 commented lines) and a file with **example data** in the interface format; plus "Export current plan as data" to test with real data.
2. **Working with Typst locally**: `typst watch template.typ` shows changes immediately. The help names the required Typst version and the bundled fonts.
3. **Data interface**: reference of all fields (period, days with required work, selection, sources with colors, holiday names in the current language, stretches, totals, print colors, language, translations), generated from the schema at build time.
4. **Helper functions** in the bundled library: `t("key")` for translations, date and fraction formatting matching the language.
5. **Load a finished template**: the app checks the `api` version and the Typst minimum version. In the Pro HTML it is compiled once with example data; errors appear with line numbers. The template is saved in the plan file or rule set.
6. Built-in templates can be downloaded as a starting point.

## Architecture, technology and tests

Recommendation: **Svelte 5** (currently 5.57.2 from 6 October 2026) and **TypeScript**, built with **Vite** and [vite-plugin-singlefile](https://cdn.jsdelivr.net/npm/vite-plugin-singlefile@2.3.3/README.md), which inlines JavaScript and CSS into one HTML file; tested with **Vitest**. The calendar engine is a pure TypeScript module without DOM and without runtime dependencies and can be verified in isolation.

```text
Architecture: one engine calculates, all outputs read the same state

Built-in rules (Easter ± n, local rules) ---------\
Calendar sources (iCal; any number, type, color) ---> Calendar engine --> Plan state --> Calendar + bar
Plan/rule set (JSON; load, migration, validation) -/   (required work per     (selection,   --> .ics export
                                                        day as minimum,        undo,         --> print CSS / .typ
                                                        cost in 1/480 day,     autosave)     --> JSON + HTML copy
                                                        stretches, totals
                                                        per year; pure
                                                        functions, no UI)
```

All outputs (UI, .ics, PDF, JSON) read the same computed state; no output recalculates costs itself.

**Size budget:** standard HTML under 600 KB including the DE/EN catalogs, help, templates and one font. The Pro HTML is a second build target from the same sources plus Typst WASM; its size is measured in the feasibility test.

**Licenses in the build:** third-party licenses and NOTICE files are collected automatically and embedded as the "About / Licenses" page with a link to the source repository.

**Feasibility tests before implementation**

| Test | Question | Before |
| --- | --- | --- |
| Browser storage with `file://` | Do local files share one storage? Does it survive renaming the file? (Firefox, Chromium) | version 1 |
| CSP and keyboard shortcuts | Do all CSP directives work via `<meta>` in the Firefox ESR? Do Ctrl+S and Ctrl+O reach the page? | version 1 |
| Calendar import | Behavior of Thunderbird, Google, Outlook on re-import of the same `UID` | version 1 |
| Typst WASM offline | compressed size, load time, fonts as bytes, compiling from `file://` | version 2 |
| HTML self-copy | rewrite the app's original bytes unchanged (carry the app source along as `type="text/plain"`) | version 3 |

**Test strategy** (engine first, like a DUT against reference models)

| Level | What | Tool |
| --- | --- | --- |
| Holidays | rule set against date-holidays (directly) and a checked-in python-holidays reference, all 16 federal states, 2000–2100; cases for SL and MV | Vitest |
| Rule types | Easter early/late, valid-from year, one-off days, substitute day with the country's own weekend, 29 February, 2000 and 2100 | Vitest, table-driven |
| Counting model | cost = min(taken, required work) for random multiples of 1/32; minimum of the lowering layers; 24/31 Dec on a weekend costs 0; ½ source on a holiday stays 0; mandatory leave; work week with a change; the sum is correct | Vitest + fast-check |
| Plans | sources "Leave from another plan" (.ics or .urlaub.json) are displayed and never count | Vitest |
| Date arithmetic | daylight saving time changes; no `Date` in the engine | Vitest, ESLint rule `no-restricted-globals` |
| iCal | round trip export → ical.js → same days; mandatory fields; UTF-8-safe folding; real example files (Google, Outlook, Thunderbird) | Vitest + ical.js |
| Files | load(save(x)) = x, migration, `revision` warning | Vitest + fast-check |
| Multilingual support, colors | missing/unused keys, pseudo-localization, contrast of the schemes | small check scripts |
| Types and style | TypeScript, Svelte components, lint | `tsc`, svelte-check, ESLint |
| PDF/Typst | every template × DE/EN with example data, pinned Typst version | Typst CLI |
| End-to-end | standard and Pro HTML via `file://` in Firefox (Playwright build), Chromium, WebKit; container widths 375/768/1100/1920 px. The Firefox ESR is not covered by Playwright and is tested manually (release checklist) | Playwright |

## Dependencies and supply chain

Recommendation: use common, widespread tools, but choose them deliberately and secure them with standard measures: exact versions, lockfile, no install scripts, a waiting period for new versions, an isolated build. The risk is real: from April to July 2026 alone there were several major npm compromises, partly via `preinstall` hooks, partly with malicious code that runs on import, partly with a valid provenance signature ([Unit 42](https://unit42.paloaltonetworks.com/?p=179395)).

### Dependencies

| Package | Purpose | In the HTML? | Assessment |
| --- | --- | --- | --- |
| svelte 5 | UI | runtime part | needed; 16 direct dependencies according to [depscope](https://depscope.dev/pkg/npm/svelte), almost all only for the compiler |
| vite, @sveltejs/vite-plugin-svelte | build, dev server | no | standard for Svelte; largest dependency tree in the project, build time only |
| vite-plugin-singlefile | everything into one HTML | no | small, fulfils exactly the core requirement |
| typescript | types | no | no dependencies |
| vitest | tests | no | fits Vite, shares its configuration |
| fast-check | property-based testing | no | few dependencies; high value for the counting model |
| eslint, eslint-plugin-svelte, svelte-check | lint, type checking | no | standard; covers among others "no `Date` in the engine" |
| typescript-eslint | ESLint parser and rules for TypeScript | no | needed to lint TypeScript; umbrella for parser, plugin, utils and typescript-estree from the same project |
| @eslint/js | ESLint's recommended rule set | no | from the ESLint team, no dependencies; no longer installed with eslint since ESLint 10 |
| ical.js | read iCal (and verify the export) | yes | 0 dependencies, MPL-2.0 ([depscope](https://depscope.dev/pkg/npm/ical.js)); proven parser instead of an own implementation, also covers `RRULE`/`EXDATE` |
| intl-messageformat (FormatJS) | ICU messages | yes | established ICU implementation; check the dependency tree during setup, otherwise `@messageformat/core` |
| date-holidays | reference model | no | development dependency, tests only |
| @playwright/test | end-to-end | no | standard; browsers locally from nixpkgs, in CI via Playwright |
| typst.ts + WASM | PDF (Pro) | yes (Pro) | pinned exactly, loaded only on the first export |
| date library | – | – | not needed; the engine calculates with day numbers |

### Measures against supply chain attacks

- **Exact versions** in `package.json`, `package-lock.json` checked in, installation with `npm ci`.
- **No install scripts:** `.npmrc` with `ignore-scripts=true`. esbuild (used by Vite) brings its binary via platform-specific packages; whether everything runs without an install script is checked during setup, otherwise a targeted exception. With `ignore-scripts=true`, npm also skips the `pre`/`post` scripts of `npm run`; the project doesn't rely on them.
- **Tools via npm scripts, not `npx`:** when stdin is not a TTY (CI, agents), `npx` installs missing packages without a prompt, bypassing the lockfile.
- **Waiting period for new versions:** `.npmrc` with `min-release-age=14` (days; from npm 11.10, [description](https://dev.classmethod.jp/en/articles/npm-min-release-age-dependabot-cooldown/)). Dependabot with a matching `cooldown` (14 days) and grouped updates; no automatic merging. `@playwright/test` is excluded from Dependabot (`ignore`), because it is pinned to the `playwright-driver` version from nixpkgs; `flake.lock` is updated manually (`nix flake update`; Dependabot has no Nix support) as part of the dependency update procedure.
- **Updates deliberately and rarely**, monthly as one collected Dependabot pull request, immediately only for security advisories.
- **Alerts from GitHub:** Dependabot alerts including [malware alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-malware-alerts) for known malicious packages, Dependabot security updates, and Dependency Review on pull requests (see Workflows).
- **Isolated build:** `npm ci` and builds in a separate user account or container without access to SSH keys, password manager and tokens, because malicious code can also run on import.
- **Network lock in the delivered HTML:** Content Security Policy in the `<meta>` tag with `connect-src 'none'`. This doesn't interfere with anything, because holidays are calculated locally from the embedded rules and iCal files come via the file picker, not over the network. Even if a compromised library gets into the HTML, it cannot send data.

## Security

Recommendation: every file from outside is considered untrusted, the app has no network access, and templates run isolated. The worst a manipulated file can then cause is an error message.

### Threats and countermeasures

| Input / risk | Example | Countermeasure |
| --- | --- | --- |
| Plan file or rule set from a colleague | manipulated JSON, huge file, `__proto__` key | size limit (5 MB); `JSON.parse` followed by schema validation of every field; keys like `__proto__`/`constructor` are discarded; data in `Map` or objects without prototype |
| iCal file from the internet | script in event names, endless `RRULE`, millions of events | size limit (5 MB) and event limit; recurrences evaluated only in the visible period ± 1 year; names always displayed as text |
| Display of foreign text | HTML/script in names and notes | Svelte escapes text; `{@html}` is forbidden for data (ESLint rule `svelte/no-at-html-tags`) |
| Own Typst template | endless loop, file or network access | Typst runs as WASM in a Web Worker with a time limit; it only sees the passed data and the bundled fonts, no files, no network |
| Data in Typst | injecting Typst code via holiday or note names | data is never inserted into Typst source code, but passed as JSON input and read there |
| .ics export | broken lines due to commas, semicolons, line breaks | RFC 5545 escaping of all TEXT values, tested |
| File names when saving | path characters in the contract name | file names reduced to safe characters |
| HTML file from a foreign source | HTML self-copy or "release" by third parties with malicious code | the help warns: HTML only from the official repository or from people you trust; immutable releases with `SHA256SUMS`, GitHub build provenance (`actions/attest-build-provenance`) and GitHub's release attestation; verification instructions in the README |
| Compromised dependency | malicious code in the bundle | see supply chain; additionally network lock via CSP |

### Content Security Policy

In the HTML's `<meta>` tag (GitHub Pages cannot set custom HTTP headers):

- `default-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
- `script-src` only with the SHA-256 hashes of the embedded scripts, computed at build time; in the Pro HTML additionally `'wasm-unsafe-eval'` for WebAssembly. No `eval`, no `new Function`.
- `style-src 'unsafe-inline'` (embedded styles; low risk, since no foreign HTML is rendered), `img-src data: blob:`, `font-src data:`, `worker-src blob:`, or in the Pages version `'self'` for the service worker.
- The Pages version additionally needs `manifest-src 'self'`: with `default-src 'none'` the web app manifest would otherwise be blocked and the app could not be installed.
- Whether every directive works via `<meta>` and all features run with it in the Firefox ESR is checked in the feasibility test.

### Verification

- Fuzzing of the parsers (iCal, plan file, rule set, settings export, template metadata) with fast-check: random and broken inputs may only lead to error messages, never to crashes or wrong data.
- CI test: the built HTML contains the CSP, and no network request leaves the page (Playwright intercepts requests).
- `SECURITY.md` with private reporting via GitHub's "Private vulnerability reporting"; handled on a best-effort basis, without any deadline commitment.

## Build and CI (GitHub Free and local)

Recommendation: everything runs locally with one command; GitHub Actions only runs the same commands, as rarely as possible, with a cache for all downloads and minimal permissions. This way neither the npm registry nor any other server is hit again on every run, and the project stays buildable without GitHub.

**Local (NixOS):** a Nix flake with a dev environment (Node.js LTS with npm ≥ 11.10, Typst, Python for the python-holidays reference, Playwright browsers, Firefox ESR for the manual test). `nix develop`, then `npm ci`, `npm run check`, `npm run build`. The flake lock file pins all tools; the README explains the commands for Nix beginners.

**GitHub Free, public repository:** standard runners are free ([GitHub docs](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)), GitHub Pages is available ([GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Free doesn't mean unlimited: runs are still kept sparse.

### Workflows

| Workflow | Trigger | Content |
| --- | --- | --- |
| `check` | push to `main`, pull requests; only on changes to code, data, lockfile or workflow (path filter) | `npm ci`, lint, REUSE check, type check, Vitest, build, size check |
| `templates` | only on changes to templates or the Typst version | compile templates × DE/EN with the pinned Typst version |
| `e2e` | pull requests with the label `e2e`, before every release, otherwise once a week only if there were commits since the last run | Playwright in Firefox, Chromium, WebKit |
| `release` | manual (tag) | build; create a draft GitHub Release, attach standard and Pro HTML, `SHA256SUMS` and the SPDX bill of materials, then publish it (immutable release); Pages version (web app) on GitHub Pages |
| Dependency Review | pull requests that change the lockfile | GitHub's own `dependency-review-action` reports new packages and known vulnerabilities |

### Consideration for upstream sources (caching)

- **npm packages:** cache via `actions/cache/restore` and `actions/cache/save` (saving only on `main`), the key is the hash of `package-lock.json`. Registry access only happens when the lockfile changes.
- **Playwright browsers:** cached with the Playwright version as key; only WebKit system packages are installed if needed.
- **Typst CLI:** official release binary of a fixed version, checksum checked against a checked-in value, cached with the version as key.
- **REUSE tool:** `reuse` is installed with `pip install --require-hashes -r` from a checked-in, hash-pinned requirements file; the pip cache is keyed on the hash of that file. Like the Typst CLI, without a third-party action.
- **No fetching of external holiday sources in CI:** date-holidays comes from the npm cache, the python-holidays reference is checked in.
- **Dependabot:** once a month, grouped into one pull request, `cooldown` 14 days; GitHub Actions as a second ecosystem, also monthly. `@playwright/test` is excluded (pinned to nixpkgs, see supply chain).
- **No pointless runs:** `concurrency` with `cancel-in-progress` cancels outdated runs of the same branch; path filters; no matrix over several Node versions (the app runs in the browser, Node is only for building); short `timeout-minutes`; no automatic retries.
- **Artifacts:** only the build result of `check`, with 3 days retention; releases live in GitHub Releases.

### Workflow security

- Only actions from GitHub itself (`actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact`, `actions/dependency-review-action`, `actions/attest-build-provenance`, Pages actions), each pinned by **commit SHA**; Dependabot keeps the SHAs current. The repository settings enforce both: only actions created by GitHub are allowed, and a workflow using an action that isn't pinned to a full-length commit SHA doesn't start. Tools without an official GitHub action (Typst CLI, `reuse`) are installed with checksum or hash pinning (see caching).
- `permissions: contents: read` as the default at workflow level; only `release` gets `contents: write`, `pages: write`, `id-token: write` and `attestations: write`.
- `actions/checkout` with `persist-credentials: false`.
- No `pull_request_target` (for public repositories GitHub blocks it by default from 2 November 2026, [workflow execution protections](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)), no secrets, nothing is published to npm.
- **Avoid cache poisoning** (the route of the TanStack attack): caches are only written by runs on `main`; pull request runs only read. Pull requests from forks only run after approval (setting "Require approval for all external contributors").
- Rulesets protect `main` (pull request and green `check` required) and the release tags; details under "Repository settings on GitHub".
- `npm ci` with `ignore-scripts` and `min-release-age` from the checked-in `.npmrc` applies in CI just as locally.

## Project operations and contributing

Recommendation: the expectations are stated visibly in one place, in short, friendly and clear words; GitHub's guide on balance for maintainers advises exactly this, to make your own boundaries public and to say "no" openly ([opensource.guide](https://github.com/github/opensource.guide/blob/main/_articles/maintaining-balance-for-open-source-maintainers.md)). The legal side (no warranty, no liability) is already covered by Art. 7 and 8 of the EUPL-1.2; the text below is the human side.

### Hobby project notice

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

`AGENTS.md` is the shared instruction file for AI coding tools; `CLAUDE.md` includes it for Claude Code via `@AGENTS.md`. In addition there are `.claude/` (settings, skills), `.mcp.json` (Svelte MCP) and a local plugin for language servers. Agents commit unsigned on branches and never push; the maintainer reviews, signs and pushes over SSH. Rationale and setup are in `docs/ai-tooling.md`.

### Releases and updates

- Versions according to Semantic Versioning; the version and the data status of the holiday rules are shown on the "About" page.
- The downloaded HTML doesn't check for updates itself (no network); new versions are available via GitHub Releases with a changelog.
- The Pages version updates via the service worker and shows "New version available – reload".
- New versions read old files (migration); older versions reject newer files with a clear message.
- Releases are immutable (see repository settings): the `release` workflow creates a draft, attaches all files and only then publishes it. A published release can't be changed and its tag can't be moved or reused; mistakes are fixed with a new patch version.

**Release checklist** (lightweight, instead of formal acceptance criteria):

- [ ] `check`, `templates` and `e2e` green.
- [ ] Short manual test: open the standard HTML via `file://` in the current Firefox ESR from the dev shell (`firefox-esr`), load a file, set days, save, export .ics and `.typ`; open the Pages version on a phone.
- [ ] Size budget met.
- [ ] REUSE check green, SPDX bill of materials generated; changelog and version number updated, data status of the holiday rules checked.
- [ ] Release published by the `release` workflow as an immutable release with `SHA256SUMS`, SPDX bill of materials and build provenance.

### Maintaining holiday data

- Every rule in the data file carries a link to the official source and the date of the last check.
- Changes to rules only with a source and a test; contributions for further countries as a data file plus tests, described in a data format documentation.
- No obligation to review annually; the help says openly that data can become outdated and that own day rules or iCal files take precedence.

### Privacy

In the help and README: no accounts, no tracking, no network access; all data stays in the browser or in the files you save yourself. The Pages version is served by GitHub; GitHub's terms apply to retrieving the page, but planning data doesn't leave the device.

## Stages, risks, decisions

Recommendation: three versions; each is usable on its own. The must lists under "Goals and scope" apply to versions 1 and 2; version 3 is only described here.

**Versions**

1. **Version 1 (standard HTML + GitHub Pages):** rule core with DE data, work week per country and contract (with validity), local rules; DE/EN with glossary; both views responsive incl. touch selection mode; counting model min(taken, required work); multiple calendar sources incl. mandatory leave and "Leave from another plan"; one plan with one allowance per file, file operations like in an editor; plan file with `revision` warning; rule sets with "Save as rule set" and "Update rules from rule set"; device settings with export; light/dark, three schemes, simple color editor; .ics export; `.typ` export and print view with three templates; help incl. template starter pack, keyboard shortcuts and example; security measures and CSP; Pages version with service worker; project files (README, SUPPORT, CONTRIBUTING, SECURITY).
2. **Version 2 (Pro HTML):** after the feasibility test, Typst WASM, PDF with one click in the Web Worker, loading finished own templates with error messages, optionally the contract part as a PDF attachment; also on Pages.
3. **Version 3 (comfort):** contrast check in the color editor, bridge day hints, HTML self-copy (after the feasibility test), further countries as data files.

**Risks**

| Risk | Impact | Countermeasure |
| --- | --- | --- |
| Holiday rules wrong or outdated | wrong costs | reference model tests, versioned rule data, iCal as an escape hatch |
| Municipality special cases incomplete | wrong required work on 1–2 days | switch "applies at my place of work" with a link to the official source; single dates can be overridden |
| Browser storage with `file://` unreliable | settings lost | plan file is the source of truth; settings exportable; prefixed keys; feasibility test |
| Old file versions in the download folder | user loads an old state | `savedAt`/`revision`, warning, file name with year |
| Month columns on narrow devices | poor UX on the phone | month tiles as the phone default, fixed day column, selection mode |
| Typst WASM large or not runnable offline | Pro HTML is delayed | feasibility test before version 2; the standard HTML is fully usable without Pro |
| Typst versions differ | templates break | pinned version, minimum version in templates, CI with the pinned version |
| iCal files inconsistent | wrong days | import preview with checkboxes and a list of skipped events |
| Translations drift apart | missing texts | CI check of the catalogs, pseudo-localization |

**Decided**

- Project name **restlos-urlaubsplaner** (repository and file name of the HTML); short name in the app "restlos", subtitle "Urlaubsplaner für Brückentage und Feiertage" (EN: "vacation planner for bridge days and holidays").
- Country-neutral core incl. work week per country; data initially only for Germany.
- Only days, no hours: taken as a share (UI currently full or half, data model and engine down to 1/32), required work with fractions; cost = min(taken, required work).
- One plan, one allowance; no automatic carry-over; days from sources "Leave from another plan" (.ics or .urlaub.json) are displayed, not counted.
- License EUPL-1.2 for code and data; templates and examples MIT-0; documentation CC BY 4.0.
- German and English from version 1, with a fixed glossary.
- Development language English (code, identifiers, file-format keys, comments, commits, developer documentation including this specification); user-facing texts (UI, help, templates, README, SUPPORT, issue templates) in German and English.
- Pro HTML with Typst is accepted; no template editor, templates are created with Typst outside the app.
- No online fetching of holidays, no contract data in .ics, no loading back from .ics except as "Leave from another plan".
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
- [depscope: svelte](https://depscope.dev/pkg/npm/svelte)
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
