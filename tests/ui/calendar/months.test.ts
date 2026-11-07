// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { columnRows, columnWeekMarker, isoWeek, periodMonths, tileWeeks } from "../../../src/ui/calendar/months.ts";

const d = (y: number, m: number, day: number): number => dayFromYmd(y, m, day);
const year2027 = periodMonths({ from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } });

describe("periodMonths", () => {
  it("lists every month of the period with its first and last day", () => {
    expect(year2027).toHaveLength(12);
    expect(year2027[1]).toEqual({ year: 2027, month: 2, first: d(2027, 2, 1), last: d(2027, 2, 28) });
  });

  it("crosses the year boundary", () => {
    const months = periodMonths({ from: { year: 2026, month: 11 }, to: { year: 2027, month: 2 } });
    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 11],
      [2026, 12],
      [2027, 1],
      [2027, 2],
    ]);
  });
});

describe("isoWeek", () => {
  it("follows ISO 8601", () => {
    expect(isoWeek(d(2027, 1, 4))).toBe(1);
    expect(isoWeek(d(2026, 12, 31))).toBe(53);
    expect(isoWeek(d(2027, 1, 1))).toBe(53);
    expect(isoWeek(d(2027, 1, 3))).toBe(53);
    expect(isoWeek(d(2024, 12, 30))).toBe(1);
  });
});

describe("tileWeeks", () => {
  it("lays out January 2027 from Monday", () => {
    const weeks = tileWeeks(year2027[0]!, "mon");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.cells.filter((c) => c === null)).toHaveLength(4);
    expect(weeks[0]!.cells[4]).toBe(d(2027, 1, 1));
    expect(weeks[0]!.isoWeek).toBe(53);
    expect(weeks[0]!.startDay).toBe(d(2026, 12, 28));
    expect(weeks[4]!.cells[6]).toBe(d(2027, 1, 31)); // a Sunday
  });

  it("starts on Sunday and labels the row with the week of its Thursday", () => {
    const weeks = tileWeeks(year2027[0]!, "sun");
    expect(weeks[0]!.cells.filter((c) => c === null)).toHaveLength(5);
    expect(weeks[0]!.isoWeek).toBe(53);
    expect(weeks[1]!.isoWeek).toBe(1);
  });

  it("starts on Saturday", () => {
    const weeks = tileWeeks(year2027[0]!, "sat");
    expect(weeks).toHaveLength(6);
    expect(weeks[0]!.startDay).toBe(d(2026, 12, 26));
    expect(weeks[0]!.cells.filter((c) => c === null)).toHaveLength(6);
    expect(weeks[0]!.cells[6]).toBe(d(2027, 1, 1));
    expect(weeks.map((w) => w.isoWeek)).toEqual([53, 1, 2, 3, 4, 5]);
    expect(weeks[5]!.cells.filter((c) => c === null)).toHaveLength(5);
  });
});

describe("columnRows", () => {
  it("gives 31 rows by day of month without alignment", () => {
    const rows = columnRows(year2027, false, "mon");
    expect(rows).toHaveLength(31);
    expect(rows[0]![0]).toBe(d(2027, 1, 1));
    expect(rows[28]![1]).toBeNull();
    expect(rows[29]![1]).toBeNull();
    expect(rows[30]![1]).toBeNull();
    expect(rows[27]![1]).toBe(d(2027, 2, 28));
  });

  it("aligns the first day on its weekday row", () => {
    const rows = columnRows(year2027, true, "mon");
    expect(rows.length).toBeLessThanOrEqual(37);
    expect(rows[4]![0]).toBe(d(2027, 1, 1));
    expect(rows[3]![0]).toBeNull();
    expect(rows[0]![1]).toBe(d(2027, 2, 1)); // a Monday
  });

  it("aligns from Sunday and from Saturday", () => {
    const sun = columnRows(year2027, true, "sun");
    expect(sun[5]![0]).toBe(d(2027, 1, 1));
    expect(sun[4]![0]).toBeNull();
    expect(sun[1]![1]).toBe(d(2027, 2, 1));
    const sat = columnRows(year2027, true, "sat");
    expect(sat[6]![0]).toBe(d(2027, 1, 1));
    expect(sat[2]![1]).toBe(d(2027, 2, 1));
    expect(sat.length).toBeLessThanOrEqual(37);
  });

  it("needs 37 rows for a 31-day month that starts on the last weekday row", () => {
    const rows = columnRows([year2027[0]!], true, "sat");
    expect(rows).toHaveLength(37);
    expect(rows[36]![0]).toBe(d(2027, 1, 31));
  });
});

describe("columnWeekMarker", () => {
  const from = d(2027, 1, 1);

  it("marks the first day of each week with the ISO week and the week's first day", () => {
    expect(columnWeekMarker(d(2027, 6, 14), "mon", from)).toEqual({ isoWeek: 24, startDay: d(2027, 6, 14) });
    expect(columnWeekMarker(d(2027, 6, 15), "mon", from)).toBeUndefined();
    expect(columnWeekMarker(d(2027, 6, 20), "mon", from)).toBeUndefined();
  });

  it("marks the period's first day for the week that runs into it", () => {
    expect(columnWeekMarker(from, "mon", from)).toEqual({ isoWeek: 53, startDay: d(2026, 12, 28) });
    expect(columnWeekMarker(d(2027, 1, 2), "mon", from)).toBeUndefined();
  });

  it("follows the week start, numbered by the week's Thursday", () => {
    expect(columnWeekMarker(d(2027, 6, 13), "sun", from)).toEqual({ isoWeek: 24, startDay: d(2027, 6, 13) });
    expect(columnWeekMarker(d(2027, 6, 14), "sun", from)).toBeUndefined();
    expect(columnWeekMarker(d(2027, 6, 12), "sat", from)).toEqual({ isoWeek: 24, startDay: d(2027, 6, 12) });
  });
});
