// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayMatch, LeaveDay, PlanPeriod, RangeMatch, RequiredOverride, WorkWeekEntry, YearMonth } from "../counting/types";
import { WEEKDAYS, isoFromDay } from "../days";
import type { DateRule } from "../holidays/types";
import { formatAmount, formatSpan, formatWeight } from "../weight";
import { sortEntries } from "./read-sources";
import type {
  AnyFile,
  Color,
  FileContract,
  FilePlan,
  FileRegion,
  FileRule,
  FileSource,
  OtherPlanRef,
  PlanFile,
  Reference,
  RuleSetFile,
  Template,
  Text,
} from "./types";

type OtherPlanEntry = Extract<FileSource, { type: "otherPlan" }>["entries"][number];

/** Object with its keys in the order given; `undefined` values are left out. */
type Json = Record<string, unknown>;
function ordered(pairs: readonly (readonly [string, unknown])[]): Json {
  return Object.fromEntries(pairs.filter(([, value]) => value !== undefined));
}

const pad = (value: number, width: number): string => String(value).padStart(width, "0");
const month = (value: YearMonth): string => `${pad(value.year, 4)}-${pad(value.month, 2)}`;

function writeDateRule(rule: DateRule): Json {
  switch (rule.type) {
    case "fixed":
      return ordered([["type", rule.type], ["month", rule.month], ["day", rule.day], ["nonLeap", rule.nonLeap]]);
    case "easter":
    case "orthodoxEaster":
      return ordered([["type", rule.type], ["offset", rule.offset]]);
    case "weekdayRelative":
      return ordered([["type", rule.type], ["weekday", rule.weekday], ["relation", rule.relation], ["month", rule.month], ["day", rule.day]]);
    case "nthWeekday":
      return ordered([["type", rule.type], ["month", rule.month], ["weekday", rule.weekday], ["n", rule.n]]);
    case "once":
      return ordered([["type", rule.type], ["date", rule.date]]);
  }
}

function writeRange(match: RangeMatch): Json {
  return ordered([
    ["type", match.type],
    ["from", writeDateRule(match.from)],
    ["to", match.to === undefined ? undefined : writeDateRule(match.to)],
    ["days", match.days],
    ["weekdays", match.weekdays === undefined ? undefined : [...match.weekdays]],
  ]);
}

const writeMatch = (match: DayMatch): Json => (match.type === "range" ? writeRange(match) : writeDateRule(match));

const writeText = (text: Text | undefined): unknown => (text === undefined || typeof text === "string" ? text : { ...text });

function writeReference(reference: Reference): Json {
  return ordered([
    ["title", writeText(reference.title)],
    ["version", writeText(reference.version)],
    ["url", reference.url],
    ["checked", isoFromDay(reference.checked)],
  ]);
}

function writeRegion(region: FileRegion): Json {
  const options =
    region.options === undefined
      ? undefined
      : Object.fromEntries(Object.keys(region.options).sort().map((key) => [key, region.options?.[key]]));
  return ordered([["country", region.country], ["state", region.state], ["options", options]]);
}

function writeWeek(entry: WorkWeekEntry): Json {
  return ordered([
    ["from", isoFromDay(entry.from)],
    ["required", Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, formatWeight(entry.required[weekday])]))],
  ]);
}

function writeRule(rule: FileRule, withOrigin: boolean): Json {
  return ordered([
    ["id", rule.id],
    ["origin", withOrigin ? rule.origin : undefined],
    ["label", writeText(rule.label)],
    ["match", writeMatch(rule.match)],
    ["validFrom", rule.validFrom],
    ["validUntil", rule.validUntil],
    ["requiredAtMost", rule.requiredAtMost === undefined ? undefined : formatWeight(rule.requiredAtMost)],
    ["requiredExactly", rule.requiredExactly === undefined ? undefined : formatWeight(rule.requiredExactly)],
    ["mandatory", rule.mandatory === undefined ? undefined : formatWeight(rule.mandatory)],
    ["part", rule.part],
    ["note", writeText(rule.note)],
    ["references", rule.references === undefined ? undefined : [...rule.references]],
  ]);
}

function writeContract(contract: FileContract, withOrigin: boolean): Json {
  const keys = Object.keys(contract.references);
  return ordered([
    ["name", writeText(contract.name)],
    ["description", writeText(contract.description)],
    ["references", keys.length === 0 ? undefined : Object.fromEntries(keys.map((key) => [key, writeReference(contract.references[key] as Reference)]))],
    ["region", writeRegion(contract.region)],
    ["minUnit", formatWeight(contract.minUnit)],
    ["week", contract.week.map(writeWeek)],
    ["rules", contract.rules.map((rule) => writeRule(rule, withOrigin))],
  ]);
}

const writeColor = (color: Color): Json => ("slot" in color ? { slot: color.slot } : { rgb: color.rgb });
const writePlanRef = (ref: OtherPlanRef): Json => ordered([["id", ref.id], ["name", writeText(ref.name)], ["revision", ref.revision]]);

