// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { MAX_YEAR, MIN_YEAR, WEEKDAYS, dayFromIso, daysInMonth } from "../days";
import { parseWeight } from "../weight";

export interface ValidationIssue {
  path: string;
  message: string;
}

type Obj = Record<string, unknown>;

const NON_LEAP = ["drop", "feb28", "mar1"];
const RELATIONS = ["before", "onOrBefore", "after", "onOrAfter"];
const NTH_VALUES = [1, 2, 3, 4, -1];
const MAX_OFFSET = 200;
// 2000 is a leap year, 2001 is not.
const LEAP_YEAR = 2000;
const COMMON_YEAR = 2001;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sub(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function at(path: string, index: number): string {
  return `${path}[${String(index)}]`;
}

class Checker {
  readonly issues: ValidationIssue[] = [];

  report(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  /** Returns the value as an object, or reports and returns undefined. */
  object(value: unknown, path: string): Obj | undefined {
    if (isObj(value)) return value;
    this.report(path, "must be an object");
    return undefined;
  }

  array(value: unknown, path: string): unknown[] | undefined {
    if (Array.isArray(value)) return value as unknown[];
    this.report(path, "must be an array");
    return undefined;
  }

  unknownKeys(obj: Obj, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) this.report(sub(path, key), "unknown key");
    }
  }

  nonEmptyString(value: unknown, path: string): value is string {
    if (typeof value === "string" && value !== "") return true;
    this.report(path, "must be a non-empty string");
    return false;
  }

  weekday(value: unknown, path: string): boolean {
    if (typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value)) return true;
    this.report(path, `must be one of ${WEEKDAYS.join(", ")}`);
    return false;
  }

  isoDate(value: unknown, path: string): void {
    try {
      if (typeof value !== "string") throw new RangeError("not a string");
      dayFromIso(value);
    } catch {
      this.report(path, "must be a valid ISO date (YYYY-MM-DD)");
    }
  }

  integerInRange(value: unknown, min: number, max: number, path: string): value is number {
    if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) return true;
    this.report(path, `must be an integer from ${String(min)} to ${String(max)}`);
    return false;
  }

  /** Checks a list of IDs against a known set; returns the valid string entries. */
  idList(value: unknown, known: ReadonlySet<string>, what: string, path: string): string[] {
    const list = this.array(value, path);
    if (!list) return [];
    if (list.length === 0) this.report(path, "must not be empty");
    const result: string[] = [];
    list.forEach((entry, i) => {
      if (typeof entry === "string" && known.has(entry)) {
        if (result.includes(entry)) this.report(at(path, i), `duplicate ${what}`);
        else result.push(entry);
      } else this.report(at(path, i), `unknown ${what}`);
    });
    return result;
  }
}

function checkHeader(c: Checker, data: Obj): void {
  if (data["schema"] !== 1) c.report("schema", "must be 1");
  if (typeof data["country"] !== "string" || !/^[A-Z]{2}$/.test(data["country"])) {
    c.report("country", "must be two uppercase letters");
  }
  c.nonEmptyString(data["nameKey"], "nameKey");
}

function checkWeek(c: Checker, data: Obj): void {
  c.weekday(data["weekStart"], "weekStart");

  const weekend = c.array(data["weekend"], "weekend");
  if (weekend) {
    if (weekend.length === 0) c.report("weekend", "must not be empty");
    // Substitute days would never be found if every weekday were a weekend day.
    if (WEEKDAYS.every((day) => weekend.includes(day))) c.report("weekend", "must leave at least one weekday free");
    const seen = new Set<unknown>();
    weekend.forEach((day, i) => {
      c.weekday(day, at("weekend", i));
      if (seen.has(day)) c.report(at("weekend", i), "duplicate weekday");
      seen.add(day);
    });
  }

  const workWeek = c.object(data["workWeek"], "workWeek");
  if (!workWeek) return;
  c.unknownKeys(workWeek, WEEKDAYS, "workWeek");
  for (const day of WEEKDAYS) {
    const path = sub("workWeek", day);
    const weight = workWeek[day];
    if (typeof weight !== "string") {
      c.report(path, "must be a weight string");
      continue;
    }
    try {
      parseWeight(weight);
    } catch {
      c.report(path, "must be a valid weight");
    }
  }
}

function checkSources(c: Checker, data: Obj): Set<string> {
  const ids = new Set<string>();
  const sources = c.object(data["sources"], "sources");
  if (!sources) return ids;
  for (const [id, value] of Object.entries(sources)) {
    ids.add(id);
    const path = sub("sources", id);
    const source = c.object(value, path);
    if (!source) continue;
    c.unknownKeys(source, ["title", "url", "checked"], path);
    c.nonEmptyString(source["title"], sub(path, "title"));
    const url = source["url"];
    if (typeof url !== "string" || !url.startsWith("https://")) {
      c.report(sub(path, "url"), "must be a string starting with https://");
    }
    c.isoDate(source["checked"], sub(path, "checked"));
  }
  return ids;
}

