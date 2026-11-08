// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Keyboard movement in the calendar grid (docs/SPEC.md, "Calendar interaction"; "Multilingual support" for
// right-to-left).
import { ymdFromDay, type DayNumber, type Weekday } from "../../engine/days.ts";
import { monthBlock, offsetInWeek, type MonthBlock } from "./months.ts";

/** A movement key; "Ctrl+Home" and "Ctrl+End" stand for Home and End with Ctrl (Cmd on macOS). */
export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "PageUp" | "PageDown" | "Home" | "End" | "Ctrl+Home" | "Ctrl+End";

/** The keys that move the same way in both views. */
type SharedKey = "Home" | "End" | "Ctrl+Home" | "Ctrl+End";
type ViewKey = Exclude<NavKey, SharedKey>;

const PLAIN_KEYS: ReadonlySet<string> = new Set<NavKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * The movement a key press stands for, or undefined when the calendar leaves it to the browser. Shift doesn't
 * change it (it extends the selection); Ctrl or Cmd only combine with Home and End, Alt with nothing.
 */
export function navKeyOf(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}): NavKey | undefined {
  if (event.altKey || !PLAIN_KEYS.has(event.key)) return undefined;
  if (!event.ctrlKey && !event.metaKey) return event.key as NavKey;
  if (event.key === "Home") return "Ctrl+Home";
  if (event.key === "End") return "Ctrl+End";
  return undefined;
}

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

/** Home and End go to the start and end of the week, across a month's edge; with Ctrl, to the month's first and last day. */
function sharedNext(key: SharedKey, day: DayNumber, ctx: NavContext): DayNumber {
  const weekFirst = day - offsetInWeek(day, ctx.weekStart);
  const { year, month } = ymdFromDay(day);
  switch (key) {
    case "Home":
      return weekFirst;
    case "End":
      return weekFirst + 6;
    case "Ctrl+Home":
      return monthBlock(year, month).first;
    case "Ctrl+End":
      return monthBlock(year, month).last;
  }
}

function tilesNext(key: ViewKey, day: DayNumber, ctx: NavContext): DayNumber {
  const horizontal = ctx.dir === "rtl" ? -1 : 1;
  switch (key) {
    case "ArrowLeft":
      return day - horizontal;
    case "ArrowRight":
      return day + horizontal;
    case "ArrowUp":
      return day - 7;
    case "ArrowDown":
      return day + 7;
    case "PageUp":
    case "PageDown": {
      const step = key === "PageUp" ? -1 : 1;
      const target = neighbour(day, step, ctx);
      // No month there inside the period: stay, as in the columns. A partial month is clamped by nextDay.
      return target ? sameDayOf(day, target) : day;
    }
  }
}

function columnsNext(key: ViewKey, day: DayNumber, ctx: NavContext): DayNumber {
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
      return Math.max(day - 1, own.first); // a column ends with its month
    case "ArrowDown":
      return Math.min(day + 1, own.last);
    case "ArrowLeft":
      return sameRow(-horizontal);
    case "ArrowRight":
      return sameRow(horizontal);
    case "PageUp":
      return sameRow(-1);
    case "PageDown":
      return sameRow(1);
  }
}

/** Where `key` moves the focus from `day`. The result stays inside the period. */
export function nextDay(view: "tiles" | "columns", key: NavKey, day: DayNumber, ctx: NavContext): DayNumber {
  if (key === "Home" || key === "End" || key === "Ctrl+Home" || key === "Ctrl+End") return clamp(sharedNext(key, day, ctx), ctx);
  return clamp(view === "tiles" ? tilesNext(key, day, ctx) : columnsNext(key, day, ctx), ctx);
}
