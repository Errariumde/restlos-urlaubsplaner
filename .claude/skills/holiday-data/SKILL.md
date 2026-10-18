---
name: holiday-data
description: Add or change public holiday rules, regional special cases or work-week definitions for a country or region in restlos. Use when editing holiday data or the holiday engine.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday data

1. Read the section "Holiday sources and work week" in `docs/SPEC.md` and the format reference `docs/holiday-data-format.md`.
2. Find the **official legal source** (law portal, official gazette, parliament documentation, authority page). Wikipedia, legal reference collections or holiday websites are not sources. Cite only documents you actually opened and read.
3. Express the rule as data in `src/data/holidays/<cc>.json` with the existing rule types (`fixed`, `easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`, `once`, plus `validFrom`/`validUntil` and `substitute`) – do not add special-case code. If a new rule type is needed, stop and ask.
4. Add each document to the file's `sources` map as `{ title, url, checked }` (`checked` = ISO date you read it) and list its key in the rule's `sources`. Cite the defining law and, where it matters, the amending law behind a change of validity.
5. Regional sub-areas (e.g. Augsburg, Catholic municipalities in Bavaria) are local-rule switches (`localRules`, plus `localRule` on the holiday), phrased as "applies at my place of work" – never silently applied, no municipality lists. A new switch also needs a variant in `tests/reference/variants.ts` and its mapping in `tests/reference/date-holidays.test.ts` and `scripts/python-holidays-reference.py`.
6. Add tests in `tests/data/holidays/<cc>.test.ts`: known dates for at least three years per rule, including the years before and after each rule change, written from the source, not from engine output.
7. Cross-check against the reference models:
   - date-holidays runs inside `npm test`;
   - after rule changes, run `npm run reference:python` and commit the regenerated `tests/reference/python-holidays-de.json`.
   Fix every difference or explain it in `tests/reference/known-differences.ts` with the official source that settles it (the packages are oracles, not the authority).
8. Add the translation keys used by the data (`nameKey`, `explanationKey`) to both message catalogs (`ui-texts` skill).
9. School holidays are **not** built in; they come via iCal import.
10. Run `npm run check` (includes `reuse lint`).
