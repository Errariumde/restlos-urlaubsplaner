// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { Part, WorkWeekEntry } from "../counting/types";
import { MAX_YEAR, MIN_YEAR, WEEKDAYS, dayFromIso, type DayNumber, type Weekday } from "../days";
import { countries } from "../../data/holidays";
import { UNITS_PER_DAY, parseAmount, parseWeight, type Units } from "../weight";
import { LIMITS, textLength } from "./limits";
import { readMatch } from "./read-match";
import { Refused, Report, at, checkKeys, child, isPrototypeKey, isRecord, readChoice, readOptional, readRequired, type Parse } from "./report";
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

export const isoDay = (value: unknown): number | undefined => tryParse(dayFromIso, value);
export const weight = (value: unknown): Units | undefined => tryParse(parseWeight, value);
export const amount = (value: unknown): Units | undefined => tryParse(parseAmount, value);
/** A weight above 0. */
export const positiveWeight: Parse<Units> = (value) => {
  const units = weight(value);
  return units === 0 ? undefined : units;
};
export const parseId: Parse<string> = (value) => (isId(value) ? value : undefined);
/** A whole number from 1 that is still exact in JavaScript: a `revision`. */
export const parseRevision: Parse<number> = (value) => (typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : undefined);
const parseRecord: Parse<Readonly<Record<string, unknown>>> = (value) => (isRecord(value) ? value : undefined);
export const parseYear: Parse<number> = (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR ? value : undefined;
export const parsePart: Parse<Part> = (value) => (value === "start" || value === "end" ? value : undefined);

function limit(count: number, max: number, key: string, path: string): void {
  if (count > max) throw new Refused({ code: "limitExceeded", path, data: { limit: key } });
}

/**
 * Reads `contract.region`. The region, its `country` and a plan file's `state` where the country's data has
 * regions belong to the file itself: when one is missing or invalid, that is reported with `dropped: ""` and the
 * result is undefined. An invalid `country` decides how `state` and `options` are read: they are not checked.
 * Neither are the `options` of a plan file whose required `state` is missing or invalid.
 */
function readRegion(value: unknown, path: string, kind: "plan" | "ruleSet", report: Report): FileRegion | undefined {
  if (!isRecord(value)) {
    report.error(value === undefined ? "missingValue" : "invalidValue", path, "");
    return undefined;
  }
  const country = readRequired(
    value,
    "country",
    (code) => (typeof code === "string" && Object.hasOwn(countries, code) ? countries[code] : undefined),
    path,
    report,
    "",
  );
  checkKeys(value, ["country", "state", "options"], path, report);
  if (country === undefined) return undefined;

  // A plan needs the state wherever the country's data has states; a rule set may leave it to "New → From rule set".
  const stateRequired = kind === "plan" && country.regions.length > 0;
  const parseState: Parse<string> = (candidate) =>
    typeof candidate === "string" && country.regions.some((region) => region.id === candidate) ? candidate : undefined;
  const state = stateRequired
    ? readRequired(value, "state", parseState, path, report, "")
    : readOptional(value, "state", parseState, path, report, child(path, "state"));
  // The state decides which options exist: without a required one they are not checked.
  if (stateRequired && state === undefined) return undefined;

  let options: Record<string, boolean> | undefined;
  const optionsValue = value["options"];
  if (optionsValue !== undefined) {
    const optionsPath = child(path, "options");
    if (!isRecord(optionsValue)) {
      report.error("invalidValue", optionsPath, optionsPath);
    } else {
      const kept: [string, boolean][] = [];
      for (const key of Object.keys(optionsValue)) {
        const optionPath = child(optionsPath, key);
        const defined = state !== undefined && !isPrototypeKey(key) && country.localRules.some((rule) => rule.id === key && rule.regions.includes(state));
        const flag = optionsValue[key];
        if (!defined) report.error("unknownLocalRule", optionPath, optionPath);
        else if (typeof flag !== "boolean") report.error("invalidValue", optionPath, optionPath);
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
    report.notice("invalidMinUnit", path);
    return DEFAULT_MIN_UNIT;
  }
  return units;
}

/**
 * Reads `contract.week`, which belongs to the file itself: every problem of every entry is reported at its key
 * with `dropped: ""`, and the result is then undefined. An entry's `from` must be after the previous entry's;
 * that is checked only when both are valid dates.
 */
function readWeek(value: unknown, path: string, report: Report): WorkWeekEntry[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    report.error(value === undefined ? "missingValue" : "invalidValue", path, "");
    return undefined;
  }
  limit(value.length, LIMITS.weekEntries, "weekEntries", path);
  const week: WorkWeekEntry[] = [];
  let complete = true;
  let previous: DayNumber | undefined;
  for (let i = 0; i < value.length; i++) {
    const entryPath = at(path, i);
    const entry: unknown = value[i];
    if (!isRecord(entry)) {
      report.error("invalidValue", entryPath, "");
      complete = false;
      previous = undefined;
      continue;
    }
    const from = readRequired(entry, "from", isoDay, entryPath, report, "");
    const ordered = from === undefined || previous === undefined || from > previous;
    if (!ordered) report.error("invalidValue", child(entryPath, "from"), "");
    previous = from;

    const requiredValue = readRequired(entry, "required", parseRecord, entryPath, report, "");
    const requiredPath = child(entryPath, "required");
    const required = {} as Record<Weekday, Units>;
    let allDays = requiredValue !== undefined;
    if (requiredValue !== undefined) {
      for (const weekday of WEEKDAYS) {
        const units = readRequired(requiredValue, weekday, weight, requiredPath, report, "");
        if (units === undefined) allDays = false;
        else required[weekday] = units;
      }
      checkKeys(requiredValue, WEEKDAYS, requiredPath, report);
    }
    checkKeys(entry, ["from", "required"], entryPath, report);
    if (from === undefined || !ordered || !allDays) complete = false;
    else week.push({ from, required });
  }
  return complete ? week : undefined;
}

/** One entry of `contract.references`; every problem drops it. */
function readReference(key: string, value: unknown, path: string, report: Report): Reference | undefined {
  const validKey = isId(key) && !isPrototypeKey(key);
  if (!validKey || !isRecord(value)) report.error("invalidValue", path, path);
  if (!isRecord(value)) return undefined;
  const title = readText(value["title"], child(path, "title"), LIMITS.shortText, report, path);
  const version = readText(value["version"], child(path, "version"), LIMITS.shortText, report, path);
  const https = (url: unknown): string | undefined =>
    typeof url === "string" && url.startsWith("https://") && textLength(url) <= LIMITS.longText ? url : undefined;
  const url = readRequired(value, "url", https, path, report, path);
  const checked = readRequired(value, "checked", isoDay, path, report, path);
  checkKeys(value, ["title", "version", "url", "checked"], path, report);
  if (!validKey || title === undefined || version === undefined || url === undefined || checked === undefined) return undefined;
  return { title, version, url, checked };
}

function readReferences(value: unknown, path: string, report: Report): Record<string, Reference> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    report.error("invalidValue", path, path);
    return {};
  }
  const keys = Object.keys(value);
  limit(keys.length, LIMITS.references, "references", path);
  const kept: [string, Reference][] = [];
  for (const key of keys) {
    const reference = readReference(key, value[key], child(path, key), report);
    if (reference) kept.push([key, reference]);
  }
  return Object.fromEntries(kept);
}

