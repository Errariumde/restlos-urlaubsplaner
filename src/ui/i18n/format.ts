// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber } from "../../engine/days.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { Locale } from "./locale.ts";

export type DateStyle = "long" | "short" | "weekday" | "month" | "monthShort" | "monthYear" | "monthLongYear" | "dayMonth";

const MINUS = "−";
const MS_PER_DAY = 86_400_000;

/** The BCP 47 tag Intl gets. English uses the British day-month-year order; the pseudo-locales format like English. */
function intlTag(locale: Locale): string {
  return locale === "de" ? "de" : "en-GB";
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: Locale, maximumFractionDigits: number): Intl.NumberFormat {
  const tag = intlTag(locale);
  const key = `${tag}/${maximumFractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(tag, { maximumFractionDigits });
    numberFormats.set(key, format);
  }
  return format;
}

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "short" },
  month: { month: "long" },
  monthShort: { month: "short" },
  monthYear: { month: "short", year: "numeric" },
  monthLongYear: { month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
};

/** Day amount for display: whole and half days with ½ ("1½", "½", "−2½"), other fractions with up to two decimals. */
export function formatDays(units: Units, locale: Locale): string {
  const sign = units < 0 ? MINUS : "";
  const abs = Math.abs(units);
  const whole = Math.floor(abs / UNITS_PER_DAY);
  const rest = abs - whole * UNITS_PER_DAY;
  if (rest === 0) return sign + numberFormat(locale, 0).format(whole);
  if (rest * 2 === UNITS_PER_DAY) return sign + (whole === 0 ? "" : numberFormat(locale, 0).format(whole)) + "½";
  return sign + numberFormat(locale, 2).format(abs / UNITS_PER_DAY);
}

/** A day number as text in the UI language, computed from the day's UTC midnight so the machine's time zone does not matter. */
export function formatDate(day: DayNumber, locale: Locale, style: DateStyle): string {
  const tag = intlTag(locale);
  const key = `${tag}/${style}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(tag, { ...DATE_OPTIONS[style], timeZone: "UTC" });
    dateFormats.set(key, format);
  }
  return format.format(day * MS_PER_DAY); // day 0 is 1970-01-01
}

/** The number of days, for plural selection in messages (the formatted amount is passed as a separate argument). */
export function dayCount(units: Units): number {
  return units / UNITS_PER_DAY;
}
