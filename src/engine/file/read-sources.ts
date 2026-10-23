// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber } from "../days";
import { UNITS_PER_DAY, type Units } from "../weight";
import { LIMITS } from "./limits";
import { isoDay, parseId, parsePart, parseRevision, parseYear, positiveWeight, weight } from "./read-contract";
import { readMatch } from "./read-match";
import { Refused, Report, at, checkKeys, child, isRecord, readChoice, readOptional, readRequired, type Parse } from "./report";
import { readText } from "./text";
import type { Color, FileSource, OtherPlanRef } from "./types";

type SourceType = FileSource["type"];
const TYPES: readonly SourceType[] = ["holiday", "paidClosure", "mandatory", "info", "otherPlan", "needed"];
const PERSONAL: readonly SourceType[] = ["otherPlan", "needed"];
const SLOT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RGB = /^#[0-9a-fA-F]{6}$/;

/** What `readEntry` produces before it is put into the typed source. */
interface ReadEntry {
  readonly date?: DayNumber;
  readonly from?: Units;
  readonly [key: string]: unknown;
}

const slot: Parse<string> = (value) => (typeof value === "string" && value.length <= LIMITS.shortText && SLOT.test(value) ? value : undefined);
const rgb: Parse<string> = (value) => (typeof value === "string" && RGB.test(value) ? value : undefined);
const spanKind: Parse<"leave" | "mandatory"> = (value) => (value === "leave" || value === "mandatory" ? value : undefined);
const parseBoolean: Parse<boolean> = (value) => (typeof value === "boolean" ? value : undefined);
const parseList: Parse<readonly unknown[]> = (value) => (Array.isArray(value) ? (value as unknown[]) : undefined);

/** A source's `color`: exactly one of `slot` and `rgb`. */
function readColor(value: unknown, path: string, report: Report, dropped: string): Color | undefined {
  if (value === undefined) report.error("missingValue", path, dropped);
  else if (!isRecord(value)) report.error("invalidValue", path, dropped);
  else {
    const key = readChoice(value, ["slot", "rgb"], path, report, dropped);
    const color = key === undefined ? undefined : readOptional(value, key, key === "slot" ? slot : rgb, path, report, dropped);
    checkKeys(value, ["slot", "rgb"], path, report);
    if (color !== undefined) return key === "slot" ? { slot: color } : { rgb: color };
  }
  return undefined;
}

/** A plan reference (`ruleSet`, or the `plan` of an `otherPlan` source); every problem drops `dropped`. */
export function readPlanRef(value: unknown, path: string, report: Report, dropped: string): OtherPlanRef | undefined {
  if (value === undefined) report.error("missingValue", path, dropped);
  else if (!isRecord(value)) report.error("invalidValue", path, dropped);
  else {
    const id = readRequired(value, "id", parseId, path, report, dropped);
    const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report, dropped);
    const revision = readRequired(value, "revision", parseRevision, path, report, dropped);
    checkKeys(value, ["id", "name", "revision"], path, report);
    if (id !== undefined && name !== undefined && revision !== undefined) return { id, name, revision };
  }
  return undefined;
}

/** Reads `except`: an invalid date drops only that date. */
function readExcept(value: unknown, path: string, report: Report, dropped: string): DayNumber[] | undefined {
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, dropped);
    return undefined;
  }
  const days: DayNumber[] = [];
  for (let i = 0; i < value.length; i++) {
    const day = isoDay(value[i]);
    if (day === undefined) report.error("invalidValue", at(path, i), at(path, i));
    else days.push(day);
  }
  return days;
}

const FIELDS: Readonly<Record<SourceType, readonly string[]>> = {
  holiday: ["required", "part"],
  paidClosure: [],
  mandatory: ["take", "part"],
  info: [],
  needed: ["take", "part"],
  otherPlan: ["from", "to", "kind"],
};
const MATCH_KEYS = ["match", "validFrom", "validUntil", "except"];

/**
 * Reads one entry of a source into `report`, the entry's own scratch report: every key in the writer's order,
 * then the unknown fields. Returns undefined when the entry is dropped. `name` is only shown: a problem in it
 * drops only the name.
 */
