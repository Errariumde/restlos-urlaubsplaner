// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { navKeyOf, nextDay } from "../../../src/ui/calendar/grid-nav.ts";

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
    expect(nextDay("tiles", "Home", day, { ...ctx, weekStart: "sat" })).toBe(d(2027, 5, 8));
    expect(nextDay("tiles", "End", day, { ...ctx, weekStart: "sat" })).toBe(d(2027, 5, 14));
  });

  it("goes to the start and end of the week across a month's edge", () => {
    // Wednesday 1 Sep 2027 starts its week on Monday 30 Aug; Tuesday 31 Aug ends it on Sunday 5 Sep.
    expect(nextDay("tiles", "Home", d(2027, 9, 1), ctx)).toBe(d(2027, 8, 30));
    expect(nextDay("tiles", "End", d(2027, 8, 31), ctx)).toBe(d(2027, 9, 5));
  });

  it("goes to the first and last day of the month with Ctrl", () => {
    expect(nextDay("tiles", "Ctrl+Home", day, ctx)).toBe(d(2027, 5, 1));
    expect(nextDay("tiles", "Ctrl+End", day, ctx)).toBe(d(2027, 5, 31));
    expect(nextDay("tiles", "Ctrl+End", d(2027, 2, 3), ctx)).toBe(d(2027, 2, 28));
  });

  it("keeps Home, End and their Ctrl forms inside the period", () => {
    // Friday 1 Jan 2027 starts the period; its week starts on Monday 28 Dec 2026, outside it.
    expect(nextDay("tiles", "Home", d(2027, 1, 1), ctx)).toBe(d(2027, 1, 1));
    expect(nextDay("tiles", "End", d(2027, 12, 31), ctx)).toBe(d(2027, 12, 31));
    const partial = { ...ctx, period: { from: d(2027, 1, 15), to: d(2027, 12, 10) } };
    expect(nextDay("tiles", "Ctrl+Home", d(2027, 1, 20), partial)).toBe(d(2027, 1, 15));
    expect(nextDay("tiles", "Ctrl+End", d(2027, 12, 1), partial)).toBe(d(2027, 12, 10));
  });

  it("stays put when no neighbouring month is inside the period", () => {
    expect(nextDay("tiles", "PageDown", d(2027, 12, 15), ctx)).toBe(d(2027, 12, 15));
    expect(nextDay("tiles", "PageUp", d(2027, 1, 15), ctx)).toBe(d(2027, 1, 15));
  });

  it("clamps a move into a partial month to the period", () => {
    const partial = { ...ctx, period: { from: d(2027, 1, 15), to: d(2027, 12, 10) } };
    expect(nextDay("tiles", "PageUp", d(2027, 2, 10), partial)).toBe(d(2027, 1, 15));
    expect(nextDay("tiles", "PageDown", d(2027, 11, 25), partial)).toBe(d(2027, 12, 10));
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

  it("stops at the ends of the column", () => {
    expect(nextDay("columns", "ArrowDown", d(2027, 1, 31), ctx)).toBe(d(2027, 1, 31));
    expect(nextDay("columns", "ArrowUp", d(2027, 2, 1), ctx)).toBe(d(2027, 2, 1));
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

  it("goes to the start and end of the week like the tiles, also into the neighbouring month", () => {
    expect(nextDay("columns", "Home", d(2027, 5, 12), ctx)).toBe(d(2027, 5, 10));
    expect(nextDay("columns", "End", d(2027, 5, 12), ctx)).toBe(d(2027, 5, 16));
    expect(nextDay("columns", "Home", d(2027, 9, 1), ctx)).toBe(d(2027, 8, 30));
    expect(nextDay("columns", "End", d(2027, 8, 31), { ...ctx, alignByWeekday: true })).toBe(d(2027, 9, 5));
    expect(nextDay("columns", "Home", d(2027, 1, 1), ctx)).toBe(d(2027, 1, 1));
  });

  it("goes to the first and last day of the month with Ctrl and to the neighbouring months", () => {
    const day = d(2027, 5, 12);
    expect(nextDay("columns", "Ctrl+Home", day, ctx)).toBe(d(2027, 5, 1));
    expect(nextDay("columns", "Ctrl+End", day, ctx)).toBe(d(2027, 5, 31));
    expect(nextDay("columns", "PageDown", day, ctx)).toBe(d(2027, 6, 12));
    expect(nextDay("columns", "PageUp", day, ctx)).toBe(d(2027, 4, 12));
    expect(nextDay("columns", "PageDown", day, { ...ctx, dir: "rtl" })).toBe(d(2027, 6, 12));
  });

  it("stays put when the neighbouring month is outside the period", () => {
    expect(nextDay("columns", "ArrowLeft", d(2027, 1, 15), ctx)).toBe(d(2027, 1, 15));
    expect(nextDay("columns", "PageDown", d(2027, 12, 15), ctx)).toBe(d(2027, 12, 15));
  });
});

describe("navKeyOf", () => {
  const press = (key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}) =>
    navKeyOf({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

  it("passes the movement keys without modifiers", () => {
    expect(press("ArrowLeft")).toBe("ArrowLeft");
    expect(press("Home")).toBe("Home");
    expect(press("PageDown")).toBe("PageDown");
  });

  it("turns Home and End with Ctrl or Cmd into the month keys", () => {
    expect(press("Home", { ctrlKey: true })).toBe("Ctrl+Home");
    expect(press("End", { metaKey: true })).toBe("Ctrl+End");
  });

  it("leaves other keys and other modifier combinations to the browser", () => {
    expect(press("a")).toBeUndefined();
    expect(press("ArrowLeft", { ctrlKey: true })).toBeUndefined();
    expect(press("PageDown", { metaKey: true })).toBeUndefined();
    expect(press("Home", { altKey: true })).toBeUndefined();
    expect(press("End", { ctrlKey: true, altKey: true })).toBeUndefined();
  });
});
