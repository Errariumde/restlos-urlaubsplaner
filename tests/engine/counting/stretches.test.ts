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
  it("finds no stretch in no days", () => expect(findStretches([])).toEqual([]));
  it("keeps a single whole day without cost as an unlisted stretch", () =>
    expect(run(free())).toEqual(["2027-05-05@0 2027-05-05@480 0/480"]));
  it("rejects a fractional day number", () => expect(() => findStretches([{ ...work, day: 0.5 }])).toThrow(RangeError));
  it.each([
    ["free time that fills the day", partial(240, 240)],
    ["cost beyond the free time at the start", partial(120, 120, 121, 0)],
    ["cost beyond the free time at the end", partial(120, 120, 0, 121)],
    ["negative free time", partial(-1, 100)],
    ["fractional free time", partial(1.5, 100)],
    ["a whole day with cost above 480", free(481)],
    ["a whole day with free time below 480", { ...free(), freeStart: 240 }],
    ["a whole day with cost at the end", { ...free(), costEnd: 1 }],
  ] as [string, Shape][])("rejects %s", (_, shape) => expect(() => findStretches(seq(shape))).toThrow(RangeError));
  it("keeps every unit of cost and free time", () => {
    const shape = fc.oneof(
      fc.integer({ min: 0, max: 480 }).map((c) => free(c)),
      fc.integer({ min: 0, max: 480 }).map((c) => free(c, true)),
      fc.tuple(fc.integer({ min: 0, max: 239 }), fc.integer({ min: 0, max: 239 })).chain(([s, e]) =>
        fc.tuple(fc.integer({ min: 0, max: s }), fc.integer({ min: 0, max: e })).map(([cs, ce]) => partial(s, e, cs, ce))),
    );
    fc.assert(fc.property(fc.array(shape, { maxLength: 30 }), (shapes) => {
      const days = seq(...shapes);
      const stretches = findStretches(days);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      const pos = (point: { day: number; offset: number }) => point.day * 480 + point.offset;
      expect(sum(stretches.map((s) => s.cost))).toBe(sum(days.map((x) => x.costStart + x.costEnd)));
      expect(sum(stretches.map((s) => s.daysOff))).toBe(sum(days.map((x) => (x.whole ? 480 : x.freeStart + x.freeEnd))));
      // Every fragment of free time lies inside exactly one stretch, which is charged its cost.
      const fragments = days.flatMap((x) => {
        const start = x.day * 480;
        if (x.whole) return [{ from: start, to: start + 480, cost: x.costStart + x.costEnd }];
        return [
          ...(x.freeStart > 0 ? [{ from: start, to: start + x.freeStart, cost: x.costStart }] : []),
          ...(x.freeEnd > 0 ? [{ from: start + 480 - x.freeEnd, to: start + 480, cost: x.costEnd }] : []),
        ];
      });
      const inside = (f: { from: number; to: number }, s: Stretch) => f.from >= pos(s.start) && f.to <= pos(s.end);
      for (const f of fragments) expect(stretches.filter((s) => inside(f, s))).toHaveLength(1);
      for (const s of stretches) expect(s.cost).toBe(sum(fragments.filter((f) => inside(f, s)).map((f) => f.cost)));
      stretches.forEach((s, index) => {
        expect(pos(s.start)).toBeLessThan(pos(s.end));
        expect(s.daysOff).toBe(pos(s.end) - pos(s.start)); // unbroken
        const previous = stretches[index - 1];
        if (previous) expect(pos(s.start)).toBeGreaterThan(pos(previous.end));
        const closureInside = days.some((x) => x.closure && x.day >= s.start.day && x.day <= s.end.day);
        expect(s.listed).toBe(s.cost > 0 || closureInside);
      });
    }));
  });
});
