// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { dayRuleWarnings } from "../counting/warnings";
import type { WorkWeekEntry } from "../counting/types";
import { MAX_YEAR, MIN_YEAR, WEEKDAYS, dayFromIso, type Weekday } from "../days";
import { countries } from "../../data/holidays";
import { UNITS_PER_DAY, parseWeight, type Units } from "../weight";
import { LIMITS, textLength } from "./limits";
import { readMatch } from "./read-match";
import { Refused, Report, at, checkKeys, child, isRecord } from "./report";
import { readText } from "./text";
import type { FileContract, FileRegion, FileRule, Reference } from "./types";

const DEFAULT_MIN_UNIT: Units = UNITS_PER_DAY / 2;

/** A non-empty string of at most 200 code points, for IDs. */
export const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && textLength(value) <= LIMITS.shortText;

function tryParse<T>(parse: (text: string) => T, value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return parse(value);
  } catch {
    return undefined;
  }
}

const isoDay = (value: unknown): number | undefined => tryParse(dayFromIso, value);
const weight = (value: unknown): Units | undefined => tryParse(parseWeight, value);

function limit(count: number, max: number, key: string, path: string): void {
  if (count > max) throw new Refused({ code: "limitExceeded", path, data: { limit: key } });
}

function readRegion(value: unknown, path: string, report: Report): FileRegion {
  if (!isRecord(value)) throw new Refused({ code: "invalidCore", path });
  const countryPath = child(path, "country");
  const country = typeof value["country"] === "string" ? countries[value["country"]] : undefined;
  if (!country || typeof value["country"] !== "string") throw new Refused({ code: "invalidCore", path: countryPath });
  checkKeys(value, ["country", "state", "options"], path, report);

  let state: string | undefined;
  if (value["state"] !== undefined) {
    const candidate = value["state"];
    if (typeof candidate === "string" && country.regions.some((region) => region.id === candidate)) state = candidate;
    else report.add("invalidEntry", child(path, "state"));
  }

  let options: Record<string, boolean> | undefined;
  const optionsValue = value["options"];
  if (optionsValue !== undefined) {
    const optionsPath = child(path, "options");
    if (!isRecord(optionsValue)) {
      report.add("invalidEntry", optionsPath);
    } else {
      const kept: [string, boolean][] = [];
      for (const key of Object.keys(optionsValue)) {
        const optionPath = child(optionsPath, key);
        const defined = state !== undefined && country.localRules.some((rule) => rule.id === key && rule.regions.includes(state));
        const flag = optionsValue[key];
        if (!defined) report.add("unknownLocalRule", optionPath);
        else if (typeof flag !== "boolean") report.add("invalidEntry", optionPath);
        else kept.push([key, flag]);
      }
      options = Object.fromEntries(kept);
    }
  }
  return { country: country.country, ...(state !== undefined ? { state } : {}), ...(options ? { options } : {}) };
}

function readMinUnit(value: unknown, path: string, report: Report): Units {
  if (value === undefined) return DEFAULT_MIN_UNIT;
  const units = weight(value);
  if (units === undefined || units < 1 || UNITS_PER_DAY % units !== 0) {
    report.add("invalidMinUnit", path);
    return DEFAULT_MIN_UNIT;
  }
  return units;
}

function readWeek(value: unknown, path: string, report: Report): WorkWeekEntry[] {
  const core = (): never => {
    throw new Refused({ code: "invalidCore", path });
  };
  if (!Array.isArray(value)) return core();
  limit(value.length, LIMITS.weekEntries, "weekEntries", path);
  if (value.length === 0) return core();
  const week: WorkWeekEntry[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry: unknown = value[i];
    if (!isRecord(entry) || !isRecord(entry["required"])) return core();
    const from = isoDay(entry["from"]);
    if (from === undefined) return core();
    if (week.length > 0 && from <= (week[week.length - 1]?.from ?? from)) return core();
    const requiredValue = entry["required"];
    const required = {} as Record<Weekday, Units>;
    for (const weekday of WEEKDAYS) {
      const units = weight(requiredValue[weekday]);
      if (units === undefined) return core();
      required[weekday] = units;
    }
    checkKeys(entry, ["from", "required"], at(path, i), report);
    checkKeys(requiredValue, WEEKDAYS, child(at(path, i), "required"), report);
    week.push({ from, required });
  }
  return week;
}

function readReferences(value: unknown, path: string, report: Report): Record<string, Reference> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    report.add("invalidEntry", path);
    return {};
  }
  const keys = Object.keys(value);
  limit(keys.length, LIMITS.references, "references", path);
  const kept: [string, Reference][] = [];
  for (const key of keys) {
    const entryPath = child(path, key);
    const entry = value[key];
    if (!isId(key) || !isRecord(entry)) {
      report.add("invalidEntry", entryPath);
      continue;
    }
    const checked = isoDay(entry["checked"]);
    const url = entry["url"];
    // Texts are read first so that their own problems are reported in file order.
    const title = readText(entry["title"], child(entryPath, "title"), LIMITS.shortText, report);
    const version = readText(entry["version"], child(entryPath, "version"), LIMITS.shortText, report);
    if (title === undefined || version === undefined) continue;
    if (checked === undefined || typeof url !== "string" || !url.startsWith("https://") || textLength(url) > LIMITS.longText) {
      report.add("invalidEntry", entryPath);
      continue;
    }
    checkKeys(entry, ["title", "version", "url", "checked"], entryPath, report);
    kept.push([key, { title, version, url, checked }]);
  }
  return Object.fromEntries(kept);
}

