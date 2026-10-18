// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateLeave, overlappingOtherPlanIds } from "../../../src/engine/counting/leave";
import type { ChargedSpan, DayLeave, LeaveKind, LeavePiece } from "../../../src/engine/counting/leave";
import type { Part } from "../../../src/engine/counting/types";

const at = (value: number, freePart: Part = "end") => ({ value, freePart });
const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mand = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "m" });
const other = (from: number, to: number): LeavePiece => ({ kind: "otherPlan", from, to, sourceId: "o" });
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
    ["10 minutes of work left", at(480), [own(470, "start")], [470, 470, 0, 10, 470, 0]],
    ["leave from another plan never costs", at(480), [other(0, 480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave already counted in another plan", at(480), [mand(480), other(0, 480)], [0, 0, 0, 0, 480, 480]],
    ["mandatory leave half covered by another plan", at(480), [mand(480), other(0, 240)], [240, 0, 240, 0, 480, 480]],
    ["own leave on a day taken in another plan", at(480), [own(480), other(0, 480)], [480, 480, 0, 0, 480, 480]],
    // a closure added after the day was already planned as own leave costs the day once
    ["closure added on a day already planned as own leave", at(480), [own(480), mand(480)], [480, 0, 480, 0, 480, 480]],
  ] as [string, ReturnType<typeof at>, LeavePiece[], number[]][])("%s", (_, required, pieces, expected) =>
    expect(pick(evaluateLeave(required, pieces, true))).toEqual(expected));

  it("splits the cost of a day with work in the middle", () => {
    const x = evaluateLeave(at(480), [own(120, "start"), mand(120)], true);
    expect([x.remaining, x.freeStart, x.freeEnd, x.costStart, x.costEnd]).toEqual([240, 120, 120, 120, 120]);
  });
  it("flags own leave covered by leave from another plan", () => {
    expect(evaluateLeave(at(480), [own(480), other(0, 480)], true).ownCoveredByOtherPlan).toBe(true);
    expect(evaluateLeave(at(480), [own(240, "start"), other(240, 480)], true).ownCoveredByOtherPlan).toBe(false);
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
    ["an other-plan span starting before 0", at(480), [other(-15, 240)]],
    ["an other-plan span ending after 480", at(480), [other(240, 495)]],
    ["an empty other-plan span", at(480), [other(240, 240)]],
    ["a reversed other-plan span", at(480), [other(240, 120)]],
    ["an other-plan span at 1.5", at(480), [other(1.5, 240)]],
  ] as [string, ReturnType<typeof at>, LeavePiece[]][])("rejects %s", (_, required, pieces) =>
    expect(() => evaluateLeave(required, pieces, true)).toThrow(RangeError));

  it("names the other-plan pieces that overlap own leave", () =>
    expect(overlappingOtherPlanIds(at(480), [own(240, "start"), { ...other(0, 240), sourceId: "overlaps" }, { ...other(240, 480), sourceId: "apart" }])).toEqual(["overlaps"]));
  it("places other-plan pieces by day position when naming overlaps", () =>
    // the work block is the afternoon, day positions 240–480; own leave covers all of it
    expect(overlappingOtherPlanIds(at(240, "start"), [own(240, "start"), { ...other(0, 240), sourceId: "morning" }, { ...other(240, 480), sourceId: "afternoon" }])).toEqual(["afternoon"]));
  it.each([
    ["an empty other-plan span", at(480), [other(480, 480)]],
    ["take 481", at(480), [own(481)]],
    ["required 481", at(481), []],
    ["required 1.5", at(1.5), []],
  ] as [string, ReturnType<typeof at>, LeavePiece[]][])("overlappingOtherPlanIds rejects %s", (_, required, pieces) =>
    expect(() => overlappingOtherPlanIds(required, pieces)).toThrow(RangeError));

  const thirtySecond = fc.integer({ min: 0, max: 32 }).map((k) => k * 15);
  const part = fc.constantFrom<Part>("start", "end");
  it("costs min(taken, required work) for any multiple of 1/32", () =>
    fc.assert(fc.property(thirtySecond, thirtySecond.filter((t) => t > 0), part, part, (r, take, p, freePart) => {
      const x = evaluateLeave(at(r, freePart), [own(take, p)], true);
      expect(x.cost).toBe(Math.min(take, r));
      expect(x.remaining).toBe(r - Math.min(take, r));
    })));
  // Pieces at the start or the end of the day; other-plan pieces at the matching edge of the day.
  const edgePiece = fc
    .record({ kind: fc.constantFrom<LeaveKind>("own", "mandatory", "otherPlan"), take: thirtySecond.filter((t) => t > 0), part })
    .map(({ kind, take, part: p }): LeavePiece => {
      if (kind !== "otherPlan") return { kind, take, part: p };
      return p === "start" ? { kind, from: 0, to: take } : { kind, from: 480 - take, to: 480 };
    });
  it("keeps cost, free time and remaining work consistent", () =>
    fc.assert(fc.property(thirtySecond, fc.array(edgePiece, { maxLength: 4 }), part,
      (r, pieces, freePart) => {
        const x = evaluateLeave(at(r, freePart), pieces, true);
        expect(x.cost).toBeLessThanOrEqual(r);
        expect(x.costStart + x.costEnd).toBe(x.cost);
        if (!x.whole) expect(x.freeStart + x.freeEnd + x.remaining).toBe(480);
      })));

  it("matches a slot-by-slot model of the day", () => {
    const multiple = fc.integer({ min: 0, max: 32 }).map((k) => k * 15);
    const ownOrMandatory = fc.record({
      kind: fc.constantFrom<"own" | "mandatory">("own", "mandatory"),
      take: fc.integer({ min: 1, max: 32 }).map((k) => k * 15),
      part,
    });
    const otherPlan = fc
      .tuple(multiple, multiple)
      .filter(([x, y]) => x !== y)
      .map(([x, y]): LeavePiece => ({ kind: "otherPlan", from: Math.min(x, y), to: Math.max(x, y) }));
    const piece = fc.oneof(ownOrMandatory, otherPlan);
    fc.assert(
      fc.property(multiple, part, fc.array(piece, { maxLength: 4 }), fc.boolean(), (r, freePart, pieces, charge) => {
        // The work block lies at day positions [a, a + r).
        const a = freePart === "end" ? 0 : 480 - r;
        // One boolean per unit of the work block; slot i is covered by a piece of that kind.
        const covered: Record<LeaveKind, boolean[]> = {
          own: new Array<boolean>(r).fill(false),
          mandatory: new Array<boolean>(r).fill(false),
          otherPlan: new Array<boolean>(r).fill(false),
        };
        for (const x of pieces) {
          for (let i = 0; i < r; i++) {
            let inside: boolean;
            if (x.kind === "otherPlan") inside = i >= x.from - a && i < x.to - a;
            else inside = x.part === "start" ? i < x.take : i >= r - x.take;
            if (inside) covered[x.kind][i] = true;
          }
        }
        // A slot is free when any kind covers it; the free time at an end is the run of free slots there.
        const free = Array.from({ length: r }, (_, i) => covered.own[i] || covered.mandatory[i] || covered.otherPlan[i]);
        let p = 0;
        while (p < r && free[p]) p++;
        let q = 0;
        while (q < r && free[r - 1 - q]) q++;
        let ownCost = 0;
        let mandatoryCost = 0;
        let costStart = 0;
        let costEnd = 0;
        let ownCovered = false;
        // Runs of slots charged with the same kind, in day positions.
        const charged: { from: number; to: number; kind: ChargedSpan["kind"] }[] = [];
        for (let i = 0; i < r; i++) {
          const mandCharged = covered.mandatory[i] && !covered.otherPlan[i];
          const isCharged = charge && (covered.own[i] || mandCharged);
          if (charge && mandCharged) mandatoryCost++;
          else if (isCharged) ownCost++;
          if (isCharged && i < p) costStart++;
          if (isCharged && i >= r - q) costEnd++;
          if (covered.own[i] && covered.otherPlan[i]) ownCovered = true;
          if (isCharged) {
            const kind = mandCharged ? "mandatory" : "leave";
            const last = charged.at(-1);
            if (last && last.to === a + i && last.kind === kind) last.to++;
            else charged.push({ from: a + i, to: a + i + 1, kind });
          }
        }
        const remaining = free.filter((isFree) => !isFree).length;
        const whole = remaining === 0;
        const cost = ownCost + mandatoryCost;
        const x = evaluateLeave(at(r, freePart), pieces, charge);
        expect(x).toEqual({
          cost,
          ownCost,
          mandatoryCost,
          remaining,
          whole,
          freeStart: whole ? 480 : a + p,
          freeEnd: whole ? 480 : 480 - a - r + q,
          costStart: whole ? cost : costStart,
          costEnd: whole ? 0 : costEnd,
          ownCoveredByOtherPlan: ownCovered,
          charged,
        });
      }),
      { numRuns: 500 },
    );
  });
});

