// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ruleDays, ruleHasDay } from "../../../src/engine/counting/match";
import type { DayMatch, RangeMatch } from "../../../src/engine/counting/types";
import { MAX_DAY, MIN_DAY } from "../../../src/engine/days";
import { d, easter, fixed, isoDays, once, span } from "./helpers";
import { dateRuleArb, dayRuleArb, oracleRuleDays, rangeArb, yearArb } from "./oracle";

const days = (match: DayMatch, from: string, to: string, validity: { validFrom?: number; validUntil?: number } = {}) =>
  isoDays(ruleDays({ match, ...validity }, d(from), d(to)));
const newYear: RangeMatch = { type: "range", from: fixed(12, 27), to: fixed(1, 2) };

describe("ruleDays", () => {
  it("evaluates single-day date rules per year", () =>
    expect(days(fixed(12, 31), "2027-01-01", "2028-12-31")).toEqual(["2027-12-31", "2028-12-31"]));
  it("applies validity years to single-day rules", () =>
    expect(days(fixed(3, 8), "2018-01-01", "2020-12-31", { validFrom: 2019 })).toEqual(["2019-03-08", "2020-03-08"]));
  it("crosses New Year with `to`, including an occurrence that started the year before", () => {
    expect(days(newYear, "2027-12-01", "2028-01-31")).toEqual(span("2027-12-27", "2028-01-02"));
    expect(days(newYear, "2026-12-30", "2027-01-03")).toEqual(span("2026-12-30", "2027-01-02"));
  });
  it("combines a `once` start with an Easter end", () =>
    expect(days({ type: "range", from: once("2028-03-20"), to: easter(1) }, "2027-01-01", "2029-12-31")).toEqual(
      span("2028-03-20", "2028-04-17"),
    ));
  it("uses a `once` end only in its own year", () =>
    expect(days({ type: "range", from: fixed(12, 27), to: once("2028-01-04") }, "2026-01-01", "2029-12-31")).toEqual(
      span("2027-12-27", "2028-01-04"),
    ));
  it("skips years in which `to` gives no day on or after the start", () =>
    expect(days({ type: "range", from: fixed(3, 1), to: once("2020-01-01") }, "2027-01-01", "2027-12-31")).toEqual([]));
  it("counts `days` from the start", () =>
    expect(days({ type: "range", from: easter(-52), days: 6 }, "2027-01-01", "2027-12-31")).toEqual(
      span("2027-02-04", "2027-02-09"),
    ));
  it("keeps only the listed weekdays", () =>
    expect(
      days({ type: "range", from: fixed(12, 1), to: fixed(12, 31), weekdays: ["sat"] }, "2027-01-01", "2027-12-31"),
    ).toEqual(["2027-12-04", "2027-12-11", "2027-12-18", "2027-12-25"]));
  it("applies validity to the year in which a range starts", () =>
    expect(days(newYear, "2027-12-01", "2029-01-31", { validUntil: 2027 })).toEqual(span("2027-12-27", "2028-01-02")));
  it("keeps the length with `days` and the end date with `to` in leap years", () => {
    const length: RangeMatch = { type: "range", from: fixed(2, 27), days: 4 };
    expect(days(length, "2027-01-01", "2027-12-31")).toEqual(span("2027-02-27", "2027-03-02"));
    expect(days(length, "2028-01-01", "2028-12-31")).toEqual(span("2028-02-27", "2028-03-01"));
    expect(days({ type: "range", from: fixed(2, 27), to: fixed(3, 2) }, "2028-01-01", "2028-12-31")).toEqual(
      span("2028-02-27", "2028-03-02"),
    );
  });
  it("counts a day matched by two occurrences once", () =>
    expect(days({ type: "range", from: fixed(1, 1), days: 366 }, "2027-12-31", "2028-01-02")).toEqual([
      "2027-12-31",
      "2028-01-01",
      "2028-01-02",
    ]));
  it("stays within the supported years without throwing", () => {
    expect(days({ type: "range", from: fixed(12, 27), days: 7 }, "9999-12-01", "9999-12-31")).toEqual(
      span("9999-12-27", "9999-12-31"),
    );
    expect(days(newYear, "9999-12-01", "9999-12-31")).toEqual([]); // its end would lie in 10000
    expect(days(newYear, "1583-01-01", "1583-01-05")).toEqual([]);
  });
  it("finds occurrences whose date lies in the neighbouring calendar year", () => {
    const satBeforeNewYear: DayMatch = { type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 };
    expect(days(satBeforeNewYear, "2027-01-01", "2027-12-31")).toEqual(["2027-12-25"]);
    expect(days({ type: "weekdayRelative", weekday: "mon", relation: "after", month: 12, day: 31 }, "2027-01-01", "2027-12-31")).toEqual(["2027-01-04"]);
    expect(days({ type: "range", from: { type: "weekdayRelative", weekday: "fri", relation: "before", month: 1, day: 1 }, days: 3 }, "2027-01-01", "2027-12-31")).toEqual(["2027-12-31"]);
  });
  it("applies validity to the rule's year, not to the year of the day", () =>
    expect(days({ type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 }, "2027-01-01", "2027-12-31", { validFrom: 2028, validUntil: 2028 })).toEqual(["2027-12-25"]));
  it("returns nothing for a day that belongs to a rule year beyond the supported years", () =>
    expect(days({ type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 }, "9999-01-01", "9999-12-31")).toEqual([]));
  it.each([
    [{ type: "range", from: fixed(1, 1), days: 0 }],
    [{ type: "range", from: fixed(1, 1), days: 367 }],
    [{ type: "range", from: fixed(1, 1), days: 1.5 }],
    [{ type: "range", from: fixed(1, 1), to: fixed(1, 2), days: 2 }],
    [{ type: "range", from: fixed(1, 1) }],
    [{ type: "range", from: fixed(1, 1), days: 2, weekdays: [] }],
  ] as [RangeMatch][])("rejects %j", (match) =>
    expect(() => ruleDays({ match }, d("2027-01-01"), d("2027-12-31"))).toThrow(RangeError),
  );
  it("rejects a malformed range even when the validity makes it empty", () =>
    expect(() => ruleDays({ match: { type: "range", from: fixed(1, 1) }, validFrom: 2030, validUntil: 2029 }, d("2027-01-01"), d("2027-12-31"))).toThrow(RangeError));
});

