// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { periodBounds } from "../counting/plan";
import type { LeaveDay, Part, PlanPeriod, RequiredOverride } from "../counting/types";
import { MAX_YEAR, MIN_YEAR, type DayNumber } from "../days";
import { UNITS_PER_DAY, parseAmount, type Units } from "../weight";
import { LIMITS, textLength } from "./limits";
import { isoDay, weight } from "./read-contract";
import { Refused, Report, at, checkKeys, child, isRecord } from "./report";
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
}

/** The array at `path`, or a refusal when it is missing, not a list or longer than `max`. */
function readList(value: unknown, path: string, max: number, limit: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Refused({ code: "invalidCore", path });
  if (value.length > max) throw new Refused({ code: "limitExceeded", path, data: { limit } });
  return value as unknown[];
}

/**
 * Reads the entries of one list: `readOne` returns the entry or undefined (it has reported the reason);
 * the first valid entry of a date wins, a later one is `duplicateDate` and isn't read any further; the
 * result is sorted by day.
 */
function readEntries<T extends { readonly day: DayNumber }>(
  value: unknown,
  path: string,
  max: number,
  limit: string,
  context: Context,
  readOne: (entry: Record<string, unknown>, entryPath: string, date: DayNumber) => T | undefined,
): T[] {
  const list = value === undefined ? [] : readList(value, path, max, limit); // a missing list is empty
  const kept: T[] = [];
  const seen = new Set<DayNumber>();
  for (let i = 0; i < list.length; i++) {
    const entryPath = at(path, i);
    const entry = list[i];
    const date = isRecord(entry) ? isoDay(entry["date"]) : undefined;
    if (!isRecord(entry) || date === undefined) {
      context.report.add("invalidEntry", entryPath);
      continue;
    }
    if (seen.has(date)) {
      context.report.add("duplicateDate", child(entryPath, "date"));
      continue;
    }
    const read = readOne(entry, entryPath, date);
    if (!read) continue;
    seen.add(date);
    if (date < context.bounds.from || date > context.bounds.to) context.report.add("outsidePeriod", entryPath);
    kept.push(read);
  }
  return kept.sort((a, b) => a.day - b.day);
}

function readPart(entry: Record<string, unknown>): Part | undefined | null {
  const part = entry["part"];
  if (part === undefined) return undefined;
  return part === "start" || part === "end" ? part : null;
}

function checkMultiple(units: Units, field: string, entryPath: string, context: Context): void {
  if (units % context.minUnit !== 0) context.report.add("notMultipleOfMinUnit", child(entryPath, field));
}

function readDays(value: unknown, path: string, context: Context): LeaveDay[] {
  return readEntries<LeaveDay>(value, path, LIMITS.planDays, "planDays", context, (entry, entryPath) => {
    const fail = (field: string): undefined => {
      context.report.add("invalidEntry", entryPath, { field });
      return undefined;
    };
    const take = weight(entry["take"]);
    if (take === undefined || take < 1) return fail("take");
    const part = readPart(entry);
    if (part === null) return fail("part");
    checkKeys(entry, ["date", "take", "part"], entryPath, context.report);
    checkMultiple(take, "take", entryPath, context);
    const day = isoDay(entry["date"]) ?? 0;
    // Partial leave without `part` gets "end" here; `readFile` replaces it by a suggestion.
    if (part !== undefined || take >= UNITS_PER_DAY) return { day, take, ...(part !== undefined ? { part } : {}) };
    const drafted: LeaveDay = { day, take, part: "end" };
    context.drafted.set(drafted, entryPath);
    return drafted;
  });
}

function readOverrides(value: unknown, path: string, context: Context): RequiredOverride[] {
  return readEntries<RequiredOverride>(value, path, LIMITS.overrides, "overrides", context, (entry, entryPath) => {
    const fail = (field: string): undefined => {
      context.report.add("invalidEntry", entryPath, { field });
      return undefined;
    };
    const required = weight(entry["required"]);
    if (required === undefined) return fail("required");
    const part = readPart(entry);
    if (part === null) return fail("part");
    checkKeys(entry, ["date", "required", "part"], entryPath, context.report);
    checkMultiple(required, "required", entryPath, context);
    return { day: isoDay(entry["date"]) ?? 0, required, ...(part !== undefined ? { part } : {}) };
  });
}

function readNotes(value: unknown, path: string, context: Context): Note[] {
  return readEntries<Note>(value, path, LIMITS.notes, "notes", context, (entry, entryPath) => {
    const text = entry["text"];
    if (typeof text !== "string" || text.length === 0) {
      context.report.add("invalidEntry", entryPath, { field: "text" });
      return undefined;
    }
    if (textLength(text) > LIMITS.longText) {
      context.report.add("textTooLong", child(entryPath, "text"), { limit: LIMITS.longText });
      return undefined;
    }
    checkKeys(entry, ["date", "text"], entryPath, context.report);
    return { day: isoDay(entry["date"]) ?? 0, text };
  });
}

export interface PlanDraft {
  readonly plan: FilePlan;
  /** Leave whose part was missing and drafted as "end", with the path of its entry, in file order. */
  readonly drafted: ReadonlyMap<LeaveDay, string>;
}

/** Reads `plan` like `readPlanSection`, and says which partial leave lacked a `part`. */
export function readPlanDraft(value: unknown, path: string, contract: FileContract, report: Report): PlanDraft {
  if (!isRecord(value)) throw new Refused({ code: "invalidCore", path });
  checkKeys(value, ["range", "allowance", "days", "overrides", "notes"], path, report);
  const range = readRange(value["range"], child(path, "range"), report);
  const allowance = readAllowance(value["allowance"], child(path, "allowance"));
  const context: Context = { bounds: periodBounds(range), minUnit: contract.minUnit, report, drafted: new Map() };
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
