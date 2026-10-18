// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { expect } from "vitest";
import type { Stretch } from "../../src/engine/counting/stretches";
import type { LeaveDay, Part, YearMonth } from "../../src/engine/counting/types";
import { WEEKDAYS, dayFromIso, isoFromDay, type Weekday } from "../../src/engine/days";
import { readFile } from "../../src/engine/file/read";
import type { AnyFile, PlanFile, RuleSetFile } from "../../src/engine/file/types";
import { parseAmount, parseWeight } from "../../src/engine/weight";

/** Paths are relative to the repository root, where `npm test` runs. */
export const RULE_SET_DIR = "examples/rules";

export const readText = (path: string): string => readFileSync(path, "utf8");

/** The file at `path`, which must load and leave an empty report. */
export function readExample(path: string): AnyFile {
  const result = readFile(readText(path));
  if (!result.ok) throw new Error(`${path} was refused: ${result.refusal.code} at ${result.refusal.path ?? "(file)"}`);
  expect(result.report, path).toEqual([]);
  return result.file;
}

export function readRuleSet(path: string): RuleSetFile {
  const file = readExample(path);
  if (file.kind !== "ruleSet") throw new Error(`${path} is not a rule set`);
  return file;
}

const month = (text: string): YearMonth => {
  const [year, value] = text.split("-").map(Number);
  if (year === undefined || value === undefined) throw new Error(`Bad month ${text}`);
  return { year, month: value };
};

export interface PlanSetup {
  readonly state: string;
  /** Replaces the rule set's local-rule switches when given. */
  readonly options?: Readonly<Record<string, boolean>>;
  /** Replaces the work week by one entry with these weights (`"1"`, `"1/2"`, `"0"`). */
  readonly week?: Readonly<Record<Weekday, string>>;
  readonly range: { readonly from: string; readonly to: string }; // "2027-01"
  readonly allowance: string; // days, "30"
  /** Leave: an ISO date is a full day. */
  readonly days: readonly (string | { readonly date: string; readonly take: string; readonly part: Part })[];
}

/** A plan file made from a rule set the way "New → From rule set" would, without `origin`s (they don't count). */
export function planFrom(ruleSet: RuleSetFile, setup: PlanSetup): PlanFile {
  const { contract } = ruleSet;
  const options = setup.options ?? contract.region.options;
  const firstWeek = contract.week[0];
  if (firstWeek === undefined) throw new Error("The rule set has no work week");
  const { week } = setup;
  const days: LeaveDay[] = setup.days.map((entry) =>
    typeof entry === "string"
      ? { day: dayFromIso(entry), take: 480 }
      : { day: dayFromIso(entry.date), take: parseWeight(entry.take), part: entry.part },
  );
  return {
    kind: "plan",
    id: `plan-from-${ruleSet.id}`,
    revision: 1,
    ruleSet: { id: ruleSet.id, name: contract.name ?? ruleSet.id, revision: ruleSet.revision },
    contract: {
      ...contract,
      region: { country: contract.region.country, state: setup.state, ...(options ? { options } : {}) },
      week: week
        ? [{ from: firstWeek.from, required: Object.fromEntries(WEEKDAYS.map((day) => [day, parseWeight(week[day])])) as Record<Weekday, number> }]
        : contract.week,
    },
    sources: ruleSet.sources,
    templates: ruleSet.templates,
    theme: ruleSet.theme,
    plan: {
      range: { from: month(setup.range.from), to: month(setup.range.to) },
      allowance: parseAmount(setup.allowance),
      days,
      overrides: [],
      notes: [],
    },
  };
}

/** A stretch as in tests/engine/counting/stretches.test.ts: `start@offset end@offset cost/daysOff listed`. */
export const fmt = (s: Stretch): string =>
  `${isoFromDay(s.start.day)}@${s.start.offset} ${isoFromDay(s.end.day)}@${s.end.offset} ${s.cost}/${s.daysOff}${s.listed ? " listed" : ""}`;

export const MON_FRI: Readonly<Record<Weekday, string>> = { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" };
export const MON_SAT: Readonly<Record<Weekday, string>> = { ...MON_FRI, sat: "1" };
