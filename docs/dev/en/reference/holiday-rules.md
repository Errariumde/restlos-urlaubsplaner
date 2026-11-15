<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday rules

The embedded holiday data and how the app uses it. The keys of a country data file, the date rules, the local rules and the substitute days are defined in the [holiday data format](../../../holiday-data-format.md).

## Embedded countries

- `countries` in `src/data/holidays/index.ts` maps a country code to its data file. It holds `DE` only.
- A country is a data file in `src/data/holidays/` plus its import and its entry in `countries`. A country needs no rule code.

## Work week and week start

- The browser's locale does not set the week start ([`weekStart`](../../../holiday-data-format.md#top-level)).
- The required work per weekday comes from the contract's `week` in the plan file ([work week](../../../file-format.md#work-week)). The engine does not fill it from the country's `workWeek`.

## German local rules

| Switch | Regions | Holiday | Official source |
| --- | --- | --- | --- |
| `augsburg` | BY | Augsburger Friedensfest (Augsburg Peace Festival), 8 August, only in the City of Augsburg | [Bayerisches Feiertagsgesetz, Art. 1](https://www.gesetze-bayern.de/Content/Document/BayFTG-1) |
| `assumption` | BY | Mariä Himmelfahrt (Assumption Day), 15 August, only in predominantly Catholic municipalities | [Bayerisches Feiertagsgesetz, Art. 1](https://www.gesetze-bayern.de/Content/Document/BayFTG-1); [Bayerisches Landesamt für Statistik](https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/index.php) (Bavarian State Office for Statistics) |
| `corpusChristi` | SN, TH | Fronleichnam (Corpus Christi), only in certain municipalities | [SächsSFG, § 1](https://www.revosax.sachsen.de/vorschrift/3997); [FronleichnamsVO](https://www.revosax.sachsen.de/vorschrift/4142); [ThürFGtG](https://landesrecht.thueringen.de/bsth/document/jlr-NNLTH00003E03) |

- The Bavarian State Office for Statistics determines the municipalities for Assumption Day. Since 2025 it uses the 2022 census, which changed eight municipalities according to [bayern.de](https://www.bayern.de/pdf/printpdf.php?id=172032).
- In Saarland, Assumption Day applies statewide, without a switch.
