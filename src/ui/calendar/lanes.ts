// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Packs the source markers of a month into lanes (docs/SPEC.md, D12).
import type { DayNumber } from "../../engine/days.ts";
import type { MonthBlock } from "./months.ts";

export const LANE_COUNT = 3;

export interface LaneRun {
  readonly sourceId: string;
  readonly first: DayNumber;
  readonly last: DayNumber;
  readonly lane: 0 | 1 | 2 | "more";
}

/**
 * Consecutive days of one source form a run, cut at the month's edges. Runs are placed in `order`
 * (sources missing from it go last, in map order), then by first day. Each run takes the lowest lane
 * that is free over its whole span; a run with no free lane among 0 to 2 gets "more".
 */
export function packLanes(month: MonthBlock, sourceDays: ReadonlyMap<string, readonly DayNumber[]>, order: readonly string[]): LaneRun[] {
  const ids = [...order.filter((id) => sourceDays.has(id)), ...[...sourceDays.keys()].filter((id) => !order.includes(id))];
  const occupied: { first: DayNumber; last: DayNumber }[][] = Array.from({ length: LANE_COUNT }, () => []);
  const runs: LaneRun[] = [];

  for (const sourceId of ids) {
    const days = [...new Set(sourceDays.get(sourceId))].filter((day) => day >= month.first && day <= month.last).sort((a, b) => a - b);
    let first = days[0];
    for (let i = 0; first !== undefined && i < days.length; i += 1) {
      const last = days[i]!;
      if (i + 1 < days.length && days[i + 1] === last + 1) continue;
      const start = first;
      const lane = occupied.findIndex((spans) => spans.every((span) => span.last < start || span.first > last));
      if (lane === -1) {
        runs.push({ sourceId, first, last, lane: "more" });
      } else {
        occupied[lane]!.push({ first, last });
        runs.push({ sourceId, first, last, lane: lane as 0 | 1 | 2 });
      }
      first = days[i + 1];
    }
  }
  return runs;
}
