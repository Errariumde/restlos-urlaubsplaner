// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/** Days since 1970-01-01 (day 0, a Thursday). */
export type DayNumber = number;

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Monday first. */
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const MIN_YEAR = 1583;
export const MAX_YEAR = 9999;

/** `year` limited to the supported years. */
export const clampYear = (year: number): number => Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));

export interface Ymd {
  year: number;
  month: number; // 1-12
  day: number;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Year out of range: ${String(year)}`);
  }
}

export function daysInMonth(year: number, month: number): number {
  assertYear(year);
  const length = Number.isInteger(month) ? MONTH_LENGTHS[month - 1] : undefined;
  if (length === undefined) {
    throw new RangeError(`Month out of range: ${String(month)}`);
  }
  return month === 2 && isLeapYear(year) ? 29 : length;
}

// Howard Hinnant's days_from_civil: years start on 1 March, 400-year eras.
export function dayFromYmd(year: number, month: number, day: number): DayNumber {
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Day out of range: ${String(day)}`);
  }
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

const MIN_DAY = dayFromYmd(MIN_YEAR, 1, 1);
const MAX_DAY = dayFromYmd(MAX_YEAR, 12, 31);

// Howard Hinnant's civil_from_days.
export function ymdFromDay(day: DayNumber): Ymd {
  if (!Number.isInteger(day) || day < MIN_DAY || day > MAX_DAY) {
    throw new RangeError(`Day number out of range: ${String(day)}`);
  }
  const z = day + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const d = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { year: yearOfEra + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d };
}

export function dayFromIso(iso: string): DayNumber {
  const match = ISO_PATTERN.exec(iso);
  if (!match) {
    throw new RangeError(`Invalid ISO date: ${JSON.stringify(iso)}`);
  }
  return dayFromYmd(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isoFromDay(day: DayNumber): string {
  const { year, month, day: d } = ymdFromDay(day);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Deliberately no range check: callers need weekdays just outside MIN_YEAR..MAX_YEAR,
// e.g. "before 1 January" in 1583 or a substitute day after 9999-12-31.
export function weekdayOf(day: DayNumber): Weekday {
  if (!Number.isInteger(day)) {
    throw new RangeError(`Day number is not an integer: ${String(day)}`);
  }
  const weekday = WEEKDAYS[((day % 7) + 7 + 3) % 7];
  if (weekday === undefined) {
    throw new RangeError(`Day number out of range: ${String(day)}`);
  }
  return weekday;
}
