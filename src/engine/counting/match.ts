// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, WEEKDAYS, clampYear, weekdayOf, ymdFromDay } from "../days";
import type { DayNumber } from "../days";
import { BLOCK_YEARS, YEAR_KINDS, ruleDates, yearTypes, type RuleDates } from "./rule-dates";
import type { DayRule, RangeMatch } from "./types";

export const MAX_RANGE_DAYS = 366;

// Local copies of the imported constants the loops below read in every year: a test runner may turn each
// read of an imported binding into a property lookup on the module.
const FIRST_YEAR = MIN_YEAR;
const LAST_YEAR = MAX_YEAR;
const BLOCK = BLOCK_YEARS;
const KINDS = YEAR_KINDS;

type Matched = Pick<DayRule, "match" | "validFrom" | "validUntil">;
/** Gets the first and last day of an occurrence; returning true ends the walk. */
type Visit = (first: DayNumber, last: DayNumber) => boolean;

/** Throws RangeError for a malformed range. */
export function checkRange(match: RangeMatch): void {
  const { days, weekdays, to } = match;
  if ((to === undefined) === (days === undefined)) {
    throw new RangeError("A range needs exactly one of `to` and `days`");
  }
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > MAX_RANGE_DAYS)) {
    throw new RangeError(`Range length must be a whole number from 1 to ${MAX_RANGE_DAYS}`);
  }
  if (weekdays !== undefined && weekdays.length === 0) {
    throw new RangeError("A range's weekdays must not be empty");
  }
}

/**
 * Calls `visit` with the first and last day of every occurrence of the rule that overlaps `from` … `to`,
 * clipped to them (a single date is an occurrence of one day), until `visit` returns true; returns whether
 * it did. A range's weekdays are left to `visit`. Throws RangeError for a malformed range.
 *
 * With `weekdaysOnly`, for a `visit` that depends on nothing but the weekdays of the days it gets, an
 * occurrence that can only repeat one already visited may be skipped.
 */
function someOccurrence(rule: Matched, from: DayNumber, to: DayNumber, visit: Visit, weekdaysOnly = false): boolean {
  const { match, validFrom, validUntil } = rule;
  const fromYear = ymdFromDay(from).year;
  const toYear = ymdFromDay(to).year;
  // A rule's date for year Y may lie in Y − 1 or Y + 1, and a range may start in Y − 1 and end in Y + 1,
  // so look one or two years further; then keep to the validity years.
  const earliest = clampYear(fromYear - (match.type === "range" ? 2 : 1));
  const latest = clampYear(toYear + 1);
  const first = validFrom !== undefined && validFrom > earliest ? Math.ceil(validFrom) : earliest;
  const last = validUntil !== undefined && validUntil < latest ? Math.floor(validUntil) : latest;

  if (match.type !== "range") {
    const dates = ruleDates(match);
    for (let year = first; year <= last; year++) {
      const day = dates.dayIn(year);
      if (day !== null && day >= from && day <= to && visit(day, day)) return true;
    }
    return false;
  }
  checkRange(match);
  const starts = ruleDates(match.from);
  const ends = match.to === undefined ? null : ruleDates(match.to);
  // `to` can't reach the start when even its day in the next year (at most 366 days plus its latest day
  // after 1 January of the start's year) lies before the start's earliest day after 1 January. For two
  // Easter rules that is known at once, so they go through the faster walk of `someEasterRange`.
  const unreachable = (): boolean => ends !== null && ends.latest() + 366 < starts.earliest();
  if (starts.easter !== null && ends !== null && ends.easter !== null) {
    return !unreachable() && someEasterRange(starts.easter, ends.easter, first, last, from, to, visit);
  }

  // A range given by the calendar alone lies on the same days after 1 January, with the same weekdays, in
  // all years of one kind: the same type of the year and of the next year (see `yearTypes`). It isn't
  // clipped when it starts two or more years after `from`'s year and three or more before `to`'s. With
  // `weekdaysOnly`, such a year is skipped when a year of its kind has been visited, and all of them are
  // once every kind has.
  const repeats = weekdaysOnly && starts.byYearType && (ends === null || ends.byYearType) ? new Uint8Array(14 * 14) : null;
  const types = yearTypes();
  let kinds = 0;
  // `to` in `carriedYear`: each year looks up `to` in the next year, which the next year reuses.
  let carried: DayNumber | null = null;
  let carriedYear = 0;
  for (let year = first; year <= last; year++) {
    // The offsets of all year types are worth looking up only for a rule that gave nothing for a while.
    // From then on, a block of years in which `to` can't reach the start (as `unreachable` says for all
    // years) is skipped; that matters for an Easter rule, whose span differs from block to block.
    if (ends !== null && year >= first + 8 && (year === first + 8 || (year - FIRST_YEAR) % BLOCK === 0)) {
      if (year === first + 8 && unreachable()) return false;
      const blockLast = Math.min(last, year + BLOCK - 1 - ((year - FIRST_YEAR) % BLOCK));
      if (ends.latest(year, blockLast + 1) + 366 < starts.earliest(year, blockLast)) {
        year = blockLast;
        continue;
      }
    }
    const unclipped = repeats !== null && year >= fromYear + 2 && year <= toYear - 3;
    if (unclipped && kinds === KINDS) {
      year = toYear - 3; // the last unclipped year; the walk goes on after it
      continue;
    }
    if (repeats !== null && unclipped) {
      const kind = (types[year - FIRST_YEAR] ?? 0) * 14 + (types[year + 1 - FIRST_YEAR] ?? 0);
      if (repeats[kind] === 1) continue;
      repeats[kind] = 1;
      kinds++;
    }
    const start = starts.dayIn(year);
    let end: DayNumber | null = null;
    if (match.days !== undefined) {
      end = start === null ? null : start + match.days - 1;
    } else if (ends !== null) {
      const sameYear = carriedYear === year ? carried : ends.dayIn(year);
      const nextYear = year + 1 <= LAST_YEAR ? ends.dayIn(year + 1) : null;
      if (start !== null) {
        if (sameYear !== null && sameYear >= start) end = sameYear;
        else if (nextYear !== null && nextYear >= start) end = nextYear;
      }
      carried = nextYear;
      carriedYear = year + 1;
    }
    if (start === null || end === null) continue;
    const low = Math.max(start, from);
    const high = Math.min(end, to);
    if (low <= high && visit(low, high)) return true;
  }
  return false;
}

