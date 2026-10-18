// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computePlan } from "../../../src/engine/counting/plan";
import type { DayResult } from "../../../src/engine/counting/plan";
import type { LeaveDay, Part, WorkWeekEntry, YearMonth } from "../../../src/engine/counting/types";
import type { Weekday } from "../../../src/engine/days";
import { planInput } from "../../../src/engine/file/model";
import { importOtherPlan } from "../../../src/engine/file/other-plan";
import type { FileRule, FileSource, OtherPlanRef, PlanFile } from "../../../src/engine/file/types";
import { toRuleSet, writeFile } from "../../../src/engine/file/write";
import { BAVARIA, d, FULL, HALF, fixed, once } from "../counting/helpers";

const QUARTER = 120;
const STEP = 15; // 1/32 day
const MON_TO_FRI: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
const month = (year: number, m: number): YearMonth => ({ year, month: m });

interface Model {
  readonly id: string;
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly name?: string;
  readonly revision?: number;
  readonly rules?: readonly FileRule[];
  readonly days?: readonly LeaveDay[];
  readonly week?: readonly WorkWeekEntry[];
}

/** A plan file model in Bavaria with minUnit 1/32, a full-time week and no sources. */
function planModel({ id, from, to, name, revision = 1, rules = [], days = [], week = BAVARIA.week }: Model): PlanFile {
  return {
    kind: "plan",
    id,
    revision,
    contract: { ...(name === undefined ? {} : { name }), references: {}, region: { country: "DE", state: "BY" }, minUnit: STEP, week, rules },
    sources: [],
    templates: [],
    theme: null,
    plan: { range: { from, to }, allowance: 30 * FULL, days, overrides: [], notes: [] },
  };
}

/** `target` with `other` as its only "Leave from another plan", imported from the written file. */
function importInto(target: PlanFile, other: PlanFile): PlanFile {
  const result = importOtherPlan(writeFile(other), { id: target.id, revision: target.revision });
  if (!result.ok) throw new Error(`refused: ${result.refusal.code}`);
  const source: FileSource = {
    id: "other",
    name: "Other plan",
    type: "otherPlan",
    color: { slot: "grey" },
    visible: true,
    plan: result.plan,
    entries: result.entries,
  };
  return { ...target, sources: [source] };
}

function dayResult(file: PlanFile, iso: string): DayResult {
  const found = computePlan(planInput(file)).days.find((x) => x.day === d(iso));
  if (!found) throw new Error(`no day ${iso}`);
  return found;
}
const costOn = (file: PlanFile, iso: string): number => dayResult(file, iso).evaluation.cost;
const CURRENT = { id: "current-plan", revision: 1 };

describe("importOtherPlan: the charged spans", () => {
  const plan2027 = planModel({
    id: "plan-2027",
    name: "Muster AG 2027",
    revision: 4,
    from: month(2027, 1),
    to: month(2027, 12),
    rules: [
      { id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF, part: "end" },
      { id: "new-years-eve", match: fixed(12, 31), requiredAtMost: HALF, part: "end" },
    ],
    days: [
      { day: d("2027-05-07"), take: FULL }, // the bridge day after Ascension
      { day: d("2027-05-08"), take: FULL }, // a Saturday: no required work, cost 0
      { day: d("2027-05-28"), take: FULL }, // after Corpus Christi
      { day: d("2027-12-24"), take: HALF, part: "start" }, // the maintainer's example: the whole day free at cost 1
      { day: d("2027-12-31"), take: FULL }, // only ½ is required
      { day: d("2028-01-03"), take: FULL }, // outside the period
    ],
  });

  it("stores every span the plan charged on the days of its period", () =>
    expect(importOtherPlan(writeFile(plan2027), CURRENT)).toEqual({
      ok: true,
      plan: { id: "plan-2027", name: "Muster AG 2027", revision: 4 },
      entries: [
        { date: d("2027-05-07"), from: 0, to: FULL, kind: "leave" },
        { date: d("2027-05-28"), from: 0, to: FULL, kind: "leave" },
        { date: d("2027-12-24"), from: 0, to: HALF, kind: "leave" },
        { date: d("2027-12-24"), from: HALF, to: FULL, kind: "mandatory" },
        { date: d("2027-12-31"), from: 0, to: HALF, kind: "leave" },
      ],
      notices: [],
      report: [{ code: "outsidePeriod", path: "plan.days[5]" }],
    }));
  it("names the plan by its id when its contract has no name", () =>
    expect(importOtherPlan(writeFile(planModel({ id: "unnamed", from: month(2027, 1), to: month(2027, 12) })), CURRENT))
      .toMatchObject({ ok: true, plan: { id: "unnamed", name: "unnamed", revision: 1 }, entries: [] }));
});

