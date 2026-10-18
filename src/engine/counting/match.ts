// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { clampYear, MAX_YEAR, weekdayOf, ymdFromDay } from "../days";
import type { DayNumber } from "../days";
import { ruleDate } from "../holidays/rules";
import type { DayRule } from "./types";

export const MAX_RANGE_DAYS = 366;

/**
 * The days a rule matches between `from` and `to` (inclusive), sorted, each once.
 * Throws RangeError for a malformed range.
 */
export function ruleDays(
  rule: Pick<DayRule, "match" | "validFrom" | "validUntil">,
  from: DayNumber,
  to: DayNumber,
): DayNumber[] {
  const { match, validFrom = -Infinity, validUntil = Infinity } = rule;
  const found = new Set<DayNumber>();
  const firstYear = ymdFromDay(from).year;
  const lastYear = ymdFromDay(to).year;
  const add = (day: DayNumber) => {
    if (day >= from && day <= to) found.add(day);
  };

  // A rule's date for year Y may lie in Y − 1 or Y + 1, so look one year further on both sides.
  if (match.type !== "range") {
    for (let year = clampYear(firstYear - 1); year <= clampYear(lastYear + 1); year++) {
      if (year < validFrom || year > validUntil) continue;
      const day = ruleDate(match, year);
      if (day !== null) add(day);
    }
    return [...found].sort((a, b) => a - b);
  }

  const { days, weekdays, to: toRule } = match;
  if ((toRule === undefined) === (days === undefined)) {
    throw new RangeError("A range needs exactly one of `to` and `days`");
  }
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > MAX_RANGE_DAYS)) {
    throw new RangeError(`Range length must be a whole number from 1 to ${MAX_RANGE_DAYS}`);
  }
  if (weekdays !== undefined && weekdays.length === 0) {
    throw new RangeError("A range's weekdays must not be empty");
  }

  for (let year = clampYear(firstYear - 2); year <= clampYear(lastYear + 1); year++) {
    if (year < validFrom || year > validUntil) continue;
    const start = ruleDate(match.from, year);
    if (start === null) continue;
    let end: DayNumber | null = null;
    if (days !== undefined) {
      end = start + days - 1;
    } else if (toRule !== undefined) {
      const sameYear = ruleDate(toRule, year);
      end = sameYear !== null && sameYear >= start ? sameYear : null;
      if (end === null && year + 1 <= MAX_YEAR) {
        const nextYear = ruleDate(toRule, year + 1);
        if (nextYear !== null && nextYear >= start) end = nextYear;
      }
    }
    if (end === null) continue;
    for (let day = Math.max(start, from); day <= Math.min(end, to); day++) {
      if (weekdays === undefined || weekdays.includes(weekdayOf(day))) found.add(day);
    }
  }
  return [...found].sort((a, b) => a - b);
}
