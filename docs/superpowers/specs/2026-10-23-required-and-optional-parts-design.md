<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Design: required and optional parts, and reading that reports everything

As of: 2026-10-23. Branch: `file-format`, before it is handed to the maintainer.

## Intent

People write plan files and rule sets by hand, or edit what the app wrote. When a file has a problem, they should get everything they need to fix it, in one go, pointing at the exact place. When they leave out something the app can do without, nothing should happen.

Today this isn't specified cleanly:

- Which keys are required and which are optional is said in three places that don't fully agree: the key tables in `docs/file-format.md` (which mark 22 of about 100 keys), its "Missing optional parts" section, and the list of refusals in `docs/SPEC.md`.
- Some behaviour contradicts the idea of "optional". `contract.rules` refuses the file when it is missing, although the app works without rules. A missing `entries` drops its whole source.
- Reading stops at the first missing or invalid core value, and an invalid entry names only its first bad field. Someone missing three things fixes them one open at a time.
- There is no minimal example to start from: the spec's sketch shows every part, and the example in `docs/file-format.md` is the full Beispiel GmbH rule set.

This design is executed in the same run as the plan `docs/superpowers/plans/2026-10-20-open-check-and-perf-gate.md` (approved by the maintainer on 2026-10-23), together with the other decisions of 2026-10-23 listed at the end.

## Goals

1. **One rule** decides whether a key is required or optional, and every key is classified by it.
2. **Each fact lives in one place.** The spec states the principles; `docs/file-format.md` and `docs/day-rules-format.md` list every key and every code.
3. **Reading reports everything it can name for certain**, in one list, and stops only where nothing reliable can follow.
4. **Minimal examples** of a plan file and a rule set to start from.
5. **Tests keep the docs and the reader in agreement.**

## Non-goals

- The wording and layout of the open dialog: the UI branch.
- The position of a JSON syntax error. The engine reports `notJson` without a position; browsers put it in their error text, each in its own wording. Recorded for the UI branch (see "Other decisions").
- Whether an invalid image drops only itself or its template (decision 2b, deferred to issue 0009).
- New limits or changed limits.

## Anti-goals

- **Guessing.** Every report entry must be certainly correct about the loaded file. An entry may follow from another problem (a citation dropped because its reference was invalid), but it never assumes what the user meant and never describes a value that wasn't read. Likewise, reading never loads an entry in a form that does something other than what the file says (a rule widened to every year because its `validFrom` was invalid).
- **Noise on files the app wrote.** Reading a file the app wrote must give no report entries except notices that still apply (leave outside the period, a suggested `part`).
- **Refusing what the app could do without.** A missing optional part never refuses a file or drops an entry.
- **Silent changes.** As before: nothing in a file is dropped or changed without a report entry.

## The rule

A key is **required** when the app can't work with the file or the entry without it and no default would be right for every file. A key is **optional** when its absence has a default that is right for every file (an empty list, no color scheme, `part` "end"), or when only a feature the user may never use needs it.

Consequences, decided by the maintainer on 2026-10-23:

- **A missing optional part** reads as its default and is **not reported**. If the user later uses a feature that needs it, that feature says so, not reading.
- **A required part of the file itself** (for example `contract.week` or `plan.range`) that is missing or invalid **refuses the file**: nothing opens, and the user gets the full list of what to fix.
- **An optional part that is present must be complete.** Its own required keys count like any other required part: a template without `typ`, a leave day without `take`, a `ruleSet` reference without `id`. Such a part or list entry is **dropped** and reported as an Error, so the open dialog offers "Open without these parts".
- **An optional part that is present but invalid** depends on where it is:
  - **At the file, contract or plan level** (`sources`, `templates`, `theme`, `ruleSet`, `contract.name`, `description`, `references`, `rules`, `plan.days`, `overrides`, `notes`): only that part is dropped and reads as its default (an Error). This already holds for `theme`, `ruleSet` and `contract.references`; it now also holds for the lists.
  - **Inside a list entry:** the whole entry is dropped (an Error), as today. Reading the key as its default would change what the entry does: an invalid `take` would charge a full day, an invalid `validFrom` would widen a rule to every year. This also holds for a source's `visible` and `entries` and a template's `images`.
  - **Exception inside a list entry: values that are only shown.** An invalid rule `label`, `note` or `references`, or a source entry's `name`, is dropped alone and the entry is kept (an Error). This extends decision 2a from over-long texts to any invalid one.
  - **Unchanged special cases:** an invalid `minUnit` reads as `"1/2"` and is a Warning (`invalidMinUnit`, already approved); an option of `contract.region.options` that isn't `true` or `false`, or one the holiday data doesn't know, is dropped alone (an Error), so a broken switch doesn't refuse the file.

