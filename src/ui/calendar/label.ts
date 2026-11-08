// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The accessible label of a calendar cell (docs/SPEC.md, "Accessibility").
import type { DayResult, Problem } from "../../engine/counting/plan.ts";
import type { SourceDay } from "../../engine/counting/types.ts";
import { weekdayOf } from "../../engine/days.ts";
import { textFor } from "../../engine/file/text.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import { formatDate, formatDays, formatList } from "../i18n/format.ts";
import { textLanguage, type Locale } from "../i18n/locale.ts";
import type { PlanMeta } from "../worker/protocol.ts";
import { dayLeave, type DayLeaveView } from "./day-leave.ts";
import { problemText } from "./problems.ts";

export type Translate = (key: string, args?: Record<string, string | number>) => string;

export type CellKind = "workday" | "weekend" | "holiday" | "halfRequired" | "halfRequiredHoliday" | "free";

type HolidaySourceDay = Extract<SourceDay, { type: "holiday" }>;

/** The first day of a holiday calendar on the day that frees time, if any; one that keeps the full day is no holiday. */
function holidaySourceDay(day: DayResult): HolidaySourceDay | undefined {
  return day.facts.sources.find((source): source is HolidaySourceDay => source.type === "holiday" && source.required < UNITS_PER_DAY);
}

/**
 * The name of the day's holiday: a public holiday's message key resolved, else the entry of a holiday calendar,
 * or that calendar's name when the entry has none; "" when the day has no holiday.
 */
export function holidayName(day: DayResult, meta: PlanMeta, i18n: { t: Translate; locale: Locale }): string {
  const publicHoliday = day.facts.holidays[0];
  if (publicHoliday) return i18n.t(publicHoliday.nameKey);
  const source = holidaySourceDay(day);
  if (source === undefined) return "";
  const lang = textLanguage(i18n.locale);
  if (source.name !== undefined) return textFor(source.name, lang);
  const calendar = meta.sources.find((candidate) => candidate.id === source.sourceId);
  return calendar ? textFor(calendar.name, lang) : source.sourceId;
}

/**
 * The kind follows the required work: a holiday that is worked is a working day, a working Saturday too. A day of
 * a holiday calendar counts as a holiday like a public holiday.
 */
export function kindOf(day: DayResult, meta: PlanMeta): CellKind {
  const holiday = day.facts.holidays.length > 0 || holidaySourceDay(day) !== undefined;
  const required = day.required.value;
  if (required === 0) {
    if (holiday) return "holiday";
    if (meta.weekend.includes(weekdayOf(day.day))) return "weekend";
    return "free"; // no work for another reason, e.g. a paid closure
  }
  if (required < UNITS_PER_DAY) return holiday ? "halfRequiredHoliday" : "halfRequired";
  return "workday";
}

/** A share's amount for the catalog's select: a full or a half day by name, any other share as its number. */
function amountOf(units: Units): "full" | "half" | "other" {
  if (units === UNITS_PER_DAY) return "full";
  return units * 2 === UNITS_PER_DAY ? "half" : "other";
}

/**
 * The day's leave in words: own and mandatory leave with their amount and where they lie ("leave ¼, at the start of
 * the day"), then leave from another plan; "no leave" without any.
 */
export function leaveText(view: DayLeaveView, i18n: { t: Translate; locale: Locale }): string {
  const { t, locale } = i18n;
  const items: string[] = [];
  const full = { amount: "full", share: "", where: "none" };
  if (view.fill === "full") items.push(t("day.leave.own", full));
  else if (view.fill === "mandatory") items.push(t("day.leave.mandatory", full));
  for (const share of view.shares) {
    const args = { amount: amountOf(share.units), share: formatDays(share.units, locale), where: share.where === "spread" ? "none" : share.where };
    items.push(share.kind === "own" ? t("day.leave.own", args) : t("day.leave.mandatory", args));
  }
  if (view.otherPlan) items.push(t("day.leave.otherPlan"));
  return items.length === 0 ? t("day.leave.none") : formatList(items, locale);
}

/**
 * The screen-reader text of a day: date, kind, leave, cost, the calendar sources that include it and its problems.
 * `sourceNames` are the names of those sources, already resolved to the UI language.
 */
export function cellLabel(
  day: DayResult,
  meta: PlanMeta,
  i18n: { t: Translate; locale: Locale },
  sourceNames: readonly string[] = [],
  problems: readonly Problem["code"][] = [],
): string {
  const { t, locale } = i18n;
  const cost = day.evaluation.cost;
  return t("day.label", {
    date: formatDate(day.day, locale, "long"),
    kind: kindOf(day, meta),
    name: holidayName(day, meta, i18n),
    leave: leaveText(dayLeave(day), i18n),
    hasCost: cost > 0 ? "yes" : "no",
    cost: formatDays(cost, locale),
    hasSources: sourceNames.length > 0 ? "yes" : "no",
    sources: formatList(sourceNames, locale),
    problemCount: problems.length,
    // Full sentences, each ending with its own full stop.
    problems: problems.map((code) => problemText(code, t)).join(" "),
  });
}
