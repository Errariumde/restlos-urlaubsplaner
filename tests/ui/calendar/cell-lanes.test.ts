// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DayResult, PlanResult } from "../../../src/engine/counting/plan.ts";
import { dayFromYmd, type DayNumber } from "../../../src/engine/days.ts";
import { lineStyle, monthCellLanes, sourceAccent } from "../../../src/ui/calendar/cell-lanes.ts";
import { monthBlock } from "../../../src/ui/calendar/months.ts";
import type { PlanState, SourceMeta } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";

const june = (day: number): DayNumber => dayFromYmd(2027, 6, day);

function source(id: string, visible = true, color: SourceMeta["color"] = { slot: "accent-1" }): SourceMeta {
  return { id, name: id, type: "info", color, visible };
}

/** A result for May to July 2027 whose days carry the given sources. */
function resultWith(sourceDays: Record<string, readonly DayNumber[]>): PlanResult {
  const from = dayFromYmd(2027, 5, 1);
  const to = dayFromYmd(2027, 7, 31);
  const days: DayResult[] = [];
  for (let day = from; day <= to; day++) {
    const sources = Object.entries(sourceDays)
      .filter(([, list]) => list.includes(day))
      .map(([sourceId]) => ({ type: "info", day, sourceId }));
    days.push({ day, facts: { sources } } as unknown as DayResult);
  }
  return { days } as unknown as PlanResult;
}

describe("monthCellLanes", () => {
  it("gives every day of a run its lane and joins it to its neighbours inside the week row", () => {
    // Fri 11 to Tue 15 June: Fri, Sat and Sun end their week row (Monday start), Mon starts the next.
    const result = resultWith({ a: [11, 12, 13, 14, 15].map(june) });
    const lanes = monthCellLanes(monthBlock(2027, 6), result, [source("a")], "mon", "row");
    expect(lanes.get(june(11))).toEqual([{ lane: 0, sourceId: "a", joinStart: false, joinEnd: true }]);
    expect(lanes.get(june(13))).toEqual([{ lane: 0, sourceId: "a", joinStart: true, joinEnd: false }]);
    expect(lanes.get(june(14))).toEqual([{ lane: 0, sourceId: "a", joinStart: false, joinEnd: true }]);
    expect(lanes.get(june(15))).toEqual([{ lane: 0, sourceId: "a", joinStart: true, joinEnd: false }]);
    expect(lanes.get(june(10))).toBeUndefined();
  });

  it("joins across week rows in the columns", () => {
    const result = resultWith({ a: [13, 14].map(june) });
    const lanes = monthCellLanes(monthBlock(2027, 6), result, [source("a")], "mon", "column");
    expect(lanes.get(june(13))).toEqual([{ lane: 0, sourceId: "a", joinStart: false, joinEnd: true }]);
    expect(lanes.get(june(14))).toEqual([{ lane: 0, sourceId: "a", joinStart: true, joinEnd: false }]);
  });

  it("stacks overlapping sources in the order of the sources list and leaves out hidden ones", () => {
    const result = resultWith({ a: [june(2)], b: [june(2)], hidden: [june(2)], c: [june(2)], d: [june(2)] });
    const sources = [source("d"), source("c"), source("hidden", false), source("b"), source("a")];
    const lanes = monthCellLanes(monthBlock(2027, 6), result, sources, "mon", "row");
    expect(lanes.get(june(2))?.map(({ sourceId, lane }) => [sourceId, lane])).toEqual([
      ["d", 0],
      ["c", 1],
      ["b", 2],
      ["a", "more"],
    ]);
  });

  it("cuts a run at the month's edges", () => {
    const result = resultWith({ a: [dayFromYmd(2027, 5, 31), june(1)] });
    const lanes = monthCellLanes(monthBlock(2027, 6), result, [source("a")], "mon", "row");
    expect(lanes.get(june(1))).toEqual([{ lane: 0, sourceId: "a", joinStart: false, joinEnd: false }]);
    expect(lanes.has(dayFromYmd(2027, 5, 31))).toBe(false);
  });
});

describe("monthCellLanes on the example", () => {
  const { meta, result } = new Session().open(readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8"), true) as PlanState;

  it("draws the Info source from 6 September to 29 October and the other plan's days in January", () => {
    const september = monthCellLanes(monthBlock(2027, 9), result, meta.sources, meta.weekStart, "row");
    expect(september.get(dayFromYmd(2027, 9, 6))?.map((lane) => lane.sourceId)).toEqual(["project"]);
    expect(september.has(dayFromYmd(2027, 9, 5))).toBe(false);
    const january = monthCellLanes(monthBlock(2027, 1), result, meta.sources, meta.weekStart, "row");
    expect(january.get(dayFromYmd(2027, 1, 4))?.map((lane) => lane.sourceId)).toEqual(["previous-year"]);
  });
});

describe("sourceAccent and lineStyle", () => {
  it("takes the accent slot of the source, else the position in the list", () => {
    expect(sourceAccent(source("a", true, { slot: "accent-3" }), 0)).toBe(3);
    expect(sourceAccent(source("a", true, { slot: "accent-8" }), 0)).toBe(8);
    expect(sourceAccent(source("a", true, { slot: "accent-9" }), 1)).toBe(2);
    expect(sourceAccent(source("a", true, { slot: "warning" }), 9)).toBe(2);
    expect(sourceAccent(source("a", true, { rgb: "#1a7f37" }), 7)).toBe(8);
  });

  it("cycles solid, dashed and dotted by the position in the list", () => {
    expect([0, 1, 2, 3, 4].map(lineStyle)).toEqual(["solid", "dashed", "dotted", "solid", "dashed"]);
  });
});
