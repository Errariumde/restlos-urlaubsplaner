// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { dayFromYmd, daysInMonth, MAX_YEAR, MIN_YEAR, ymdFromDay } from "../days";
import type { DayNumber } from "../days";
import { checkUnits, UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";
import { evaluateLeave, overlappingOtherPlanIds } from "./leave";
import type { DayLeave, LeavePiece } from "./leave";
import { dayFacts, requiredWork } from "./required";
import type { DayFacts, RequiredWork } from "./required";
import { findStretches } from "./stretches";
import type { Stretch, StretchDay } from "./stretches";
import type { PlanInput, PlanPeriod, YearMonth } from "./types";

/** How far the day results reach before and after the period, so that stretches can be seen whole. */
export const STRETCH_MARGIN_DAYS = 60;

export interface DayResult {
  readonly day: DayNumber;
  readonly inPeriod: boolean;
  readonly facts: DayFacts;
  readonly required: RequiredWork;
  readonly leave: readonly LeavePiece[];
  readonly evaluation: DayLeave;
  readonly closure: boolean;
}
export interface PlanTotals {
  readonly allowance: Units;
  readonly planned: Units;
  readonly remaining: Units; // allowance − planned, may be negative
  readonly byYear: readonly { readonly year: number; readonly planned: Units }[]; // every calendar year the period touches, ascending
}
export type Problem =
  | { readonly code: "leaveOutsidePeriod"; readonly day: DayNumber }
  | { readonly code: "leaveWithoutRequiredWork"; readonly day: DayNumber }
  | { readonly code: "leaveTakenInOtherPlan"; readonly day: DayNumber; readonly sourceIds: readonly string[] }
  | { readonly code: "conflictingForcedRules"; readonly day: DayNumber; readonly ruleIds: readonly string[] };
export interface PlanResult {
  readonly period: { readonly from: DayNumber; readonly to: DayNumber };
  readonly days: readonly DayResult[]; // consecutive: the period ± STRETCH_MARGIN_DAYS, clamped to the supported years
  readonly totals: PlanTotals;
  readonly stretches: readonly Stretch[]; // every stretch with at least one day in the period, in order
  readonly problems: readonly Problem[]; // sorted by day, then in the order of the codes above
}

const checkMonth = ({ year, month }: YearMonth): void => {
  daysInMonth(year, month); // throws RangeError for a bad year or month
};

/** First day of the start month to last day of the end month. Throws RangeError for an invalid period. */
export function periodBounds(period: PlanPeriod): { from: DayNumber; to: DayNumber } {
  checkMonth(period.from);
  checkMonth(period.to);
  const from = dayFromYmd(period.from.year, period.from.month, 1);
  const to = dayFromYmd(period.to.year, period.to.month, daysInMonth(period.to.year, period.to.month));
  if (from > to) throw new RangeError("The plan period starts after it ends");
  return { from, to };
}

const FIRST_DAY = dayFromYmd(MIN_YEAR, 1, 1);
const LAST_DAY = dayFromYmd(MAX_YEAR, 12, 31);

const PROBLEM_ORDER: Record<Problem["code"], number> = {
  leaveOutsidePeriod: 0,
  leaveWithoutRequiredWork: 1,
  leaveTakenInOtherPlan: 2,
  conflictingForcedRules: 3,
};

export function computePlan(input: PlanInput): PlanResult {
  const period = periodBounds(input.period);
  if (!Number.isInteger(input.allowance) || input.allowance < 0) {
    throw new RangeError("The allowance must be a non-negative integer");
  }
  const leaveByDay = new Map<DayNumber, PlanInput["leave"][number]>();
  for (const entry of input.leave) {
    checkUnits(entry.take, "Leave take", 1);
    if (entry.take < UNITS_PER_DAY && entry.part === undefined) throw new RangeError("Partial leave needs a part of the day");
    if (leaveByDay.has(entry.day)) throw new RangeError("At most one leave entry per day");
    leaveByDay.set(entry.day, entry);
  }

  const windowFrom = Math.max(FIRST_DAY, period.from - STRETCH_MARGIN_DAYS);
  const windowTo = Math.min(LAST_DAY, period.to + STRETCH_MARGIN_DAYS);
  const days: DayResult[] = [];
  const problems: Problem[] = [];

  for (const facts of dayFacts(input, windowFrom, windowTo)) {
    const inPeriod = facts.day >= period.from && facts.day <= period.to;
    const required = requiredWork(facts);
    const pieces: LeavePiece[] = [];
    const own = inPeriod ? leaveByDay.get(facts.day) : undefined;
    if (own) pieces.push({ kind: "own", take: own.take, part: own.part ?? "end" });
    for (const rule of facts.rules) {
      if (rule.mandatory !== undefined) pieces.push({ kind: "mandatory", take: rule.mandatory, part: rule.part ?? "end", ruleId: rule.id });
    }
    for (const source of facts.sources) {
      if (source.type === "mandatory") {
        pieces.push({ kind: "mandatory", take: source.take, part: source.part ?? "end", sourceId: source.sourceId });
      } else if (source.type === "otherPlan") {
        pieces.push({ kind: "otherPlan", take: source.take, part: source.part ?? "end", sourceId: source.sourceId });
      }
    }
    const evaluation = evaluateLeave(required, pieces, inPeriod);
    const closure =
      required.value === 0 &&
      facts.base.value > 0 &&
      required.layers.some(
        (layer) => layer.kind === "paidClosure" || ((layer.kind === "ruleAtMost" || layer.kind === "ruleExactly") && layer.value === 0),
      );
    days.push({ day: facts.day, inPeriod, facts, required, leave: pieces, evaluation, closure });

    if (inPeriod) {
      if (own && required.value === 0) problems.push({ code: "leaveWithoutRequiredWork", day: facts.day });
      if (evaluation.ownCoveredByOtherPlan) {
        problems.push({ code: "leaveTakenInOtherPlan", day: facts.day, sourceIds: overlappingOtherPlanIds(required.value, pieces) });
      }
      if (required.conflictingRules.length > 0) {
        problems.push({ code: "conflictingForcedRules", day: facts.day, ruleIds: required.conflictingRules });
      }
    }
  }
  for (const entry of input.leave) {
    if (entry.day < period.from || entry.day > period.to) problems.push({ code: "leaveOutsidePeriod", day: entry.day });
  }
  problems.sort((a, b) => a.day - b.day || PROBLEM_ORDER[a.code] - PROBLEM_ORDER[b.code]);

  const byYear = new Map<number, Units>();
  for (let year = ymdFromDay(period.from).year; year <= ymdFromDay(period.to).year; year++) byYear.set(year, 0);
  let planned = 0;
  for (const day of days) {
    if (!day.inPeriod) continue;
    planned += day.evaluation.cost;
    const year = ymdFromDay(day.day).year;
    byYear.set(year, (byYear.get(year) ?? 0) + day.evaluation.cost);
  }

  const stretchDays: StretchDay[] = days.map(({ day, evaluation: e, closure }) => ({
    day,
    whole: e.whole,
    freeStart: e.freeStart,
    freeEnd: e.freeEnd,
    costStart: e.costStart,
    costEnd: e.costEnd,
    closure,
  }));
  const stretches = findStretches(stretchDays).filter((s) => s.end.day >= period.from && s.start.day <= period.to);

  return {
    period,
    days,
    totals: {
      allowance: input.allowance,
      planned,
      remaining: input.allowance - planned,
      byYear: [...byYear].map(([year, units]) => ({ year, planned: units })),
    },
    stretches,
    problems,
  };
}
