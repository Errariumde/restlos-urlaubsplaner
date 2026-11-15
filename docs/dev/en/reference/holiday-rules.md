<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday rules

## Rule types of the core

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

## Work week per country

Countries define the work week differently: weekend Sat/Sun (DE), Fri/Sat (some countries in the Middle East), only one day off (six-day week), week start Monday, Sunday or Saturday. Therefore:

- The country data contains the **standard work week** (required work per weekday) and the **week start**.
- Substitute-day rules refer to the country's weekend, not fixed to Sat/Sun.
- The contract takes over the standard work week and can override it (part-time, shift model, six-day week).
- The week start in the UI comes from the country data or a separate table, not from the browser (its week info is missing in Firefox); the default for DE is Monday.

## Region tree and German special cases

Region tree country → region → optional sub-areas (for example DE → BY → "City of Augsburg", "Assumption Day applies"). Holiday names are translation keys. Further countries come later as a data file without code changes.

- Augsburger Friedensfest (Augsburg Peace Festival, 8 August): only the City of Augsburg ([Bayerisches Feiertagsgesetz, Art. 1](https://www.gesetze-bayern.de/Content/Document/BayFTG-1)).
- Mariä Himmelfahrt (Assumption Day) in Bavaria: only in predominantly Catholic municipalities; determined by the [Bayerisches Landesamt für Statistik](https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/index.php) (Bavarian State Office for Statistics), since 2025 based on the 2022 census (according to [bayern.de](https://www.bayern.de/pdf/printpdf.php?id=172032), a change in eight municipalities). In Saarland the day applies statewide.
- Fronleichnam (Corpus Christi) in Saxony and Thuringia only in certain municipalities.

Municipality lists are not embedded.
