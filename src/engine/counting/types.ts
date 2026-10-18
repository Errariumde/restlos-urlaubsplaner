// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber, Weekday } from "../days";
import type { CountryData, DateRule, RegionSelection } from "../holidays/types";
import type { Units } from "../weight";

/** Where in the day a partial piece lies: at the start or at the end of the working time. */
export type Part = "start" | "end";

export interface RangeMatch {
  readonly type: "range";
  readonly from: DateRule;
  readonly to?: DateRule; // exactly one of `to` and `days`
  readonly days?: number; // whole number, 1 … MAX_RANGE_DAYS
  readonly weekdays?: readonly Weekday[]; // non-empty when present
}
export type DayMatch = DateRule | RangeMatch;

interface DayRuleBase {
  readonly id: string;
  readonly match: DayMatch;
  readonly validFrom?: number; // years, inclusive; for a range, the year in which it starts
  readonly validUntil?: number;
  /** Where the free time lies when the effect's value is below a full day; default "end". */
  readonly part?: Part;
}
export type DayRule = DayRuleBase &
  (
    | { readonly requiredAtMost: Units; readonly requiredExactly?: never; readonly mandatory?: never }
    | { readonly requiredAtMost?: never; readonly requiredExactly: Units; readonly mandatory?: never }
    | { readonly requiredAtMost?: never; readonly requiredExactly?: never; readonly mandatory: Units }
  );

export interface WorkWeekEntry {
  readonly from: DayNumber; // valid until the next entry's `from`; the first entry also applies before it
  readonly required: Readonly<Record<Weekday, Units>>;
}

export interface Contract {
  readonly region: RegionSelection;
  readonly week: readonly WorkWeekEntry[]; // non-empty, strictly increasing `from`
  readonly rules: readonly DayRule[];
}

/** One day of a calendar source, already resolved from its iCal or plan file. */
export type SourceDay =
  | {
      readonly type: "holiday";
      readonly day: DayNumber;
      readonly sourceId: string;
      readonly required: Units;
      readonly part?: Part;
    }
  | { readonly type: "paidClosure" | "info"; readonly day: DayNumber; readonly sourceId: string }
  | {
      readonly type: "mandatory";
      readonly day: DayNumber;
      readonly sourceId: string;
      readonly take: Units;
      readonly part?: Part;
    }
  | {
      /** A span another plan charged on this day; covers leave here but never costs. */
      readonly type: "otherPlan";
      readonly day: DayNumber;
      readonly sourceId: string;
      /** Day positions: units of a full day, 0 = start of a full working day; 0 ≤ from < to ≤ 480. */
      readonly from: Units;
      readonly to: Units;
      /** What the other plan charged it as; for display only. */
      readonly kind: "leave" | "mandatory";
    };

export interface LeaveDay {
  readonly day: DayNumber;
  readonly take: Units; // 1 … 480
  readonly part?: Part; // required when take < 480
}

export interface RequiredOverride {
  readonly day: DayNumber;
  readonly required: Units;
  readonly part?: Part; // where the free time lies; default "end"
}

export interface YearMonth {
  readonly year: number;
  readonly month: number;
}
/** The months a plan covers, both inclusive. */
export interface PlanPeriod {
  readonly from: YearMonth;
  readonly to: YearMonth;
}

export interface PlanInput {
  readonly country: CountryData; // holiday data for contract.region.country
  readonly contract: Contract;
  readonly sources: readonly SourceDay[];
  readonly period: PlanPeriod;
  readonly allowance: Units; // ≥ 0, may exceed one day
  readonly leave: readonly LeaveDay[]; // at most one entry per day
  readonly overrides: readonly RequiredOverride[]; // at most one entry per day
}
