// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What the legend at the end of the allowance panel shows (docs/SPEC.md, "Allowance display"): only the marks and
// calendars that occur in the plan period, which is what the calendar shows.
import type { PlanResult } from "../../engine/counting/plan.ts";
import type { PlanMeta, SourceMeta } from "../worker/protocol.ts";
import { lineStyle, sourceAccent, type LineStyle } from "../calendar/cell-lanes.ts";
import { dayLeave } from "../calendar/day-leave.ts";
import { kindOf, type Translate } from "../calendar/label.ts";

/** A way the cells draw a day: its leave, its required work, or the problem mark on its number. */
export type LegendMark = "leave" | "mandatory" | "otherPlan" | "weekend" | "holiday" | "halfRequired" | "free" | "problem";

/** A calendar source with the accent and line style its lanes have in the cells. */
export interface LegendCalendar {
  readonly source: SourceMeta;
  readonly accent: number;
  readonly style: LineStyle;
}

export interface Legend {
  readonly marks: readonly LegendMark[];
  readonly calendars: readonly LegendCalendar[];
}

/** The leave first, as it is what the plan is about, then the day types and the problem mark. */
const ORDER: readonly LegendMark[] = ["leave", "mandatory", "otherPlan", "weekend", "holiday", "halfRequired", "free", "problem"];

/** The marks and calendars of the days in the plan period, each once. */
export function legendOf(result: PlanResult, meta: PlanMeta): Legend {
  const { from, to } = result.period;
  const marks = new Set<LegendMark>();
  const sourceIds = new Set<string>();
  const first = result.days[0]?.day ?? from;
  for (let day = from; day <= to; day++) {
    const dayResult = result.days[day - first];
    if (dayResult === undefined) continue;
    const kind = kindOf(dayResult, meta);
    if (kind === "halfRequiredHoliday") {
      // The work block of a half working day beside the holiday's dots.
      marks.add("halfRequired");
      marks.add("holiday");
    } else if (kind !== "workday") marks.add(kind);
    const leave = dayLeave(dayResult);
    if (leave.fill === "full" || leave.shares.some((share) => share.kind === "own")) marks.add("leave");
    if (leave.fill === "mandatory" || leave.shares.some((share) => share.kind === "mandatory")) marks.add("mandatory");
    if (leave.otherPlan) marks.add("otherPlan");
    for (const entry of dayResult.facts.sources) sourceIds.add(entry.sourceId);
  }
  if (result.problems.some((problem) => problem.day >= from && problem.day <= to)) marks.add("problem");
  const calendars = meta.sources.flatMap((source, index) =>
    source.visible && sourceIds.has(source.id) ? [{ source, accent: sourceAccent(source, index), style: lineStyle(index) }] : [],
  );
  return { marks: ORDER.filter((mark) => marks.has(mark)), calendars };
}

/** A mark's name. Each key spelled out, so the catalog check sees it used. */
export function markText(mark: LegendMark, t: Translate): string {
  switch (mark) {
    case "leave":
      return t("legend.leave");
    case "mandatory":
      return t("legend.mandatory");
    case "otherPlan":
      return t("legend.otherPlan");
    case "weekend":
      return t("legend.weekend");
    case "holiday":
      return t("legend.holiday");
    case "halfRequired":
      return t("legend.halfRequired");
    case "free":
      return t("legend.free");
    case "problem":
      return t("legend.problem");
  }
}
