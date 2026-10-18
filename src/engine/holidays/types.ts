// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber, Weekday } from "../days";

export interface Source {
  readonly title: string;
  readonly url: string;
  readonly checked: string; // ISO date
}

export type DateRule =
  | {
      readonly type: "fixed";
      readonly month: number;
      readonly day: number;
      readonly nonLeap?: "drop" | "feb28" | "mar1"; // only, and required, for 02-29
    }
  | { readonly type: "easter"; readonly offset: number }
  | { readonly type: "orthodoxEaster"; readonly offset: number }
  | {
      readonly type: "weekdayRelative";
      readonly weekday: Weekday;
      readonly relation: "before" | "onOrBefore" | "after" | "onOrAfter";
      readonly month: number;
      readonly day: number;
    }
  | {
      readonly type: "nthWeekday";
      readonly month: number;
      readonly weekday: Weekday;
      readonly n: 1 | 2 | 3 | 4 | -1; // -1 = last
    }
  | { readonly type: "once"; readonly date: string }; // ISO date

export interface HolidayRule {
  readonly id: string;
  readonly nameKey: string;
  readonly date: DateRule;
  readonly regions: "all" | readonly string[]; // region IDs
  readonly localRule?: string; // applies only when this switch is on
  readonly validFrom?: number; // years, inclusive
  readonly validUntil?: number;
  readonly substitute?: { readonly when: readonly Weekday[] }; // subset of the country's weekend
  readonly sources: readonly string[]; // keys of CountryData.sources, non-empty
}

export interface Region {
  readonly id: string;
  readonly nameKey: string;
}

export interface LocalRule {
  readonly id: string;
  readonly regions: readonly string[];
  readonly nameKey: string;
  readonly explanationKey: string;
  readonly sources: readonly string[];
}

/** Country data is shared by all callers (see src/data/holidays), hence read-only throughout. */
export interface CountryData {
  readonly schema: 1;
  readonly country: string;
  readonly nameKey: string;
  readonly weekStart: Weekday;
  readonly weekend: readonly Weekday[];
  readonly workWeek: Readonly<Record<Weekday, string>>; // weight strings
  readonly sources: Readonly<Record<string, Source>>;
  readonly regions: readonly Region[];
  readonly localRules: readonly LocalRule[];
  readonly holidays: readonly HolidayRule[];
}

export interface RegionSelection {
  readonly country: string;
  readonly state: string;
  readonly options?: Readonly<Record<string, boolean>>;
}

export interface Holiday {
  readonly day: DayNumber;
  readonly ruleId: string;
  readonly nameKey: string;
  readonly substitute: boolean;
}
