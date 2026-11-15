<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday data

1. Read the [holiday rules](../reference/holiday-rules.md) reference, the [holiday sources](../explanation/holiday-sources.md) explanation and the [holiday data format](../../../holiday-data-format.md).
2. Find the **official legal source** of each rule, as [sources](../../../holiday-data-format.md#sources) defines it. Cite only documents you opened and read.
3. For a new country, create `src/data/holidays/<cc>.json` (lowercase country code), import it in `src/data/holidays/index.ts` and add it to `countries` under its code. `REUSE.toml` already covers `src/data/**`.
4. Express each rule as data in `src/data/holidays/<cc>.json` with the existing [date rules](../../../holiday-data-format.md#date-rules), validity years and substitute days. Do not add special-case code. If a new rule type is needed, stop and ask. Do not add school holidays: they belong in calendar sources.
5. Add each document to the file's `sources` map, with `checked` set to the date you read it, and list its key in the rule's `sources`. Cite the defining law and, where it matters, the amending law behind a change of validity.
6. Model a regional sub-area, such as Augsburg or the Catholic municipalities in Bavaria, as a [local rule](../../../holiday-data-format.md#local-rules). Do not add municipality lists. For a new switch, add a variant in `tests/reference/variants.ts` and its mapping in `tests/reference/date-holidays.test.ts` and `scripts/python-holidays-reference.py`.
7. Add tests in `tests/data/holidays/<cc>.test.ts`: known dates for at least three years per rule, including the years before and after each rule change. Write them from the source, not from engine output. The validity test in `tests/data/holidays/de.test.ts` already runs for every entry of `countries`.
8. Cross-check against the reference models:
   - date-holidays runs inside `npm test`;
   - after rule changes, run `npm run reference:python` and commit the regenerated `tests/reference/python-holidays-de.json`.
   Fix every difference or explain it in `tests/reference/known-differences.ts` with the official source that settles it (the packages are oracles, not the authority). Both reference models cover only DE; for a new country, ask before extending them.
9. Add the translation keys used by the data (`nameKey`, `explanationKey`) to both message catalogs ([UI texts](ui-texts.md)).
10. Run `npm run check` (includes `reuse lint`).
