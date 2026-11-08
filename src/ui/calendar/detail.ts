// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What the detail popover of a day shows (docs/SPEC.md, "Detail view"), and the changes its actions make.
import type { DayResult, Problem } from "../../engine/counting/plan.ts";
import type { RequiredLayer } from "../../engine/counting/required.ts";
import { textFor } from "../../engine/file/text.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import { formatDays } from "../i18n/format.ts";
import { textLanguage, type Locale } from "../i18n/locale.ts";
import type { LeaveChange, PlanMeta, SourceMeta } from "../worker/protocol.ts";

export type DetailLeave = "none" | "full" | "halfStart" | "halfEnd" | "mandatory" | "otherPlan" | "partial";

/** The message keys of what decided the required work, one per kind of RequiredLayer. */
export type RequiredReasonKey =
  | "detail.required.workWeek"
  | "detail.required.publicHoliday"
  | "detail.required.holidaySource"
  | "detail.required.paidClosure"
  | "detail.required.ruleAtMost"
  | "detail.required.ruleExactly"
  | "detail.required.override";

/** A calendar of the day and the names of its entries on that day, each once, in the UI language; empty when they have none. */
export interface DetailSource {
  readonly source: SourceMeta;
  readonly entries: readonly string[];
}

export interface DayDetailData {
  /**
   * The message that says what decided the required work. A `nameKey` argument (a public holiday) is a
   * message key itself: the caller passes its text as `name`.
   */
  readonly requiredReason: { readonly key: RequiredReasonKey; readonly args: Record<string, string | number> };
  /** Every calendar source of the day, in the order of the sources list, with the names of its entries on the day. */
  readonly sources: readonly DetailSource[];
  readonly leave: DetailLeave;
  readonly cost: Units;
  readonly problems: Problem["code"][];
}

function reasonOf(day: DayResult, meta: PlanMeta, locale: Locale): DayDetailData["requiredReason"] {
  const layer: RequiredLayer = day.required.decidedBy;
  const lang = textLanguage(locale);
  const days = formatDays(layer.value, locale);
  const sourceName = (id: string): string => {
    const source = meta.sources.find((candidate) => candidate.id === id);
    return source ? textFor(source.name, lang) : id;
  };
  const ruleLabel = (id: string): string => {
    const label = meta.rules.find((candidate) => candidate.id === id)?.label;
    return label === undefined ? id : textFor(label, lang);
  };
  switch (layer.kind) {
    case "workWeek":
      return { key: "detail.required.workWeek", args: {} };
    case "publicHoliday":
      return { key: "detail.required.publicHoliday", args: { nameKey: layer.nameKey } };
    case "holidaySource": {
      // The entry's name ("Faschingsdienstag"), else the calendar's.
      const entry = day.facts.sources.find((source) => source.type === "holiday" && source.sourceId === layer.sourceId && source.name !== undefined);
      return { key: "detail.required.holidaySource", args: { name: entry?.name === undefined ? sourceName(layer.sourceId) : textFor(entry.name, lang) } };
    }
    case "paidClosure":
      return { key: "detail.required.paidClosure", args: { source: sourceName(layer.sourceId) } };
    case "ruleAtMost":
      return { key: "detail.required.ruleAtMost", args: { label: ruleLabel(layer.ruleId), days } };
    case "ruleExactly":
      return { key: "detail.required.ruleExactly", args: { label: ruleLabel(layer.ruleId), days } };
    case "override":
      return { key: "detail.required.override", args: { days } };
  }
}

function leaveOf(day: DayResult): DetailLeave {
  const own = day.leave.find((piece) => piece.kind === "own");
  if (own?.kind === "own" && own.take > 0) {
    // As in the cell: leave that covers all the required work is a full day, wherever it lies.
    if (day.evaluation.ownCost >= day.required.value) return "full";
    if (own.take === UNITS_PER_DAY / 2) return own.part === "start" ? "halfStart" : "halfEnd";
    return "partial";
  }
  if (day.leave.some((piece) => piece.kind === "mandatory")) return "mandatory";
  if (day.leave.some((piece) => piece.kind === "otherPlan")) return "otherPlan";
  return "none";
}

/** The detail of a day. `problems` is the result's list; only those of this day are kept. */
export function dayDetail(day: DayResult, meta: PlanMeta, problems: readonly Problem[], locale: Locale): DayDetailData {
  const lang = textLanguage(locale);
  const entries = new Map<string, Set<string>>();
  const namesOf = (sourceId: string): Set<string> => {
    let names = entries.get(sourceId);
    if (names === undefined) {
      names = new Set();
      entries.set(sourceId, names);
    }
    return names;
  };
  for (const entry of day.facts.sources) {
    const names = namesOf(entry.sourceId);
    if (entry.name !== undefined) names.add(textFor(entry.name, lang));
  }
  for (const piece of day.leave) if (piece.sourceId !== undefined) namesOf(piece.sourceId);
  return {
    requiredReason: reasonOf(day, meta, locale),
    sources: meta.sources.flatMap((source) => {
      const names = entries.get(source.id);
      return names === undefined ? [] : [{ source, entries: [...names] }];
    }),
    leave: leaveOf(day),
    cost: day.evaluation.cost,
    problems: problems.filter((problem) => problem.day === day.day).map((problem) => problem.code),
  };
}

/** Why no leave can be set on a day. */
export type Blocked = "noRequired" | "mandatory" | "otherPlan";

/**
 * The one change each action of the detail makes, or undefined when it changes nothing or isn't possible;
 * `blocked` says why none of the setting actions is possible. The actions follow the range rules
 * (range.ts): only days in the period with required work and without mandatory or other-plan leave.
 */
export interface DetailActions {
  readonly full?: LeaveChange;
  readonly morning?: LeaveChange;
  readonly afternoon?: LeaveChange;
  readonly remove?: LeaveChange;
  readonly blocked?: Blocked;
}

export function detailActions(day: DayResult): DetailActions {
  if (!day.inPeriod) return {};
  const own = day.leave.find((piece) => piece.kind === "own");
  const take = own?.kind === "own" ? own.take : 0;
  const part = own?.kind === "own" ? own.part : undefined;
  const remove: LeaveChange | undefined = take > 0 ? { day: day.day, take: 0 } : undefined;
  const removeOnly = (blocked: Blocked): DetailActions => (remove ? { remove, blocked } : { blocked });
  if (day.leave.some((piece) => piece.kind === "mandatory")) return removeOnly("mandatory");
  if (day.leave.some((piece) => piece.kind === "otherPlan")) return removeOnly("otherPlan");
  if (day.required.value <= 0) return removeOnly("noRequired");
  const half = (side: "start" | "end"): LeaveChange | undefined =>
    take === UNITS_PER_DAY / 2 && part === side ? undefined : { day: day.day, take: 240, part: side };
  const actions: { -readonly [K in keyof DetailActions]: DetailActions[K] } = {};
  if (take !== UNITS_PER_DAY) actions.full = { day: day.day, take: 480 };
  const morning = half("start");
  if (morning) actions.morning = morning;
  const afternoon = half("end");
  if (afternoon) actions.afternoon = afternoon;
  if (remove) actions.remove = remove;
  return actions;
}
