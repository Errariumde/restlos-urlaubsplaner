// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { countries } from "../../../src/data/holidays";
import { dayFromIso, isoFromDay } from "../../../src/engine/days";
import type { DayNumber, Weekday } from "../../../src/engine/days";
import type { Contract, DayRule, PlanInput } from "../../../src/engine/counting/types";
import type { CountryData, DateRule } from "../../../src/engine/holidays/types";
import type { Units } from "../../../src/engine/weight";

export const d = dayFromIso;
export const isoDays = (days: readonly DayNumber[]): string[] => days.map(isoFromDay);
/** Every ISO date from `fromIso` to `toIso`, inclusive. */
export function span(fromIso: string, toIso: string): string[] {
  const result: string[] = [];
  for (let day = d(fromIso); day <= d(toIso); day++) result.push(isoFromDay(day));
  return result;
}

export const FULL = 480;
export const HALF = 240;
export const FULL_TIME: Readonly<Record<Weekday, Units>> = {
  mon: FULL,
  tue: FULL,
  wed: FULL,
  thu: FULL,
  fri: FULL,
  sat: 0,
  sun: 0,
};

export const fixed = (month: number, day: number): DateRule => ({ type: "fixed", month, day });
export const once = (date: string): DateRule => ({ type: "once", date });
export const easter = (offset: number): DateRule => ({ type: "easter", offset });

export const BAVARIA: Contract = {
  region: { country: "DE", state: "BY" },
  week: [{ from: d("2020-01-01"), required: FULL_TIME }],
  rules: [],
};

export const CHRISTMAS_EVE_RULES: readonly DayRule[] = [
  { id: "christmas-eve", match: fixed(12, 24), requiredAtMost: HALF },
  { id: "new-years-eve", match: fixed(12, 31), requiredAtMost: HALF },
];

const germany = ((): CountryData => {
  const data = countries["DE"];
  if (!data) throw new Error("German holiday data missing");
  return data;
})();

/** A full-year 2027 Bavarian plan; `changes` replace whole fields. */
export function baseInput(changes: Partial<PlanInput> = {}): PlanInput {
  return {
    country: germany,
    contract: BAVARIA,
    sources: [],
    period: { from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } },
    allowance: 30 * FULL,
    leave: [],
    overrides: [],
    ...changes,
  };
}