## Every key

"Yes" means: missing or invalid refuses the file when the key belongs to the file itself, and drops the part or list entry that holds it otherwise. "No" gives the default. **Bold** rows change today's behaviour.

### File

| Key | Required | Today |
| --- | --- | --- |
| `schema` | yes; reading stops | same |
| `kind` | yes; reading stops | same |
| `id` | yes | refused at the first problem |
| `revision` | yes | refused at the first problem |
| `ruleSet` | no, plan files only; none | same |
| `contract` | yes | refused at the first problem |
| **`sources`** | no, `[]` | **present but not a list: refused. New: dropped, Error** |
| **`templates`** | no, `[]` | **present but not a list: refused. New: dropped, Error** |
| `theme` | no, `null` | same (invalid: `null`, Error) |
| `plan` | yes in a plan file | refused at the first problem |

### Plan reference (`ruleSet`, the `plan` of an `otherPlan` source)

`id`, `name`, `revision`: all yes. Unchanged.

### Contract

| Key | Required | Today |
| --- | --- | --- |
| `name`, `description` | no; none | same |
| `references` | no, `{}` | same |
| `region` | yes | same |
| `minUnit` | no, `"1/2"` | same |
| `week` | yes, in plan files and rule sets | same |
| **`rules`** | **no, `[]`** | **missing: refused. New: `[]`, not reported; present but not a list: dropped, Error** |

A reference: `title`, `version`, `url`, `checked`, all yes. Unchanged.

A region: `country` yes; `state` yes in a plan file when the country's data has regions, otherwise no; `options` no, `{}`. Unchanged.

A work-week entry: `from` yes, `required` yes with all seven weekdays. Unchanged, except that every problem is reported instead of the first.

### Day rule (in `docs/day-rules-format.md`)

`id` yes; `match` yes; exactly one effect (`requiredAtMost`, `requiredExactly`, `mandatory`) yes; `validFrom`, `validUntil` no; `part` no, `"end"`; `label`, `note`, `references` no; `origin` no, plan files only. **Change:** an invalid `label`, `note` or `references` drops only that key, not the rule (today the rule is dropped).

### Source

| Key | Required | Today |
| --- | --- | --- |
| `id`, `name`, `type`, `color` | yes | same |
| `origin` | no, plan files only | same |
| **`visible`** | **no, `true`** | **missing: source dropped. New: `true`, not reported; present but invalid: source dropped, as today** |
| `plan` | yes for type `otherPlan`, otherwise not allowed | same |
| **`entries`** | **no, `[]`** | **missing: source dropped. New: `[]`, not reported; present but invalid: source dropped, as today** |

A source entry: exactly one of `date` and `match`, yes; `validFrom`, `validUntil`, `except` no (match entries only); `name` no; `required` of a `holiday` entry no, `"0"`; `take` of a `mandatory` or `needed` entry no, `"1"`; `part` no, `"end"`. An `otherPlan` entry: `date`, `from`, `to`, `kind` yes; `name` no. **Change:** an invalid `name` drops only the name, not the entry.

### Template

`id`, `name`, `api`, `typst`, `typ` yes; `origin` no, plan files only; `images` no, `[]`. An image: `name`, `type`, `data` yes. Unchanged.

### Plan

| Key | Required | Today |
| --- | --- | --- |
| `range` (`from`, `to`), `allowance` | yes | refused at the first problem |
| **`days`, `overrides`, `notes`** | no, `[]` | **present but not a list: refused. New: dropped, Error** |

A leave day: `date`, `take` yes; `part` no: on a partial day a missing `part` is suggested and reported (`partSuggested`, a Warning, as today). An override: `date`, `required` yes; `part` no. A note: `date`, `text` yes. Unchanged.

### Calls I made in this table (for the maintainer to check)

- `visible` becomes optional with `true`. The principle applies directly: showing a source is the only sensible reading of "not said".
- `color` stays required. No single default is right: every source would get the same color.
- A source's `name` and a template's `name` stay required. They are how the user tells sources and templates apart, and the app has no neutral text to show instead. A rule's `label` stays optional, because a rule is also described by its match and effect.
- `revision` stays required. It belongs to the file's identity together with `id`, and the revision warnings rely on it.
- `week` stays required in rule sets too. Changing that would add a question to "New → From rule set", which is UI work.
- A reference keeps `url` and `checked` required. A reference exists so the basis can be checked.
- An invalid optional key inside a list entry drops the entry, except for values that are only shown (see "The rule"). Reading a broken `take`, `validFrom`, `weekdays` or `except` as its default would make the entry do something the file doesn't say.
- A part that is not loaded, including a refused file, reports its Errors but not its Warnings and Infos.
- Follow-on entries (`unknownReference` after a dropped reference, and the like) stay, because they are correct about the loaded file.

