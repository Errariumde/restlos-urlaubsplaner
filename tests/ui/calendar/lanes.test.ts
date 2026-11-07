// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { packLanes } from "../../../src/ui/calendar/lanes.ts";
import { periodMonths } from "../../../src/ui/calendar/months.ts";

const may = periodMonths({ from: { year: 2027, month: 5 }, to: { year: 2027, month: 5 } })[0]!;
const d = (day: number): number => dayFromYmd(2027, 5, day);
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => d(from + i));

describe("packLanes", () => {
  it("puts overlapping runs of two sources in lanes 0 and 1", () => {
    const runs = packLanes(may, new Map([["a", range(3, 6)], ["b", range(5, 8)]]), ["a", "b"]);
    expect(runs).toEqual([
      { sourceId: "a", first: d(3), last: d(6), lane: 0 },
      { sourceId: "b", first: d(5), last: d(8), lane: 1 },
    ]);
  });

  it("reuses lane 0 for a later run that does not overlap", () => {
    const runs = packLanes(may, new Map([["a", [...range(3, 4), ...range(10, 11)]]]), ["a"]);
    expect(runs.map((r) => r.lane)).toEqual([0, 0]);
    expect(runs).toHaveLength(2);
  });

  it("lets a later source's earlier run take a lane freed by a gap", () => {
    const runs = packLanes(may, new Map([["a", range(10, 12)], ["b", range(3, 4)]]), ["a", "b"]);
    expect(runs).toEqual([
      { sourceId: "a", first: d(10), last: d(12), lane: 0 },
      { sourceId: "b", first: d(3), last: d(4), lane: 0 },
    ]);
  });

  it("gives a fourth overlapping run more", () => {
    const days = new Map([["a", range(3, 6)], ["b", range(3, 6)], ["c", range(3, 6)], ["d", range(3, 6)]]);
    const runs = packLanes(may, days, ["a", "b", "c", "d"]);
    expect(runs.map((r) => r.lane)).toEqual([0, 1, 2, "more"]);
  });

  it("cuts a run at the month's edges", () => {
    const apr30 = dayFromYmd(2027, 4, 30);
    const jun2 = dayFromYmd(2027, 6, 2);
    const days = new Map([["a", [apr30, d(1), d(2)]], ["b", [d(30), d(31), dayFromYmd(2027, 6, 1), jun2]]]);
    const runs = packLanes(may, days, ["a", "b"]);
    expect(runs).toEqual([
      { sourceId: "a", first: d(1), last: d(2), lane: 0 },
      { sourceId: "b", first: d(30), last: d(31), lane: 0 },
    ]);
  });

  it("orders runs by the given order, then by first day; unknown sources go last", () => {
    const days = new Map([["x", [d(1)]], ["b", [d(2)]], ["a", [d(3), d(9)]]]);
    const runs = packLanes(may, days, ["a", "b"]);
    expect(runs.map((r) => r.sourceId)).toEqual(["a", "a", "b", "x"]);
  });

  it("sorts unsorted days and ignores duplicates", () => {
    const runs = packLanes(may, new Map([["a", [d(5), d(3), d(4), d(4)]]]), ["a"]);
    expect(runs).toEqual([{ sourceId: "a", first: d(3), last: d(5), lane: 0 }]);
  });
});
