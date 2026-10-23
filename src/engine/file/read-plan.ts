// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { periodBounds } from "../counting/plan";
import type { LeaveDay, PlanPeriod, RequiredOverride } from "../counting/types";
import { MAX_YEAR, MIN_YEAR, type DayNumber } from "../days";
import { UNITS_PER_DAY, parseAmount, type Units } from "../weight";
import { LIMITS, textLength } from "./limits";
import { isoDay, parsePart, positiveWeight, weight } from "./read-contract";
import { Refused, Report, at, checkKeys, child, isRecord, readOptional, readRequired } from "./report";
import type { FileContract, FilePlan, Note } from "./types";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function readMonth(value: unknown): { year: number; month: number } | undefined {
  if (typeof value !== "string") return undefined;
  const match = MONTH.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= MIN_YEAR && year <= MAX_YEAR ? { year, month } : undefined;
}

function readRange(value: unknown, path: string, report: Report): PlanPeriod {
  const fail = (): never => {
    throw new Refused({ code: "invalidCore", path });
  };
  if (!isRecord(value)) return fail();
  const from = readMonth(value["from"]);
  const to = readMonth(value["to"]);
  if (!from || !to) return fail();
  const months = (to.year - from.year) * 12 + (to.month - from.month) + 1;
  if (months < 1) return fail();
  if (months > LIMITS.periodMonths) throw new Refused({ code: "limitExceeded", path, data: { limit: "periodMonths" } });
  checkKeys(value, ["from", "to"], path, report);
  return { from, to };
}

function readAllowance(value: unknown, path: string): Units {
  if (typeof value !== "string") throw new Refused({ code: "invalidCore", path });
  try {
    return parseAmount(value);
  } catch {
    throw new Refused({ code: "invalidCore", path });
  }
}

interface Context {
  readonly bounds: { from: DayNumber; to: DayNumber };
  readonly minUnit: Units;
  readonly report: Report;
  /** Leave drafted with the part "end" because the file gave none → the path of its entry. */
  readonly drafted: Map<LeaveDay, string>;
  /** Loaded path of every kept entry → its index in the text. */
  readonly positions: Map<string, number>;
}

/** The array at `path`, or a refusal when it is missing, not a list or longer than `max`. */
function readList(value: unknown, path: string, max: number, limit: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Refused({ code: "invalidCore", path });
  if (value.length > max) throw new Refused({ code: "limitExceeded", path, data: { limit } });
  return value as unknown[];
}

/**
 * Reads the entries of one list. An entry is read into a scratch report of its own: its `date` first, then
 * `readOne` reads the other keys and returns the entry, or undefined when it is dropped (with `day` undefined
 * too). The first kept entry of a date wins; a later one is `duplicateDate` and isn't read any further. The
 * result is sorted by day.
 */
function readEntries<T extends { readonly day: DayNumber }>(
  value: unknown,
  path: string,
  max: number,
  limit: string,
  context: Context,
  readOne: (entry: Readonly<Record<string, unknown>>, entryPath: string, day: DayNumber | undefined, report: Report) => T | undefined,
): T[] {
  const list = value === undefined ? [] : readList(value, path, max, limit); // a missing list is empty
  const kept: { readonly read: T; readonly index: number }[] = [];
  const seen = new Set<DayNumber>();
  for (let i = 0; i < list.length; i++) {
    const entryPath = at(path, i);
    const entry = list[i];
    if (!isRecord(entry)) {
      context.report.error("invalidValue", entryPath, entryPath);
      continue;
    }
    const scratch = new Report();
    const day = readRequired(entry, "date", isoDay, entryPath, scratch, entryPath);
    if (day !== undefined && seen.has(day)) {
      context.report.error("duplicateDate", child(entryPath, "date"), entryPath);
      continue;
    }
    if (day !== undefined && (day < context.bounds.from || day > context.bounds.to)) scratch.notice("outsidePeriod", entryPath);
    const read = readOne(entry, entryPath, day, scratch);
    context.report.merge(scratch, read !== undefined);
    if (!read) continue;
    seen.add(read.day);
    kept.push({ read, index: i });
  }
  kept.sort((a, b) => a.read.day - b.read.day);
  kept.forEach(({ index }, loaded) => context.positions.set(at(path, loaded), index));
  return kept.map(({ read }) => read);
}