describe("importOtherPlan: a closure over the turn of the year (0006)", () => {
  const closure: FileRule = { id: "closure", match: { type: "range", from: fixed(12, 27), to: fixed(1, 4), weekdays: MON_TO_FRI }, mandatory: FULL };
  const plan2027 = planModel({ id: "plan-2027", from: month(2027, 1), to: month(2028, 1), rules: [closure] });
  const plan2028 = planModel({ id: "plan-2028", from: month(2028, 1), to: month(2029, 1), rules: [closure] });
  const shared = ["2028-01-03", "2028-01-04"];

  it("charges 3 and 4 January 2028 only in plan 2027", () => {
    const imported = importInto(plan2028, plan2027);
    expect(shared.map((iso) => costOn(plan2027, iso))).toEqual([FULL, FULL]);
    expect(shared.map((iso) => costOn(imported, iso))).toEqual([0, 0]);
    expect(shared.map((iso) => costOn(plan2028, iso))).toEqual([FULL, FULL]); // without the source, both plans would charge them
  });
});

describe("importOtherPlan: a span in the middle of the working time (the quarter case)", () => {
  const DAY = "2028-01-04";
  const morning: FileRule = { id: "mandatory-morning", match: once(DAY), mandatory: HALF, part: "start" };
  const quarter: LeaveDay = { day: d(DAY), take: QUARTER, part: "start" };
  const x = (rules: readonly FileRule[]) => planModel({ id: "plan-x", from: month(2027, 1), to: month(2028, 1), rules });
  const y = (rules: readonly FileRule[]) => planModel({ id: "plan-y", from: month(2028, 1), to: month(2028, 12), rules, days: [quarter] });
  const written = (file: PlanFile): unknown => (JSON.parse(writeFile(file)) as { sources: { entries: unknown[] }[] }).sources[0]?.entries;

  it.each<[string, () => readonly [PlanFile, PlanFile]]>([
    [
      "the mandatory morning only in X: X imports Y, then Y imports X",
      () => {
        const x1 = importInto(x([morning]), y([]));
        return [x1, importInto(y([]), x1)];
      },
    ],
    [
      "the mandatory morning in both plans, after Y first imported X: X imports Y, then Y imports X",
      () => {
        const y1 = importInto(y([morning]), x([morning])); // Y's quarter lies in time X charged: flagged in Y here
        const x2 = importInto(x([morning]), y1);
        return [x2, importInto(y([morning]), x2)];
      },
    ],
  ])("%s", (_, run) => {
    const [xFinal, yFinal] = run();
    expect(dayResult(xFinal, DAY).evaluation.charged).toEqual([{ from: QUARTER, to: HALF, kind: "mandatory" }]);
    expect(written(yFinal)).toEqual([{ date: DAY, from: "1/4", to: "2/4", kind: "mandatory" }]);
    expect(computePlan(planInput(yFinal)).problems.filter((problem) => problem.code === "leaveTakenInOtherPlan" && problem.day === d(DAY))).toEqual([]);
    expect(costOn(xFinal, DAY) + costOn(yFinal, DAY)).toBe(HALF);
  });
});

describe("importOtherPlan: two plans importing each other (property)", () => {
  const SHARED = "2028-01-04"; // a working Tuesday in January 2028, the month both plans share
  const run = (take: number, part: Part, a: number, b: number): void => {
    const rule: FileRule = { id: "shared-mandatory", match: once(SHARED), mandatory: take, part };
    const planA = planModel({ id: "plan-a", from: month(2027, 1), to: month(2028, 1), rules: [rule], days: [{ day: d(SHARED), take: a, part: "start" }] });
    const planB = planModel({ id: "plan-b", from: month(2028, 1), to: month(2028, 12), rules: [rule], days: [{ day: d(SHARED), take: b, part: "end" }] });
    const b1 = importInto(planB, planA); // B importing A0, which is A without sources
    const a2 = importInto(planA, b1);
    const [mandatoryFrom, mandatoryTo] = part === "start" ? ([0, take] as const) : ([FULL - take, FULL] as const);
    let union = 0; // units of the day inside A's own leave, B's own leave or the mandatory leave
    for (let unit = 0; unit < FULL; unit++) {
      if (unit < a || unit >= FULL - b || (unit >= mandatoryFrom && unit < mandatoryTo)) union++;
    }
    expect(costOn(a2, SHARED) + costOn(b1, SHARED)).toBe(union);
  };

  it("charges every unit of the shared day once, with own leave in A at the start and in B at the end", () =>
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 32 }),
        fc.constantFrom<Part>("start", "end"),
        fc.integer({ min: 1, max: 31 }).chain((a) => fc.tuple(fc.constant(a), fc.integer({ min: 1, max: 32 - a }))),
        (take, part, [a, b]) => run(take * STEP, part, a * STEP, b * STEP),
      ),
    ));
});

