// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFacts, requiredWork } from "../../../src/engine/counting/required";
import type { DayRule, PlanInput } from "../../../src/engine/counting/types";
import { BAVARIA, CHRISTMAS_EVE_RULES, FULL, FULL_TIME, HALF, baseInput, d, easter, fixed, once } from "./helpers";

const req = (iso: string, changes: Partial<PlanInput> = {}) => {
  const facts = dayFacts(baseInput(changes), d(iso), d(iso))[0];
  if (!facts) throw new Error("no facts");
  return requiredWork(facts);
};
const rules = (...list: DayRule[]) => ({ contract: { ...BAVARIA, rules: list } });

describe("requiredWork", () => {
  it("takes the work week as the base value", () => {
    const w = req("2027-05-05");
    expect([w.value, w.decidedBy.kind, w.freePart]).toEqual([480, "workWeek", "end"]);
  });
  it("lowers a public holiday to 0", () =>
    expect(req("2027-05-06").decidedBy).toMatchObject({ kind: "publicHoliday", ruleId: "ascension-day" }));
  it("takes the minimum of the lowering layers", () => {
    const w = req("2027-05-05", {
      sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "company", required: HALF }],
      ...rules({ id: "quarter", match: once("2027-05-05"), requiredAtMost: 120 }),
    });
    expect([w.value, w.decidedBy.kind, w.layers.map((l) => l.kind)]).toEqual([
      120,
      "ruleAtMost",
      ["workWeek", "holidaySource", "ruleAtMost"],
    ]);
  });
  it("keeps a public holiday at 0 under a ½ holiday source", () =>
    expect(
      req("2027-05-06", { sources: [{ type: "holiday", day: d("2027-05-06"), sourceId: "company", required: HALF }] })
        .value,
    ).toBe(0));
  it("keeps 24 and 31 December on a weekend at 0", () => {
    expect(req("2022-12-24", rules(...CHRISTMAS_EVE_RULES)).value).toBe(0);
    expect(req("2022-12-31", rules(...CHRISTMAS_EVE_RULES)).value).toBe(0);
  });
  it("lets a forced rule beat a public holiday", () =>
    expect(req("2027-05-06", rules({ id: "work", match: easter(39), requiredExactly: FULL })).value).toBe(480));
  it("takes the lower of conflicting forced rules and reports them", () => {
    const w = req(
      "2027-03-13",
      rules(
        { id: "a", match: once("2027-03-13"), requiredExactly: HALF },
        { id: "b", match: once("2027-03-13"), requiredExactly: FULL },
      ),
    );
    expect([w.value, w.conflictingRules]).toEqual([240, ["a", "b"]]);
  });
  it("applies a manual override last", () => {
    const w = req("2027-03-13", {
      ...rules({ id: "a", match: once("2027-03-13"), requiredExactly: FULL }),
      overrides: [{ day: d("2027-03-13"), required: 120 }],
    });
    expect([w.value, w.decidedBy.kind]).toEqual([120, "override"]);
  });
  it("sets a paid closure to 0", () =>
    expect(
      req("2027-05-05", { sources: [{ type: "paidClosure", day: d("2027-05-05"), sourceId: "closure" }] }).decidedBy
        .kind,
    ).toBe("paidClosure"));
  it("follows a work week with a change", () => {
    const week = [
      { from: d("2020-01-01"), required: FULL_TIME },
      { from: d("2027-07-01"), required: { ...FULL_TIME, fri: 0 } },
    ];
    const contract = { contract: { ...BAVARIA, week } };
    expect([req("2027-06-25", contract).value, req("2027-07-02", contract).value]).toEqual([480, 0]);
  });
  it("applies the first work-week entry before its start", () => {
    const facts = dayFacts(
      baseInput({ contract: { ...BAVARIA, week: [{ from: d("2027-04-01"), required: FULL_TIME }] } }),
      d("2027-01-04"),
      d("2027-01-04"),
    )[0];
    expect(facts?.base).toEqual({ entryFrom: d("2027-04-01"), value: 480 });
  });
  it("supports an all-zero entry for part-year work", () => {
    const week = [
      { from: d("2020-01-01"), required: FULL_TIME },
      { from: d("2027-10-01"), required: { ...FULL_TIME, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 } },
    ];
    expect(req("2027-10-04", { contract: { ...BAVARIA, week } }).value).toBe(0);
  });
  it("puts the free time at the end unless the deciding layer says otherwise", () => {
    expect(req("2027-05-05", rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF })).freePart).toBe("end");
    expect(
      req("2027-05-05", rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF, part: "start" })).freePart,
    ).toBe("start");
    expect(
      req("2027-05-05", {
        sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "company", required: HALF }],
        ...rules({ id: "h", match: once("2027-05-05"), requiredAtMost: HALF, part: "start" }),
      }).freePart,
    ).toBe("start");
  });
  it("adds no layer for mandatory rules, mandatory, other-plan and Info sources", () => {
    const w = req("2027-05-05", {
      sources: [
        { type: "info", day: d("2027-05-05"), sourceId: "school" },
        { type: "mandatory", day: d("2027-05-05"), sourceId: "m", take: HALF },
        { type: "otherPlan", day: d("2027-05-05"), sourceId: "o", take: HALF },
      ],
      ...rules({ id: "m", match: once("2027-05-05"), mandatory: FULL }),
    });
    expect(w.layers.map((l) => l.kind)).toEqual(["workWeek"]);
  });
});

describe("dayFacts", () => {
  it("lists every source of a day, Info included, and the matching rules in contract order", () => {
    const facts = dayFacts(
      baseInput({
        sources: [{ type: "info", day: d("2027-05-05"), sourceId: "school" }],
        ...rules(
          { id: "b", match: once("2027-05-05"), requiredAtMost: HALF },
          { id: "a", match: fixed(5, 5), mandatory: FULL },
        ),
      }),
      d("2027-05-04"),
      d("2027-05-06"),
    );
    expect(facts.map((f) => f.day)).toEqual([d("2027-05-04"), d("2027-05-05"), d("2027-05-06")]);
    expect(facts[1]?.sources.map((s) => s.sourceId)).toEqual(["school"]);
    expect(facts[1]?.rules.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it.each([
    [{ contract: { ...BAVARIA, week: [] } }],
    [
      {
        contract: {
          ...BAVARIA,
          week: [
            { from: d("2027-01-01"), required: FULL_TIME },
            { from: d("2027-01-01"), required: FULL_TIME },
          ],
        },
      },
    ],
    [{ overrides: [{ day: d("2027-05-05"), required: 0 }, { day: d("2027-05-05"), required: 480 }] }],
    [{ sources: [{ type: "holiday", day: d("2027-05-05"), sourceId: "x", required: 481 }] }],
    [rules({ id: "m", match: once("2027-05-05"), mandatory: 0 })],
    [{ sources: [{ type: "mandatory", day: d("2027-05-05"), sourceId: "x", take: 0 }] }],
    [{ sources: [{ type: "otherPlan", day: d("2027-05-05"), sourceId: "x", take: 0 }] }],
    [rules({ id: "none", match: once("2027-05-05") } as unknown as DayRule)],
    [rules({ id: "two", match: once("2027-05-05"), requiredAtMost: 0, mandatory: FULL } as unknown as DayRule)],
  ] as [Partial<PlanInput>][])("rejects invalid input %#", (changes) =>
    expect(() => dayFacts(baseInput(changes), d("2027-05-01"), d("2027-05-31"))).toThrow(RangeError),
  );
});
