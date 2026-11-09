// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What the detail of a day shows (docs/SPEC.md, "Detail view"): the required work as a bar of work and free time,
// the leave as a bar of switches with its cost and the work left, the calendars as bars, the reasons for the
// required work and the leave, and the day's problems.
import type { DayResult, Problem } from "../../engine/counting/plan.ts";
import type { RequiredLayer } from "../../engine/counting/required.ts";
import type { SourceDay } from "../../engine/counting/types.ts";
import { textFor } from "../../engine/file/text.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import { formatDate, formatDays, pluralCount } from "../i18n/format.ts";
import { textLanguage, type Locale } from "../i18n/locale.ts";
import type { PlanMeta, SourceMeta } from "../worker/protocol.ts";
import { kindOf, type Translate } from "./label.ts";
import { leaveSwitch, type LeaveSegment, type LeaveSwitch, type PartName } from "./leave-switch.ts";

/** The pattern of the free time, as the cell draws the day. */
export type OffKind = "weekend" | "holiday" | "halfRequired" | "free";

/** A stretch of a day in day positions. */
export interface DaySpan {
  readonly from: Units;
  readonly to: Units;
}

export interface RequiredView {
  readonly value: Units;
  /** The work block and the free time beside it, in the order of the day. */
  readonly blocks: readonly (DaySpan & { readonly work: boolean })[];
  readonly off: OffKind;
  /** Where the work lies on a day with less than a full day of it and more than none. */
  readonly where?: "morning" | "afternoon" | "start" | "end";
}

export interface DetailCalendar {
  readonly source: SourceMeta;
  /** The source's place in the sources list, which picks its line style. */
  readonly index: number;
  /** The names of its entries on the day, each once, in the UI language. */
  readonly entries: readonly string[];
  /** Where its entries lie in the day. */
  readonly spans: readonly DaySpan[];
}

export type Reason =
  | { readonly kind: "normalDay" }
  | { readonly kind: "workWeek"; readonly weekday: string; readonly value: Units }
  | { readonly kind: "publicHoliday"; readonly nameKey: string }
  | { readonly kind: "holidaySource"; readonly name: string; readonly value: Units }
  | { readonly kind: "paidClosure"; readonly source: string }
  | { readonly kind: "ruleAtMost" | "ruleExactly"; readonly label: string; readonly value: Units }
  | { readonly kind: "override"; readonly value: Units }
  | { readonly kind: "mandatory"; readonly source: string; readonly value: Units }
  | { readonly kind: "otherPlan"; readonly plan: string };

export interface DayDetailData {
  readonly required: RequiredView;
  /** The leave part; undefined on a day without work and without leave, where `noLeave` says why. */
  readonly leave?: LeaveSwitch & { readonly cost: Units; readonly remaining: Units };
  readonly noLeave?: "notNeeded" | "outsidePeriod";
  readonly calendars: readonly DetailCalendar[];
  /** What decided the required work, in the order of its layers, then the mandatory leave and other plans' leave. */
  readonly reasons: readonly Reason[];
  readonly problems: readonly Problem["code"][];
}

const FULL = UNITS_PER_DAY;

function requiredView(day: DayResult, meta: PlanMeta): RequiredView {
  const { value, freePart } = day.required;
  const kind = kindOf(day, meta);
  const off: OffKind = kind === "holiday" || kind === "halfRequiredHoliday" ? "holiday" : kind === "workday" ? "weekend" : kind;
  if (value <= 0 || value >= FULL) return { value, blocks: [{ from: 0, to: FULL, work: value > 0 }], off };
  const half = value * 2 === FULL;
  if (freePart === "end") {
    return { value, blocks: [{ from: 0, to: value, work: true }, { from: value, to: FULL, work: false }], off, where: half ? "morning" : "start" };
  }
  const start = FULL - value;
  return { value, blocks: [{ from: 0, to: start, work: false }, { from: start, to: FULL, work: true }], off, where: half ? "afternoon" : "end" };
}

/** Where a calendar's entry lies in the day: a holiday calendar's free time, a share of the day, or all of it. */
function spanOf(entry: SourceDay): DaySpan {
  switch (entry.type) {
    case "holiday": {
      if (entry.required >= FULL) return { from: 0, to: FULL };
      return entry.part === "start" ? { from: 0, to: FULL - entry.required } : { from: entry.required, to: FULL };
    }
    case "mandatory":
    case "needed": {
      const take = Math.min(entry.take, FULL);
      return entry.part === "start" ? { from: 0, to: take } : { from: FULL - take, to: FULL };
    }
    case "otherPlan":
      return { from: entry.from, to: entry.to };
    default:
      return { from: 0, to: FULL };
  }
}

