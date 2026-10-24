// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { YEAR_KINDS, ruleDates, yearTypes } from "../../../src/engine/counting/rule-dates";
import { MAX_YEAR, MIN_YEAR } from "../../../src/engine/days";
import { ruleDate } from "../../../src/engine/holidays/rules";
import { easter, fixed } from "./helpers";
import { dateRuleArb, yearArb } from "./oracle";

describe("ruleDates", () => {
  it("gives ruleDate's day in any supported year", () =>
    fc.assert(
      fc.property(dateRuleArb, fc.array(yearArb, { minLength: 1, maxLength: 30 }), (rule, years) => {
        const dates = ruleDates(rule);
        for (const year of years) expect(dates.dayIn(year)).toBe(ruleDate(rule, year));
      }),
      { numRuns: 500 },
    ));
  it("gives ruleDate's day in every year of the 400-year cycle and at both ends", () => {
    for (const rule of [fixed(2, 29), { type: "fixed", month: 2, day: 29, nonLeap: "mar1" } as const, easter(-366), { type: "nthWeekday", month: 2, weekday: "sun", n: -1 } as const]) {
      const dates = ruleDates(rule);
      for (const year of [MIN_YEAR, MIN_YEAR + 1, MAX_YEAR - 1, MAX_YEAR]) expect(dates.dayIn(year)).toBe(ruleDate(rule, year));
      for (let year = 2000; year < 2400; year++) expect(dates.dayIn(year)).toBe(ruleDate(rule, year));
    }
  });
  it("knows how many pairs of a year's type and the next year's type occur", () => {
    const types = yearTypes();
    const kinds = new Set<number>();
    for (let i = 0; i + 1 < types.length; i++) kinds.add((types[i] ?? 0) * 14 + (types[i + 1] ?? 0));
    expect(kinds.size).toBe(YEAR_KINDS);
    expect(types[2026 - MIN_YEAR]).toBe(3); // 1 January 2026 is a Thursday
    expect(types[2028 - MIN_YEAR]).toBe(5 + 7); // a Saturday, in a leap year
  });
  it.each([MIN_YEAR - 1, MAX_YEAR + 1, 2000.5, Number.NaN])("throws for the year %d", (year) =>
    expect(() => ruleDates(easter(0)).dayIn(year)).toThrow(RangeError));
});
