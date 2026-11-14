<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation style

The rules for every page under `docs/user/` and `docs/dev/`. Humans and agents follow the same rules. They adapt the style of the Diátaxis documentation framework.

## Terms

- **must:** the rule applies without exception.
- **must not:** the thing is not allowed.
- **may:** the thing is allowed and optional.

## Layout

- **Path pattern:** `docs/<audience>/<language>/<quadrant>/<topic>.md`.
  - Audiences: `user` for people who plan their leave, `dev` for contributors and agents.
  - Language: a two-letter code, such as `en` or `de`.
  - Quadrants: `tutorials`, `howto`, `reference`, `explanation`.
  - Decision records live in `explanation/decisions/`, named with a four-digit number and the topic.
  - Folder and file names are lower case with hyphens.
- **Folders:** a folder appears with its first page. There are no empty quadrant folders.
- **Topic IDs:** the topic ID is the file name without `.md`. It is unique within an audience. A retired topic ID is never reused.
- **Mirrored trees:** the trees under `docs/user/en/` and `docs/user/de/` mirror each other path for path.
- **User page links:** user pages link to each other by topic ID, not by file path: `[Tagesregeln](day-rules)`.
- **Developer page links:** developer pages use relative links. `npm run check` resolves them.
- **Meta pages:** they keep their own homes. `README.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and `CHANGELOG.md` stay at the repository root. Issues live in `issues/`, the licence texts in `LICENSES/`.

## Languages

- **English is the source.** A user page is written under `docs/user/en/` first.
- **German is required and current.** The same path under `docs/user/de/` must exist and match the current English text. It changes in the same commit as the English page.
- **Further languages are optional.** A folder such as `docs/user/fr/` may be added.
- **Developer docs are English only.**
- **German style:** these rules apply to user docs and UI texts only.
  - `du` as the form of address;
  - gender-neutral wording without gender characters such as `*`, `:`, `_` or a capital `I` in `-Innen`;
  - `z. B.` and `d. h.` with a non-breaking space (U+00A0);
  - no `wir`, tutorials included;
  - no Konjunktiv in instructions.

## Audience and mode

- Each page has one audience first, then one mode. The folder follows the mode.
- Mixing modes in one page is the defect. A page that is touched is split into one page per mode.
- Meta pages keep the homes named under "Layout".

## Voice

- No selling and no editorialising.
- A warning appears only where data or privacy can be lost. It is one sentence on what happens and how to avoid it.

## Order

- What, then why, then how.
- Rationale lives in explanation pages and is linked, not inlined.
- Inside an explanation page: the decision first, then why, then the rejected alternatives.

## Sentence and paragraph length

- English sentences: one idea each, about 15–20 words on average. A sentence over 25 words is split.
- German sentences: a sentence over about 20 words is split. It has at most one subordinate clause.
- Paragraphs: one idea, at most five sentences.
- Tables, code, paths and normative lists are exempt.

## Cut list

- Filler.
- Minimising words: `simply`, `easily`, `just`, `merely`, `obviously`, `straightforward`; in German `einfach`, `eben`, `halt`, `natürlich`, `offensichtlich`.
- Time-relative words such as `currently`, `now`, `soon`, `at the moment` and `will be`. They are allowed in `CHANGELOG.md` and in `issues/`. Elsewhere the text names the version.
- Latin abbreviations in English, such as `e.g.`, `i.e.` and `etc.`.
- Metaphor, idiom, humour and exclamation marks.

## Grammar

- Active voice and present tense. Passive is allowed when the actor does not matter.
- Normative reference uses must, must not and may, as defined under "Terms".
- They/them for a hypothetical person.

## Register per quadrant

| Quadrant | Register |
| --- | --- |
| reference | indicative, terse, no rationale, no second person |
| how-to | imperative, second person, no theory |
| tutorial | second person; `we` allowed in English only; show expected output |
| explanation | discursive; the only place for rejected alternatives |

Agent files: `AGENTS.md` is reference. Skills and how-tos are how-to.

## Checks

`npm run check` checks the mechanical rules of every page under `docs/user/` and `docs/dev/`:

- the path pattern;
- the cut words and Latin abbreviations;
- exclamation marks;
- `we` and `our` outside tutorials, and second person in reference pages;
- in reference pages, a line that starts with `Recommendation:`;
- in German pages, `wir`, gender characters and `z. B.` or `d. h.` without a non-breaking space;
- every cited `docs/` path and every relative link, anchors included.

The check skips code blocks, code spans, HTML comments and link targets. A page that quotes a cut word writes it as a code span.
