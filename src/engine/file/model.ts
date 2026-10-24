// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { countries } from "../../data/holidays";
import { computationWindow } from "../counting/plan";
import { ruleDays } from "../counting/match";
import type { DayRule, PlanInput, SourceDay } from "../counting/types";
import type { DayNumber } from "../days";
import type { FileRule, FileSource, PlanFile } from "./types";
import { LIMITS } from "./limits";

/** The days of one entry between `from` and `to`, ascending. */
function entryDays(entry: FileSource["entries"][number], from: DayNumber, to: DayNumber): DayNumber[] {
  if ("date" in entry) return entry.date >= from && entry.date <= to ? [entry.date] : [];
  const days = ruleDays(entry, from, to);
  if (entry.except === undefined || entry.except.length === 0) return days;
  const except = new Set(entry.except);
  return days.filter((day) => !except.has(day));
}

/**
 * Every entry's days between `from` and `to` as source days; `null` as soon as more than `max` would result.
 * Order: sources in list order, entries in list order, a match entry's days ascending.
 */
export function expandSources(
  sources: readonly FileSource[],
  from: DayNumber,
  to: DayNumber,
  max: number = LIMITS.sourceDays,
): SourceDay[] | null {
  const result: SourceDay[] = [];
  for (const source of sources) {
    for (const entry of source.entries) {
      for (const day of entryDays(entry, from, to)) {
        const base = { day, sourceId: source.id };
        switch (source.type) {
          case "holiday": {
            const { required, part } = entry as { required: number; part?: "start" | "end" };
            result.push(part === undefined ? { type: "holiday", ...base, required } : { type: "holiday", ...base, required, part });
            break;
          }
          case "paidClosure":
          case "info":
            result.push({ type: source.type, ...base });
            break;
          case "mandatory":
          case "needed": {
            const { take, part } = entry as { take: number; part?: "start" | "end" };
            result.push(part === undefined ? { type: source.type, ...base, take } : { type: source.type, ...base, take, part });
            break;
          }
          case "otherPlan": {
            const { from: spanFrom, to: spanTo, kind } = entry as { from: number; to: number; kind: "leave" | "mandatory" };
            result.push({ type: "otherPlan", ...base, from: spanFrom, to: spanTo, kind });
            break;
          }
        }
      }
      if (result.length > max) return null;
    }
  }
  return result;
}

function counted(rule: FileRule): DayRule {
  const copy: Record<string, unknown> = { ...rule };
  delete copy.label;
  delete copy.note;
  delete copy.references;
  delete copy.origin;
  return copy as unknown as DayRule;
}

/** The counting model's input for a plan file. Throws RangeError for a model `readFile` never produces. */
export function planInput(file: PlanFile): PlanInput {
  const { region } = file.contract;
  if (!Object.hasOwn(countries, region.country)) throw new RangeError("Unknown country");
  const country = countries[region.country];
  if (!country) throw new RangeError("Unknown country");
  if (region.state === undefined) throw new RangeError("The region needs a state");
  const window = computationWindow(file.plan.range);
  const sources = expandSources(file.sources, window.from, window.to);
  if (sources === null) throw new RangeError("The sources exceed the day limit");
  return {
    country,
    contract: {
      region: region.options === undefined
        ? { country: region.country, state: region.state }
        : { country: region.country, state: region.state, options: region.options },
      week: file.contract.week,
      rules: file.contract.rules.map(counted),
    },
    sources,
    period: file.plan.range,
    allowance: file.plan.allowance,
    leave: file.plan.days,
    overrides: file.plan.overrides,
  };
}
