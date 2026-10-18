// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateLeave } from "../../../src/engine/counting/leave";
import type { DayLeave, LeaveKind, LeavePiece } from "../../../src/engine/counting/leave";
import type { Part } from "../../../src/engine/counting/types";

const at = (value: number, freePart: Part = "end") => ({ value, freePart });
const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mand = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "m" });
const other = (take: number, part: Part = "end"): LeavePiece => ({ kind: "otherPlan", take, part, sourceId: "o" });
const pick = (x: DayLeave) => [x.cost, x.ownCost, x.mandatoryCost, x.remaining, x.freeStart, x.freeEnd];

describe("evaluateLeave", () => {
  // [cost, ownCost, mandatoryCost, remaining, freeStart, freeEnd]
  it.each([
    ["company closure", at(480), [mand(480)], [480, 0, 480, 0, 480, 480]],
    ["mandatory leave on a Sunday", at(0), [mand(480)], [0, 0, 0, 0, 480, 480]],
    ["company closes at noon", at(480), [mand(240)], [240, 0, 240, 240, 0, 240]],
    ["maintainer's example: own ½ start, mandatory ½ end", at(480), [own(240, "start"), mand(240)], [480, 240, 240, 0, 480, 480]],
    ["own and mandatory on the same half", at(480), [own(240), mand(240)], [240, 0, 240, 240, 0, 240]],
    ["mandatory ½ on a day with at most ½", at(240), [mand(240)], [240, 0, 240, 0, 480, 480]],
    ["own ½ at the start of a ½ day frees it", at(240), [own(240, "start")], [240, 240, 0, 0, 480, 480]],
    ["½ day with the free time at the start, no leave", at(240, "start"), [], [0, 0, 0, 240, 240, 0]],
    ["15 minutes of work left", at(480), [own(470, "start")], [470, 470, 0, 10, 470, 0]],
    ["leave from another plan never costs", at(480), [other(480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave already counted in another plan", at(480), [mand(480), other(480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave half covered by another plan", at(480), [mand(480), other(240, "start")], [240, 0, 240, 0, 480, 480]],
    ["own leave on a day taken in another plan", at(480), [own(480), other(480)], [480, 480, 0, 0, 480, 480]],
    // Review Focus 5
    ["closure added on a day already planned as own leave", at(480), [own(480), mand(480)], [480, 0, 480, 0, 480, 480]],
  ] as [string, ReturnType<typeof at>, LeavePiece[], number[]][])("%s", (_, required, pieces, expected) =>
    expect(pick(evaluateLeave(required, pieces, true))).toEqual(expected));

  it("splits the cost of a day with work in the middle", () => {
    const x = evaluateLeave(at(480), [own(120, "start"), mand(120)], true);
    expect([x.remaining, x.freeStart, x.freeEnd, x.costStart, x.costEnd]).toEqual([240, 120, 120, 120, 120]);
  });
  it("flags own leave covered by leave from another plan", () => {
    expect(evaluateLeave(at(480), [own(480), other(480)], true).ownCoveredByOtherPlan).toBe(true);
    expect(evaluateLeave(at(480), [own(240, "start"), other(240)], true).ownCoveredByOtherPlan).toBe(false);
  });
  it("frees time but charges nothing when charge is false", () =>
    expect(pick(evaluateLeave(at(480), [own(480)], false))).toEqual([0, 0, 0, 0, 480, 480]));

  it.each([
    ["take 0", at(480), [own(0)]],
    ["take 481", at(480), [own(481)]],
    ["take 1.5", at(480), [own(1.5)]],
    ["required -1", at(-1), []],
    ["required 481", at(481), []],
    ["required 1.5", at(1.5), []],
  ] as [string, ReturnType<typeof at>, LeavePiece[]][])("rejects %s", (_, required, pieces) =>
    expect(() => evaluateLeave(required, pieces, true)).toThrow(RangeError));

  const sixteenth = fc.integer({ min: 0, max: 32 }).map((k) => k * 15);
  const part = fc.constantFrom<Part>("start", "end");
  it("costs min(taken, required work) for any multiple of 1/32", () =>
    fc.assert(fc.property(sixteenth, sixteenth.filter((t) => t > 0), part, part, (r, take, p, freePart) => {
      const x = evaluateLeave(at(r, freePart), [own(take, p)], true);
      expect(x.cost).toBe(Math.min(take, r));
      expect(x.remaining).toBe(r - Math.min(take, r));
    })));
  it("keeps cost, free time and remaining work consistent", () =>
    fc.assert(fc.property(sixteenth, fc.array(fc.record({ kind: fc.constantFrom<LeaveKind>("own", "mandatory", "otherPlan"), take: sixteenth.filter((t) => t > 0), part }), { maxLength: 4 }), part,
      (r, pieces, freePart) => {
        const x = evaluateLeave(at(r, freePart), pieces, true);
        expect(x.cost).toBeLessThanOrEqual(r);
        expect(x.costStart + x.costEnd).toBe(x.cost);
        if (!x.whole) expect(x.freeStart + x.freeEnd + x.remaining).toBe(480);
      })));
});
