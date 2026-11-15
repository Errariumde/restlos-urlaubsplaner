<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Glossary

**Glossary** (binding for UI, help, templates and code identifiers):

| German | English | Meaning |
| --- | --- | --- |
| Soll | Required work | share of a day that would have to be worked (for example 0, ½, 1; any multiple of 1/32 possible) |
| Genommen | Taken | share of the day taken off (in the UI full or half days, and the plan's smallest leave unit in the day detail's leave bar) |
| Restarbeitszeit | Work left | the required work of a day that no leave covers, own, mandatory or from another plan |
| Kontingent | Allowance | available leave days of a plan |
| Plan | Plan | period + allowance + selected days |
| Vertrag | Contract | rules of the employment: region, local rules, work week, day rules, smallest leave unit, with name, description and references; no time zone, no working hours |
| Plandatei | Plan file | `.urlaub.json`: copy of a rule set plus exactly one plan |
| Regelwerk | Rule set | `.regeln.json`: contract, calendar sources, templates and optional color scheme without a plan; shared per company or collective agreement |
| Geräte-Einstellungen | Device settings | language, display options and own color schemes; stored in the browser, exportable as `.einstellungen.json` |
| Arbeitswoche | Work week | required work per weekday, with validity |
| Tagesregel | Day rule | own rule that lowers or fixes the required work (`requiredAtMost`, `requiredExactly`) or marks mandatory leave (`mandatory`) |
| Kalenderquelle | Calendar source | named list of days (dates or repeating matches) with type and color; imported once from iCal or a .urlaub.json file, or created by hand |
| Pflichturlaub | Mandatory leave | charges the allowance automatically |
| Bezahlte Betriebsruhe | Paid closure | required work 0, costs nothing |
| Urlaub aus anderem Plan | Leave from another plan | is displayed, not counted |
| Freizeit nötig | Time off needed | days or parts of days on which the user must be free (for example Kita closure); never costs, reported when not free |
| Am Stück frei | Stretch | consecutive days off |
| Brückentag | Bridge day | working day between a holiday and the weekend |
| Sonderschalter | Local rule | regional exception, for example Augsburger Friedensfest |
