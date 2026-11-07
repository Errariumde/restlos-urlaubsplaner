// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The source lanes of each day cell (docs/SPEC.md, "Day cell", layer 4; D12), and how a source is drawn.
import type { PlanResult } from "../../engine/counting/plan.ts";
import type { DayNumber, Weekday } from "../../engine/days.ts";
import type { SourceMeta } from "../worker/protocol.ts";
import { packLanes } from "./lanes.ts";
import { offsetInWeek, type MonthBlock } from "./months.ts";

/** One lane of a cell: the band joins the neighbouring cell where the run goes on in the same row (or column). */
export interface CellLane {
  readonly lane: 0 | 1 | 2 | "more";
  readonly sourceId: string;
  readonly joinStart: boolean;
  readonly joinEnd: boolean;
}

export type LineStyle = "solid" | "dashed" | "dotted";

const ACCENT_COUNT = 8;
const LINE_STYLES: readonly LineStyle[] = ["solid", "dashed", "dotted"];

/**
 * The lanes of every day of the month that a visible source covers. The days of each source come from the
 * day results (`facts.sources`), so an Info source counts as much as a holiday source. In the tiles
 * ("row") a band never joins across the end of a week row; in the columns every day follows the one above.
 */
export function monthCellLanes(
  month: MonthBlock,
  result: PlanResult,
  sources: readonly SourceMeta[],
  weekStart: Weekday,
  orientation: "row" | "column",
): Map<DayNumber, CellLane[]> {
  const visible = new Set(sources.filter((source) => source.visible).map((source) => source.id));
  const first = result.days[0]?.day;
  const sourceDays = new Map<string, DayNumber[]>();
  for (let day = month.first; first !== undefined && day <= month.last; day++) {
    for (const entry of result.days[day - first]?.facts.sources ?? []) {
      if (!visible.has(entry.sourceId)) continue;
      const list = sourceDays.get(entry.sourceId);
      if (list === undefined) sourceDays.set(entry.sourceId, [day]);
      else if (list.at(-1) !== day) list.push(day);
    }
  }

  const lanes = new Map<DayNumber, CellLane[]>();
  const order = sources.map((source) => source.id);
  for (const run of packLanes(month, sourceDays, order)) {
    for (let day = run.first; day <= run.last; day++) {
      const column = offsetInWeek(day, weekStart);
      const lane: CellLane = {
        lane: run.lane,
        sourceId: run.sourceId,
        joinStart: day > run.first && (orientation === "column" || column !== 0),
        joinEnd: day < run.last && (orientation === "column" || column !== 6),
      };
      const list = lanes.get(day);
      if (list === undefined) lanes.set(day, [lane]);
      else list.push(lane);
    }
  }
  return lanes;
}

/** The lanes of every day of the months, for one view. */
export function periodCellLanes(
  months: readonly MonthBlock[],
  result: PlanResult,
  sources: readonly SourceMeta[],
  weekStart: Weekday,
  orientation: "row" | "column",
): Map<DayNumber, CellLane[]> {
  const all = new Map<DayNumber, CellLane[]>();
  for (const month of months) {
    for (const [day, list] of monthCellLanes(month, result, sources, weekStart, orientation)) all.set(day, list);
  }
  return all;
}

/**
 * The accent token (1 … 8, `--r-accent-N`) a source is drawn in: its palette slot `accent-N`, else (an own
 * colour, which the page doesn't draw literally, or an unknown slot) the one for its position in the list.
 */
export function sourceAccent(source: SourceMeta, index: number): number {
  if ("slot" in source.color) {
    const slot = /^accent-([1-8])$/.exec(source.color.slot);
    if (slot) return Number(slot[1]);
  }
  return (index % ACCENT_COUNT) + 1;
}

/** The line style of the source at `index` in the sources list. */
export function lineStyle(index: number): LineStyle {
  return LINE_STYLES[index % LINE_STYLES.length]!;
}
