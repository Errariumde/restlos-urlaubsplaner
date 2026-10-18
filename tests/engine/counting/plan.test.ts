// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computePlan, periodBounds } from "../../../src/engine/counting/plan";
import type { PlanResult } from "../../../src/engine/counting/plan";
import type { Stretch } from "../../../src/engine/counting/stretches";
import type { DayRule, LeaveDay, Part, PlanInput, SourceDay } from "../../../src/engine/counting/types";
import { isoFromDay } from "../../../src/engine/days";
import { BAVARIA, baseInput, CHRISTMAS_EVE_RULES, d, FULL, HALF, fixed, once, span } from "./helpers";

// lib has no DOM; performance exists in Node and in Firefox.
declare const performance: { now(): number };

const fmt = (s: Stretch) => `${isoFromDay(s.start.day)}@${s.start.offset} ${isoFromDay(s.end.day)}@${s.end.offset} ${s.cost}/${s.daysOff}`;
const listed = (result: PlanResult) => result.stretches.filter((s) => s.listed).map(fmt);
const dayOf = (result: PlanResult, iso: string) => {
  const found = result.days.find((x) => x.day === d(iso));
  if (!found) throw new Error(`no day ${iso}`);
  return found;
};
const leave = (iso: string, take = FULL, part?: Part): LeaveDay => ({ day: d(iso), take, ...(part && { part }) });
const plan = (changes: Partial<PlanInput>) => computePlan(baseInput(changes));
const withRules = (...rules: DayRule[]) => ({ ...BAVARIA, rules });
const closureRule: DayRule = { id: "closure", match: { type: "range", from: fixed(12, 27), to: fixed(1, 4) }, validFrom: 2027, validUntil: 2027, mandatory: FULL };
const month = (year: number, m: number) => ({ year, month: m });

describe("computePlan: stretches from the design", () => {
  it("½ on Fri 7 May in the morning", () =>
    expect(listed(plan({ leave: [leave("2027-05-07", HALF, "start")] }))).toEqual(["2027-05-06@0 2027-05-07@240 240/720"]));
  it("½ on Fri 7 May in the afternoon", () =>
    expect(listed(plan({ leave: [leave("2027-05-07", HALF, "end")] }))).toEqual(["2027-05-07@240 2027-05-09@480 240/1200"]));
  it("Christmas with 24 and 31 December at most ½", () => {
    const christmas = ["2027-12-27", "2027-12-28", "2027-12-29", "2027-12-30"].map((x) => leave(x));
    const contract = withRules(...CHRISTMAS_EVE_RULES);
    expect(listed(plan({ contract, leave: [...christmas, leave("2027-12-31", HALF, "end")] }))).toEqual(["2027-12-24@240 2028-01-02@480 2160/4560"]);
    expect(listed(plan({ contract, leave: [leave("2027-12-24", HALF, "end"), ...christmas, leave("2027-12-31", HALF, "end")] })))
      .toEqual(["2027-12-24@0 2028-01-02@480 2400/4800"]);
  });
  it("the maintainer's example: own ½ in the morning, mandatory ½ in the afternoon", () => {
    const contract = withRules({ id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF });
    const morning = plan({ contract, leave: [leave("2027-12-24", HALF, "start")] });
    expect(listed(morning)).toEqual(["2027-12-24@0 2027-12-26@480 480/1440"]);
    expect([dayOf(morning, "2027-12-24").evaluation.ownCost, dayOf(morning, "2027-12-24").evaluation.mandatoryCost]).toEqual([240, 240]);
    expect(listed(plan({ contract, leave: [leave("2027-12-24", HALF, "end")] }))).toEqual(["2027-12-24@240 2027-12-26@480 240/1200"]);
  });
  it("lists a standalone paid closure with cost 0", () => {
    const sources: SourceDay[] = span("2027-12-27", "2027-12-30").map((x) => ({ type: "paidClosure", day: d(x), sourceId: "closure" }));
    expect(listed(plan({ sources }))).toEqual(["2027-12-25@0 2027-12-30@480 0/2880"]);
  });
  it("lists a closure made by a rule requiring no work", () => {
    const closure: DayRule = { id: "closure", match: { type: "range", from: once("2027-12-27"), to: once("2027-12-30") }, requiredAtMost: 0 };
    const result = plan({ contract: withRules(closure) });
    expect(listed(result)).toEqual(["2027-12-25@0 2027-12-30@480 0/2880"]);
    expect(result.totals.planned).toBe(0);
  });
  it("doesn't treat a rule on a day without work as a closure", () => {
    const result = plan({ contract: withRules({ id: "sat", match: once("2027-06-12"), requiredAtMost: 0 }) });
    expect([listed(result), dayOf(result, "2027-06-12").closure]).toEqual([[], false]);
  });
  it("lists each other plan once in a leaveTakenInOtherPlan problem", () => {
    const sources: SourceDay[] = [
      { type: "otherPlan", day: d("2027-05-05"), sourceId: "p", take: FULL },
      { type: "otherPlan", day: d("2027-05-05"), sourceId: "p", take: FULL },
    ];
    expect(plan({ sources, leave: [leave("2027-05-05")] }).problems).toEqual([{ code: "leaveTakenInOtherPlan", day: d("2027-05-05"), sourceIds: ["p"] }]);
  });
  it("names only the other plans that overlap the own leave", () => {
    const sources: SourceDay[] = [
      { type: "otherPlan", day: d("2027-05-05"), sourceId: "morning", take: HALF, part: "start" },
      { type: "otherPlan", day: d("2027-05-05"), sourceId: "evening", take: HALF, part: "end" },
    ];
    expect(plan({ sources, leave: [leave("2027-05-05", HALF, "end")] }).problems).toEqual([{ code: "leaveTakenInOtherPlan", day: d("2027-05-05"), sourceIds: ["evening"] }]);
  });
  it("doesn't list ordinary weekends and holidays", () => expect(listed(plan({}))).toEqual([]));
  // a period that starts inside a stretch still sees the whole stretch
  it("reaches back before a period that starts inside a stretch and counts only the cost inside it", () => {
    const result = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2028, 12) } });
    expect(listed(result)).toEqual(["2027-12-25@0 2028-01-04@480 960/5280"]);
    expect(result.totals.planned).toBe(960);
  });
});

