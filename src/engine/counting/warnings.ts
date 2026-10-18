// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, dayFromIso, dayFromYmd, ymdFromDay } from "../days";
import { ruleDate } from "../holidays/rules";
import type { DateRule } from "../holidays/types";
import { ruleDays } from "./match";
import type { DayRule, RangeMatch } from "./types";

export type RuleWarningCode = "leapYearLength" | "mixedRangeEnds" | "neverApplies";

export interface RuleWarning {
  readonly code: RuleWarningCode;
  readonly ruleId: string;
}

const NEVER_APPLIES_YEARS = 400;
const DEFAULT_FIRST_YEAR = 2000;

const clampYear = (year: number): number => Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
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

function neverApplies(rule: DayRule): boolean {
  const { match } = rule;
  const dates = match.type === "range" ? [match.from, match.to] : [match];
  const years = new Set<number>();
  for (const date of dates) {
    if (date?.type !== "once") continue;
    const year = ymdFromDay(dayFromIso(date.date)).year;
    for (let y = year - 1; y <= year + 1; y++) years.add(clampYear(y));
  }
  if (years.size === 0) {
    const first = Math.max(MIN_YEAR, rule.validFrom ?? DEFAULT_FIRST_YEAR);
    const last = Math.min(first + NEVER_APPLIES_YEARS - 1, rule.validUntil ?? MAX_YEAR, MAX_YEAR);
    for (let y = first; y <= last; y++) years.add(y);
  }
  if (years.size === 0) return true;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return ruleDays(rule, dayFromYmd(first, 1, 1), dayFromYmd(last, 12, 31)).length === 0;
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