## Reading

### What it reports

Reading reports everything whose message is certain:

- **Every problem gets its own report entry**, also several in one list entry: a rule without `id` and without `match` gives two.
- **A missing required key and an invalid value are told apart** by their code, so the message can say "missing" or "invalid". Two codes replace `invalidEntry` and the report use of `invalidCore`: `missingValue` and `invalidValue`. Both are Errors.
- **The path names the key itself**, as deep as reading looked: `contract.rules[2].match.month`, not only `contract.rules[2]` with the first field in `data`. Where the file has to choose between keys (exactly one effect; `date` or `match`; `to` or `days`) and none or several are present, the entry stands at the object, and `data` names the choices.
- **Every Error says what is not loaded:** the whole file, a list entry, an optional part, or only a text (decision 2a). How the entry carries this is left to the plan; the UI must not have to infer it from the path.
- **Paths are positions in the text that was read** (decision 1, below).
- **A part that is not loaded reports its Errors only.** When a file is refused, or a part or list entry is dropped, reading still reports every Error inside it (a second missing key, an unknown field, an unknown citation): they are all things to fix. Its Warnings and Infos are left out, because they describe values as loaded ("loaded, but changed", "loaded unchanged"), which isn't true of something that wasn't loaded. This replaces the item of issue 0014 that asked to keep only the drop entry for a dropped rule.
- **Follow-on entries stay** when a value is dropped but the part holding it loads, because they are correct about the loaded file and nothing is dropped silently: rules that cite a reference that was dropped get `unknownReference`; leave checked against `"1/2"` after an invalid `minUnit` gets `notMultipleOfMinUnit`; options in a rule set whose `state` was dropped get `unknownLocalRule`. All three behave as today.

### Where it stops or skips

Reading stops completely, with a single refusal and no list, when nothing reliable can follow:

- the text is larger than 10 MB (`tooLarge`) or isn't JSON (`notJson`);
- `schema` or `kind` is missing, unknown or newer (`unknownSchema`, `newerSchema`, `unknownKind`, `settingsNotSupported`), or a rule set holds `plan` or `ruleSet` (`kindMismatch`): they decide what the rest may contain;
- a size or count limit is exceeded (`limitExceeded`): reading on would cost what the limit prevents.

Everything else is read to the end. Where one value decides how others are read and that value is broken, the values that depend on it are skipped, not guessed:

- an invalid `country`: `state` and `options` are not checked;
- a source with a missing or unknown `type`: its entries are not checked, because the type decides their fields;
- a `match` with an unknown `type`: its fields are not checked;
- `contract` or `plan` not an object: nothing inside is read;
- a missing or invalid `plan.range`: no `outsidePeriod`, no `partSuggested` computation, no check of the 50,000 source days;
- an invalid `region` or `week`: no `partSuggested` computation (it needs the counting model).

### What comes back

- **Loaded:** the file, its report, and the position table of decision 1.
- **Refused by a stop:** one refusal with its code, as today.
- **Refused because a required part of the file is missing or invalid:** the refusal code `invalidCore` together with every Error reading found: every `missingValue` and `invalidValue` of the file's own parts, and the Errors in all other parts. Warnings and Infos are left out, as for any part that is not loaded. The UI shows one dialog that lists every problem, each with its own message, sorted by severity. A refused file is not checked (the check step needs a loaded file).

The decision "A refusal is not in the list: the file doesn't open, and one error message says why" (issue 0015, decision 4) is reworded accordingly. It was meant as one dialog, and the dialog now lists everything that has to be fixed.

Reading stays linear in the size of the file and never throws (`readFile` returns every outcome); the performance gate of the approved plan covers it.

## Documentation: one place per fact

- **`docs/SPEC.md`** states the principles only: the rule for required and optional, what reading reports, where it stops, the three outcomes, and the severity definitions (Error, Warning, Info). It no longer lists keys or codes: the refused list (`SPEC.md:347`), the situation table (`:350–:364`), the paragraph "Optional parts that are missing …" (`:366`) and the limits table go, replaced by links. The spec texts of Task 1 in the approved plan are rewritten to match; in particular, the "Severities" paragraph there lists codes, which moves to `docs/file-format.md`.
- **`AGENTS.md`** says that `docs/file-format.md` and `docs/day-rules-format.md` are the normative reference for the file format, as part of the spec.
- **`docs/file-format.md`** holds the details:
  - every key table gets a "Required" column with "yes", "yes in …", or "no" with the default; the "Missing optional parts" section is removed;
  - the refusal table lists the stop codes and `invalidCore` with "a required part of the file is missing or invalid", without listing keys;
  - the code table of "Loaded with a report" gets a "Severity" column; `src/engine/file/severity.ts` mirrors it;
  - the limits table stays here, and only here;
  - a new section "Minimal examples".
