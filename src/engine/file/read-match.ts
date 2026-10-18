// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_RANGE_DAYS } from "../counting/match";
import type { DayMatch, RangeMatch } from "../counting/types";
import { WEEKDAYS, dayFromIso, daysInMonth, type Weekday } from "../days";
import type { DateRule } from "../holidays/types";
import { at, checkKeys, child, isRecord, type Report } from "./report";

const LEAP_YEAR = 2000;
const MAX_EASTER_OFFSET = 366;
const RELATIONS = ["before", "onOrBefore", "after", "onOrAfter"] as const;
const NON_LEAP = ["drop", "feb28", "mar1"] as const;
const NTH = [1, 2, 3, 4, -1] as const;

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isWeekday = (value: unknown): value is Weekday => typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
const isOneOf = <T extends string | number>(list: readonly T[], value: unknown): value is T => list.some((item) => item === value);

function validMonthDay(month: unknown, day: unknown): month is number {
  return isInt(month) && isInt(day) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(LEAP_YEAR, month);
}

function isoDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    dayFromIso(value);
    return true;
  } catch {
    return false;
  }
}

/** One of the six date rules; reports `invalidEntry` at the first problem and returns undefined. */
function readDateRule(value: Readonly<Record<string, unknown>>, path: string, report: Report): DateRule | undefined {
  const bad = (key?: string): undefined => {
    report.add("invalidEntry", key === undefined ? path : child(path, key));
    return undefined;
  };
  switch (value["type"]) {
    case "fixed": {
      const { month, day, nonLeap } = value;
      if (!validMonthDay(month, day)) return bad(isInt(month) && month >= 1 && month <= 12 ? "day" : "month");
      const feb29 = month === 2 && day === 29;
      if (feb29 !== (nonLeap !== undefined)) return bad("nonLeap");
      if (feb29 && !isOneOf(NON_LEAP, nonLeap)) return bad("nonLeap");
      checkKeys(value, ["type", "month", "day", "nonLeap"], path, report);
      return feb29 && isOneOf(NON_LEAP, nonLeap) ? { type: "fixed", month, day, nonLeap } : { type: "fixed", month, day: day as number };
    }
    case "easter":
    case "orthodoxEaster": {
      const { offset } = value;
      if (!isInt(offset) || Math.abs(offset) > MAX_EASTER_OFFSET) return bad("offset");
      checkKeys(value, ["type", "offset"], path, report);
      return { type: value["type"], offset };
    }
    case "weekdayRelative": {
      const { weekday, relation, month, day } = value;
      if (!isWeekday(weekday)) return bad("weekday");
      if (!isOneOf(RELATIONS, relation)) return bad("relation");
      if (!validMonthDay(month, day) || (month === 2 && day === 29)) return bad(isInt(month) && month >= 1 && month <= 12 ? "day" : "month");
      checkKeys(value, ["type", "weekday", "relation", "month", "day"], path, report);
      return { type: "weekdayRelative", weekday, relation, month, day: day as number };
    }
    case "nthWeekday": {
      const { month, weekday, n } = value;
      if (!isInt(month) || month < 1 || month > 12) return bad("month");
      if (!isWeekday(weekday)) return bad("weekday");
      if (!isOneOf(NTH, n)) return bad("n");
      checkKeys(value, ["type", "month", "weekday", "n"], path, report);
      return { type: "nthWeekday", month, weekday, n };
    }
    case "once": {
      if (!isoDate(value["date"])) return bad("date");
      checkKeys(value, ["type", "date"], path, report);
      return { type: "once", date: value["date"] as string };
    }
    default:
      return bad("type");
  }
}

function readRange(value: Readonly<Record<string, unknown>>, path: string, report: Report): RangeMatch | undefined {
  const bad = (key: string): undefined => {
    report.add("invalidEntry", child(path, key));
    return undefined;
  };
  const fromPath = child(path, "from");
  const from = value["from"];
  if (!isRecord(from) || from["type"] === "range") return bad("from");
  const toValue = value["to"];
  const days = value["days"];
  if ((toValue === undefined) === (days === undefined)) return bad(toValue === undefined ? "days" : "to");
  if (days !== undefined && (!isInt(days) || days < 1 || days > MAX_RANGE_DAYS)) return bad("days");
  const weekdays = value["weekdays"];
  if (weekdays !== undefined) {
    if (!Array.isArray(weekdays) || weekdays.length === 0) return bad("weekdays");
    const seen = new Set<unknown>();
    for (let i = 0; i < weekdays.length; i++) {
      const weekday: unknown = weekdays[i];
      if (!isWeekday(weekday) || seen.has(weekday)) {
        report.add("invalidEntry", at(child(path, "weekdays"), i));
        return undefined;
      }
      seen.add(weekday);
    }
  }
  checkKeys(value, ["type", "from", "to", "days", "weekdays"], path, report);
  const fromRule = readDateRule(from, fromPath, report);
  if (!fromRule) return undefined;
  let toRule: DateRule | undefined;
  if (toValue !== undefined) {
    if (!isRecord(toValue) || toValue["type"] === "range") return bad("to");
    toRule = readDateRule(toValue, child(path, "to"), report);
    if (!toRule) return undefined;
  }
  return {
    type: "range",
    from: fromRule,
    ...(toRule ? { to: toRule } : {}),
    ...(isInt(days) ? { days } : {}),
    ...(weekdays !== undefined ? { weekdays: weekdays as Weekday[] } : {}),
  };
}

/**
 * A `match`: one of the six date rules or a range. On a problem it reports `invalidEntry` at the
 * path of the first offending value (more precisely than `path`) and returns undefined.
 */
export function readMatch(value: unknown, path: string, report: Report): DayMatch | undefined {
  if (!isRecord(value)) {
    report.add("invalidEntry", path);
    return undefined;
  }
  return value["type"] === "range" ? readRange(value, path, report) : readDateRule(value, path, report);
}
