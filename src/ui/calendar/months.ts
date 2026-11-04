// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The month and week layout of the two calendar views (docs/SPEC.md, D4).
import type { PlanPeriod } from "../../engine/counting/types.ts";
import { WEEKDAYS, dayFromYmd, daysInMonth, weekdayOf, ymdFromDay, type DayNumber, type Weekday } from "../../engine/days.ts";

export interface MonthBlock {
  readonly year: number;
  readonly month: number; // 1 … 12
  readonly first: DayNumber;
  readonly last: DayNumber;
}

export interface TileWeek {
  readonly isoWeek: number;
  readonly startDay: DayNumber; // the first cell's day, also when that cell is outside the month
  readonly cells: (DayNumber | null)[]; // 7 cells, null outside the month
}

/** Position of a weekday in the week, Monday = 0. */
export function weekdayIndex(weekday: Weekday): number {
  return WEEKDAYS.indexOf(weekday);
}

/** How many days `day` lies after the start of its week row. */
export function offsetInWeek(day: DayNumber, weekStart: Weekday): number {
  return (weekdayIndex(weekdayOf(day)) - weekdayIndex(weekStart) + 7) % 7;
}

export function monthBlock(year: number, month: number): MonthBlock {
  return { year, month, first: dayFromYmd(year, month, 1), last: dayFromYmd(year, month, daysInMonth(year, month)) };
}

/** Every calendar month the period touches, in order. */
export function periodMonths(period: PlanPeriod): MonthBlock[] {
  const months: MonthBlock[] = [];
  let { year, month } = period.from;
  while (year < period.to.year || (year === period.to.year && month <= period.to.month)) {
    months.push(monthBlock(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** The ISO 8601 week number: the week containing the Thursday of the day's week. */
export function isoWeek(day: DayNumber): number {
  const thursday = day - weekdayIndex(weekdayOf(day)) + 3;
  const jan1 = dayFromYmd(ymdFromDay(thursday).year, 1, 1);
  return Math.floor((thursday - jan1) / 7) + 1;
}

/** The week rows of a month tile. A row's week number is that of its Thursday, so it holds for any week start. */
export function tileWeeks(month: MonthBlock, weekStart: Weekday): TileWeek[] {
  const weeks: TileWeek[] = [];
  const thursdayOffset = (3 - weekdayIndex(weekStart) + 7) % 7;
  for (let startDay = month.first - offsetInWeek(month.first, weekStart); startDay <= month.last; startDay += 7) {
    const cells: (DayNumber | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = startDay + i;
      cells.push(day >= month.first && day <= month.last ? day : null);
    }
    weeks.push({ isoWeek: isoWeek(startDay + thursdayOffset), startDay, cells });
  }
  return weeks;
}

/**
 * The rows of the month columns view, as rows × months. Without alignment row i is day i + 1 of
 * the month (31 rows). With alignment the rows are weekday positions from `weekStart`: each month is
 * shifted so its first day lies on its weekday's row (at most 37 rows).
 */
export function columnRows(months: readonly MonthBlock[], alignByWeekday: boolean, weekStart: Weekday): (DayNumber | null)[][] {
  const offsets = months.map((month) => (alignByWeekday ? offsetInWeek(month.first, weekStart) : 0));
  const rowCount = alignByWeekday ? Math.max(0, ...months.map((month, i) => offsets[i]! + month.last - month.first + 1)) : 31;
  const rows: (DayNumber | null)[][] = [];
  for (let row = 0; row < rowCount; row += 1) {
    rows.push(
      months.map((month, i) => {
        const day = month.first + row - offsets[i]!;
        return day >= month.first && day <= month.last ? day : null;
      }),
    );
  }
  return rows;
}