function readEntry(value: unknown, path: string, type: SourceType, report: Report): ReadEntry | undefined {
  if (!isRecord(value)) {
    report.error("invalidValue", path, path);
    return undefined;
  }
  const optional = <T>(key: string, parse: Parse<T>): T | undefined => readOptional(value, key, parse, path, report, path);
  const required = <T>(key: string, parse: Parse<T>): T | undefined => readRequired(value, key, parse, path, report, path);
  // An other-plan entry is always a date entry; the others have exactly one of `date` and `match`.
  const when = type === "otherPlan" ? "date" : readChoice(value, ["date", "match"], path, report, path);
  const date = when === "date" ? required("date", isoDay) : undefined;
  const match = when === "match" ? readMatch(value["match"], child(path, "match"), report, path) : undefined;
  let validFrom: number | undefined;
  let validUntil: number | undefined;
  let except: DayNumber[] | undefined;
  if (when === "match") {
    validFrom = optional("validFrom", parseYear);
    validUntil = optional("validUntil", parseYear);
    if (validFrom !== undefined && validUntil !== undefined && validFrom > validUntil) report.error("invalidValue", child(path, "validUntil"), path);
    if (value["except"] !== undefined) except = readExcept(value["except"], child(path, "except"), report, path);
  }
  const namePath = child(path, "name");
  const name = value["name"] === undefined ? undefined : readText(value["name"], namePath, LIMITS.shortText, report, namePath);

  const extra: Record<string, unknown> = {};
  if (type === "holiday") {
    extra["required"] = value["required"] === undefined ? 0 : optional("required", weight);
  } else if (type === "mandatory" || type === "needed") {
    extra["take"] = value["take"] === undefined ? UNITS_PER_DAY : optional("take", positiveWeight);
  } else if (type === "otherPlan") {
    const from = required("from", weight);
    const to = required("to", weight);
    if (from !== undefined && to !== undefined && to <= from) report.error("invalidValue", child(path, "to"), path);
    Object.assign(extra, { from, to, kind: required("kind", spanKind) });
  }
  if (FIELDS[type].includes("part") && value["part"] !== undefined) extra["part"] = optional("part", parsePart);

  // Without one of `date` and `match`, whether the match fields are allowed is not known: they are not checked.
  const whenKeys = type === "otherPlan" || when === "date" ? ["date"] : when === "match" ? MATCH_KEYS : ["date", ...MATCH_KEYS];
  checkKeys(value, [...whenKeys, "name", ...FIELDS[type]], path, report);
  if (report.drops(path) || (date === undefined && match === undefined)) return undefined;
  return {
    ...(date !== undefined ? { date } : {}),
    ...(match ? { match } : {}),
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(validUntil !== undefined ? { validUntil } : {}),
    ...(except ? { except } : {}),
    ...(name !== undefined ? { name } : {}),
    ...extra,
  };
}

/**
 * The canonical order of a source's entries, used by the reader and the writer: date entries by date
 * (other-plan entries then by `from`), then match entries in their list order.
 */
export function sortEntries<T extends object>(entries: readonly T[]): T[] {
  return sortedOrder(entries).map((index) => entries[index] as T);
}

/** The indexes of `entries` in the order `sortEntries` gives them. */
function sortedOrder(entries: readonly object[]): number[] {
  const field = (index: number, key: "date" | "from"): number | undefined => {
    const entry = entries[index] as Record<string, unknown>;
    return key in entry ? (entry[key] as number) : undefined;
  };
  const dated: number[] = [];
  const matched: number[] = [];
  for (let i = 0; i < entries.length; i++) (field(i, "date") !== undefined ? dated : matched).push(i);
  dated.sort((a, b) => (field(a, "date") ?? 0) - (field(b, "date") ?? 0) || (field(a, "from") ?? 0) - (field(b, "from") ?? 0));
  return [...dated, ...matched];
}

/**
 * The entries of a source in their canonical order, with their indexes in the text. Each entry is read into a
 * scratch report of its own and merged into `report`. Missing `entries` read as empty; anything but a list
 * drops the source. Without a `type` (missing, unknown, or a personal source in a rule set) the list is checked
 * but its entries are not read.
 */
