// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The plan's problems where the calendar shows them (docs/SPEC.md, "Problems"): a mark on the day, the day's label,
// the list in the allowance panel and the day's detail all use the same sentences.
import type { Problem } from "../../engine/counting/plan.ts";
import type { DayNumber } from "../../engine/days.ts";
import type { Translate } from "./label.ts";

/** The codes of the problems of each day that has any, in the result's order. */
export function problemsByDay(problems: readonly Problem[]): Map<DayNumber, Problem["code"][]> {
  const byDay = new Map<DayNumber, Problem["code"][]>();
  for (const { day, code } of problems) {
    const codes = byDay.get(day);
    if (codes === undefined) byDay.set(day, [code]);
    else codes.push(code);
  }
  return byDay;
}

/** A problem as a full sentence. Each key spelled out, so the catalog check sees it used. */
export function problemText(code: Problem["code"], t: Translate): string {
  switch (code) {
    case "leaveOutsidePeriod":
      return t("detail.problem.leaveOutsidePeriod");
    case "leaveWithoutRequiredWork":
      return t("detail.problem.leaveWithoutRequiredWork");
    case "leaveTakenInOtherPlan":
      return t("detail.problem.leaveTakenInOtherPlan");
    case "conflictingForcedRules":
      return t("detail.problem.conflictingForcedRules");
    case "uncoveredNeed":
      return t("detail.problem.uncoveredNeed");
  }
}