- **`docs/day-rules-format.md`**: the rule key table gets the same column, and the sentence "An over-long `label` or `note` makes the whole rule invalid" follows decision 2a.
- **Historical design documents** (`docs/superpowers/specs/2026-10-1*`) stay as they are; they record what was decided then.

## Minimal examples

- `examples/minimal/minimal.urlaub.json` and `examples/minimal/minimal.regeln.json`, each with only the required keys. The plan file: `schema`, `kind`, `id`, `revision`, `contract` with `region` (`country`, `state`) and one `week` entry, `plan` with `range` and `allowance`. The rule set: the same without `plan` and `state`. Covered by REUSE as MIT-0 (`examples/**`).
- `docs/file-format.md` shows both in a section "Minimal examples", as a starting point for writing a file by hand.
- They are not canonical (the writer adds the empty lists and `theme`), so they are exempt from the examples' byte-for-byte round-trip test.

## Tests that keep docs and reader in agreement

- The minimal examples read with an empty report and no hints, and `npm run plan` runs on them.
- The blocks in `docs/file-format.md` equal the two files.
- For each required key: removing it from the minimal plan file or rule set (or from a minimal list entry or optional part placed in it) gives `missingValue` at that key's path, and the outcome the rule says: refused, or that entry dropped.
- For each optional key: removing it from a full file gives no report entry. No shipped example holds every optional key (none has an `otherPlan` source, `origin`, templates or a non-null `theme` together), so the test builds its own full file; the shipped examples stay as they are and keep proving that files the app wrote read without noise.
- A file with several problems in different parts reports all of them; a refused one returns them with `invalidCore`.

## Other decisions of 2026-10-23 executed in the same run

1. **Hints and report entries point into the text that was read.** Reading returns, next to the file, a table that gives each kept list entry its position in the text (rules, sources, source entries, leave days, overrides, notes, and the other lists). The check step reports those positions, so both lists use the same positions, and they match what a hand-editor sees and what `npm run plan` prints. The UI uses the table the other way round to find and mark the loaded object. The table is never saved. This replaces the plan's "positions in the loaded file" (Task 2).
2. **2a: an over-long optional text drops only the text.** A rule's `label` or `note`, and a source entry's `name`, are dropped and reported (`textTooLong`, an Error, since the text is lost when saving); the rule or entry is kept. The same holds for an otherwise invalid one (see "The rule"). Ruling R20's extra report entry for the rule goes. A required text that is too long (a source's or template's `name`, a reference's `title` or `version`, a plan reference's `name`, a note's `text`) still drops the part that holds it. `contract.name` and `description` are left out, as today.
3. **2b: deferred.** Issue 0009 gets a note: an invalid image, or one over its size limit, drops its whole template today (ruling R21); when the export is built, decide whether only the image is dropped and the export reports it missing, in line with 2a.
4. **2d: a new low-priority issue** to verify the five interpretations in the example files: Metall-Elektro BW § 27 (Saturday before a Sunday 24 or 31 December), Versicherungen (Saturday at 0 required work, MTV § 13), Karneval Rheinland's "Vorschlag 2026" name, Augsburg's `assumption: true`, and IHK Köln not cited. The maintainer kept them as they are, without having verified them. They are checked before the app offers the examples as templates.
5. **A new issue for the UI branch, the open dialog's messages:** a dropped part exists only in the text, so the dialog can name it only by its path unless the report entry carries something to name it by (a rule's label, a source's name, an entry's date); and a JSON syntax error has no position yet.
6. **The maintainer's uncommitted edits** (`flake.nix`, `.claude/skills/release/SKILL.md`, `.claude/skills/dependency-update/SKILL.md`) go into the commit of plan Task 5, which builds what they describe.

## Left to the plan

- The order of the new tasks relative to the approved Tasks 1–6. Both change the reader; the plan sequences them so each commit passes `npm run check`.
- How a report entry says what is not loaded, and the shape of the position table.
- The exact spec and doc wording, written out in the plan for the maintainer to review, as Task 1 does today.
- Which existing tests change, and how the severity table in `severity.ts` gains `missingValue` and `invalidValue` and loses `invalidEntry`.