describe("computePlan: totals and plans that share a month", () => {
  it("charges a closure over New Year once across two plans", () => {
    const plan2027 = plan({ contract: withRules(closureRule), period: { from: month(2027, 1), to: month(2028, 1) } });
    expect(plan2027.totals.byYear).toEqual([{ year: 2027, planned: 2400 }, { year: 2028, planned: 960 }]);
    const otherPlan: SourceDay[] = ["2028-01-03", "2028-01-04"].map((x) => ({ type: "otherPlan", day: d(x), sourceId: "plan-2027", take: FULL }));
    const plan2028 = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2029, 1) }, sources: otherPlan });
    expect(plan2028.totals.planned).toBe(0);
    const again = plan({ contract: withRules(closureRule), period: { from: month(2028, 1), to: month(2029, 1) }, sources: otherPlan, leave: [leave("2028-01-03")] });
    expect(again.totals.planned).toBe(480);
    expect(again.problems).toEqual([{ code: "leaveTakenInOtherPlan", day: d("2028-01-03"), sourceIds: ["plan-2027"] }]);
  });
  it("never counts leave from another plan and shows it on the day", () => {
    const sources: SourceDay[] = span("2027-06-01", "2027-06-03").map((x) => ({ type: "otherPlan", day: d(x), sourceId: "p", take: FULL }));
    const result = plan({ sources });
    expect(result.totals.planned).toBe(0);
    expect(dayOf(result, "2027-06-02").facts.sources.map((s) => s.sourceId)).toEqual(["p"]);
    expect(listed(result)).toEqual([]);
  });
  it("goes below zero without blocking", () =>
    expect(plan({ allowance: FULL, leave: [leave("2027-05-05"), leave("2027-05-07")] }).totals).toMatchObject({ planned: 960, remaining: -480 }));
});

