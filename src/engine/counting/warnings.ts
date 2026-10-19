// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, WEEKDAYS, clampYear, dayFromIso, dayFromYmd, weekdayOf, ymdFromDay } from "../days";
import type { Weekday } from "../days";
import { ruleDate } from "../holidays/rules";
import type { DateRule } from "../holidays/types";
import { checkRange, ruleHasDay } from "./match";
import { dateRuleKey } from "./rule-dates";
import type { DayRule, RangeMatch } from "./types";

export type RuleWarningCode = "leapYearLength" | "mixedRangeEnds" | "neverApplies";

export interface RuleWarning {
  readonly code: RuleWarningCode;
  readonly ruleId: string;
}

const NEVER_APPLIES_YEARS = 400;
const DEFAULT_FIRST_YEAR = 2000;
const A_SUNDAY = dayFromYmd(1970, 1, 4); // Easter is always a Sunday

const isFixedDate = (rule: DateRule): boolean => rule.type === "fixed" || rule.type === "once";

/** Four consecutive start years cover every leap-year position of a range of at most 366 days. */
function hasLeapYearLength(match: RangeMatch): boolean {
  if (match.days === undefined || match.from.type !== "fixed") return false;
  const ends = new Set<string>();
  for (let year = 2000; year <= 2003; year++) {
    const start = ruleDate(match.from, year);
    if (start === null) continue;
    const end = ymdFromDay(start + match.days - 1);
    ends.add(`${end.month}-${end.day}`);
  }
  return ends.size > 1;
}

function hasMixedEnds(match: RangeMatch): boolean {
  return match.to !== undefined && isFixedDate(match.from) !== isFixedDate(match.to);
}

/** The weekday every day of a date rule falls on, or undefined when it changes from year to year. */
function fixedWeekday(rule: DateRule): Weekday | undefined {
  switch (rule.type) {
    case "easter":
    case "orthodoxEaster":
      return weekdayOf(A_SUNDAY + rule.offset);
    case "weekdayRelative":
    case "nthWeekday":
      return rule.weekday;
    case "once":
      return weekdayOf(dayFromIso(rule.date));
    case "fixed":
      return undefined;
  }
}

/**
 * True when none of the range's weekdays can occur in it: the range starts on the same weekday and has the
 * same length in every year, so it covers the same weekdays in every year.
 */
function missesWeekdays(match: RangeMatch): boolean {
  const { from, to, weekdays } = match;
  const start = fixedWeekday(from);
  if (weekdays === undefined || start === undefined) return false;
  // Both ends counted from the same Easter Sunday, the end not before the start: always in the same year.
  const easter = from.type === "easter" || from.type === "orthodoxEaster";
  const sameSunday = easter && (to?.type === "easter" || to?.type === "orthodoxEaster") && to.type === from.type && to.offset >= from.offset;
  const length = sameSunday ? to.offset - from.offset + 1 : match.days;
  if (length === undefined) return false;
  const first = WEEKDAYS.indexOf(start);
  const covered = WEEKDAYS.filter((_, i) => (i - first + 7) % 7 < length);
  return !weekdays.some((weekday) => covered.includes(weekday));
}

/**
 * True when the rule gives no day in the years it is checked for: around a `once` date, else 400 years
 * from `validFrom` (from 2000 without it). Each window stops at the first day it finds.
 */
function neverApplies(rule: DayRule): boolean {
  const { match } = rule;
  const dates = match.type === "range" ? [match.from, match.to] : [match];
  // A day of rule year Y may lie in Y − 1 or Y + 1, so every window reaches one year further on both sides.
  const windows: { first: number; last: number }[] = [];
  for (const date of dates) {
    if (date?.type !== "once") continue;
    const year = ymdFromDay(dayFromIso(date.date)).year;
    windows.push({ first: clampYear(year - 2), last: clampYear(year + 2) });
  }
  if (windows.length === 0) {
    const first = Math.max(MIN_YEAR, rule.validFrom ?? DEFAULT_FIRST_YEAR);
    const last = Math.min(first + NEVER_APPLIES_YEARS - 1, rule.validUntil ?? MAX_YEAR, MAX_YEAR);
    if (first > last) return true;
    windows.push({ first: clampYear(first - 1), last: clampYear(last + 1) });
  }
  if (match.type === "range") {
    checkRange(match);
    if (missesWeekdays(match)) return true;
  }
  return windows.every(({ first, last }) => !ruleHasDay(rule, dayFromYmd(first, 1, 1), dayFromYmd(last, 12, 31)));
}

/** Warnings, not errors, for a day rule that is legal but probably not what its author meant. */
export function dayRuleWarnings(rule: DayRule): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  const add = (code: RuleWarningCode) => warnings.push({ code, ruleId: rule.id });
  if (rule.match.type === "range") {
    if (hasLeapYearLength(rule.match)) add("leapYearLength");
    if (hasMixedEnds(rule.match)) add("mixedRangeEnds");
  }
  if (neverApplies(rule)) add("neverApplies");
  return warnings;
}

export type RuleWarningCheck = (rule: DayRule) => RuleWarning[];

/** A key for what the warnings depend on: the match and the validity years. */
function warningKey(rule: DayRule): string {
  const { match } = rule;
  const when =
    match.type === "range"
      ? `range:${dateRuleKey(match.from)}/${match.to === undefined ? String(match.days) : dateRuleKey(match.to)}/${match.weekdays?.join(",") ?? ""}`
      : dateRuleKey(match);
  return `${when}/${String(rule.validFrom ?? "")}/${String(rule.validUntil ?? "")}`;
}

/**
 * `dayRuleWarnings` that checks each distinct match and validity once, for the many rules and source
 * entries of one file read.
 */
export function dayRuleWarningsMemo(): RuleWarningCheck {
  const known = new Map<string, readonly RuleWarningCode[]>();
  return (rule) => {
    const key = warningKey(rule);
    let codes = known.get(key);
    if (codes === undefined) {
      codes = dayRuleWarnings(rule).map((warning) => warning.code);
      known.set(key, codes);
    }
    return codes.map((code) => ({ code, ruleId: rule.id }));
  };
}
