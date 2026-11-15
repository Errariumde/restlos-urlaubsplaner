<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday data

1. Read the [holiday rules](../reference/holiday-rules.md) reference, the [holiday sources](../explanation/holiday-sources.md) explanation and the format reference [`docs/holiday-data-format.md`](../../../holiday-data-format.md).
2. Find the **official legal source** (law portal, official gazette, parliament documentation, authority page). Wikipedia, legal reference collections or holiday websites are not sources. Cite only documents you actually opened and read.
3. Express the rule as data in `src/data/holidays/<cc>.json` with the existing rule types (`fixed`, `easter`, `orthodoxEaster`, `weekdayRelative`, `nthWeekday`, `once`, plus `validFrom`/`validUntil` and `substitute`) – do not add special-case code. If a new rule type is needed, stop and ask.
4. Add each document to the file's `sources` map as `{ title, url, checked }` (`checked` = ISO date you read it) and list its key in the rule's `sources`. Cite the defining law and, where it matters, the amending law behind a change of validity.
5. Regional sub-areas (for example Augsburg, Catholic municipalities in Bavaria) are local-rule switches (`localRules`, plus `localRule` on the holiday), phrased as "applies at my place of work" – never silently applied, no municipality lists. A new switch also needs a variant in `tests/reference/variants.ts` and its mapping in `tests/reference/date-holidays.test.ts` and `scripts/python-holidays-reference.py`.
6. Add tests in `tests/data/holidays/<cc>.test.ts`: known dates for at least three years per rule, including the years before and after each rule change, written from the source, not from engine output.
7. Cross-check against the reference models:
   - date-holidays runs inside `npm test`;
   - after rule changes, run `npm run reference:python` and commit the regenerated `tests/reference/python-holidays-de.json`.
   Fix every difference or explain it in `tests/reference/known-differences.ts` with the official source that settles it (the packages are oracles, not the authority).
8. Add the translation keys used by the data (`nameKey`, `explanationKey`) to both message catalogs ([UI texts](ui-texts.md)).
9. School holidays are **not** built in; they come via iCal import.
10. Run `npm run check` (includes `reuse lint`).

## Maintaining holiday data

- Every rule in the data file carries a link to the official source and the date of the last check.
- Changes to rules only with a source and a test; contributions for further countries as a data file plus tests, described in a data format documentation.

## Adding a country

1. Find the official legal sources (see the how-to above, step 2).
2. Create `src/data/holidays/<cc>.json` (lowercase country code); `REUSE.toml` already covers `src/data/**`.
3. Import it in `src/data/holidays/index.ts` and add it to `countries` under its code.
4. Add `tests/data/holidays/<cc>.test.ts` with known dates for at least three years per rule, including the years before and after each rule change. The validity test in `tests/data/holidays/de.test.ts` runs for every entry of `countries`.
5. Add the translation keys used by the file to the message catalogs (`docs/dev/en/howto/ui-texts.md`).
6. Cross-check against the Python `holidays` package and explain the differences.