describe("computePlan: problems", () => {
  it("reports leave outside the period and leave on a day without required work", () => {
    const result = plan({ leave: [leave("2027-05-09"), leave("2028-02-01")] });
    expect(result.problems).toEqual([{ code: "leaveWithoutRequiredWork", day: d("2027-05-09") }, { code: "leaveOutsidePeriod", day: d("2028-02-01") }]);
    expect(result.totals.planned).toBe(0);
  });
  it("charges nothing for 24 and 31 December on a Sunday", () => {
    const result = plan({ contract: withRules(...CHRISTMAS_EVE_RULES), period: { from: month(2028, 1), to: month(2028, 12) }, leave: [leave("2028-12-24"), leave("2028-12-31")] });
    expect([result.totals.planned, result.problems.map((p) => p.code)]).toEqual([0, ["leaveWithoutRequiredWork", "leaveWithoutRequiredWork"]]);
  });
  it("reports conflicting forced rules", () =>
    expect(plan({ contract: withRules({ id: "a", match: once("2027-03-13"), requiredExactly: HALF }, { id: "b", match: once("2027-03-13"), requiredExactly: FULL }) }).problems)
      .toEqual([{ code: "conflictingForcedRules", day: d("2027-03-13"), ruleIds: ["a", "b"] }]));
  it("reports several problems on one day in order", () =>
    expect(
      plan({
        contract: withRules({ id: "a", match: once("2027-03-13"), requiredExactly: HALF }, { id: "b", match: once("2027-03-13"), requiredExactly: FULL }),
        leave: [leave("2027-03-13")],
        sources: [{ type: "otherPlan", day: d("2027-03-13"), sourceId: "p", take: FULL }],
      }).problems,
    ).toEqual([
      { code: "leaveTakenInOtherPlan", day: d("2027-03-13"), sourceIds: ["p"] },
      { code: "conflictingForcedRules", day: d("2027-03-13"), ruleIds: ["a", "b"] },
    ]));
  it.each([
    [{ leave: [{ day: d("2027-05-05"), take: 481 }] }], [{ allowance: 1.5 }],
  ] as [Partial<PlanInput>][])("rejects out-of-range units %#", (changes) => expect(() => plan(changes)).toThrow(RangeError));
  it.each([
    ["month 0", month(2027, 0)], ["month 13", month(2027, 13)], ["year 1582", month(1582, 1)], ["year 10000", month(10000, 1)],
  ])("periodBounds rejects %s", (_, bad) => expect(() => periodBounds({ from: month(2027, 1), to: bad })).toThrow(RangeError));
  it.each([
    [{ leave: [leave("2027-05-05"), leave("2027-05-05")] }], [{ leave: [{ day: d("2027-05-05"), take: 0 }] }],
    [{ leave: [{ day: d("2027-05-05"), take: HALF }] }], [{ allowance: -1 }], [{ period: { from: month(2027, 5), to: month(2027, 4) } }],
  ] as [Partial<PlanInput>][])("rejects invalid input %#", (changes) => expect(() => plan(changes)).toThrow(RangeError));
});

describe("computePlan: limits", () => {
  // the day window is clamped to the supported years
  it("works at the limits of the supported years", () => {
    expect(isoFromDay(plan({ period: { from: month(9999, 1), to: month(9999, 12) } }).days.at(-1)?.day ?? 0)).toBe("9999-12-31");
    expect(isoFromDay(plan({ period: { from: month(1583, 1), to: month(1583, 12) } }).days[0]?.day ?? 0)).toBe("1583-01-01");
  });
  it("keeps the costs of all stretches equal to planned", () => {
    const take = fc.integer({ min: 1, max: 32 }).map((k) => k * 15);
    const leaveDays = fc.uniqueArray(fc.integer({ min: 0, max: 58 }), { maxLength: 15 }).chain((offsets) =>
      fc.tuple(...offsets.map((o) => fc.tuple(take, fc.constantFrom<Part>("start", "end")).map(([t, p]) => ({ day: d("2027-01-01") + o, take: t, part: p })))));
    const mandatoryDays = fc.uniqueArray(fc.integer({ min: 0, max: 58 }), { maxLength: 6 }).map((offsets) =>
      offsets.map((o): SourceDay => ({ type: "mandatory", day: d("2027-01-01") + o, sourceId: "m", take: HALF, part: "end" })));
    fc.assert(fc.property(leaveDays, mandatoryDays, (leaveList, sources) => {
      const result = plan({ period: { from: month(2027, 1), to: month(2027, 2) }, leave: leaveList, sources });
      expect(result.stretches.reduce((sum, s) => sum + s.cost, 0)).toBe(result.totals.planned);
    }), { numRuns: 50 });
  });
  // speed budget for a realistic plan
  it("computes a 13-month plan with 40 rules and 300 source days quickly", () => {
    const rules: DayRule[] = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? { id: `r${i}`, match: fixed(1 + (i % 12), 1 + (i % 28)), requiredAtMost: HALF }
        : { id: `r${i}`, match: { type: "range", from: fixed(1 + (i % 12), 1), days: 10, weekdays: ["fri"] }, mandatory: HALF });
    const sources: SourceDay[] = Array.from({ length: 300 }, (_, i) => ({ type: "holiday", day: d("2027-01-01") + i, sourceId: "s", required: HALF }));
    const input = baseInput({ contract: withRules(...rules), sources, period: { from: month(2027, 1), to: month(2028, 1) } });
    computePlan(input);
    const startedAt = performance.now();
    computePlan(input);
    expect(performance.now() - startedAt).toBeLessThan(200);
  });
});
