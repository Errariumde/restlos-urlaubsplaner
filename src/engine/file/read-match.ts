// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_RANGE_DAYS } from "../counting/match";
import type { DayMatch, RangeMatch } from "../counting/types";
import { WEEKDAYS, dayFromIso, daysInMonth, type Weekday } from "../days";
import type { DateRule } from "../holidays/types";
import { at, checkKeys, child, isRecord, readChoice, readOptional, readRequired, type Parse, type Report } from "./report";

const LEAP_YEAR = 2000;
const MAX_EASTER_OFFSET = 366;
const RELATIONS = ["before", "onOrBefore", "after", "onOrAfter"] as const;
const NON_LEAP = ["drop", "feb28", "mar1"] as const;
const NTH = [1, 2, 3, 4, -1] as const;

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isWeekday = (value: unknown): value is Weekday => typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
const oneOf = <T extends string | number>(list: readonly T[]): Parse<T> => (value) => list.find((item) => item === value);
const month: Parse<number> = (value) => (isInt(value) && value >= 1 && value <= 12 ? value : undefined);
const weekday: Parse<Weekday> = (value) => (isWeekday(value) ? value : undefined);

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    dayFromIso(value);
    return value;
  } catch {
    return undefined;
  }
}

/** `month`, then `day` of a date in the year; `day` only when `month` is valid, 29 February only where `feb29` allows it. */
function readMonthDay(
  value: Readonly<Record<string, unknown>>,
  path: string,
  report: Report,
  dropped: string,
  feb29: boolean,
): { month: number; day: number } | undefined {
  const monthOfYear = readRequired(value, "month", month, path, report, dropped);
  if (monthOfYear === undefined) return undefined;
  const last = monthOfYear === 2 && !feb29 ? 28 : daysInMonth(LEAP_YEAR, monthOfYear);
  const day = readRequired(value, "day", (item) => (isInt(item) && item >= 1 && item <= last ? item : undefined), path, report, dropped);
  return day === undefined ? undefined : { month: monthOfYear, day };
}

/**
 * One of the six date rules; every field is checked. A missing or unknown `type` is the only report entry,
 * since the type decides the fields.
 */
function readDateRule(value: Readonly<Record<string, unknown>>, path: string, report: Report, dropped: string): DateRule | undefined {
  const required = <T>(key: string, parse: Parse<T>): T | undefined => readRequired(value, key, parse, path, report, dropped);
  const type = value["type"];
  let rule: DateRule | undefined;
  let keys: readonly string[];
  switch (type) {
    case "fixed": {
      const date = readMonthDay(value, path, report, dropped, true);
      // `nonLeap` is required for 29 February and allowed only there, so it is checked only with a valid date.
      if (date?.month === 2 && date.day === 29) {
        const nonLeap = required("nonLeap", oneOf(NON_LEAP));
        if (nonLeap !== undefined) rule = { type, ...date, nonLeap };
      } else if (date) {
        if (value["nonLeap"] === undefined) rule = { type, ...date };
        else report.error("invalidValue", child(path, "nonLeap"), dropped);
      }
      keys = ["type", "month", "day", "nonLeap"];
      break;
    }
    case "easter":
    case "orthodoxEaster": {
      const offset = required("offset", (item) => (isInt(item) && Math.abs(item) <= MAX_EASTER_OFFSET ? item : undefined));
      if (offset !== undefined) rule = { type, offset };
      keys = ["type", "offset"];
      break;
    }
    case "weekdayRelative": {
      const day = required("weekday", weekday);
      const relation = required("relation", oneOf(RELATIONS));
      const date = readMonthDay(value, path, report, dropped, false);
      if (day !== undefined && relation !== undefined && date) rule = { type, weekday: day, relation, ...date };
      keys = ["type", "weekday", "relation", "month", "day"];
      break;
    }
    case "nthWeekday": {
      const monthOfYear = required("month", month);
      const day = required("weekday", weekday);
      const n = required("n", oneOf(NTH));
      if (monthOfYear !== undefined && day !== undefined && n !== undefined) rule = { type, month: monthOfYear, weekday: day, n };
      keys = ["type", "month", "weekday", "n"];
      break;
    }
    case "once": {
      const date = required("date", isoDate);
      if (date !== undefined) rule = { type, date };
      keys = ["type", "date"];
      break;
    }
    default:
      report.error(type === undefined ? "missingValue" : "invalidValue", child(path, "type"), dropped);
      return undefined;
  }
  checkKeys(value, keys, path, report);
  return rule;
}

/** The `from` or `to` of a range: a date rule, never a range (a `type` "range" there is invalid). */
function readBound(value: Readonly<Record<string, unknown>>, key: string, path: string, report: Report, dropped: string): DateRule | undefined {
  const bound = value[key];
  const boundPath = child(path, key);
  if (bound === undefined) report.error("missingValue", boundPath, dropped);
  else if (!isRecord(bound)) report.error("invalidValue", boundPath, dropped);
  else return readDateRule(bound, boundPath, report, dropped);
  return undefined;
}

/** A non-empty list of distinct weekdays; each invalid or repeated one is reported at its index. */
function readWeekdays(value: unknown, path: string, report: Report, dropped: string): Weekday[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    report.error("invalidValue", path, dropped);
    return undefined;
  }
  const seen = new Set<Weekday>();
  let valid = true;
  for (let i = 0; i < value.length; i++) {
    const item: unknown = value[i];
    if (isWeekday(item) && !seen.has(item)) seen.add(item);
    else {
      report.error("invalidValue", at(path, i), dropped);
      valid = false;
    }
  }
  return valid ? [...seen] : undefined;
}

function readRange(value: Readonly<Record<string, unknown>>, path: string, report: Report, dropped: string): RangeMatch | undefined {
  const from = readBound(value, "from", path, report, dropped);
  const end = readChoice(value, ["to", "days"], path, report, dropped);
  const to = end === "to" ? readBound(value, "to", path, report, dropped) : undefined;
  const days =
    end === "days" ? readOptional(value, "days", (item) => (isInt(item) && item >= 1 && item <= MAX_RANGE_DAYS ? item : undefined), path, report, dropped) : undefined;
  const weekdaysValue = value["weekdays"];
  const weekdays = weekdaysValue === undefined ? undefined : readWeekdays(weekdaysValue, child(path, "weekdays"), report, dropped);
  checkKeys(value, ["type", "from", "to", "days", "weekdays"], path, report);
  if (from === undefined || (to === undefined && days === undefined) || (weekdaysValue !== undefined && weekdays === undefined)) return undefined;
  return { type: "range", from, ...(to ? { to } : {}), ...(days !== undefined ? { days } : {}), ...(weekdays ? { weekdays } : {}) };
}

/**
 * A `match`: one of the six date rules or a range. Every problem is reported at the key itself. A missing or
 * invalid value drops `dropped`, and the result is then undefined; an unknown field drops only itself, and the
 * match is kept.
 */
export function readMatch(value: unknown, path: string, report: Report, dropped: string): DayMatch | undefined {
  if (value === undefined) report.error("missingValue", path, dropped);
  else if (!isRecord(value)) report.error("invalidValue", path, dropped);
  else return value["type"] === "range" ? readRange(value, path, report, dropped) : readDateRule(value, path, report, dropped);
  return undefined;
}
