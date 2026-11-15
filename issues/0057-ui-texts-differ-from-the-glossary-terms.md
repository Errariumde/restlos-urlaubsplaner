---
status: open
priority: 3
area: docs, i18n
branch:
created: 2026-11-15
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# UI texts differ from the glossary terms

## Problem

`docs/dev/en/reference/glossary.md` says that UI texts must use its terms. The catalogs use other words for three of them:

| Glossary term (German / English) | Catalog keys | Catalog text (German / English) |
| --- | --- | --- |
| Genommen / Taken | `detail.leave.label` | "Urlaub" / "Leave" |
| Urlaub aus anderem Plan / Leave from another plan | `legend.otherPlan`, `day.leave.otherPlan` | "Urlaub aus anderem Plan" / "Leave in another plan", "leave in another plan" |
| Kalenderquelle / Calendar source | `detail.sources` | "Kalender" / "Calendars" |

## Context

- The glossary: `docs/dev/en/reference/glossary.md`, opening sentence and table.
- The catalogs: `src/ui/i18n/de.json` and `src/ui/i18n/en.json`.

## Acceptance criteria

- [ ] The maintainer decides, per term, which side changes: the glossary (its term, or a rule that allows a shorter UI label) or the catalogs.
- [ ] The glossary and the catalogs agree for these three terms; catalog changes follow the `ui-texts` skill in both languages.

## Notes

- For "Leave from another plan" only the English texts differ; the German texts match the glossary.