function checkRegions(c: Checker, data: Obj): Set<string> {
  const ids = new Set<string>();
  const regions = c.array(data["regions"], "regions");
  if (!regions) return ids;
  if (regions.length === 0) c.report("regions", "must not be empty");
  regions.forEach((value, i) => {
    const path = at("regions", i);
    const region = c.object(value, path);
    if (!region) return;
    c.unknownKeys(region, ["id", "nameKey"], path);
    c.nonEmptyString(region["nameKey"], sub(path, "nameKey"));
    const id = region["id"];
    if (!c.nonEmptyString(id, sub(path, "id"))) return;
    if (ids.has(id)) c.report(sub(path, "id"), "duplicate id");
    ids.add(id);
  });
  return ids;
}

/** Validates a list of source references and records which sources are used. */
function checkSourceRefs(c: Checker, value: unknown, path: string, sourceIds: Set<string>, used: Set<string>): void {
  for (const id of c.idList(value, sourceIds, "source", path)) used.add(id);
}

function checkLocalRules(
  c: Checker,
  data: Obj,
  regionIds: Set<string>,
  sourceIds: Set<string>,
  used: Set<string>,
): Map<string, string[]> {
  const known = new Map<string, string[]>();
  const rules = c.array(data["localRules"], "localRules");
  if (!rules) return known;
  rules.forEach((value, i) => {
    const path = at("localRules", i);
    const rule = c.object(value, path);
    if (!rule) return;
    c.unknownKeys(rule, ["id", "regions", "nameKey", "explanationKey", "sources"], path);
    c.nonEmptyString(rule["nameKey"], sub(path, "nameKey"));
    c.nonEmptyString(rule["explanationKey"], sub(path, "explanationKey"));
    const regions = c.idList(rule["regions"], regionIds, "region", sub(path, "regions"));
    checkSourceRefs(c, rule["sources"], sub(path, "sources"), sourceIds, used);
    const id = rule["id"];
    if (!c.nonEmptyString(id, sub(path, "id"))) return;
    // A duplicate keeps the first definition, so holidays are checked against one set of regions.
    if (known.has(id)) c.report(sub(path, "id"), "duplicate id");
    else known.set(id, regions);
  });
  return known;
}

function checkDate(c: Checker, value: unknown, path: string): void {
  const date = c.object(value, path);
  if (!date) return;
  const typePath = sub(path, "type");
  const month = (): number | undefined =>
    c.integerInRange(date["month"], 1, 12, sub(path, "month")) ? date["month"] : undefined;
  const weekday = (): void => void c.weekday(date["weekday"], sub(path, "weekday"));
  const offset = (): void => void c.integerInRange(date["offset"], -MAX_OFFSET, MAX_OFFSET, sub(path, "offset"));
  /** A day that exists in every year, i.e. never 02-29. */
  const everyYearDay = (m: number | undefined): void => {
    const max = m === undefined ? 31 : daysInMonth(COMMON_YEAR, m);
    c.integerInRange(date["day"], 1, max, sub(path, "day"));
  };

  switch (date["type"]) {
    case "fixed": {
      c.unknownKeys(date, ["type", "month", "day", "nonLeap"], path);
      const m = month();
      const max = m === undefined ? 31 : daysInMonth(LEAP_YEAR, m);
      const dayOk = c.integerInRange(date["day"], 1, max, sub(path, "day"));
      const leapDay = m === 2 && dayOk && date["day"] === 29;
      const nonLeap = date["nonLeap"];
      if (leapDay && (typeof nonLeap !== "string" || !NON_LEAP.includes(nonLeap))) {
        c.report(sub(path, "nonLeap"), `required for 02-29, one of ${NON_LEAP.join(", ")}`);
      } else if (!leapDay && nonLeap !== undefined) {
        c.report(sub(path, "nonLeap"), "only allowed for 02-29");
      }
      return;
    }
    case "easter":
    case "orthodoxEaster":
      c.unknownKeys(date, ["type", "offset"], path);
      offset();
      return;
    case "weekdayRelative":
      c.unknownKeys(date, ["type", "weekday", "relation", "month", "day"], path);
      weekday();
      if (typeof date["relation"] !== "string" || !RELATIONS.includes(date["relation"])) {
        c.report(sub(path, "relation"), `must be one of ${RELATIONS.join(", ")}`);
      }
      everyYearDay(month());
      return;
    case "nthWeekday":
      c.unknownKeys(date, ["type", "month", "weekday", "n"], path);
      month();
      weekday();
      if (typeof date["n"] !== "number" || !NTH_VALUES.includes(date["n"])) {
        c.report(sub(path, "n"), `must be one of ${NTH_VALUES.join(", ")}`);
      }
      return;
    case "once":
      c.unknownKeys(date, ["type", "date"], path);
      c.isoDate(date["date"], sub(path, "date"));
      return;
    default:
      c.report(typePath, "unknown date type");
  }
}

