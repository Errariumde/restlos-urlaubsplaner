// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  WEEKDAYS,
  dayFromIso,
  dayFromYmd,
  daysInMonth,
  isLeapYear,
  isoFromDay,
  weekdayOf,
  ymdFromDay,
} from "../../src/engine/days";

const FIRST_DAY = -141349;
const LAST_DAY = 2932896;

describe("day numbers", () => {
  it("converts known dates", () => {
    expect(dayFromYmd(1970, 1, 1)).toBe(0);
    expect(dayFromYmd(2000, 1, 1)).toBe(10957);
    expect(dayFromYmd(2027, 5, 7)).toBe(20945);
    expect(dayFromYmd(1583, 1, 1)).toBe(FIRST_DAY);
    expect(dayFromYmd(9999, 12, 31)).toBe(LAST_DAY);
    expect(isoFromDay(20945)).toBe("2027-05-07");
    expect(ymdFromDay(FIRST_DAY)).toEqual({ year: 1583, month: 1, day: 1 });
  });

  it("knows leap years and month lengths", () => {
    expect([2000, 2024, 1900, 2100, 2027].map(isLeapYear)).toEqual([true, true, false, false, false]);
    expect([daysInMonth(2024, 2), daysInMonth(2100, 2), daysInMonth(2027, 4)]).toEqual([29, 28, 30]);
  });

  it("knows weekdays", () => {
    expect(weekdayOf(0)).toBe("thu");
    expect(weekdayOf(dayFromIso("2000-01-01"))).toBe("sat");
    expect(weekdayOf(dayFromIso("2027-05-07"))).toBe("fri");
    expect(weekdayOf(dayFromIso("2100-12-31"))).toBe("fri");
  });

  it.each([
    [2027, 2, 29],
    [2027, 13, 1],
    [2027, 0, 1],
    [2027, 4, 31],
    [1582, 12, 31],
    [10000, 1, 1],
    [2027, 1, 1.5],
  ])("rejects %i-%i-%i", (y, m, d) => {
    expect(() => dayFromYmd(y, m, d)).toThrow(RangeError);
  });

  it.each(["2027-2-01", "2027-02-30", "20270201", " 2027-02-01", "2027-02-01T00:00", ""])(
    "rejects ISO %j",
    (s) => {
      expect(() => dayFromIso(s)).toThrow(RangeError);
    },
  );

  it("rejects day numbers outside the range", () => {
    expect(() => ymdFromDay(LAST_DAY + 1)).toThrow(RangeError);
    expect(() => ymdFromDay(FIRST_DAY - 1)).toThrow(RangeError);
    expect(() => ymdFromDay(0.5)).toThrow(RangeError);
  });

  it("round-trips through year/month/day and ISO strings", () => {
    fc.assert(
      fc.property(fc.integer({ min: FIRST_DAY, max: LAST_DAY }), (n) => {
        const { year, month, day } = ymdFromDay(n);
        expect(dayFromYmd(year, month, day)).toBe(n);
        expect(dayFromIso(isoFromDay(n))).toBe(n);
      }),
    );
  });

  it("repeats weekdays every seven days", () => {
    fc.assert(
      fc.property(fc.integer({ min: FIRST_DAY, max: LAST_DAY - 7 }), (n) => {
        expect(weekdayOf(n + 7)).toBe(weekdayOf(n));
      }),
    );
  });

  it("agrees with the platform date implementation", () => {
    fc.assert(
      fc.property(fc.integer({ min: FIRST_DAY, max: LAST_DAY }), (n) => {
        const { year, month, day } = ymdFromDay(n);
        expect(Date.UTC(year, month - 1, day) / 86_400_000).toBe(n);
        expect(WEEKDAYS[(new Date(n * 86_400_000).getUTCDay() + 6) % 7]).toBe(weekdayOf(n));
      }),
    );
  });
});