/**
 * The walk of `someOccurrence` for a range from one Easter rule to another, over the rule years `first`
 * … `last`, reading the Easter tables directly: several times faster over the 400 years of a rule warning.
 */
function someEasterRange(
  starts: NonNullable<RuleDates["easter"]>,
  ends: NonNullable<RuleDates["easter"]>,
  first: number,
  last: number,
  from: DayNumber,
  to: DayNumber,
  visit: Visit,
): boolean {
  for (let year = first; year <= last; year++) {
    const i = year - FIRST_YEAR;
    const start = (starts.sundays[i] ?? 0) + starts.offset;
    const sameYear = (ends.sundays[i] ?? 0) + ends.offset;
    const nextYear = year + 1 <= LAST_YEAR ? (ends.sundays[i + 1] ?? 0) + ends.offset : null;
    const end = sameYear >= start ? sameYear : nextYear !== null && nextYear >= start ? nextYear : null;
    if (end === null) continue;
    const low = Math.max(start, from);
    const high = Math.min(end, to);
    if (low <= high && visit(low, high)) return true;
  }
  return false;
}

/**
 * The days a rule matches between `from` and `to` (inclusive), sorted, each once.
 * Throws RangeError for a malformed range.
 */
export function ruleDays(rule: Matched, from: DayNumber, to: DayNumber): DayNumber[] {
  const found = new Set<DayNumber>();
  const weekdays = rule.match.type === "range" ? rule.match.weekdays : undefined;
  someOccurrence(rule, from, to, (first, last) => {
    for (let day = first; day <= last; day++) {
      if (weekdays === undefined || weekdays.includes(weekdayOf(day))) found.add(day);
    }
    return false;
  });
  return [...found].sort((a, b) => a - b);
}

const ALL_WEEKDAYS = 0b1111111;
/** At index 7 · w + n − 1, bit (w + k) mod 7 for k = 0 … n − 1: the weekdays of n days from weekday w. */
const COVERED = Array.from({ length: 49 }, (_, i) => {
  let bits = 0;
  for (let k = 0; k <= i % 7; k++) bits |= 1 << ((Math.floor(i / 7) + k) % 7);
  return bits;
});
/** The index in WEEKDAYS (Monday 0) of a day; day 0 is a Thursday. */
const weekdayIndex = (day: DayNumber): number => ((day % 7) + 10) % 7;

/**
 * Whether the rule matches a day between `from` and `to`, like `ruleDays(rule, from, to).length > 0` but
 * stopping at the first day. Throws RangeError for a malformed range.
 */
export function ruleHasDay(rule: Matched, from: DayNumber, to: DayNumber): boolean {
  const { match } = rule;
  let mask = ALL_WEEKDAYS;
  if (match.type === "range" && match.weekdays !== undefined) {
    mask = 0;
    for (const weekday of match.weekdays) mask |= 1 << WEEKDAYS.indexOf(weekday);
  }
  // Seven days hold every weekday; fewer are looked up in COVERED.
  const visit: Visit = (first, last) =>
    mask === ALL_WEEKDAYS || last - first >= 6 || ((COVERED[7 * weekdayIndex(first) + last - first] ?? 0) & mask) !== 0;
  return someOccurrence(rule, from, to, visit, true);
}