const RULE_KEYS = [
  "id", "match", "requiredAtMost", "requiredExactly", "mandatory", "validFrom", "validUntil", "part",
  "label", "note", "references", "origin",
];
const EFFECTS = ["requiredAtMost", "requiredExactly", "mandatory"] as const;

/**
 * The citations of a rule: the keys `references` (the contract's) has. They are only shown, so a problem drops
 * only what it is in: a value that isn't a list drops the rule's `references`, and a citation that isn't a
 * string or that names a key the contract doesn't have drops only that citation.
 */
function readCitations(value: unknown, path: string, references: Readonly<Record<string, Reference>>, report: Report): string[] | undefined {
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, path);
    return undefined;
  }
  const citations: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const key: unknown = value[i];
    const citationPath = at(path, i);
    if (typeof key !== "string") report.error("invalidValue", citationPath, citationPath);
    else if (Object.hasOwn(references, key)) citations.push(key);
    else report.error("unknownReference", citationPath, citationPath, { reference: key.slice(0, LIMITS.shortText) });
  }
  return citations;
}

/**
 * Reads one day rule into `report`, the rule's own scratch report: every key in the writer's order, then
 * the unknown fields. Returns undefined when the rule is dropped. A duplicate `id` is read no further.
 * `label`, `note` and `references` are only shown: a problem in one of them drops only that key.
 */