describe("other-plan pieces with a position", () => {
  it("a middle piece frees time but neither edge", () =>
    expect(evaluateLeave(at(480), [other(120, 240)], true)).toMatchObject({ cost: 0, remaining: 360, whole: false, freeStart: 0, freeEnd: 0, charged: [] }));
  it("joins an own quarter at the start into one free stretch", () =>
    expect(evaluateLeave(at(480), [own(120, "start"), other(120, 240)], true)).toMatchObject({ cost: 120, freeStart: 240, costStart: 120, charged: [{ from: 0, to: 120, kind: "leave" }] }));
  it("charges only the second quarter of a mandatory morning", () =>
    expect(evaluateLeave(at(480), [mand(240, "start"), other(0, 120)], true)).toMatchObject({ cost: 120, mandatoryCost: 120, freeStart: 240, costStart: 120, charged: [{ from: 120, to: 240, kind: "mandatory" }] }));
  it("places a span by day position, not by work block (Review Focus 5)", () => {
    // required ½ with the free time at the start: the work block is the afternoon, day positions 240–480
    expect(evaluateLeave(at(240, "start"), [other(0, 240)], true)).toMatchObject({ remaining: 240, whole: false, freeStart: 240 });
    expect(evaluateLeave(at(240, "start"), [other(240, 480)], true)).toMatchObject({ remaining: 0, whole: true });
  });
  it("reports charged spans in day positions", () =>
    expect(evaluateLeave(at(240, "start"), [own(240, "start")], true).charged).toEqual([{ from: 240, to: 480, kind: "leave" }]));
  it("splits own and mandatory spans as mandatoryCost counts them", () =>
    expect(evaluateLeave(at(480), [own(240, "start"), mand(480, "end")], true).charged).toEqual([{ from: 0, to: 480, kind: "mandatory" }]));
  it("charges nothing outside the period", () =>
    expect(evaluateLeave(at(480), [own(480, "end")], false).charged).toEqual([]));
});
