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
    // a normal working day: work over the whole day
    ["normal day: a full day costs 1", at(480), [own(480)], [480, 480, 0, 0, 480, 480]],
    ["normal day: own ½ morning costs ½", at(480), [own(240, "start")], [240, 240, 0, 240, 240, 0]],
    ["normal day: own ½ afternoon costs ½", at(480), [own(240, "end")], [240, 240, 0, 240, 0, 240]],
    ["maintainer's example: own ½ start, mandatory ½ end", at(480), [own(240, "start"), mand(240)], [480, 240, 240, 0, 480, 480]],
    ["own and mandatory on the same half", at(480), [own(240), mand(240)], [240, 0, 240, 240, 0, 240]],
    ["mandatory ½ at the end on a ½ day costs nothing", at(240), [mand(240)], [0, 0, 0, 240, 0, 240]],
    // 24 December with the rule "afternoon off": work ½ in the morning
    ["24 Dec: own ½ afternoon on free time", at(240), [own(240, "end")], [0, 0, 0, 240, 0, 240]],
    ["24 Dec: own ½ morning frees the day", at(240), [own(240, "start")], [240, 240, 0, 0, 480, 480]],
    ["24 Dec: a full day costs ½", at(240), [own(480)], [240, 240, 0, 0, 480, 480]],
    // a ¾ day with the free time at the end: work from 0 to 360
    ["¾ day: own ½ afternoon costs ¼", at(360), [own(240, "end")], [120, 120, 0, 240, 0, 240]],
    ["¾ day: own ½ morning costs ½", at(360), [own(240, "start")], [240, 240, 0, 120, 240, 120]],
    ["¾ day: a full day costs ¾", at(360), [own(480)], [360, 360, 0, 0, 480, 480]],
    ["free start: own ½ start on free time", at(240, "start"), [own(240, "start")], [0, 0, 0, 240, 240, 0]],
    // the other plan charged the afternoon, which is free here; the mandatory morning is still charged
    ["another plan's afternoon on this plan's free afternoon", at(240), [mand(240, "start"), other(240, 480)], [240, 0, 240, 0, 480, 480]],
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
  it("measures own leave's overlap with the work", () => {
    expect(evaluateLeave(at(240), [own(240, "end")], true).ownWorkOverlap).toBe(0);
    expect(evaluateLeave(at(240), [own(480)], true).ownWorkOverlap).toBe(240);
    expect(evaluateLeave(at(0), [own(480)], true).ownWorkOverlap).toBe(0);
    expect(evaluateLeave(at(480), [mand(480), other(0, 240)], true).ownWorkOverlap).toBe(0);
    expect(evaluateLeave(at(480), [], true).ownWorkOverlap).toBe(0);
  });

  it.each([
    ["take 0", at(480), [own(0)]],
    ["take 481", at(480), [own(481)]],
    ["take 1.5", at(480), [own(1.5)]],
    ["required -1", at(-1), []],
    ["required 481", at(481), []],
    ["required 1.5", at(1.5), []],
    // checkSpan's own cases are in the weight tests
    ["an other-plan span ending after 480", at(480), [other(240, 495)]],
  ] as [string, ReturnType<typeof at>, LeavePiece[]][])("rejects %s", (_, required, pieces) =>
    expect(() => evaluateLeave(required, pieces, true)).toThrow(RangeError));

  it("names the other-plan pieces that overlap own leave", () =>
    expect(overlappingOtherPlanIds(at(480), [own(240, "start"), { ...other(0, 240), sourceId: "overlaps" }, { ...other(240, 480), sourceId: "apart" }])).toEqual(["overlaps"]));
  it("places other-plan pieces by day position when naming overlaps", () =>
    // the work block is the afternoon, day positions 240–480; own leave covers all of it
    expect(overlappingOtherPlanIds(at(240, "start"), [own(240, "end"), { ...other(0, 240), sourceId: "morning" }, { ...other(240, 480), sourceId: "afternoon" }])).toEqual(["afternoon"]));
  it("names no other plan where own leave lies only on free time", () =>
    // the work block is the morning, day positions 0–240; own leave and the other plan's leave lie in the afternoon
    expect(overlappingOtherPlanIds(at(240), [own(240, "end"), other(240, 480)])).toEqual([]));
  it.each([
    ["an empty other-plan span", at(480), [other(480, 480)]],
    ["take 481", at(480), [own(481)]],
    ["required 481", at(481), []],
    ["required 1.5", at(1.5), []],
  ] as [string, ReturnType<typeof at>, LeavePiece[]][])("overlappingOtherPlanIds rejects %s", (_, required, pieces) =>
    expect(() => overlappingOtherPlanIds(required, pieces)).toThrow(RangeError));

  const thirtySecond = fc.integer({ min: 0, max: 32 }).map((k) => k * 15);
  // Multiples of 1/32, and any multiple of 1/480: the engine has no special cases for either.
  const share = fc.oneof(thirtySecond, fc.integer({ min: 0, max: 480 }));
  const part = fc.constantFrom<Part>("start", "end");
  it("costs the overlap with the work for any multiple of 1/480", () =>
    fc.assert(fc.property(share, share.filter((t) => t > 0), part, part, (r, take, p, freePart) => {
      // The work lies at [a, a + r), the leave at [from, to), both in day positions.
      const a = freePart === "end" ? 0 : 480 - r;
      const [from, to] = p === "start" ? [0, take] : [480 - take, 480];
      const overlap = Math.max(0, Math.min(to, a + r) - Math.max(from, a));
      const x = evaluateLeave(at(r, freePart), [own(take, p)], true);
      expect(x.cost).toBe(overlap);
      expect(x.cost).toBeLessThanOrEqual(Math.min(take, r));
      if (r === 480) expect(x.cost).toBe(Math.min(take, r));
      expect(x.remaining).toBe(r - overlap);
    })));
  // Pieces at the start or the end of the day; other-plan pieces at the matching edge of the day.
  const edgePiece = fc
    .record({ kind: fc.constantFrom<LeaveKind>("own", "mandatory", "otherPlan"), take: share.filter((t) => t > 0), part })
    .map(({ kind, take, part: p }): LeavePiece => {
      if (kind !== "otherPlan") return { kind, take, part: p };
      return p === "start" ? { kind, from: 0, to: take } : { kind, from: 480 - take, to: 480 };
    });
  it("keeps cost, free time and remaining work consistent", () =>
    fc.assert(fc.property(share, fc.array(edgePiece, { maxLength: 4 }), part,
      (r, pieces, freePart) => {
        const x = evaluateLeave(at(r, freePart), pieces, true);
        expect(x.cost).toBeLessThanOrEqual(r);
        expect(x.costStart + x.costEnd).toBe(x.cost);
        if (!x.whole) expect(x.freeStart + x.freeEnd + x.remaining).toBe(480);
      })));

  it("matches a slot-by-slot model of the day", () => {
    // Positions and takes in multiples of 1/32, and in any multiple of 1/480.
    const multiple = fc.oneof(fc.integer({ min: 0, max: 32 }).map((k) => k * 15), fc.integer({ min: 0, max: 480 }));
    const ownOrMandatory = fc.record({
      kind: fc.constantFrom<"own" | "mandatory">("own", "mandatory"),
      take: fc.oneof(fc.integer({ min: 1, max: 32 }).map((k) => k * 15), fc.integer({ min: 1, max: 480 })),
      part,
    });
    const otherPlan = fc
      .tuple(multiple, multiple)
      .filter(([x, y]) => x !== y)
      .map(([x, y]): LeavePiece => ({ kind: "otherPlan", from: Math.min(x, y), to: Math.max(x, y) }));
    const piece = fc.oneof(ownOrMandatory, otherPlan);
    fc.assert(
      fc.property(multiple, part, fc.array(piece, { maxLength: 4 }), fc.boolean(), (r, freePart, pieces, charge) => {
        // One slot per unit of the day. The work lies at the slots [a, a + r).
        const a = freePart === "end" ? 0 : 480 - r;
        const work = Array.from({ length: 480 }, (_, i) => i >= a && i < a + r);
        // Slot i is covered by a piece of that kind: at the start or the end of the day, or at its day positions.
        const covered: Record<LeaveKind, boolean[]> = {
          own: new Array<boolean>(480).fill(false),
          mandatory: new Array<boolean>(480).fill(false),
          otherPlan: new Array<boolean>(480).fill(false),
        };
        for (const x of pieces) {
          for (let i = 0; i < 480; i++) {
            let inside: boolean;
            if (x.kind === "otherPlan") inside = i >= x.from && i < x.to;
            else inside = x.part === "start" ? i < x.take : i >= 480 - x.take;
            if (inside) covered[x.kind][i] = true;
          }
        }
        // A slot is free when it has no work or any kind covers it; the free time at an end is the run of free slots there.
        const leave = Array.from({ length: 480 }, (_, i) => covered.own[i] || covered.mandatory[i] || covered.otherPlan[i]);
        const free = Array.from({ length: 480 }, (_, i) => !work[i] || leave[i]);
        let p = 0;
        while (p < 480 && free[p]) p++;
        let q = 0;
        while (q < 480 && free[479 - q]) q++;
        let ownCost = 0;
        let mandatoryCost = 0;
        let costStart = 0;
        let costEnd = 0;
        let ownWorkOverlap = 0;
        let ownCovered = false;
        // Runs of slots charged with the same kind.
        const charged: { from: number; to: number; kind: ChargedSpan["kind"] }[] = [];
        // Runs of slots where one kind lies, charged or not, work or not: mandatory where no other plan's leave is, own
        // where no such mandatory leave lies, another plan's where neither does.
        const placed: { from: number; to: number; kind: LeaveKind }[] = [];
        for (let i = 0; i < 480; i++) {
          const mandatoryHere = covered.mandatory[i] && !covered.otherPlan[i];
          // Only work slots are charged: mandatory leave first, own leave where no such mandatory leave lies.
          const isCharged = charge && work[i] && (covered.own[i] || mandatoryHere);
          if (isCharged && mandatoryHere) mandatoryCost++;
          else if (isCharged) ownCost++;
          if (isCharged && i < p) costStart++;
          if (isCharged && i >= 480 - q) costEnd++;
          if (work[i] && covered.own[i]) ownWorkOverlap++;
          if (work[i] && covered.own[i] && covered.otherPlan[i]) ownCovered = true;
          if (isCharged) {
            const kind = mandatoryHere ? "mandatory" : "leave";
            const last = charged.at(-1);
            if (last && last.to === i && last.kind === kind) last.to++;
            else charged.push({ from: i, to: i + 1, kind });
          }
          const placedKind: LeaveKind | undefined = mandatoryHere ? "mandatory" : covered.own[i] ? "own" : covered.otherPlan[i] ? "otherPlan" : undefined;
          if (placedKind !== undefined) {
            const last = placed.at(-1);
            if (last && last.to === i && last.kind === placedKind) last.to++;
            else placed.push({ from: i, to: i + 1, kind: placedKind });
          }
        }
        const remaining = work.filter((isWork, i) => isWork && !leave[i]).length;
        const whole = remaining === 0;
        const cost = ownCost + mandatoryCost;
        const x = evaluateLeave(at(r, freePart), pieces, charge);
        expect(x).toEqual({
          cost,
          ownCost,
          mandatoryCost,
          ownWorkOverlap,
          remaining,
          whole,
          freeStart: whole ? 480 : p,
          freeEnd: whole ? 480 : q,
          costStart: whole ? cost : costStart,
          costEnd: whole ? 0 : costEnd,
          ownCoveredByOtherPlan: ownCovered,
          charged,
          placed,
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
  it("places a span by day position, not by work block", () => {
    // required ½ with the free time at the start: the work block is the afternoon, day positions 240–480
    expect(evaluateLeave(at(240, "start"), [other(0, 240)], true)).toMatchObject({ remaining: 240, whole: false, freeStart: 240 });
    expect(evaluateLeave(at(240, "start"), [other(240, 480)], true)).toMatchObject({ remaining: 0, whole: true });
  });
  it("reports charged spans in day positions", () =>
    expect(evaluateLeave(at(240, "start"), [own(240, "end")], true).charged).toEqual([{ from: 240, to: 480, kind: "leave" }]));
  it("charges only the part of the leave that overlaps the work", () =>
    // the work is the morning, day positions 0–240; a full day of leave is charged for the morning only
    expect(evaluateLeave(at(240), [own(480)], true)).toMatchObject({ cost: 240, charged: [{ from: 0, to: 240, kind: "leave" }] }));
  it("splits own and mandatory spans as mandatoryCost counts them", () =>
    expect(evaluateLeave(at(480), [own(240, "start"), mand(480, "end")], true).charged).toEqual([{ from: 0, to: 480, kind: "mandatory" }]));
  it("places each kind where it lies, charged or not", () => {
    // Own leave gives way to mandatory leave, which gives way to another plan's.
    expect(evaluateLeave(at(480), [own(480), mand(240)], true).placed).toEqual([
      { from: 0, to: 240, kind: "own" },
      { from: 240, to: 480, kind: "mandatory" },
    ]);
    expect(evaluateLeave(at(480), [mand(480), other(0, 240)], true).placed).toEqual([
      { from: 0, to: 240, kind: "otherPlan" },
      { from: 240, to: 480, kind: "mandatory" },
    ]);
    expect(evaluateLeave(at(480), [own(240, "start"), other(0, 480)], true).placed).toEqual([
      { from: 0, to: 240, kind: "own" },
      { from: 240, to: 480, kind: "otherPlan" },
    ]);
    // Outside the period nothing is charged, but the leave still lies where it does.
    expect(evaluateLeave(at(480), [own(120, "start")], false).placed).toEqual([{ from: 0, to: 120, kind: "own" }]);
    // Leave at the end of the day lies at the end of the day, wherever the work lies.
    expect(evaluateLeave(at(240, "start"), [own(120, "end")], true).placed).toEqual([{ from: 360, to: 480, kind: "own" }]);
    expect(evaluateLeave(at(240), [own(120, "end")], true).placed).toEqual([{ from: 360, to: 480, kind: "own" }]);
    // Leave lies where it is also on time without work and on a day without required work.
    expect(evaluateLeave(at(240), [mand(240, "start"), other(240, 480)], true).placed).toEqual([
      { from: 0, to: 240, kind: "mandatory" },
      { from: 240, to: 480, kind: "otherPlan" },
    ]);
    expect(evaluateLeave(at(0), [own(480)], true).placed).toEqual([{ from: 0, to: 480, kind: "own" }]);
    // A day without leave has no placed spans.
    expect(evaluateLeave(at(480), [], true).placed).toEqual([]);
  });

  it("charges nothing outside the period", () =>
    expect(evaluateLeave(at(480), [own(480, "end")], false).charged).toEqual([]));
});
