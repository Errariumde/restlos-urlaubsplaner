// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, WEEKDAYS, dayFromIso, dayFromYmd, isLeapYear, weekdayOf, ymdFromDay } from "../days";
import type { DayNumber } from "../days";
import { orthodoxEaster, westernEaster } from "../easter";
import { ruleDate } from "../holidays/rules";
import type { DateRule } from "../holidays/types";

// Local copies of imported constants that loops read often; see match.ts.
const FIRST_YEAR = MIN_YEAR;
const LAST_YEAR = MAX_YEAR;
const YEARS = LAST_YEAR - FIRST_YEAR + 1;
const YEAR_TYPES = 14;

/** Years per block of the Easter bounds, counted from MIN_YEAR. */
export const BLOCK_YEARS = 16;

/**
 * The pairs of a year's type and the next year's type that occur: given the one, the other depends only
 * on whether the next year is a leap year, which it can't be after a leap year, so 7 · 2 + 7.
 */
export const YEAR_KINDS = 21;

/**
 * The earliest and latest Easter Sunday as days after 1 January: for each block of years at 2k and 2k + 1,
 * over all years in the last two places.
 */
type EasterBounds = Int16Array;

/**
 * Tables over the supported years at index `year - MIN_YEAR`, built on first use: 1 January, the year's
 * type and both Easter Sundays; also the first year of each type and the bounds of each Easter.
 */
interface YearTables {
  readonly jan1: Int32Array;
  readonly type: Uint8Array;
  readonly western: Int32Array;
  readonly orthodox: Int32Array;
  readonly sample: Int32Array;
  readonly westernBounds: EasterBounds;
  readonly orthodoxBounds: EasterBounds;
}
let tables: YearTables | undefined;

function yearTables(): YearTables {
  if (tables) return tables;
  const jan1 = new Int32Array(YEARS);
  const type = new Uint8Array(YEARS);
  const western = new Int32Array(YEARS);
  const orthodox = new Int32Array(YEARS);
  const sample = new Int32Array(YEAR_TYPES);
  for (let i = 0; i < YEARS; i++) {
    const year = FIRST_YEAR + i;
    const day = dayFromYmd(year, 1, 1);
    jan1[i] = day;
    type[i] = WEEKDAYS.indexOf(weekdayOf(day)) + (isLeapYear(year) ? 7 : 0);
    western[i] = westernEaster(year);
    orthodox[i] = orthodoxEaster(year);
  }
  for (let i = YEARS - 1; i >= 0; i--) sample[type[i] ?? 0] = FIRST_YEAR + i;
  const bounds = (sundays: Int32Array): EasterBounds => {
    const blocks = Math.ceil(YEARS / BLOCK_YEARS);
    const result = new Int16Array(2 * blocks + 2);
    for (let block = 0; block < blocks; block++) {
      const first = block * BLOCK_YEARS;
      const after = sundays.subarray(first, first + BLOCK_YEARS).map((sunday, k) => sunday - (jan1[first + k] ?? 0));
      result[2 * block] = Math.min(...after);
      result[2 * block + 1] = Math.max(...after);
    }
    const all = sundays.map((sunday, i) => sunday - (jan1[i] ?? 0));
    result[2 * blocks] = Math.min(...all);
    result[2 * blocks + 1] = Math.max(...all);
    return result;
  };
  tables = { jan1, type, western, orthodox, sample, westernBounds: bounds(western), orthodoxBounds: bounds(orthodox) };
  return tables;
}

/**
 * The type of each supported year, at index `year - MIN_YEAR`: the weekday of 1 January (0 for Monday),
 * plus 7 in a leap year. Read-only.
 */
export function yearTypes(): Uint8Array {
  return yearTables().type;
}

function yearIndex(year: number): number {
  const i = year - FIRST_YEAR;
  if (i >>> 0 !== i || i >= YEARS) throw new RangeError(`Year out of range: ${String(year)}`);
  return i;
}

/**
 * `ruleDate(rule, year)` for many years, without computing Easter or a calendar date anew in each year.
 * Loops call these methods for hundreds of years per rule, so they allocate nothing.
 */
export interface RuleDates {
  /** The rule's day in `year`, or null when it has none. Throws RangeError outside the supported years. */
  dayIn(year: number): DayNumber | null;
  /**
   * No day of the rule lies earlier after 1 January of its year, in the years `first` … `last` (all years
   * without them); Infinity when it has no day there.
   */
  earliest(first?: number, last?: number): number;
  /** No day lies later, likewise; −Infinity when it has no day there. */
  latest(first?: number, last?: number): number;
  /** True when its day, counted from 1 January, is the same in all years of one type (see `yearTypes`). */
  readonly byYearType: boolean;
  /** For an Easter rule: its day in the year at index i is `sundays[i] + offset`. */
  readonly easter: { readonly sundays: Int32Array; readonly offset: number } | null;
}

