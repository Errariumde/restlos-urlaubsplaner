// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber, Weekday } from "../days";

export interface Source {
  title: string;
  url: string;
  checked: string; // ISO date
}

export type DateRule =
  | { type: "fixed"; month: number; day: number; nonLeap?: "drop" | "feb28" | "mar1" } // nonLeap only, and required, for 02-29
  | { type: "easter"; offset: number }
  | { type: "orthodoxEaster"; offset: number }
  | {
      type: "weekdayRelative";
      weekday: Weekday;
      relation: "before" | "onOrBefore" | "after" | "onOrAfter";
      month: number;
      day: number;
    }
  | { type: "nthWeekday"; month: number; weekday: Weekday; n: 1 | 2 | 3 | 4 | -1 } // -1 = last
  | { type: "once"; date: string }; // ISO date

export interface HolidayRule {
  id: string;
  nameKey: string;
  date: DateRule;
  regions: "all" | string[]; // region IDs
  localRule?: string; // applies only when this switch is on
  validFrom?: number; // years, inclusive
  validUntil?: number;
  substitute?: { when: Weekday[] }; // subset of the country's weekend
  sources: string[]; // keys of CountryData.sources, non-empty
}

export interface Region {
  id: string;
  nameKey: string;
}

export interface LocalRule {
  id: string;
  regions: string[];
  nameKey: string;
  explanationKey: string;
  sources: string[];
}

export interface CountryData {
  schema: 1;
  country: string;
  nameKey: string;
  weekStart: Weekday;
  weekend: Weekday[];
  workWeek: Record<Weekday, string>; // weight strings
  sources: Record<string, Source>;
  regions: Region[];
  localRules: LocalRule[];
  holidays: HolidayRule[];
}

export interface RegionSelection {
  country: string;
  state: string;
  options?: Readonly<Record<string, boolean>>;
}

export interface Holiday {
  day: DayNumber;
  ruleId: string;
  nameKey: string;
  substitute: boolean;
}
