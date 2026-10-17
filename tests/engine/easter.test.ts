// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dayFromYmd, isoFromDay, weekdayOf } from "../../src/engine/days";
import { orthodoxEaster, westernEaster } from "../../src/engine/easter";

const yearArb = fc.integer({ min: 1583, max: 9999 });

describe("Easter", () => {
  it.each([
    [1583, "1583-04-10"], [1818, "1818-03-22"], [2000, "2000-04-23"], [2008, "2008-03-23"], [2011, "2011-04-24"],
    [2019, "2019-04-21"], [2027, "2027-03-28"], [2038, "2038-04-25"], [2100, "2100-03-28"], [2285, "2285-03-22"],
    [9999, "9999-03-28"],
  ])("Western Easter %i is %s", (y, iso) => {
    expect(isoFromDay(westernEaster(y))).toBe(iso);
  });

  it.each([
    [2000, "2000-04-30"], [2023, "2023-04-16"], [2024, "2024-05-05"], [2027, "2027-05-02"], [2100, "2100-05-02"],
  ])("Orthodox Easter %i is %s", (y, iso) => {
    expect(isoFromDay(orthodoxEaster(y))).toBe(iso);
  });

  it("rejects years outside the range", () => {
    expect(() => westernEaster(1582)).toThrow(RangeError);
    expect(() => orthodoxEaster(10000)).toThrow(RangeError);
  });

  it("is always a Sunday", () => {
    fc.assert(
      fc.property(yearArb, (y) => {
        expect(weekdayOf(westernEaster(y))).toBe("sun");
        expect(weekdayOf(orthodoxEaster(y))).toBe("sun");
      }),
    );
  });

  it("Western Easter lies between 22 March and 25 April (inclusive)", () => {
    fc.assert(
      fc.property(yearArb, (y) => {
        const easter = westernEaster(y);
        expect(easter).toBeGreaterThanOrEqual(dayFromYmd(y, 3, 22));
        expect(easter).toBeLessThanOrEqual(dayFromYmd(y, 4, 25));
      }),
    );
  });

  it("Orthodox Easter is never before Western Easter", () => {
    fc.assert(fc.property(yearArb, (y) => orthodoxEaster(y) >= westernEaster(y)));
  });
});