function checkMultiple(units: Units, field: string, entryPath: string, context: Context, report: Report): void {
  if (units % context.minUnit !== 0) report.notice("notMultipleOfMinUnit", child(entryPath, field));
}

function readDays(value: unknown, path: string, context: Context): LeaveDay[] {
  return readEntries<LeaveDay>(value, path, LIMITS.planDays, "planDays", context, (entry, entryPath, day, report) => {
    const take = readRequired(entry, "take", positiveWeight, entryPath, report, entryPath);
    if (take !== undefined) checkMultiple(take, "take", entryPath, context, report);
    const part = readOptional(entry, "part", parsePart, entryPath, report, entryPath);
    checkKeys(entry, ["date", "take", "part"], entryPath, report);
    if (day === undefined || take === undefined || report.drops(entryPath)) return undefined;
    // Partial leave without `part` gets "end" here; `readFile` replaces it by a suggestion.
    if (part !== undefined || take >= UNITS_PER_DAY) return { day, take, ...(part !== undefined ? { part } : {}) };
    const drafted: LeaveDay = { day, take, part: "end" };
    context.drafted.set(drafted, entryPath);
    return drafted;
  });
}

function readOverrides(value: unknown, path: string, context: Context): RequiredOverride[] {
  return readEntries<RequiredOverride>(value, path, LIMITS.overrides, "overrides", context, (entry, entryPath, day, report) => {
    const required = readRequired(entry, "required", weight, entryPath, report, entryPath);
    if (required !== undefined) checkMultiple(required, "required", entryPath, context, report);
    const part = readOptional(entry, "part", parsePart, entryPath, report, entryPath);
    checkKeys(entry, ["date", "required", "part"], entryPath, report);
    if (day === undefined || required === undefined || report.drops(entryPath)) return undefined;
    return { day, required, ...(part !== undefined ? { part } : {}) };
  });
}

function readNotes(value: unknown, path: string, context: Context): Note[] {
  return readEntries<Note>(value, path, LIMITS.notes, "notes", context, (entry, entryPath, day, report) => {
    const text = readRequired(entry, "text", (item) => (typeof item === "string" && item.length > 0 ? item : undefined), entryPath, report, entryPath);
    if (text !== undefined && textLength(text) > LIMITS.longText) report.error("textTooLong", child(entryPath, "text"), entryPath, { limit: LIMITS.longText });
    checkKeys(entry, ["date", "text"], entryPath, report);
    if (day === undefined || text === undefined || report.drops(entryPath)) return undefined;
    return { day, text };
  });
}

export interface PlanDraft {
  readonly plan: FilePlan;
  /** Leave whose part was missing and drafted as "end", with the path of its entry, in file order. */
  readonly drafted: ReadonlyMap<LeaveDay, string>;
}

/** Reads `plan` like `readPlanSection`, and says which partial leave lacked a `part`. */
export function readPlanDraft(value: unknown, path: string, contract: FileContract, report: Report, positions: Map<string, number> = new Map()): PlanDraft {
  if (!isRecord(value)) throw new Refused({ code: "invalidCore", path });
  checkKeys(value, ["range", "allowance", "days", "overrides", "notes"], path, report);
  const range = readRange(value["range"], child(path, "range"), report);
  const allowance = readAllowance(value["allowance"], child(path, "allowance"));
  const context: Context = { bounds: periodBounds(range), minUnit: contract.minUnit, report, drafted: new Map(), positions };
  const days = readDays(value["days"], child(path, "days"), context);
  const overrides = readOverrides(value["overrides"], child(path, "overrides"), context);
  const notes = readNotes(value["notes"], child(path, "notes"), context);
  return { plan: { range, allowance, days, overrides, notes }, drafted: context.drafted };
}

/**
 * Reads `plan`. Throws `Refused` for core problems and counts over a limit.
 * Partial leave without `part` is drafted as "end"; `readFile` replaces those parts with suggestions.
 */
export function readPlanSection(value: unknown, path: string, contract: FileContract, report: Report): FilePlan {
  return readPlanDraft(value, path, contract, report).plan;
}