describe("importOtherPlan: notices", () => {
  const planA = planModel({ id: "plan-a", name: "A", revision: 2, from: month(2027, 1), to: month(2028, 1) });
  const ref = (id: string, revision: number): OtherPlanRef => ({ id, name: id, revision });

  it("reports a different plan than the one imported before", () =>
    expect(importOtherPlan(writeFile(planA), CURRENT, ref("plan-z", 2))).toMatchObject({ ok: true, notices: [{ code: "differentPlan", previousId: "plan-z" }] }));
  it("reports a lower revision than the one imported before", () =>
    expect(importOtherPlan(writeFile(planA), CURRENT, ref("plan-a", 3))).toMatchObject({ ok: true, notices: [{ code: "olderRevision", previousRevision: 3 }] }));
  it("reports nothing for the same or a higher revision", () => {
    expect(importOtherPlan(writeFile(planA), CURRENT, ref("plan-a", 2))).toMatchObject({ ok: true, notices: [] });
    expect(importOtherPlan(writeFile(planA), CURRENT, ref("plan-a", 1))).toMatchObject({ ok: true, notices: [] });
  });
  it("reports an outdated copy of the current plan inside the imported one", () => {
    const planB = planModel({ id: "plan-b", from: month(2028, 1), to: month(2028, 12) });
    const b1 = importInto(planB, { ...planA, revision: 1 }); // B holds A at revision 1
    expect(importOtherPlan(writeFile(b1), { id: "plan-a", revision: 2 })).toMatchObject({ ok: true, notices: [{ code: "outdatedCopyOfCurrent", copyRevision: 1 }] });
    expect(importOtherPlan(writeFile(b1), { id: "plan-a", revision: 1 })).toMatchObject({ ok: true, notices: [] });
    expect(importOtherPlan(writeFile(b1), { id: "plan-c", revision: 2 })).toMatchObject({ ok: true, notices: [] });
  });
});

describe("importOtherPlan: refusals", () => {
  const planA = planModel({ id: "plan-a", from: month(2027, 1), to: month(2027, 12) });

  it("refuses a rule set", () =>
    expect(importOtherPlan(writeFile(toRuleSet(planA, "rules")), CURRENT)).toEqual({ ok: false, refusal: { code: "notAPlan" } }));
  it("passes on the refusal of an unreadable file", () => {
    expect(importOtherPlan("{", CURRENT)).toEqual({ ok: false, refusal: { code: "notJson" } });
    expect(importOtherPlan(writeFile(planA).replace("restlos/1", "restlos/2"), CURRENT)).toEqual({ ok: false, refusal: { code: "newerSchema", path: "schema" } });
  });

  // Every day a working day; a mandatory afternoon on the first `halves` working days with own leave in the morning
  // (two spans each), and own whole days on the next `wholes` working days (one span each).
  describe("refuses a plan that charged more spans than a source may hold", () => {
    const everyDay = [{ from: d("2020-01-01"), required: { mon: FULL, tue: FULL, wed: FULL, thu: FULL, fri: FULL, sat: FULL, sun: FULL } }];
    const base = planModel({ id: "busy", from: month(2027, 1), to: month(2029, 12), week: everyDay });
    const workingDays = computePlan(planInput(base))
      .days.filter((day) => day.inPeriod && day.required.value === FULL)
      .map((day) => day.day);
    const busy = (halves: number, wholes: number): PlanFile => {
      const halfDays = workingDays.slice(0, halves);
      const wholeDays = workingDays.slice(halves, halves + wholes);
      const afternoons: FileSource = {
        id: "afternoons",
        name: "Afternoons",
        type: "mandatory",
        color: { slot: "red" },
        visible: true,
        entries: halfDays.map((day) => ({ date: day, take: HALF, part: "end" as const })),
      };
      const days: LeaveDay[] = [
        ...halfDays.map((day) => ({ day, take: HALF, part: "start" as const })),
        ...wholeDays.map((day) => ({ day, take: FULL })),
      ];
      return { ...base, sources: [afternoons], plan: { ...base.plan, days } };
    };

    it("loads 2000 spans", () => {
      const result = importOtherPlan(writeFile(busy(1000, 0)), CURRENT);
      expect(result.ok && result.entries.length).toBe(2000);
    });
    it("refuses 2001 spans", () =>
      expect(importOtherPlan(writeFile(busy(1000, 1)), CURRENT)).toEqual({ ok: false, refusal: { code: "limitExceeded", data: { limit: "entriesPerSource" } } }));
  });
});
