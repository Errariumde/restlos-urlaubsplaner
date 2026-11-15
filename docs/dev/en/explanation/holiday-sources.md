<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Holiday sources and work week

restlos computes public holidays with a country-neutral rule core. Embedded data exists only for Germany. Other days off, such as school holidays, come from any number of calendar sources, for example from iCal files.

## Why a country-neutral core

A country-neutral core costs hardly any extra effort, as long as it is limited to Gregorian and Easter-based rules.

Germany needs five kinds of rules: fixed dates, Western Easter with an offset, a weekday before or after a date, rules valid from or until a year, and one-off dates. Three more kinds are common in other countries and cheap to build: the n-th weekday in a month, Orthodox Easter with an offset, and a substitute day when a holiday falls on the weekend. The German data uses none of these three.

## Why the work week belongs to the country

Countries define the work week differently. Germany rests on Saturday and Sunday, some countries in the Middle East on Friday and Saturday, and a six-day week leaves only one day off. The week starts on Monday, Sunday or Saturday. Therefore the country data carries the weekend, a standard work week and the week start. Substitute days refer to the country's weekend, not to a fixed Saturday and Sunday.

A contract can still differ from the country's standard, for example with part-time work, a shift model or a six-day week. So the contract keeps its own work week.

The week start comes from the country data and not from the browser, because the browser's week information is missing in Firefox.

## Why local rules are switches

Some holidays apply only in parts of a region, such as one city or certain municipalities. The municipality lists are long and change: the 2022 census changed the Bavarian list for Assumption Day. restlos does not embed them. Instead, a switch asks whether the holiday applies at the place of work, and links to the official source. The place of work decides, not the place of residence, because the holiday frees a working day where the work is done.

## Rejected alternatives

- **A core for Germany only:** it would save little, and every further country would need new code.
- **Fetching holidays online:** restlos has no network access at runtime.
- **Embedded municipality lists:** they go out of date, and a wrong list gives wrong required work without notice.
- **Built-in school holidays:** they differ by state and year and are not public holidays; a calendar source covers them.
