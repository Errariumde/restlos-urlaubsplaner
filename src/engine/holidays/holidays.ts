// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, weekdayOf, ymdFromDay } from "../days";
import type { DayNumber } from "../days";
import { ruleDate } from "./rules";
import type { CountryData, Holiday, HolidayRule, RegionSelection } from "./types";

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function checkSelection(data: CountryData, selection: RegionSelection): void {
  if (selection.country !== data.country) {
    throw new RangeError(`Selection country "${selection.country}" does not match data country "${data.country}"`);
  }
  if (!data.regions.some((region) => region.id === selection.state)) {
    throw new RangeError(`Unknown state "${selection.state}" for country "${data.country}"`);
  }
  for (const key of Object.keys(selection.options ?? {})) {
    const localRule = data.localRules.find((rule) => rule.id === key);
    if (!localRule?.regions.includes(selection.state)) {
      throw new RangeError(`Option "${key}" is not a local rule of state "${selection.state}"`);
    }
  }
}

function appliesTo(rule: HolidayRule, selection: RegionSelection): boolean {
  if (rule.regions !== "all" && !rule.regions.includes(selection.state)) return false;
  return rule.localRule === undefined || selection.options?.[rule.localRule] === true;
}

/**
 * Holidays of a region selection between two days (both inclusive), sorted by
 * day, rule ID, regular before substitute. Throws RangeError for an invalid selection
 * or when `from` or `to` lies outside the years 1583 to 9999.
 */
export function holidaysBetween(
  data: CountryData,
  selection: RegionSelection,
  from: DayNumber,
  to: DayNumber,
): Holiday[] {
  checkSelection(data, selection);
  if (from > to) return [];

  // One year of margin on both sides, so substitutes of days outside the range are found.
  const firstYear = Math.max(MIN_YEAR, ymdFromDay(from).year - 1);
  const lastYear = Math.min(MAX_YEAR, ymdFromDay(to).year + 1);
  const rules = data.holidays.filter((rule) => appliesTo(rule, selection));

  const regular: Holiday[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    for (const rule of rules) {
      if ((rule.validFrom !== undefined && year < rule.validFrom) || (rule.validUntil !== undefined && year > rule.validUntil)) {
        continue;
      }
      const day = ruleDate(rule.date, year);
      if (day !== null) regular.push({ day, ruleId: rule.id, nameKey: rule.nameKey, substitute: false });
    }
  }

  const taken = new Set(regular.map((holiday) => holiday.day));
  const weekend = new Set(data.weekend);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const candidates = regular
    .filter((holiday) => ruleById.get(holiday.ruleId)?.substitute?.when.includes(weekdayOf(holiday.day)))
    .sort((a, b) => a.day - b.day || compareText(a.ruleId, b.ruleId));

  const substitutes: Holiday[] = [];
  for (const holiday of candidates) {
    let day = holiday.day + 1;
    while (weekend.has(weekdayOf(day)) || taken.has(day)) day++;
    taken.add(day);
    substitutes.push({ ...holiday, day, substitute: true });
  }

  return [...regular, ...substitutes]
    .filter((holiday) => holiday.day >= from && holiday.day <= to)
    .sort((a, b) => a.day - b.day || compareText(a.ruleId, b.ruleId) || Number(a.substitute) - Number(b.substitute));
}
