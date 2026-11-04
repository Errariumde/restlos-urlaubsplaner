// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The accessible label of a calendar cell (docs/SPEC.md, D4).
import type { DayResult } from "../../engine/counting/plan.ts";
import { weekdayOf } from "../../engine/days.ts";
import { UNITS_PER_DAY } from "../../engine/weight.ts";
import { formatDate, formatDays } from "../i18n/format.ts";
import type { Locale } from "../i18n/locale.ts";
import type { PlanMeta } from "../worker/protocol.ts";

export type Translate = (key: string, args?: Record<string, string | number>) => string;

type Kind = "workday" | "weekend" | "holiday" | "halfRequired" | "free";
type Leave = "none" | "full" | "half" | "mandatory" | "otherPlan";

function kindOf(day: DayResult, meta: PlanMeta): Kind {
  if (day.facts.holidays.length > 0) return "holiday";
  if (meta.weekend.includes(weekdayOf(day.day))) return "weekend";
  if (day.required.value === 0) return "free"; // no work for another reason, e.g. a paid closure
  return day.required.value < UNITS_PER_DAY ? "halfRequired" : "workday";
}

function leaveOf(day: DayResult): Leave {
  if (day.leave.some((piece) => piece.kind === "own")) {
    return day.evaluation.ownCost >= day.required.value ? "full" : "half";
  }
  if (day.leave.some((piece) => piece.kind === "mandatory")) return "mandatory";
  if (day.leave.some((piece) => piece.kind === "otherPlan")) return "otherPlan";
  return "none";
}

/**
 * The screen-reader text of a day: date, kind, leave, cost and the calendar sources that include it.
 * `sourceNames` are the names of those sources, already resolved to the UI language.
 */
export function cellLabel(day: DayResult, meta: PlanMeta, i18n: { t: Translate; locale: Locale }, sourceNames: readonly string[] = []): string {
  const { t, locale } = i18n;
  const cost = day.evaluation.cost;
  const holiday = day.facts.holidays[0];
  const list = new Intl.ListFormat(locale === "de" ? "de" : "en-GB", { style: "long", type: "conjunction" });
  return t("day.label", {
    date: formatDate(day.day, locale, "long"),
    kind: kindOf(day, meta),
    name: holiday ? t(holiday.nameKey) : "",
    leave: leaveOf(day),
    hasCost: cost > 0 ? "yes" : "no",
    cost: formatDays(cost, locale),
    hasSources: sourceNames.length > 0 ? "yes" : "no",
    sources: list.format(sourceNames),
  });
}