/** An Easter rule: its offset from a table of Easter Sundays. */
class EasterDates implements RuleDates {
  readonly byYearType = false;
  readonly easter: { readonly sundays: Int32Array; readonly offset: number };
  private readonly bounds: EasterBounds;
  constructor(sundays: Int32Array, offset: number, bounds: EasterBounds) {
    this.easter = { sundays, offset };
    this.bounds = bounds;
  }
  dayIn(year: number): DayNumber {
    return (this.easter.sundays[yearIndex(year)] ?? 0) + this.easter.offset;
  }
  earliest(first?: number, last?: number): number {
    return this.bound(first, last, 0, Math.min, Infinity);
  }
  latest(first?: number, last?: number): number {
    return this.bound(first, last, 1, Math.max, -Infinity);
  }
  /** Combines the bounds at `at` (0 earliest, 1 latest) of the blocks that hold `first` … `last`. */
  private bound(first: number | undefined, last: number | undefined, at: number, pick: (a: number, b: number) => number, none: number): number {
    if (first === undefined || last === undefined) return (this.bounds[this.bounds.length - 2 + at] ?? none) + this.easter.offset;
    let result = none;
    const lastBlock = Math.floor((Math.min(last, LAST_YEAR) - FIRST_YEAR) / BLOCK_YEARS);
    for (let block = Math.floor((Math.max(first, FIRST_YEAR) - FIRST_YEAR) / BLOCK_YEARS); block <= lastBlock; block++) {
      result = pick(result, this.bounds[2 * block + at] ?? none);
    }
    return result + this.easter.offset;
  }
}

/** A `once` rule: its day, in its own year only. */
class OnceDates implements RuleDates {
  readonly byYearType = false;
  readonly easter = null;
  private readonly day: DayNumber;
  private readonly year: number;
  private readonly after: number;
  constructor(day: DayNumber) {
    this.day = day;
    this.year = ymdFromDay(day).year;
    this.after = day - dayFromYmd(this.year, 1, 1);
  }
  dayIn(year: number): DayNumber | null {
    yearIndex(year);
    return year === this.year ? this.day : null;
  }
  earliest(first = FIRST_YEAR, last = LAST_YEAR): number {
    return this.year >= first && this.year <= last ? this.after : Infinity;
  }
  latest(first = FIRST_YEAR, last = LAST_YEAR): number {
    return this.year >= first && this.year <= last ? this.after : -Infinity;
  }
}

const UNKNOWN = 1_000_000; // an offset not looked up yet; a small integer keeps arrays of offsets fast
const NO_DAY = UNKNOWN + 1; // the rule has no day in years of this type

/**
 * The offsets per year type of the calendar rules met so far, shared by their `RuleDates`. There are only
 * about 11,000 such rules, with 14 offsets each, so this stays small.
 */
const calendarOffsets = new Map<string, number[]>();

/**
 * Any other rule: its day lies the same number of days after 1 January in all years of one type. That
 * offset comes from `ruleDate` in the type's first year, when a year of the type first comes up.
 */
class CalendarDates implements RuleDates {
  readonly byYearType = true;
  readonly easter = null;
  private readonly rule: DateRule;
  private readonly tables: YearTables;
  private readonly offsets: number[];
  private bounds: { earliest: number; latest: number } | undefined;
  constructor(rule: DateRule, tables: YearTables) {
    this.rule = rule;
    this.tables = tables;
    const key = dateRuleKey(rule);
    const known = calendarOffsets.get(key);
    const U = UNKNOWN;
    this.offsets = known ?? [U, U, U, U, U, U, U, U, U, U, U, U, U, U];
    if (known === undefined) calendarOffsets.set(key, this.offsets);
  }
  dayIn(year: number): DayNumber | null {
    const i = yearIndex(year);
    const type = this.tables.type[i] ?? 0;
    let offset = this.offsets[type] ?? UNKNOWN;
    if (offset === UNKNOWN) offset = this.learn(type);
    return offset === NO_DAY ? null : (this.tables.jan1[i] ?? 0) + offset;
  }
  /** Over all supported years, whatever `first` and `last`. */
  earliest(): number {
    return this.allBounds().earliest;
  }
  /** Over all supported years, whatever `first` and `last`. */
  latest(): number {
    return this.allBounds().latest;
  }
  private allBounds(): { earliest: number; latest: number } {
    if (this.bounds !== undefined) return this.bounds;
    let earliest = Infinity;
    let latest = -Infinity;
    for (let type = 0; type < YEAR_TYPES; type++) {
      let offset = this.offsets[type] ?? UNKNOWN;
      if (offset === UNKNOWN) offset = this.learn(type);
      if (offset === NO_DAY) continue;
      earliest = Math.min(earliest, offset);
      latest = Math.max(latest, offset);
    }
    this.bounds = { earliest, latest };
    return this.bounds;
  }
  private learn(type: number): number {
    const sample = this.tables.sample[type] ?? FIRST_YEAR;
    const day = ruleDate(this.rule, sample);
    const offset = day === null ? NO_DAY : day - dayFromYmd(sample, 1, 1);
    this.offsets[type] = offset;
    return offset;
  }
}

/** The days of a date rule in many years; see `RuleDates`. */
export function ruleDates(rule: DateRule): RuleDates {
  const t = yearTables();
  switch (rule.type) {
    case "easter":
      return new EasterDates(t.western, rule.offset, t.westernBounds);
    case "orthodoxEaster":
      return new EasterDates(t.orthodox, rule.offset, t.orthodoxBounds);
    case "once":
      return new OnceDates(dayFromIso(rule.date));
    default:
      return new CalendarDates(rule, t);
  }
}

/** A key for a date rule; no field holds a colon, so different rules get different keys. */
export function dateRuleKey(rule: DateRule): string {
  switch (rule.type) {
    case "fixed":
      return `fixed:${String(rule.month)}:${String(rule.day)}:${rule.nonLeap ?? ""}`;
    case "easter":
    case "orthodoxEaster":
      return `${rule.type}:${String(rule.offset)}`;
    case "weekdayRelative":
      return `weekdayRelative:${rule.weekday}:${rule.relation}:${String(rule.month)}:${String(rule.day)}`;
    case "nthWeekday":
      return `nthWeekday:${String(rule.month)}:${rule.weekday}:${String(rule.n)}`;
    case "once":
      return `once:${rule.date}`;
  }
}