describe("ruleDays and ruleHasDay against the per-year computation", () => {
  // Windows of up to four years anywhere, also against both ends of the supported years.
  const windowArb = fc
    .tuple(fc.oneof(fc.integer({ min: MIN_DAY, max: MAX_DAY }), fc.integer({ min: MIN_DAY, max: MIN_DAY + 800 }), fc.integer({ min: MAX_DAY - 800, max: MAX_DAY })), fc.integer({ min: 0, max: 1500 }))
    .map(([from, length]) => [from, Math.min(from + length, MAX_DAY)] as const);
  it("matches the same days as computing every year with ruleDate", () =>
    fc.assert(
      fc.property(dayRuleArb, windowArb, (rule, [from, to]) => {
        const expected = oracleRuleDays(rule, from, to);
        expect(ruleDays(rule, from, to)).toEqual(expected);
        expect(ruleHasDay(rule, from, to)).toBe(expected.length > 0);
      }),
      { numRuns: 500 },
    ));
  // Long windows let the walk skip repeated calendar years and take the shortcuts of Easter ranges.
  const longWindowArb = fc
    .tuple(fc.oneof(fc.integer({ min: MIN_DAY, max: MAX_DAY }), fc.integer({ min: MIN_DAY, max: MIN_DAY + 800 }), fc.integer({ min: MAX_DAY - 800, max: MAX_DAY })), fc.oneof(fc.integer({ min: 2000, max: 25_000 }), fc.constant(146_097)))
    .map(([from, length]) => [Math.min(from, MAX_DAY - 2000), Math.min(from + length, MAX_DAY)] as const);
  const calendarRule = dateRuleArb.filter((rule) => rule.type === "fixed" || rule.type === "weekdayRelative" || rule.type === "nthWeekday");
  const easterRule = dateRuleArb.filter((rule) => rule.type === "easter" || rule.type === "orthodoxEaster");
  it.each([
    ["calendar rules", calendarRule],
    ["Easter rules", easterRule],
  ])("finds a day over long windows like the per-year computation, for ranges between %s", (_name, ends) =>
    fc.assert(
      fc.property(rangeArb(ends), fc.option(yearArb, { nil: undefined }), longWindowArb, (match, validFrom, [from, to]) => {
        const rule = validFrom === undefined ? { match } : { match, validFrom };
        expect(ruleHasDay(rule, from, to)).toBe(oracleRuleDays(rule, from, to).length > 0);
      }),
      { numRuns: 300 },
    ));
  it("finds a day that only years of one rare kind give, after many years of other kinds", () => {
    const feb29: RangeMatch = { type: "range", from: { type: "fixed", month: 2, day: 29, nonLeap: "drop" }, days: 1, weekdays: ["mon"] };
    expect(ruleHasDay({ match: feb29 }, d("2001-01-01"), d("2030-12-31"))).toBe(true); // 2016-02-29
    expect(ruleHasDay({ match: feb29 }, d("2017-01-01"), d("2043-12-31"))).toBe(false);
    for (const weekday of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
      const match: RangeMatch = { ...feb29, weekdays: [weekday] };
      for (const [from, to] of [["1583-01-01", "1700-12-31"], ["2001-01-01", "2400-12-31"], ["2017-03-01", "2048-02-28"]] as const) {
        expect(ruleHasDay({ match }, d(from), d(to))).toBe(oracleRuleDays({ match }, d(from), d(to)).length > 0);
      }
    }
  });
  it("rejects a malformed range in ruleHasDay too", () =>
    expect(() => ruleHasDay({ match: { type: "range", from: fixed(1, 1) } }, d("2027-01-01"), d("2027-12-31"))).toThrow(RangeError));
});
