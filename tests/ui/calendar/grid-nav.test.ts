// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { nextDay } from "../../../src/ui/calendar/grid-nav.ts";

const d = (y: number, m: number, day: number): number => dayFromYmd(y, m, day);
const ctx = {
  dir: "ltr" as const,
  weekStart: "mon" as const,
  period: { from: d(2027, 1, 1), to: d(2027, 12, 31) },
  alignByWeekday: false,
};

describe("nextDay in the tiles", () => {
  const day = d(2027, 5, 12); // a Wednesday

  it("moves by day and week", () => {
    expect(nextDay("tiles", "ArrowRight", day, ctx)).toBe(day + 1);
    expect(nextDay("tiles", "ArrowLeft", day, ctx)).toBe(day - 1);
    expect(nextDay("tiles", "ArrowDown", day, ctx)).toBe(day + 7);
    expect(nextDay("tiles", "ArrowUp", day, ctx)).toBe(day - 7);
  });

  it("mirrors left and right in RTL", () => {
    expect(nextDay("tiles", "ArrowRight", day, { ...ctx, dir: "rtl" })).toBe(day - 1);
    expect(nextDay("tiles", "ArrowLeft", day, { ...ctx, dir: "rtl" })).toBe(day + 1);
    expect(nextDay("tiles", "ArrowDown", day, { ...ctx, dir: "rtl" })).toBe(day + 7);
  });

  it("goes to the start and end of the week row", () => {
    expect(nextDay("tiles", "Home", day, ctx)).toBe(d(2027, 5, 10));
    expect(nextDay("tiles", "End", day, ctx)).toBe(d(2027, 5, 16));
    expect(nextDay("tiles", "Home", day, { ...ctx, weekStart: "sun" })).toBe(d(2027, 5, 9));
  });

  it("goes to the same day of the previous or next month, clamped to its length", () => {
    expect(nextDay("tiles", "PageDown", d(2027, 1, 31), ctx)).toBe(d(2027, 2, 28));
    expect(nextDay("tiles", "PageUp", d(2027, 3, 31), ctx)).toBe(d(2027, 2, 28));
    expect(nextDay("tiles", "PageDown", day, ctx)).toBe(d(2027, 6, 12));
  });

  it("clamps to the period", () => {
    expect(nextDay("tiles", "PageDown", d(2027, 12, 31), ctx)).toBe(d(2027, 12, 31));
    expect(nextDay("tiles", "ArrowUp", d(2027, 1, 3), ctx)).toBe(d(2027, 1, 1));
    expect(nextDay("tiles", "ArrowRight", d(2027, 12, 31), ctx)).toBe(d(2027, 12, 31));
  });
});

describe("nextDay in the columns", () => {
  it("moves by day with up and down", () => {
    const day = d(2027, 5, 12);
    expect(nextDay("columns", "ArrowDown", day, ctx)).toBe(day + 1);
    expect(nextDay("columns", "ArrowUp", day, ctx)).toBe(day - 1);
  });

  it("moves to the same day of the neighbouring month, clamped", () => {
    expect(nextDay("columns", "ArrowRight", d(2027, 1, 31), ctx)).toBe(d(2027, 2, 28));
    expect(nextDay("columns", "ArrowLeft", d(2027, 3, 31), ctx)).toBe(d(2027, 2, 28));
    expect(nextDay("columns", "ArrowRight", d(2027, 1, 31), { ...ctx, dir: "rtl" })).toBe(d(2027, 1, 31));
    expect(nextDay("columns", "ArrowLeft", d(2027, 1, 15), { ...ctx, dir: "rtl" })).toBe(d(2027, 2, 15));
  });

  it("keeps the weekday row when aligned", () => {
    const aligned = { ...ctx, alignByWeekday: true };
    // 1 Jan 2027 is a Friday (row 4); 1 Feb 2027 is a Monday (row 0), so row 4 is Friday 5 Feb.
    expect(nextDay("columns", "ArrowRight", d(2027, 1, 1), aligned)).toBe(d(2027, 2, 5));
    expect(nextDay("columns", "ArrowLeft", d(2027, 2, 5), aligned)).toBe(d(2027, 1, 1));
  });

  it("goes to the first and last day of the month and to the neighbouring months", () => {
    const day = d(2027, 5, 12);
    expect(nextDay("columns", "Home", day, ctx)).toBe(d(2027, 5, 1));
    expect(nextDay("columns", "End", day, ctx)).toBe(d(2027, 5, 31));
    expect(nextDay("columns", "PageDown", day, ctx)).toBe(d(2027, 6, 12));
    expect(nextDay("columns", "PageUp", day, ctx)).toBe(d(2027, 4, 12));
    expect(nextDay("columns", "PageDown", day, { ...ctx, dir: "rtl" })).toBe(d(2027, 6, 12));
  });

  it("stays put when the neighbouring month is outside the period", () => {
    expect(nextDay("columns", "ArrowLeft", d(2027, 1, 15), ctx)).toBe(d(2027, 1, 15));
    expect(nextDay("columns", "PageDown", d(2027, 12, 15), ctx)).toBe(d(2027, 12, 15));
  });
});
