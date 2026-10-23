// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { dayRuleWarningsMemo, type RuleWarningCheck } from "../counting/warnings";
import type { DayMatch, Part } from "../counting/types";
import { MAX_YEAR, MIN_YEAR, type DayNumber } from "../days";
import { UNITS_PER_DAY, type Units } from "../weight";
import { LIMITS } from "./limits";
import { isId, isoDay, weight } from "./read-contract";
import { readMatch } from "./read-match";
import { Refused, Report, at, checkKeys, child, isRecord } from "./report";
import { readText } from "./text";
import type { Color, FileSource, OtherPlanRef, Text } from "./types";

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

const isYear = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR;

function readColor(value: unknown, path: string, report: Report): Color | undefined {
  if (isRecord(value)) {
    const { slot, rgb } = value;
    if (typeof slot === "string" && rgb === undefined && SLOT.test(slot) && slot.length <= LIMITS.shortText) {
      checkKeys(value, ["slot"], path, report);
      return { slot };
    }
    if (typeof rgb === "string" && slot === undefined && RGB.test(rgb)) {
      checkKeys(value, ["rgb"], path, report);
      return { rgb };
    }
  }
  report.add("invalidEntry", path);
  return undefined;
}

export function readPlanRef(value: unknown, path: string, report: Report): OtherPlanRef | undefined {
  if (isRecord(value)) {
    const { id, revision } = value;
    const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report);
    if (name !== undefined && isId(id) && typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 1) {
      checkKeys(value, ["id", "name", "revision"], path, report);
      return { id, name, revision };
    }
    if (name === undefined) return undefined;
  }
  report.add("invalidEntry", path);
  return undefined;
}

