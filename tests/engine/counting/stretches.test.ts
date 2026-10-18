// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { findStretches } from "../../../src/engine/counting/stretches";
import type { Stretch, StretchDay } from "../../../src/engine/counting/stretches";
import { isoFromDay } from "../../../src/engine/days";
import { d } from "./helpers";

type Shape = Omit<StretchDay, "day">;
const work: Shape = { whole: false, freeStart: 0, freeEnd: 0, costStart: 0, costEnd: 0, closure: false };
const free = (cost = 0, closure = false): Shape => ({ whole: true, freeStart: 480, freeEnd: 480, costStart: cost, costEnd: 0, closure });
const partial = (freeStart: number, freeEnd: number, costStart = 0, costEnd = 0): Shape => ({ ...work, freeStart, freeEnd, costStart, costEnd });
const seq = (...shapes: Shape[]): StretchDay[] => shapes.map((s, i) => ({ ...s, day: d("2027-05-05") + i }));
const fmt = (s: Stretch) =>
  `${isoFromDay(s.start.day)}@${s.start.offset} ${isoFromDay(s.end.day)}@${s.end.offset} ${s.cost}/${s.daysOff}${s.listed ? " listed" : ""}`;
const run = (...shapes: Shape[]) => findStretches(seq(...shapes)).map(fmt);

describe("findStretches", () => {
  it("ends a stretch with a free start on its last day", () =>
    expect(run(work, free(), partial(240, 0, 240), free(), free(), work))
      .toEqual(["2027-05-06@0 2027-05-07@240 240/720 listed", "2027-05-08@0 2027-05-09@480 0/960"]));
  it("starts a stretch with a free end on its first day", () =>
    expect(run(work, free(), partial(0, 240, 0, 240), free(), free(), work))
      .toEqual(["2027-05-06@0 2027-05-06@480 0/480", "2027-05-07@240 2027-05-09@480 240/1200 listed"]));
  it("breaks at 10 units of work", () =>
    expect(run(free(), partial(470, 0, 470), free())).toEqual(["2027-05-05@0 2027-05-06@470 470/950 listed", "2027-05-07@0 2027-05-07@480 0/480"]));
  it("lists a paid closure without cost", () => expect(run(work, free(0, true), free(), work)).toEqual(["2027-05-06@0 2027-05-07@480 0/960 listed"]));
  it("splits a day with work in the middle", () =>
    expect(run(work, partial(120, 120, 120, 120), work)).toEqual(["2027-05-06@0 2027-05-06@120 120/120 listed", "2027-05-06@360 2027-05-06@480 120/120 listed"]));
  it("closes a stretch at the end of the list", () => expect(run(work, free(480))).toEqual(["2027-05-06@0 2027-05-06@480 480/480 listed"]));
  it("rejects days that are not consecutive", () =>
    expect(() => findStretches([{ ...work, day: 10 }, { ...work, day: 12 }])).toThrow(RangeError));
  it("keeps every unit of cost and free time", () => {
    const shape = fc.oneof(
      fc.integer({ min: 0, max: 480 }).map((c) => free(c)),
      fc.tuple(fc.integer({ min: 0, max: 239 }), fc.integer({ min: 0, max: 239 })).chain(([s, e]) =>
        fc.tuple(fc.integer({ min: 0, max: s }), fc.integer({ min: 0, max: e })).map(([cs, ce]) => partial(s, e, cs, ce))),
    );
    fc.assert(fc.property(fc.array(shape, { maxLength: 30 }), (shapes) => {
      const days = seq(...shapes);
      const stretches = findStretches(days);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(sum(stretches.map((s) => s.cost))).toBe(sum(days.map((x) => x.costStart + x.costEnd)));
      expect(sum(stretches.map((s) => s.daysOff))).toBe(sum(days.map((x) => (x.whole ? 480 : x.freeStart + x.freeEnd))));
    }));
  });
});
