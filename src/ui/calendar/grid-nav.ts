// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Keyboard movement in the calendar grid (docs/SPEC.md, D4; D14 for right-to-left).
import { ymdFromDay, type DayNumber, type Weekday } from "../../engine/days.ts";
import { monthBlock, offsetInWeek, type MonthBlock } from "./months.ts";

export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown";

export interface NavContext {
  readonly dir: "ltr" | "rtl";
  readonly weekStart: Weekday;
  readonly period: { readonly from: DayNumber; readonly to: DayNumber };
  readonly alignByWeekday: boolean;
}

const monthIndex = (year: number, month: number): number => year * 12 + month - 1;
const clamp = (day: DayNumber, ctx: NavContext): DayNumber => Math.min(Math.max(day, ctx.period.from), ctx.period.to);

/** The month `months` away from the day's month, or undefined when it lies outside the period. */
function neighbour(day: DayNumber, months: number, ctx: NavContext): MonthBlock | undefined {
  const { year, month } = ymdFromDay(day);
  const from = ymdFromDay(ctx.period.from);
  const to = ymdFromDay(ctx.period.to);
  const index = monthIndex(year, month) + months;
  if (index < monthIndex(from.year, from.month) || index > monthIndex(to.year, to.month)) return undefined;
  return monthBlock(Math.floor(index / 12), (index % 12) + 1);
}

/** The same day of the month in `target`, clamped to its length. */
const sameDayOf = (day: DayNumber, target: MonthBlock): DayNumber => Math.min(target.first + ymdFromDay(day).day - 1, target.last);

function tilesNext(key: NavKey, day: DayNumber, ctx: NavContext): DayNumber {
  const horizontal = ctx.dir === "rtl" ? -1 : 1;
  const weekFirst = day - offsetInWeek(day, ctx.weekStart);
  switch (key) {
    case "ArrowLeft":
      return day - horizontal;
    case "ArrowRight":
      return day + horizontal;
    case "ArrowUp":
      return day - 7;
    case "ArrowDown":
      return day + 7;
    case "Home":
      return weekFirst;
    case "End":
      return weekFirst + 6;
    case "PageUp":
    case "PageDown": {
      const step = key === "PageUp" ? -1 : 1;
      const target = neighbour(day, step, ctx);
      // Past the period the focus goes to its edge; the caller's clamp does the rest.
      return target ? sameDayOf(day, target) : step < 0 ? ctx.period.from : ctx.period.to;
    }
  }
}

function columnsNext(key: NavKey, day: DayNumber, ctx: NavContext): DayNumber {
  const horizontal = ctx.dir === "rtl" ? -1 : 1;
  const own = monthBlock(ymdFromDay(day).year, ymdFromDay(day).month);
  // The same row in another month: the same weekday row when aligned, else the same day of the month.
  const sameRow = (months: number): DayNumber => {
    const target = neighbour(day, months, ctx);
    if (!target) return day; // no month there: stay
    if (!ctx.alignByWeekday) return sameDayOf(day, target);
    const row = day - own.first + offsetInWeek(own.first, ctx.weekStart);
    const wanted = target.first - offsetInWeek(target.first, ctx.weekStart) + row;
    return Math.min(Math.max(wanted, target.first), target.last);
  };
  switch (key) {
    case "ArrowUp":
      return day - 1;
    case "ArrowDown":
      return day + 1;
    case "ArrowLeft":
      return sameRow(-horizontal);
    case "ArrowRight":
      return sameRow(horizontal);
    case "PageUp":
      return sameRow(-1);
    case "PageDown":
      return sameRow(1);
    case "Home":
      return own.first;
    case "End":
      return own.last;
  }
}

/** Where `key` moves the focus from `day`. The result stays inside the period. */
export function nextDay(view: "tiles" | "columns", key: NavKey, day: DayNumber, ctx: NavContext): DayNumber {
  return clamp(view === "tiles" ? tilesNext(key, day, ctx) : columnsNext(key, day, ctx), ctx);
}