const RULE_KEYS = [
  "id", "match", "requiredAtMost", "requiredExactly", "mandatory", "validFrom", "validUntil", "part",
  "label", "note", "references", "origin",
];
const EFFECTS = ["requiredAtMost", "requiredExactly", "mandatory"] as const;

const isYear = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR;

/** Reads one day rule; reports and returns undefined when it must be dropped. */
function readRule(
  value: unknown,
  path: string,
  references: Readonly<Record<string, Reference>>,
  report: Report,
): FileRule | undefined {
  const fail = (field?: string): undefined => {
    report.add("invalidEntry", path, field === undefined ? undefined : { field });
    return undefined;
  };
  if (!isRecord(value)) return fail();
  if (!isId(value["id"])) return fail("id");
  const id = value["id"];

  const matchReport = new Report();
  const match = readMatch(value["match"], child(path, "match"), matchReport);
  if (!match) return fail(matchReport.entries[0]?.path.slice(path.length + 1) ?? "match");

  const present = EFFECTS.filter((effect) => value[effect] !== undefined);
  const effect = present[0];
  if (present.length !== 1 || effect === undefined) return fail("effect");
  const units = weight(value[effect]);
  if (units === undefined || (effect === "mandatory" && units === 0)) return fail(effect);

  const { validFrom, validUntil, part } = value;
  if (validFrom !== undefined && !isYear(validFrom)) return fail("validFrom");
  if (validUntil !== undefined && !isYear(validUntil)) return fail("validUntil");
  if (isYear(validFrom) && isYear(validUntil) && validFrom > validUntil) return fail("validUntil");
  if (part !== undefined && part !== "start" && part !== "end") return fail("part");
  if (value["origin"] !== undefined && !isId(value["origin"])) return fail("origin");

  let citations: string[] | undefined;
  const referencesValue = value["references"];
  if (referencesValue !== undefined) {
    if (!Array.isArray(referencesValue)) return fail("references");
    citations = [];
    for (let i = 0; i < referencesValue.length; i++) {
      const key: unknown = referencesValue[i];
      if (typeof key !== "string") return fail("references");
      if (Object.hasOwn(references, key)) citations.push(key);
      else report.add("unknownReference", at(child(path, "references"), i), { reference: key.slice(0, LIMITS.shortText) });
    }
  }

  // A text over its limit has been reported by readText; the rule goes with it (the design's table).
  const label = value["label"] === undefined ? undefined : readText(value["label"], child(path, "label"), LIMITS.shortText, report);
  if (value["label"] !== undefined && label === undefined) return undefined;
  const note = value["note"] === undefined ? undefined : readText(value["note"], child(path, "note"), LIMITS.longText, report);
  if (value["note"] !== undefined && note === undefined) return undefined;

  checkKeys(value, RULE_KEYS, path, report);
  report.entries.push(...matchReport.entries);
  const effects =
    effect === "requiredAtMost" ? { requiredAtMost: units } : effect === "requiredExactly" ? { requiredExactly: units } : { mandatory: units };
  const rule: FileRule = {
    id,
    match,
    ...effects,
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(validUntil !== undefined ? { validUntil } : {}),
    ...(part !== undefined ? { part } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(citations !== undefined ? { references: citations } : {}),
    ...(value["origin"] !== undefined ? { origin: value["origin"] } : {}),
  };
  for (const warning of dayRuleWarnings(rule)) report.add("ruleWarning", path, { warning: warning.code });
  return rule;
}

function readRules(value: unknown, path: string, references: Readonly<Record<string, Reference>>, report: Report): FileRule[] {
  if (!Array.isArray(value)) throw new Refused({ code: "invalidCore", path });
  limit(value.length, LIMITS.rules, "rules", path);
  const rules: FileRule[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const rulePath = at(path, i);
    const rule = readRule(value[i], rulePath, references, report);
    if (!rule) continue;
    if (ids.has(rule.id)) {
      report.add("duplicateId", child(rulePath, "id"));
      continue;
    }
    ids.add(rule.id);
    rules.push(rule);
  }
  return rules;
}

/** Reads `contract`. Throws `Refused` for core problems and for counts over a limit. */
export function readContract(value: unknown, path: string, _kind: "plan" | "ruleSet", report: Report): FileContract {
  if (!isRecord(value)) throw new Refused({ code: "invalidCore", path });
  checkKeys(value, ["name", "description", "references", "region", "minUnit", "week", "rules"], path, report);
  const name = value["name"] === undefined ? undefined : readText(value["name"], child(path, "name"), LIMITS.shortText, report);
  const description =
    value["description"] === undefined ? undefined : readText(value["description"], child(path, "description"), LIMITS.longText, report);
  const references = readReferences(value["references"], child(path, "references"), report);
  const region = readRegion(value["region"], child(path, "region"), report);
  const minUnit = readMinUnit(value["minUnit"], child(path, "minUnit"), report);
  const week = readWeek(value["week"], child(path, "week"), report);
  const rules = readRules(value["rules"], child(path, "rules"), references, report);
  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    references,
    region,
    minUnit,
    week,
    rules,
  };
}
