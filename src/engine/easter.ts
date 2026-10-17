// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, dayFromYmd } from "./days";
import type { DayNumber } from "./days";

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Year out of range: ${String(year)}`);
  }
}

/** Western Easter Sunday (Gregorian computus, Meeus/Jones/Butcher). */
export function westernEaster(year: number): DayNumber {
  assertYear(year);
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayFromYmd(year, month, day);
}

// Same algorithm as dayFromYmd but without the Gregorian century rules.
// The origin is arbitrary; it is shifted below to the 1970 epoch.
function julianDaysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 4);
  const yearOfEra = y - era * 4;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  return era * 1461 + yearOfEra * 365 + dayOfYear;
}

// 1970-01-01 (Gregorian) is 1969-12-19 in the Julian calendar.
const JULIAN_EPOCH_OFFSET = julianDaysFromCivil(1969, 12, 19);

/** Orthodox Easter Sunday as a Gregorian day number (Julian computus, Meeus). */
export function orthodoxEaster(year: number): DayNumber {
  assertYear(year);
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return julianDaysFromCivil(year, month, day) - JULIAN_EPOCH_OFFSET;
}