function writeEntry(source: FileSource, entry: FileSource["entries"][number]): Json {
  if (source.type === "otherPlan") {
    const { date, name, from, to, kind } = entry as OtherPlanEntry;
    const [fromText, toText] = formatSpan(from, to);
    return ordered([["date", isoFromDay(date)], ["name", writeText(name)], ["from", fromText], ["to", toText], ["kind", kind]]);
  }
  const when: [string, unknown][] =
    "date" in entry
      ? [["date", isoFromDay(entry.date)]]
      : [
          ["match", writeMatch(entry.match)],
          ["validFrom", entry.validFrom],
          ["validUntil", entry.validUntil],
          ["except", entry.except === undefined ? undefined : entry.except.map(isoFromDay)],
        ];
  const common: [string, unknown][] = [...when, ["name", writeText(entry.name)]];
  switch (source.type) {
    case "holiday": {
      const { required, part } = entry as { required: number; part?: string };
      return ordered([...common, ["required", formatWeight(required)], ["part", part]]);
    }
    case "mandatory":
    case "needed": {
      const { take, part } = entry as { take: number; part?: string };
      return ordered([...common, ["take", formatWeight(take)], ["part", part]]);
    }
    default:
      return ordered(common);
  }
}

function writeSource(source: FileSource, withOrigin: boolean): Json {
  return ordered([
    ["id", source.id],
    ["origin", withOrigin ? source.origin : undefined],
    ["name", writeText(source.name)],
    ["type", source.type],
    ["color", writeColor(source.color)],
    ["visible", source.visible],
    ["plan", source.type === "otherPlan" ? writePlanRef(source.plan) : undefined],
    ["entries", sortEntries<FileSource["entries"][number]>(source.entries).map((entry) => writeEntry(source, entry))],
  ]);
}

function writeTemplate(template: Template, withOrigin: boolean): Json {
  return ordered([
    ["id", template.id],
    ["origin", withOrigin ? template.origin : undefined],
    ["name", writeText(template.name)],
    ["api", template.api],
    ["typst", template.typst],
    ["typ", template.typ],
    ["images", template.images?.map((image) => ordered([["name", image.name], ["type", image.type], ["data", image.data]]))],
  ]);
}

const writeDay = (leave: LeaveDay): Json => ordered([["date", isoFromDay(leave.day)], ["take", formatWeight(leave.take)], ["part", leave.part]]);
const writeOverride = (override: RequiredOverride): Json =>
  ordered([["date", isoFromDay(override.day)], ["required", formatWeight(override.required)], ["part", override.part]]);
const writeRangeMonths = (range: PlanPeriod): Json => ({ from: month(range.from), to: month(range.to) });

const byDay = <T extends { readonly day: number }>(list: readonly T[]): T[] => [...list].sort((a, b) => a.day - b.day);

function writePlan(plan: FilePlan): Json {
  return ordered([
    ["range", writeRangeMonths(plan.range)],
    ["allowance", formatAmount(plan.allowance)],
    ["days", byDay(plan.days).map(writeDay)],
    ["overrides", byDay(plan.overrides).map(writeOverride)],
    ["notes", byDay(plan.notes).map((note) => ({ date: isoFromDay(note.day), text: note.text }))],
  ]);
}

/** Rule sets hold neither personal sources nor `origin`s, whatever the model contains. */
const isPersonal = (source: FileSource): boolean => source.type === "otherPlan" || source.type === "needed";

/**
 * Writes a plan file or rule set as JSON text: keys in canonical order, 2-space indentation, one final line break.
 * `days`, `overrides` and `notes` are written by date and source entries in the reader's order (`sortEntries`);
 * everything else is written as it is, and `revision` is not touched.
 */
export function writeFile(file: AnyFile): string {
  const plan = file.kind === "plan";
  const sources = plan ? file.sources : file.sources.filter((source) => !isPersonal(source));
  const json = ordered([
    ["schema", "restlos/1"],
    ["kind", file.kind],
    ["id", file.id],
    ["revision", file.revision],
    ["ruleSet", plan && file.ruleSet ? writePlanRef(file.ruleSet) : undefined],
    ["contract", writeContract(file.contract, plan)],
    ["sources", sources.map((source) => writeSource(source, plan))],
    ["templates", file.templates.map((template) => writeTemplate(template, plan))],
    ["theme", file.theme],
    ["plan", plan ? writePlan(file.plan) : undefined],
  ]);
  return `${JSON.stringify(json, null, 2)}\n`;
}

/**
 * The file for saving: revision + 1, but never above Number.MAX_SAFE_INTEGER, the largest revision a reader
 * accepts; with `newId` ("Save as"), that id and revision 1.
 */
export function prepareSave(file: AnyFile, newId?: string): AnyFile {
  if (newId !== undefined) return { ...file, id: newId, revision: 1 };
  return { ...file, revision: Math.min(file.revision + 1, Number.MAX_SAFE_INTEGER) };
}

function withoutOrigin<T extends { readonly origin?: string }>(item: T): Omit<T, "origin"> {
  const { origin, ...rest } = item;
  void origin;
  return rest;
}

/** "Save as rule set": the rule set of a plan file without plan, `ruleSet`, `origin`s and personal sources, at revision 1. */
export function toRuleSet(file: PlanFile, id: string): RuleSetFile {
  return {
    kind: "ruleSet",
    id,
    revision: 1,
    contract: { ...file.contract, rules: file.contract.rules.map(withoutOrigin) as FileRule[] },
    sources: file.sources.filter((source) => !isPersonal(source)).map(withoutOrigin) as FileSource[],
    templates: file.templates.map(withoutOrigin),
    theme: file.theme,
  };
}
