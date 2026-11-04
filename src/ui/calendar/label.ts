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

export type CellKind = "workday" | "weekend" | "holiday" | "halfRequired" | "halfRequiredHoliday" | "free";
export type CellLeave = "none" | "full" | "half" | "mandatory" | "otherPlan";

/** The kind follows the required work: a holiday that is worked is a working day, a working Saturday too. */
export function kindOf(day: DayResult, meta: PlanMeta): CellKind {
  const holiday = day.facts.holidays.length > 0;
  const required = day.required.value;
  if (required === 0) {
    if (holiday) return "holiday";
    if (meta.weekend.includes(weekdayOf(day.day))) return "weekend";
    return "free"; // no work for another reason, e.g. a paid closure
  }
  if (required < UNITS_PER_DAY) return holiday ? "halfRequiredHoliday" : "halfRequired";
  return "workday";
}

/** The leave a cell shows: own leave wins over mandatory leave, which wins over leave from another plan. */
export function leaveOf(day: DayResult): CellLeave {
  if (day.leave.some((piece) => piece.kind === "own" && piece.take > 0)) {
    return day.evaluation.ownCost >= day.required.value ? "full" : "half";
  }
  if (day.leave.some((piece) => piece.kind === "mandatory")) return "mandatory";
  if (day.leave.some((piece) => piece.kind === "otherPlan")) return "otherPlan";
  return "none";
}

const listFormats = new Map<string, Intl.ListFormat>();

function listFormat(locale: Locale): Intl.ListFormat {
  const tag = locale === "de" ? "de" : "en-GB";
  let format = listFormats.get(tag);
  if (!format) {
    format = new Intl.ListFormat(tag, { style: "long", type: "conjunction" });
    listFormats.set(tag, format);
  }
  return format;
}

/**
 * The screen-reader text of a day: date, kind, leave, cost and the calendar sources that include it.
 * `sourceNames` are the names of those sources, already resolved to the UI language.
 */
export function cellLabel(day: DayResult, meta: PlanMeta, i18n: { t: Translate; locale: Locale }, sourceNames: readonly string[] = []): string {
  const { t, locale } = i18n;
  const cost = day.evaluation.cost;
  const holiday = day.facts.holidays[0];
  const list = listFormat(locale);
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
