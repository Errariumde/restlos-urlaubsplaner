---
name: ui-texts
description: Add or change user-visible texts in restlos in German and English using ICU MessageFormat catalogs. Use whenever a UI string, help text or error message is added or changed.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# UI texts

1. Never hard-code user-visible strings in components. Use a message key.
2. Add the key to **both** catalogs (`de` and `en`) in the same change.
3. Use ICU MessageFormat for numbers, plurals and selects – never concatenate sentence parts.
   For day amounts, pass the number for plural selection and the formatted fraction (rule 4) as a separate argument.
   Don't use `#`: it formats via `Intl.NumberFormat` ("1,5" instead of "1½").
   `"{count, plural, one {{days} Tag} other {{days} Tage}} übrig"` with `count: 1.5, days: "1½"`.
4. Fractions of days are formatted via the shared formatter (½, 1½), not by hand.
5. Dates and weekday names come from `Intl.DateTimeFormat` with the UI locale.
6. Key names: English, dot-separated by area (`plan.remaining`, `file.saveAs`).
7. German texts: informal "du", short, no jargon. English: plain, sentence case.
8. Run the catalog consistency test (missing/unused keys) via `npm run check`.
