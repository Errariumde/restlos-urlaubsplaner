// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { weekdayOf } from "../days";
import type { DayNumber } from "../days";
import { holidaysBetween } from "../holidays/holidays";
import type { Holiday } from "../holidays/types";
import { UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";
import { ruleDays } from "./match";
import type { DayRule, Part, PlanInput, RequiredOverride, SourceDay } from "./types";

export type RequiredLayer =
  | { readonly kind: "workWeek"; readonly value: Units; readonly entryFrom: DayNumber }
  | { readonly kind: "publicHoliday"; readonly value: 0; readonly ruleId: string; readonly nameKey: string }
  | { readonly kind: "holidaySource"; readonly value: Units; readonly sourceId: string; readonly part?: Part }
  | { readonly kind: "paidClosure"; readonly value: 0; readonly sourceId: string }
  | { readonly kind: "ruleAtMost"; readonly value: Units; readonly ruleId: string; readonly part?: Part }
  | { readonly kind: "ruleExactly"; readonly value: Units; readonly ruleId: string; readonly part?: Part }
  | { readonly kind: "override"; readonly value: Units; readonly part?: Part };

export interface RequiredWork {
  readonly value: Units;
  /** Where the free time lies when `value` is below a full day. */
  readonly freePart: Part;
  readonly decidedBy: RequiredLayer;
  readonly layers: readonly RequiredLayer[];
  /** IDs of `requiredExactly` rules with different values on this day, else empty. */
  readonly conflictingRules: readonly string[];
}

export interface DayFacts {
  readonly day: DayNumber;
  readonly base: { readonly entryFrom: DayNumber; readonly value: Units };
  readonly holidays: readonly Holiday[];
  /** Every source of the day, Info included, in input order. */
  readonly sources: readonly SourceDay[];
  /** Matching rules, in contract order. */
  readonly rules: readonly DayRule[];
  readonly override?: RequiredOverride;
}

function checkUnits(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UNITS_PER_DAY) {
    throw new RangeError(`${what} must be a whole number of units from 0 to ${UNITS_PER_DAY}`);
  }
}

function groupByDay<T extends { readonly day: DayNumber }>(items: readonly T[]): Map<DayNumber, T[]> {
  const grouped = new Map<DayNumber, T[]>();
  for (const item of items) {
    const list = grouped.get(item.day);
    if (list) list.push(item);
    else grouped.set(item.day, [item]);
  }
  return grouped;
}

/** The facts that apply to each day from `from` to `to` (inclusive). Throws RangeError for invalid input. */
export function dayFacts(
  input: Pick<PlanInput, "country" | "contract" | "sources" | "overrides">,
  from: DayNumber,
  to: DayNumber,
): DayFacts[] {
  const { contract, sources, overrides } = input;
  const { week, rules } = contract;
  if (week.length === 0) throw new RangeError("The work week needs at least one entry");
  week.forEach((entry, index) => {
    const previous = week[index - 1];
    if (previous && entry.from <= previous.from) {
      throw new RangeError("Work-week entries must have strictly increasing start dates");
    }
    for (const value of Object.values(entry.required)) checkUnits(value, "Required work in the work week");
  });
  for (const source of sources) {
    if (source.type === "holiday") checkUnits(source.required, "Required work of a source");
    else if (source.type === "mandatory" || source.type === "otherPlan") checkUnits(source.take, "Take of a source");
  }
  for (const rule of rules) {
    if ("requiredAtMost" in rule) checkUnits(rule.requiredAtMost, "Required work of a rule");
    else if ("requiredExactly" in rule) checkUnits(rule.requiredExactly, "Required work of a rule");
    else checkUnits(rule.mandatory, "Mandatory work of a rule");
  }
  const overrideByDay = new Map<DayNumber, RequiredOverride>();
  for (const override of overrides) {
    checkUnits(override.required, "Required work of an override");
    if (overrideByDay.has(override.day)) throw new RangeError("At most one override per day");
    overrideByDay.set(override.day, override);
  }

  const holidaysByDay = groupByDay(holidaysBetween(input.country, contract.region, from, to));
  const sourcesByDay = groupByDay(sources);
  const rulesByDay = new Map<DayNumber, DayRule[]>();
  for (const rule of rules) {
    for (const day of ruleDays(rule, from, to)) {
      const list = rulesByDay.get(day);
      if (list) list.push(rule);
      else rulesByDay.set(day, [rule]);
    }
  }

  const result: DayFacts[] = [];
  for (let day = from; day <= to; day++) {
    let entry = week[0] as (typeof week)[number];
    for (const candidate of week) if (candidate.from <= day) entry = candidate;
    const override = overrideByDay.get(day);
    result.push({
      day,
      base: { entryFrom: entry.from, value: entry.required[weekdayOf(day)] },
      holidays: holidaysByDay.get(day) ?? [],
      sources: sourcesByDay.get(day) ?? [],
      rules: rulesByDay.get(day) ?? [],
      ...(override ? { override } : {}),
    });
  }
  return result;
}

const withPart = (part: Part | undefined): { part?: Part } => (part === undefined ? {} : { part });

function layersOf(facts: DayFacts): RequiredLayer[] {
  const layers: RequiredLayer[] = [{ kind: "workWeek", value: facts.base.value, entryFrom: facts.base.entryFrom }];
  for (const holiday of facts.holidays) {
    layers.push({ kind: "publicHoliday", value: 0, ruleId: holiday.ruleId, nameKey: holiday.nameKey });
  }
  for (const source of facts.sources) {
    if (source.type === "holiday") {
      layers.push({ kind: "holidaySource", value: source.required, sourceId: source.sourceId, ...withPart(source.part) });
    } else if (source.type === "paidClosure") {
      layers.push({ kind: "paidClosure", value: 0, sourceId: source.sourceId });
    }
  }
  for (const rule of facts.rules) {
    if ("requiredAtMost" in rule) {
      layers.push({ kind: "ruleAtMost", value: rule.requiredAtMost, ruleId: rule.id, ...withPart(rule.part) });
    }
  }
  for (const rule of facts.rules) {
    if ("requiredExactly" in rule) {
      layers.push({ kind: "ruleExactly", value: rule.requiredExactly, ruleId: rule.id, ...withPart(rule.part) });
    }
  }
  if (facts.override) {
    layers.push({ kind: "override", value: facts.override.required, ...withPart(facts.override.part) });
  }
  return layers;
}

/** The required work of a day and the layers it comes from. */
export function requiredWork(facts: DayFacts): RequiredWork {
  const layers = layersOf(facts);
  const exactly = layers.filter((layer) => layer.kind === "ruleExactly");
  const override = layers.find((layer) => layer.kind === "override");

  let stage: readonly RequiredLayer[];
  if (override) stage = [override];
  else if (exactly.length > 0) stage = exactly;
  else stage = layers.filter((layer) => layer.kind !== "ruleExactly" && layer.kind !== "override");

  const value = Math.min(...stage.map((layer) => layer.value));
  const matching = stage.filter((layer) => layer.value === value);
  const decidedBy = (matching.find((layer) => "part" in layer && layer.part !== undefined) ??
    matching[0]) as RequiredLayer;
  const freePart = ("part" in decidedBy ? decidedBy.part : undefined) ?? "end";

  const conflicting = exactly.some((layer) => layer.value !== exactly[0]?.value);
  const conflictingRules = conflicting
    ? exactly.flatMap((layer) => (layer.kind === "ruleExactly" ? [layer.ruleId] : []))
    : [];
  return { value, freePart, decidedBy, layers, conflictingRules };
}
