// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/**
 * The day-rule matching and rule warnings as they were before the early exit, kept as test oracles: they
 * compute every year with `ruleDate` and collect every matched day. Also the random rules to compare with.
 */

import fc from "fast-check";
import type { DayMatch, DayRule, RangeMatch } from "../../../src/engine/counting/types";
import type { RuleWarning } from "../../../src/engine/counting/warnings";
import { MAX_YEAR, MIN_YEAR, WEEKDAYS, clampYear, dayFromIso, dayFromYmd, daysInMonth, isoFromDay, weekdayOf, ymdFromDay } from "../../../src/engine/days";
import type { DayNumber } from "../../../src/engine/days";
import { ruleDate } from "../../../src/engine/holidays/rules";
import type { DateRule } from "../../../src/engine/holidays/types";

/** `ruleDays` before the early exit. */
export function oracleRuleDays(rule: Pick<DayRule, "match" | "validFrom" | "validUntil">, from: DayNumber, to: DayNumber): DayNumber[] {
  const { match, validFrom = -Infinity, validUntil = Infinity } = rule;
  const found = new Set<DayNumber>();
  const firstYear = ymdFromDay(from).year;
  const lastYear = ymdFromDay(to).year;
  const add = (day: DayNumber) => {
    if (day >= from && day <= to) found.add(day);
  };
  if (match.type !== "range") {
    for (let year = clampYear(firstYear - 1); year <= clampYear(lastYear + 1); year++) {
      if (year < validFrom || year > validUntil) continue;
      const day = ruleDate(match, year);
      if (day !== null) add(day);
    }
    return [...found].sort((a, b) => a - b);
  }
  const { days, weekdays, to: toRule } = match;
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

/** `dayRuleWarnings` before the early exit: `neverApplies` collects every day of the 400-year window. */
export function oracleRuleWarnings(rule: DayRule): RuleWarning[] {
  const isFixedDate = (date: DateRule): boolean => date.type === "fixed" || date.type === "once";
  const hasLeapYearLength = (match: RangeMatch): boolean => {
    if (match.days === undefined || match.from.type !== "fixed") return false;
    const ends = new Set<string>();
    for (let year = 2000; year <= 2003; year++) {
      const start = ruleDate(match.from, year);
      if (start === null) continue;
      const end = ymdFromDay(start + match.days - 1);
      ends.add(`${end.month}-${end.day}`);
    }
    return ends.size > 1;
  };
  const neverApplies = (): boolean => {
    const { match } = rule;
    const dates = match.type === "range" ? [match.from, match.to] : [match];
    const windows: { first: number; last: number }[] = [];
    for (const date of dates) {
      if (date?.type !== "once") continue;
      const year = ymdFromDay(dayFromIso(date.date)).year;
      windows.push({ first: clampYear(year - 2), last: clampYear(year + 2) });
    }
    if (windows.length === 0) {
      const first = Math.max(MIN_YEAR, rule.validFrom ?? 2000);
      const last = Math.min(first + 399, rule.validUntil ?? MAX_YEAR, MAX_YEAR);
      if (first > last) return true;
      windows.push({ first: clampYear(first - 1), last: clampYear(last + 1) });
    }
    return windows.every(({ first, last }) => oracleRuleDays(rule, dayFromYmd(first, 1, 1), dayFromYmd(last, 12, 31)).length === 0);
  };
  const warnings: RuleWarning[] = [];
  const add = (code: RuleWarning["code"]) => warnings.push({ code, ruleId: rule.id });
  if (rule.match.type === "range") {
    if (hasLeapYearLength(rule.match)) add("leapYearLength");
    if (rule.match.to !== undefined && isFixedDate(rule.match.from) !== isFixedDate(rule.match.to)) add("mixedRangeEnds");
  }
  if (neverApplies()) add("neverApplies");
  return warnings;
}

/** Years from both ends of the supported range, around the default window (2000 … 2399) and anywhere. */
export const yearArb = fc.oneof(
  fc.integer({ min: MIN_YEAR, max: MIN_YEAR + 6 }),
  fc.integer({ min: 1995, max: 2405 }),
  fc.integer({ min: MAX_YEAR - 6, max: MAX_YEAR }),
  fc.integer({ min: MIN_YEAR, max: MAX_YEAR }),
);
const weekday = fc.constantFrom(...WEEKDAYS);
// Month and day as the reader accepts them outside `fixed` (no 29 February).
const monthDay = fc
  .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
  .filter(([month, day]) => day <= daysInMonth(2001, month));
const offset = fc.oneof(fc.integer({ min: -366, max: 366 }), fc.constantFrom(-366, -365, 365, 366));

/** Every kind of date rule the reader accepts, with Easter offsets up to ±366 and `once` dates near both ends. */
export const dateRuleArb: fc.Arbitrary<DateRule> = fc.oneof(
  monthDay.map(([month, day]): DateRule => ({ type: "fixed", month, day })),
  fc.constantFrom("drop", "feb28", "mar1").map((nonLeap): DateRule => ({ type: "fixed", month: 2, day: 29, nonLeap })),
  offset.map((value): DateRule => ({ type: "easter", offset: value })),
  offset.map((value): DateRule => ({ type: "orthodoxEaster", offset: value })),
  fc
    .tuple(weekday, fc.constantFrom("before", "onOrBefore", "after", "onOrAfter"), monthDay)
    .map(([w, relation, [month, day]]): DateRule => ({ type: "weekdayRelative", weekday: w, relation, month, day })),
  fc.tuple(fc.integer({ min: 1, max: 12 }), weekday, fc.constantFrom(1, 2, 3, 4, -1)).map(([month, w, n]): DateRule => ({ type: "nthWeekday", month, weekday: w, n })),
  fc
    .tuple(yearArb, fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
    .map(([y, month, day]): DateRule => ({ type: "once", date: isoFromDay(dayFromYmd(y, month, Math.min(day, daysInMonth(y, month)))) })),
);

/** Ranges between two date rules of `ends`, or with a length; half of them with weekdays. */
export const rangeArb = (ends: fc.Arbitrary<DateRule> = dateRuleArb): fc.Arbitrary<RangeMatch> =>
  fc
    .tuple(
      ends,
      fc.oneof(
        ends.map((to) => ({ to })),
        fc.oneof(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 366 })).map((days) => ({ days })),
      ),
      fc.option(fc.uniqueArray(weekday, { minLength: 1, maxLength: 7 }), { nil: undefined }),
    )
    .map(([from, end, weekdays]): RangeMatch => ({ type: "range", from, ...end, ...(weekdays ? { weekdays } : {}) }));

export const matchArb: fc.Arbitrary<DayMatch> = fc.oneof(dateRuleArb, rangeArb());

/** A day rule with any match and optional validity years, in any order. */
export const dayRuleArb: fc.Arbitrary<DayRule> = fc
  .tuple(matchArb, fc.option(yearArb, { nil: undefined }), fc.option(yearArb, { nil: undefined }))
  .map(([match, validFrom, validUntil]) => ({
    id: "r",
    match,
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(validUntil !== undefined ? { validUntil } : {}),
    requiredAtMost: 0,
  }));