function readSourceEntries(
  value: Readonly<Record<string, unknown>>,
  path: string,
  type: SourceType | undefined,
  report: Report,
): { readonly entries: readonly ReadEntry[]; readonly entryIndexes: readonly number[] } | undefined {
  const list = value["entries"] === undefined ? [] : readOptional(value, "entries", parseList, path, report, path);
  if (list === undefined) return undefined;
  const tooLarge = (limit: string): undefined => {
    report.error("sourceTooLarge", path, path, { limit });
    return undefined;
  };
  if (list.length > LIMITS.entriesPerSource) return tooLarge("entriesPerSource");
  if (type === undefined) return undefined;
  for (const entry of list) {
    if (isRecord(entry) && Array.isArray(entry["except"]) && entry["except"].length > LIMITS.exceptPerEntry) return tooLarge("exceptPerEntry");
  }

  const entriesPath = child(path, "entries");
  const entries: ReadEntry[] = [];
  const textIndexes: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const scratch = new Report();
    const entry = readEntry(list[i], at(entriesPath, i), type, scratch);
    report.merge(scratch, entry !== undefined);
    if (!entry) continue;
    entries.push(entry);
    textIndexes.push(i);
  }
  const order = sortedOrder(entries);
  return { entries: order.map((index) => entries[index] as ReadEntry), entryIndexes: order.map((index) => textIndexes[index] as number) };
}

/**
 * Reads one source into `report`, the source's own scratch report: every key in the writer's order, then the
 * unknown fields. Returns undefined when the source is dropped. A duplicate `id` is read no further. A missing
 * `visible` reads as `true`.
 */
function readSource(
  value: unknown,
  path: string,
  kind: "plan" | "ruleSet",
  ids: ReadonlySet<string>,
  report: Report,
): { readonly source: FileSource; readonly entryIndexes: readonly number[] } | undefined {
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
  const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report, path);
  const type = readRequired(value, "type", (item) => TYPES.find((candidate) => candidate === item), path, report, path);
  const personal = type !== undefined && kind === "ruleSet" && PERSONAL.includes(type);
  if (personal) report.error("personalSourceInRuleSet", path, path, { type });
  const color = readColor(value["color"], child(path, "color"), report, path);
  const visible = value["visible"] === undefined ? true : readOptional(value, "visible", parseBoolean, path, report, path);
  const plan = type === "otherPlan" ? readPlanRef(value["plan"], child(path, "plan"), report, path) : undefined;
  const read = readSourceEntries(value, path, personal ? undefined : type, report);
  // Rule sets have no `origin`. `plan` belongs to other-plan sources; for a source without a known type it is not checked.
  const planKeys = type === undefined || type === "otherPlan" ? ["plan"] : [];
  checkKeys(value, ["id", "name", "type", "color", "visible", "entries", ...(kind === "plan" ? ["origin"] : []), ...planKeys], path, report);
  if (report.drops(path) || id === undefined || name === undefined || type === undefined || color === undefined || visible === undefined) return undefined;
  if (!read || (type === "otherPlan" && !plan)) return undefined;
  const source = {
    id,
    name,
    type,
    color,
    visible,
    ...(origin !== undefined ? { origin } : {}),
    ...(plan ? { plan } : {}),
    entries: read.entries,
  };
  return { source: source as FileSource, entryIndexes: read.entryIndexes };
}

/**
 * Reads `sources`. A missing list reads as empty. Anything but a list is dropped and reads as empty too; more
 * than 50 sources are refused. Invalid sources and entries are dropped one by one with a report entry.
 */
export function readSources(
  value: unknown,
  path: string,
  kind: "plan" | "ruleSet",
  report: Report,
  positions: Map<string, number> = new Map(),
): FileSource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, path);
    return [];
  }
  if (value.length > LIMITS.sources) throw new Refused({ code: "limitExceeded", path, data: { limit: "sources" } });
  const sources: FileSource[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const scratch = new Report();
    const read = readSource(value[i], at(path, i), kind, ids, scratch);
    report.merge(scratch, read !== undefined);
    if (!read) continue;
    ids.add(read.source.id);
    const sourcePath = at(path, sources.length);
    positions.set(sourcePath, i);
    const entriesPath = child(sourcePath, "entries");
    read.entryIndexes.forEach((textIndex, loaded) => positions.set(at(entriesPath, loaded), textIndex));
    sources.push(read.source);
  }
  return sources;
}