/** Sorted, merged spans. */
function merged(spans: readonly DaySpan[]): DaySpan[] {
  const out: { from: Units; to: Units }[] = [];
  for (const { from, to } of spans.toSorted((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last !== undefined && from <= last.to) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}

function calendarsOf(day: DayResult, meta: PlanMeta, locale: Locale): DetailCalendar[] {
  const lang = textLanguage(locale);
  return meta.sources.flatMap((source, index) => {
    const entries = day.facts.sources.filter((entry) => entry.sourceId === source.id);
    if (entries.length === 0) return [];
    const names = new Set(entries.flatMap((entry) => (entry.name === undefined ? [] : [textFor(entry.name, lang)])));
    return [{ source, index, entries: [...names], spans: merged(entries.map(spanOf)) }];
  });
}

function reasonsOf(day: DayResult, meta: PlanMeta, locale: Locale): Reason[] {
  const lang = textLanguage(locale);
  const sourceName = (id: string): string => {
    const source = meta.sources.find((candidate) => candidate.id === id);
    return source ? textFor(source.name, lang) : id;
  };
  const ruleLabel = (id: string): string => {
    const label = meta.rules.find((candidate) => candidate.id === id)?.label;
    return label === undefined ? id : textFor(label, lang);
  };
  const { layers } = day.required;
  const onlyWorkWeek = layers.length === 1 && layers[0]?.kind === "workWeek" && layers[0].value >= FULL;
  const reasons: Reason[] = onlyWorkWeek
    ? [{ kind: "normalDay" }]
    : layers.map((layer: RequiredLayer): Reason => {
        switch (layer.kind) {
          case "workWeek":
            return { kind: "workWeek", weekday: formatDate(day.day, locale, "weekdayLong"), value: layer.value };
          case "publicHoliday":
            return { kind: "publicHoliday", nameKey: layer.nameKey };
          case "holidaySource": {
            // The entry's name ("Rosenmontag"), else the calendar's.
            const entry = day.facts.sources.find((source) => source.type === "holiday" && source.sourceId === layer.sourceId && source.name !== undefined);
            return { kind: "holidaySource", name: entry?.name === undefined ? sourceName(layer.sourceId) : textFor(entry.name, lang), value: layer.value };
          }
          case "paidClosure":
            return { kind: "paidClosure", source: sourceName(layer.sourceId) };
          case "ruleAtMost":
          case "ruleExactly":
            return { kind: layer.kind, label: ruleLabel(layer.ruleId), value: layer.value };
          case "override":
            return { kind: "override", value: layer.value };
        }
      });
  const plans = new Set<string>();
  for (const piece of day.leave) {
    if (piece.kind === "mandatory") {
      const source = piece.sourceId === undefined ? ruleLabel(piece.ruleId ?? "") : sourceName(piece.sourceId);
      reasons.push({ kind: "mandatory", source, value: piece.take });
    } else if (piece.kind === "otherPlan") {
      plans.add(piece.sourceId === undefined ? "" : sourceName(piece.sourceId));
    }
  }
  for (const plan of plans) reasons.push({ kind: "otherPlan", plan });
  return reasons;
}

/** The detail of a day. `problems` is the result's list; only those of this day are kept. */
export function dayDetail(day: DayResult, meta: PlanMeta, problems: readonly Problem[], locale: Locale): DayDetailData {
  const base = {
    required: requiredView(day, meta),
    calendars: calendarsOf(day, meta, locale),
    reasons: reasonsOf(day, meta, locale),
    problems: problems.filter((problem) => problem.day === day.day).map((problem) => problem.code),
  };
  // The leave part goes only where there is neither work nor leave of any kind; own leave on a free day stays removable.
  if (day.leave.length === 0 && !(day.inPeriod && day.required.value > 0)) return { ...base, noLeave: day.inPeriod ? "notNeeded" : "outsidePeriod" };
  const { cost, remaining } = day.evaluation;
  return { ...base, leave: { ...leaveSwitch(day, meta.minUnit), cost, remaining } };
}

/** A switch of the leave bar. */
export type SwitchSegment = Extract<LeaveSegment, { kind: "switch" }>;

/** A fixed block of the leave bar: time without work, mandatory leave or another plan's leave. */
export type FixedSegment = Exclude<LeaveSegment, SwitchSegment>;

/** A part of the day by its name: a half or the whole day ("vormittags", "Ganzer Tag"), a smaller part by its place ("4. Sechzehntel"). */
export function partText(name: PartName, t: Translate): string {
  if (name.kind === "part") return t("detail.part", { index: name.index, count: name.count });
  return t("detail.segment", { name: name.kind === "half" ? name.half : "day" });
}

function samePart(a: PartName, b: PartName): boolean {
  if (a.kind === "part" && b.kind === "part") return a.index === b.index;
  if (a.kind === "half" && b.kind === "half") return a.half === b.half;
  return a.kind === b.kind;
}

/**
 * Where a fixed block lies: the whole day, its one part, or its first to its last part, with their share named once
 * ("13. bis 16. Sechzehntel"); a block over both halves that isn't the whole day lies from the morning to the afternoon.
 */
function placeText(block: FixedSegment, t: Translate): string {
  const { first, last } = block;
  if (block.from === 0 && block.to === FULL) return partText({ kind: "day" }, t);
  if (samePart(first, last)) return partText(first, t);
  if (first.kind === "part" && last.kind === "part") return t("detail.partRange", { first: first.index, last: last.index, count: first.count });
  return t("detail.halfRange");
}

/**
 * What a fixed block is to a screen reader: where it lies and what it is ("nachmittags: frei",
 * "13. bis 16. Sechzehntel: frei", "Ganzer Tag: aus anderem Plan").
 */
export function fixedText(block: FixedSegment, t: Translate): string {
  return t("detail.fixed", { where: placeText(block, t), kind: block.kind });
}

/**
 * A switch's name: its part's. A switch over time without work (it is there only to take away own leave that lies
 * on free time alone) is named like the fixed block it stands for ("nachmittags: frei"), so that two switches of one
 * bar never share a name: the free rest of a part can be a switch beside the switch over the part's work.
 */
export function switchText(segment: SwitchSegment, t: Translate): string {
  const name = partText(segment.name, t);
  return segment.onFree ? t("detail.fixed", { where: name, kind: "free" }) : name;
}

/** A share of the day as a percentage of `whole`, for a stretch drawn inside a bar. */
export function percent(units: Units, whole: Units = FULL): string {
  return `${String((units / whole) * 100)}%`;
}

/** A day amount with its unit: "½ Tag", "1 Tag", "1½ Tage". */
export function amountText(units: Units, i18n: { t: Translate; locale: Locale }): string {
  return i18n.t("detail.amount", { count: pluralCount(units), days: formatDays(units, i18n.locale) });
}

/** A reason in words, "Name (kind): value", with "free" for no work. */
export function reasonText(reason: Reason, i18n: { t: Translate; locale: Locale }): string {
  const { t } = i18n;
  const value = (units: Units): string => (units <= 0 ? t("detail.off") : amountText(units, i18n));
  const zero = (units: Units): string => (units <= 0 ? "yes" : "no");
  switch (reason.kind) {
    case "normalDay":
      return t("detail.reason.normalDay");
    case "workWeek":
      return t("detail.reason.workWeek", { weekday: reason.weekday, value: value(reason.value) });
    case "publicHoliday":
      return t("detail.reason.publicHoliday", { name: t(reason.nameKey), value: value(0) });
    case "holidaySource":
      return t("detail.reason.holidaySource", { name: reason.name, value: value(reason.value) });
    case "paidClosure":
      return t("detail.reason.paidClosure", { source: reason.source, value: value(0) });
    case "ruleAtMost":
      return t("detail.reason.ruleAtMost", { label: reason.label, zero: zero(reason.value), value: value(reason.value) });
    case "ruleExactly":
      return t("detail.reason.ruleExactly", { label: reason.label, zero: zero(reason.value), value: value(reason.value) });
    case "override":
      return t("detail.reason.override", { value: value(reason.value) });
    case "mandatory":
      return t("detail.reason.mandatory", { source: reason.source, value: value(reason.value) });
    case "otherPlan":
      return t("detail.reason.otherPlan", { plan: reason.plan });
  }
}