/** Reads `except`: invalid dates are dropped one by one. */
function readExcept(value: unknown, path: string, report: Report): DayNumber[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const days: DayNumber[] = [];
  for (let i = 0; i < value.length; i++) {
    const day = isoDay(value[i]);
    if (day === undefined) report.add("invalidEntry", at(path, i));
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

/** Reads one entry of a source; reports and returns undefined when it must be dropped. */
function readEntry(
  value: unknown,
  path: string,
  type: SourceType,
  sourceId: string,
  report: Report,
  warnings: RuleWarningCheck,
): ReadEntry | undefined {
  const fail = (field?: string): undefined => {
    report.add("invalidEntry", path, field === undefined ? undefined : { field });
    return undefined;
  };
  if (!isRecord(value)) return fail();
  const hasDate = value["date"] !== undefined;
  const hasMatch = value["match"] !== undefined;
  if (hasDate === hasMatch) return fail(hasDate ? "match" : "date");
  if (type === "otherPlan" && hasMatch) return fail("match");

  const matchReport = new Report();
  let date: DayNumber | undefined;
  let match: DayMatch | undefined;
  if (hasDate) {
    date = isoDay(value["date"]);
    if (date === undefined) return fail("date");
  } else {
    match = readMatch(value["match"], child(path, "match"), matchReport);
    if (!match) return fail(matchReport.entries[0]?.path.slice(path.length + 1) ?? "match");
  }

  const { validFrom, validUntil } = value;
  let except: DayNumber[] | undefined;
  if (match) {
    if (validFrom !== undefined && !isYear(validFrom)) return fail("validFrom");
    if (validUntil !== undefined && !isYear(validUntil)) return fail("validUntil");
    if (isYear(validFrom) && isYear(validUntil) && validFrom > validUntil) return fail("validUntil");
    if (value["except"] !== undefined) {
      except = readExcept(value["except"], child(path, "except"), report);
      if (except === undefined) return fail("except");
    }
  }

  const extra: Record<string, unknown> = {};
  if (type === "holiday") {
    const required = value["required"] === undefined ? 0 : weight(value["required"]);
    if (required === undefined) return fail("required");
    extra["required"] = required;
  } else if (type === "mandatory" || type === "needed") {
    const take = value["take"] === undefined ? UNITS_PER_DAY : weight(value["take"]);
    if (take === undefined || take === 0) return fail("take");
    extra["take"] = take;
  } else if (type === "otherPlan") {
    const from = weight(value["from"]);
    const to = weight(value["to"]);
    if (from === undefined) return fail("from");
    if (to === undefined || to <= from) return fail("to");
    const kind = value["kind"];
    if (kind !== "leave" && kind !== "mandatory") return fail("kind");
    Object.assign(extra, { from, to, kind });
  }
  if (FIELDS[type].includes("part") && value["part"] !== undefined) {
    const part = value["part"];
    if (part !== "start" && part !== "end") return fail("part");
    extra["part"] = part satisfies Part;
  }

  let name: Text | undefined;
  if (value["name"] !== undefined) {
    name = readText(value["name"], child(path, "name"), LIMITS.shortText, report);
    if (name === undefined) return undefined;
  }

  const allowed = ["name", ...FIELDS[type], ...(type === "otherPlan" ? ["date"] : match ? ["match", "validFrom", "validUntil", "except"] : ["date"])];
  checkKeys(value, allowed, path, report);
  report.entries.push(...matchReport.entries);

  const entry: ReadEntry = {
    ...(date !== undefined ? { date } : {}),
    ...(match ? { match } : {}),
    ...(match && validFrom !== undefined ? { validFrom } : {}),
    ...(match && validUntil !== undefined ? { validUntil } : {}),
    ...(except ? { except } : {}),
    ...(name !== undefined ? { name } : {}),
    ...extra,
  };
  if (match) {
    const rule = { id: sourceId, match, ...(isYear(validFrom) ? { validFrom } : {}), ...(isYear(validUntil) ? { validUntil } : {}), requiredAtMost: 0 };
    for (const warning of warnings(rule)) report.add("ruleWarning", path, { warning: warning.code });
  }
  return entry;
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

function readSource(
  value: unknown,
  path: string,
  kind: "plan" | "ruleSet",
  seen: ReadonlySet<string>,
  report: Report,
  warnings: RuleWarningCheck,
): { readonly source: FileSource; readonly entryIndexes: readonly number[] } | undefined {
  const fail = (field: string): undefined => {
    report.add("invalidEntry", child(path, field));
    return undefined;
  };
  if (!isRecord(value)) {
    report.add("invalidEntry", path);
    return undefined;
  }
  const type = TYPES.find((candidate) => candidate === value["type"]);
  if (type === undefined) return fail("type");
  if (kind === "ruleSet" && PERSONAL.includes(type)) {
    report.add("personalSourceInRuleSet", path, { type });
    return undefined;
  }
  const id = value["id"];
  if (!isId(id)) return fail("id");
  if (seen.has(id)) {
    report.add("duplicateId", child(path, "id"));
    return undefined;
  }
  const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report);
  if (name === undefined) return undefined;
  const color = readColor(value["color"], child(path, "color"), report);
  if (!color) return undefined;
  if (typeof value["visible"] !== "boolean") return fail("visible");
  const originValue = value["origin"];
  if (kind === "plan" && originValue !== undefined && !isId(originValue)) return fail("origin");
  const origin = kind === "plan" && isId(originValue) ? originValue : undefined;
  let plan: OtherPlanRef | undefined;
  if (type === "otherPlan") {
    plan = readPlanRef(value["plan"], child(path, "plan"), report);
    if (!plan) return undefined;
  }

  const entriesPath = child(path, "entries");
  const list = value["entries"];
  if (!Array.isArray(list)) return fail("entries");
  const tooLarge = (data: Record<string, number | string>): undefined => {
    report.add("sourceTooLarge", path, data);
    return undefined;
  };
  if (list.length > LIMITS.entriesPerSource) return tooLarge({ limit: "entriesPerSource" });
  for (const entry of list as unknown[]) {
    if (isRecord(entry) && Array.isArray(entry["except"]) && entry["except"].length > LIMITS.exceptPerEntry) return tooLarge({ limit: "exceptPerEntry" });
  }

  const entries: ReadEntry[] = [];
  const textIndexes: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const entry = readEntry(list[i], at(entriesPath, i), type, id, report, warnings);
    if (!entry) continue;
    entries.push(entry);
    textIndexes.push(i);
  }
  const order = sortedOrder(entries);
  checkKeys(value, ["id", "name", "type", "color", "visible", "entries", ...(kind === "plan" ? ["origin"] : []), ...(type === "otherPlan" ? ["plan"] : [])], path, report);
  const source = {
    id,
    name,
    type,
    color,
    visible: value["visible"],
    ...(origin !== undefined ? { origin } : {}),
    ...(plan ? { plan } : {}),
    entries: order.map((index) => entries[index] as ReadEntry),
  };
  return { source: source as FileSource, entryIndexes: order.map((index) => textIndexes[index] as number) };
}

/**
 * Reads `sources`. A missing list reads as empty; anything but a list, or more than 50 sources, is refused.
 * Invalid sources and entries are dropped one by one with a report entry.
 */
export function readSources(
  value: unknown,
  path: string,
  kind: "plan" | "ruleSet",
  report: Report,
  warnings: RuleWarningCheck = dayRuleWarningsMemo(),
  positions: Map<string, number> = new Map(),
): FileSource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Refused({ code: "invalidCore", path });
  if (value.length > LIMITS.sources) throw new Refused({ code: "limitExceeded", path, data: { limit: "sources" } });
  const sources: FileSource[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const read = readSource(value[i], at(path, i), kind, ids, report, warnings);
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