function readRule(
  value: unknown,
  path: string,
  references: Readonly<Record<string, Reference>>,
  kind: "plan" | "ruleSet",
  ids: ReadonlySet<string>,
  report: Report,
): FileRule | undefined {
  if (!isRecord(value)) {
    report.error("invalidValue", path, path);
    return undefined;
  }
  const id = readRequired(value, "id", parseId, path, report, path);
  if (id !== undefined && ids.has(id)) {
    report.error("duplicateId", child(path, "id"), path);
    return undefined;
  }
  const origin = kind === "plan" ? readOptional(value, "origin", parseId, path, report, path) : undefined;
  const labelPath = child(path, "label");
  const label = value["label"] === undefined ? undefined : readText(value["label"], labelPath, LIMITS.shortText, report, labelPath);
  const match = readMatch(value["match"], child(path, "match"), report, path);
  const validFrom = readOptional(value, "validFrom", parseYear, path, report, path);
  const validUntil = readOptional(value, "validUntil", parseYear, path, report, path);
  if (validFrom !== undefined && validUntil !== undefined && validFrom > validUntil) report.error("invalidValue", child(path, "validUntil"), path);
  const effect = readChoice(value, EFFECTS, path, report, path);
  const units = effect === undefined ? undefined : readOptional(value, effect, effect === "mandatory" ? positiveWeight : weight, path, report, path);
  const part = readOptional(value, "part", parsePart, path, report, path);
  const notePath = child(path, "note");
  const note = value["note"] === undefined ? undefined : readText(value["note"], notePath, LIMITS.longText, report, notePath);
  const citations = value["references"] === undefined ? undefined : readCitations(value["references"], child(path, "references"), references, report);
  // Rule sets have no `origin`; there it counts as an unknown field.
  checkKeys(value, kind === "plan" ? RULE_KEYS : RULE_KEYS.filter((key) => key !== "origin"), path, report);
  if (report.drops(path) || id === undefined || match === undefined || effect === undefined || units === undefined) return undefined;

  const effects =
    effect === "requiredAtMost" ? { requiredAtMost: units } : effect === "requiredExactly" ? { requiredExactly: units } : { mandatory: units };
  return {
    id,
    match,
    ...effects,
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(validUntil !== undefined ? { validUntil } : {}),
    ...(part !== undefined ? { part } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(citations !== undefined ? { references: citations } : {}),
    ...(origin !== undefined ? { origin } : {}),
  };
}

function readRules(
  value: unknown,
  path: string,
  references: Readonly<Record<string, Reference>>,
  kind: "plan" | "ruleSet",
  report: Report,
  positions: Map<string, number>,
): FileRule[] {
  // `rules` is optional: missing it reads as empty; anything but a list is dropped and reads as empty too.
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, path);
    return [];
  }
  limit(value.length, LIMITS.rules, "rules", path);
  const rules: FileRule[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const scratch = new Report();
    const rule = readRule(value[i], at(path, i), references, kind, ids, scratch);
    report.merge(scratch, rule !== undefined);
    if (!rule) continue;
    ids.add(rule.id);
    positions.set(at(path, rules.length), i);
    rules.push(rule);
  }
  return rules;
}

/** What `readContract` gives: the contract, and the `minUnit` the plan's lists are read against. */
export interface ContractRead {
  /** Undefined when the contract, its region or its work week is missing or invalid (reported with `dropped: ""`). */
  readonly contract: FileContract | undefined;
  readonly minUnit: Units;
}

/**
 * Reads `contract`. A missing or invalid core value is reported with `dropped: ""`; a contract that isn't an
 * object is not read any further. Throws `Refused` only for counts over a limit.
 */
export function readContract(
  value: unknown,
  path: string,
  kind: "plan" | "ruleSet",
  report: Report,
  positions: Map<string, number> = new Map(),
): ContractRead {
  if (!isRecord(value)) {
    report.error(value === undefined ? "missingValue" : "invalidValue", path, "");
    return { contract: undefined, minUnit: DEFAULT_MIN_UNIT };
  }
  checkKeys(value, ["name", "description", "references", "region", "minUnit", "week", "rules"], path, report);
  const namePath = child(path, "name");
  const name = value["name"] === undefined ? undefined : readText(value["name"], namePath, LIMITS.shortText, report, namePath);
  const descriptionPath = child(path, "description");
  const description =
    value["description"] === undefined ? undefined : readText(value["description"], descriptionPath, LIMITS.longText, report, descriptionPath);
  const references = readReferences(value["references"], child(path, "references"), report);
  const region = readRegion(value["region"], child(path, "region"), kind, report);
  const minUnit = readMinUnit(value["minUnit"], child(path, "minUnit"), report);
  const week = readWeek(value["week"], child(path, "week"), report);
  const rules = readRules(value["rules"], child(path, "rules"), references, kind, report, positions);
  if (region === undefined || week === undefined) return { contract: undefined, minUnit };
  const contract: FileContract = {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    references,
    region,
    minUnit,
    week,
    rules,
  };
  return { contract, minUnit };
}
