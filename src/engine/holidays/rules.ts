// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { WEEKDAYS, dayFromIso, dayFromYmd, daysInMonth, isLeapYear, weekdayOf, ymdFromDay } from "../days";
import type { DayNumber, Weekday } from "../days";
import { orthodoxEaster, westernEaster } from "../easter";
import type { DateRule } from "./types";

function weekdayIndex(weekday: Weekday): number {
  return WEEKDAYS.indexOf(weekday);
}

/** Days from `from` forward to the next `target` weekday (0 when equal). */
function forwardDistance(from: DayNumber, target: Weekday): number {
  return (weekdayIndex(target) - weekdayIndex(weekdayOf(from)) + 7) % 7;
}

/** Days from `from` backward to the previous `target` weekday (0 when equal). */
function backwardDistance(from: DayNumber, target: Weekday): number {
  return (weekdayIndex(weekdayOf(from)) - weekdayIndex(target) + 7) % 7;
}

/**
 * The day a rule falls on in `year`, or null when it has no occurrence that year.
 * Assumes a valid rule (validated by the data validator).
 */
export function ruleDate(rule: DateRule, year: number): DayNumber | null {
  switch (rule.type) {
    case "fixed": {
      if (rule.month === 2 && rule.day === 29 && !isLeapYear(year)) {
        switch (rule.nonLeap) {
          case "feb28":
            return dayFromYmd(year, 2, 28);
          case "mar1":
            return dayFromYmd(year, 3, 1);
          default:
            return null;
        }
      }
      return dayFromYmd(year, rule.month, rule.day);
    }
    case "easter":
      return westernEaster(year) + rule.offset;
    case "orthodoxEaster":
      return orthodoxEaster(year) + rule.offset;
    case "weekdayRelative": {
      const ref = dayFromYmd(year, rule.month, rule.day);
      switch (rule.relation) {
        case "onOrAfter":
          return ref + forwardDistance(ref, rule.weekday);
        case "after":
          return ref + (forwardDistance(ref + 1, rule.weekday) + 1);
        case "onOrBefore":
          return ref - backwardDistance(ref, rule.weekday);
        case "before":
          return ref - (backwardDistance(ref - 1, rule.weekday) + 1);
        default: {
          const unreachable: never = rule.relation;
          return unreachable;
        }
      }
    }
    case "nthWeekday": {
      if (rule.n === -1) {
        const last = dayFromYmd(year, rule.month, daysInMonth(year, rule.month));
        return last - backwardDistance(last, rule.weekday);
      }
      const first = dayFromYmd(year, rule.month, 1);
      return first + forwardDistance(first, rule.weekday) + (rule.n - 1) * 7;
    }
    case "once": {
      const day = dayFromIso(rule.date);
      return ymdFromDay(day).year === year ? day : null;
    }
    default: {
      const unreachable: never = rule;
      return unreachable;
    }
  }
}
