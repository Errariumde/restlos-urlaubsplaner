// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber } from "../../engine/days.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { Locale } from "./locale.ts";

export type DateStyle = "long" | "short" | "weekday" | "weekdayLong" | "month" | "monthShort" | "monthYear" | "monthLongYear" | "dayMonth";

const MINUS = "−";
const MS_PER_DAY = 86_400_000;

/** The BCP 47 tag Intl gets. English uses the British day-month-year order; the pseudo-locales format like English. */
function intlTag(locale: Locale): string {
  return locale === "de" ? "de" : "en-GB";
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const listFormats = new Map<string, Intl.ListFormat>();

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
  weekdayLong: { weekday: "long" },
  month: { month: "long" },
  monthShort: { month: "short" },
  monthYear: { month: "short", year: "numeric" },
  monthLongYear: { month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
};

/** The vulgar-fraction characters Unicode has, by "numerator/denominator" in lowest terms. */
const FRACTION_GLYPHS: Readonly<Record<string, string>> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
  "1/10": "⅒",
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Day amount for display, exact for every share of a day (docs/SPEC.md, "Finer granularity"): the whole days,
 * then the fraction as its glyph where Unicode has one ("1½", "¼", "−2⅓"), else as numerator/denominator after a
 * no-break space ("3/32", "1 3/32").
 */
export function formatDays(units: Units, locale: Locale): string {
  const sign = units < 0 ? MINUS : "";
  const abs = Math.abs(units);
  const whole = Math.floor(abs / UNITS_PER_DAY);
  const rest = abs - whole * UNITS_PER_DAY;
  const wholeText = numberFormat(locale, 0).format(whole);
  if (rest === 0) return sign + wholeText;
  const divisor = gcd(rest, UNITS_PER_DAY);
  const fraction = `${String(rest / divisor)}/${String(UNITS_PER_DAY / divisor)}`;
  const glyph = FRACTION_GLYPHS[fraction];
  if (glyph !== undefined) return sign + (whole === 0 ? "" : wholeText) + glyph;
  return sign + (whole === 0 ? "" : wholeText + "\u00a0") + fraction;
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

/** Items joined as a list in the UI language: "A, B and C", "A, B und C". */
export function formatList(items: readonly string[], locale: Locale): string {
  const tag = intlTag(locale);
  let format = listFormats.get(tag);
  if (!format) {
    format = new Intl.ListFormat(tag, { style: "long", type: "conjunction" });
    listFormats.set(tag, format);
  }
  return format.format(items);
}

/**
 * The number that selects the plural form for a day amount in messages (the formatted amount is passed as a
 * separate argument). Up to one day, a fraction included, is singular: "½ day", "1 day", "1½ days" (and
 * "½ Tag", "1½ Tage"); English and German plural rules would put 0.5 and 1.5 in "other" alike.
 */
export function pluralCount(units: Units): number {
  return Math.ceil(Math.abs(units) / UNITS_PER_DAY);
}