interface HolidayContext {
  regionIds: Set<string>;
  sourceIds: Set<string>;
  localRules: Map<string, string[]>;
  weekend: unknown[];
  used: Set<string>;
}

function checkHolidayRegions(c: Checker, rule: Obj, path: string, ctx: HolidayContext): void {
  const regionsPath = sub(path, "regions");
  const value = rule["regions"];
  let regions: string[];
  if (value === "all") regions = [...ctx.regionIds];
  else regions = c.idList(value, ctx.regionIds, "region", regionsPath);

  const localRule = rule["localRule"];
  if (localRule === undefined) return;
  const allowed = typeof localRule === "string" ? ctx.localRules.get(localRule) : undefined;
  if (!allowed) {
    c.report(sub(path, "localRule"), "unknown local rule");
  } else if (regions.some((r) => !allowed.includes(r))) {
    c.report(regionsPath, "must lie within the regions of the local rule");
  }
}

function checkHoliday(c: Checker, value: unknown, path: string, ctx: HolidayContext, ids: Set<string>): void {
  const rule = c.object(value, path);
  if (!rule) return;
  c.unknownKeys(
    rule,
    ["id", "nameKey", "date", "regions", "localRule", "validFrom", "validUntil", "substitute", "sources"],
    path,
  );
  const id = rule["id"];
  if (c.nonEmptyString(id, sub(path, "id"))) {
    if (ids.has(id)) c.report(sub(path, "id"), "duplicate id");
    ids.add(id);
  }
  c.nonEmptyString(rule["nameKey"], sub(path, "nameKey"));
  checkDate(c, rule["date"], sub(path, "date"));
  checkHolidayRegions(c, rule, path, ctx);

  const from = rule["validFrom"];
  const until = rule["validUntil"];
  const fromOk = from === undefined || c.integerInRange(from, MIN_YEAR, MAX_YEAR, sub(path, "validFrom"));
  const untilOk = until === undefined || c.integerInRange(until, MIN_YEAR, MAX_YEAR, sub(path, "validUntil"));
  if (fromOk && untilOk && typeof from === "number" && typeof until === "number" && from > until) {
    c.report(sub(path, "validUntil"), "must not be before validFrom");
  }

  const substitute = rule["substitute"];
  if (substitute !== undefined) {
    const subPath = sub(path, "substitute");
    const obj = c.object(substitute, subPath);
    if (obj) {
      c.unknownKeys(obj, ["when"], subPath);
      const whenPath = sub(subPath, "when");
      const when = c.array(obj["when"], whenPath);
      if (when) {
        if (when.length === 0) c.report(whenPath, "must not be empty");
        when.forEach((day, i) => {
          if (!c.weekday(day, at(whenPath, i))) return;
          if (!ctx.weekend.includes(day)) c.report(at(whenPath, i), "must be a weekend day of the country");
          if (when.indexOf(day) < i) c.report(at(whenPath, i), "duplicate weekday");
        });
      }
    }
  }

  checkSourceRefs(c, rule["sources"], sub(path, "sources"), ctx.sourceIds, ctx.used);
}

const ROOT_KEYS = [
  "schema", "country", "nameKey", "weekStart", "weekend", "workWeek",
  "sources", "regions", "localRules", "holidays",
];

/** Checks country data of unknown origin; returns the problems found (empty = valid). Never throws. */
export function validateCountryData(input: unknown): ValidationIssue[] {
  const c = new Checker();
  if (!isObj(input)) {
    c.report("", "must be an object");
    return c.issues;
  }
  c.unknownKeys(input, ROOT_KEYS, "");
  checkHeader(c, input);
  checkWeek(c, input);
  const sourceIds = checkSources(c, input);
  const regionIds = checkRegions(c, input);
  const used = new Set<string>();
  const localRules = checkLocalRules(c, input, regionIds, sourceIds, used);

  const holidays = c.array(input["holidays"], "holidays");
  if (holidays) {
    const ctx: HolidayContext = {
      regionIds,
      sourceIds,
      localRules,
      weekend: Array.isArray(input["weekend"]) ? (input["weekend"] as unknown[]) : [],
      used,
    };
    const ids = new Set<string>();
    holidays.forEach((rule, i) => { checkHoliday(c, rule, at("holidays", i), ctx, ids); });
  }

  for (const id of sourceIds) {
    if (!used.has(id)) c.report(sub("sources", id), "source is not referenced by any rule");
  }
  return c.issues;
}
