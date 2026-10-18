// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import type { DayMatch, DayRule, RangeMatch } from "../../../src/engine/counting/types";
import { dayRuleWarnings } from "../../../src/engine/counting/warnings";
import { easter, fixed, once } from "./helpers";

const r = (match: DayMatch, extra: { validFrom?: number; validUntil?: number } = {}): DayRule => ({
  id: "r",
  match,
  requiredAtMost: 0,
  ...extra,
});
const codes = (rule: DayRule) => dayRuleWarnings(rule).map((w) => w.code);

describe("dayRuleWarnings", () => {
  it.each([
    [{ type: "range", from: fixed(2, 27), days: 4 }, ["leapYearLength"]],
    [{ type: "range", from: fixed(12, 1), days: 100 }, ["leapYearLength"]],
    [{ type: "range", from: fixed(12, 27), days: 6 }, []],
    [{ type: "range", from: once("2027-02-27"), days: 4 }, []],
    [{ type: "range", from: easter(-52), days: 6 }, []],
    [{ type: "range", from: fixed(2, 27), to: fixed(3, 2) }, []],
    [{ type: "range", from: { type: "fixed", month: 2, day: 29, nonLeap: "drop" }, days: 4 }, []],
  ] as [RangeMatch, string[]][])("leap-year length of %j", (match, expected) =>
    expect(codes(r(match))).toEqual(expected),
  );
  it.each([
    [{ type: "range", from: easter(-52), to: fixed(3, 1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: fixed(4, 20), to: easter(1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: once("2028-03-20"), to: easter(1) }, ["mixedRangeEnds"]],
    [{ type: "range", from: fixed(12, 27), to: fixed(1, 2) }, []],
    [{ type: "range", from: easter(-52), to: easter(-47) }, []],
    [
      {
        type: "range",
        from: { type: "nthWeekday", month: 11, weekday: "sun", n: 4 },
        to: { type: "weekdayRelative", weekday: "sun", relation: "before", month: 12, day: 25 },
      },
      [],
    ],
  ] as [RangeMatch, string[]][])("mixed ends of %j", (match, expected) =>
    expect(codes(r(match))).toEqual(expected),
  );
  it("finds rules that never produce a day", () => {
    expect(codes(r(once("2027-03-13"), { validFrom: 2028 }))).toEqual(["neverApplies"]);
    expect(codes(r({ type: "range", from: easter(0), days: 1, weekdays: ["mon"] }))).toEqual([
      "neverApplies",
    ]);
    expect(codes(r(fixed(12, 31), { validFrom: 2030, validUntil: 2029 }))).toEqual(["neverApplies"]);
    expect(codes(r(once("2027-03-13")))).toEqual([]);
    expect(codes(r(fixed(12, 31)))).toEqual([]);
  });
  it("reports several warnings of one rule in code order", () => {
    expect(codes(r({ type: "range", from: fixed(2, 27), days: 4 }, { validFrom: 2030, validUntil: 2029 }))).toEqual(["leapYearLength", "neverApplies"]);
    expect(codes(r({ type: "range", from: once("2027-03-01"), to: easter(1) }, { validFrom: 2028 }))).toEqual(["mixedRangeEnds", "neverApplies"]);
  });
  it("looks at a `once` date in `to` only", () => {
    const match: RangeMatch = { type: "range", from: fixed(12, 27), to: once("2028-01-04") };
    expect(codes(r(match))).toEqual([]);
    expect(codes(r(match, { validUntil: 2026 }))).toEqual(["neverApplies"]);
  });
  it("reports a rule that starts after the last supported year", () => expect(codes(r(fixed(1, 1), { validFrom: 10000 }))).toEqual(["neverApplies"]));
  it("doesn't report a rule whose only day lies in the year before its valid year", () =>
    expect(
      codes(r({ type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 }, { validFrom: 2028, validUntil: 2028 })),
    ).toEqual([]));
  it("reports the rule ID", () =>
    expect(
      dayRuleWarnings({ id: "x", match: once("1999-01-01"), validFrom: 2000, mandatory: 480 }),
    ).toEqual([{ code: "neverApplies", ruleId: "x" }]));
});
