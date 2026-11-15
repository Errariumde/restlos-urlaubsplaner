---
status: open
priority: 3
area: scripts (docs checks)
branch:
created: 2026-11-15
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Edge cases in the docs checks

## Problem

The citation check (`scripts/citation-rules.ts`), the docs style check (`scripts/docs-rules.ts`) and the spec status check (`scripts/spec-status-rules.ts`) read Markdown with their own small parsers. Each covers the forms the repository uses today, but some forms that a writer would expect to work give false reports, and some citations that don't resolve pass unseen.

## Context

The three checks run in `npm run check`. Their tests are in `tests/scripts/citation-rules.test.ts`, `tests/scripts/docs-rules.test.ts` and `tests/scripts/spec-status-rules.test.ts`.

## Acceptance criteria

- [ ] The three checks read fenced code blocks with one shared helper: an opening fence of three or more backticks or tildes, closed only by a fence of the same kind and at least the same length, with the indentation a list item allows.
- [ ] Each case under Notes is fixed, or the check's comment states it as a known limit.
- [ ] Each fixed case has a test, and the test gaps under Notes are closed.

## Notes

### Fence parsers that differ

- `scripts/citation-rules.ts:24` takes any indented line that starts with three backticks or tildes for a fence, and doesn't pair the fence kind, so a `~~~` line closes a block opened with backticks.
- `scripts/docs-rules.ts:112` and `scripts/spec-status-rules.ts:19` accept only 0 to 3 spaces before a fence. So in the docs style check a fence indented 4 or more spaces inside a list item is read as prose and gives false reports: a step "1. Run:" followed by a fenced block indented under a nested list item has its commands checked as sentences. A writer expects code inside a list item to be skipped like any other code block.
- An unclosed fence blanks the rest of the file in all three checks, so a missing closing fence silently turns off every rule below it. A writer expects a report of the unclosed fence.

### Citation forms the section-name check skips

The section-name check (`SECTIONS`, `scripts/citation-rules.ts:101`) only reads quoted names that directly follow the file name, after a comma, a parenthesis or a space. A writer expects these to be checked too:

- unquoted names, as in `(docs/SPEC.md, Date arithmetic)`;
- a parent section before the quoted name, as in `(docs/SPEC.md, Architecture, "Worker")`;
- names in curly quotes;
- two names joined by "and" instead of a comma: only the first one is checked.

### Link check: false reports and misses

- Markdown links inside fenced blocks and code spans are resolved (`LINK`, `scripts/citation-rules.ts:100`), so an example link in a code span is reported. A writer expects code to be skipped.
- A link target in angle brackets, written `[a](<…>)`, is read with the brackets as part of the path. A writer expects the path inside the brackets to be resolved.
- An extensionless relative link without a slash on a developer page is skipped as a help topic ID (`scripts/citation-rules.ts:169`). Only user pages link by topic ID (`docs/dev/en/reference/documentation-style.md`, "User page links"); developer pages link by file path, so there a writer expects such a link to be checked.
- Headings with closing hashes (`## Title ##`) keep the hashes in their anchor (`headings`, `scripts/citation-rules.ts:30`), and a duplicate heading's numbered anchor (`#title-1`) is not known (`githubSlug`, `scripts/citation-rules.ts:11`). A writer expects the anchors GitHub gives.
- Percent-encoded anchors after a `docs/…` path are not decoded (`ANCHOR`, `scripts/citation-rules.ts:99`, used at :153), unlike those in Markdown links, so an anchor with an umlaut written as `%C3%BC` is cut at the `%` and reported.

### Other cases

- The spec citation allowlist (`SPEC_CITATION_ALLOWLIST`, `scripts/citation-rules.ts:192`) exempts whole files, so a new citation of the spec in an allowlisted how-to passes. A writer expects only the citations that exist today to be exempt.
- An italic path at the end of a sentence, `*docs/<missing>.md*.`, is skipped as a pattern (`pattern`, `scripts/citation-rules.ts:104`), because a `*` followed by a dot marks a pattern. A writer expects it to be resolved like a bold path.
- A code span of two or more backticks that contains a single backtick is not recognised (`CODE_SPAN`, `scripts/docs-rules.ts:113`), so its content is checked as prose.
- Reference-style link definitions and bare URLs are not skipped by the docs style check (`proseLines`, `scripts/docs-rules.ts:124`), so a word inside a URL can be reported.
- No check enforces that a topic ID is unique within an audience (`docs/dev/en/reference/documentation-style.md`), so a reference page and an explanation page with the same file name pass. A writer expects the check to report the second page.

### Test gaps

- No test for a relative link that leaves the repository through `..`.
- No test for the whitespace form, the file name followed by a space and a quoted section name.
- The test "does not take a test file's path property for a citation" (`tests/scripts/citation-rules.test.ts:99`) cites `docs/SPEC.md`, which exists in its file list, so it passes whether or not the check skips path properties. It should use a path that doesn't exist.
