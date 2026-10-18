// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { LeaveDay, DayMatch, DayRule, Part, PlanPeriod, RequiredOverride, WorkWeekEntry } from "../counting/types";
import type { DayNumber } from "../days";
import type { Units } from "../weight";

/** The checked in-memory model of a file: dates are day numbers, weights are units. */

export type Text = string | Readonly<Record<string, string>>; // language code → text
export interface Reference {
  readonly title: Text;
  readonly version: Text;
  readonly url: string;
  readonly checked: DayNumber;
}
export type FileRule = DayRule & {
  readonly label?: Text;
  readonly note?: Text;
  readonly references?: readonly string[];
  readonly origin?: string;
};
export interface FileRegion {
  readonly country: string;
  readonly state?: string;
  readonly options?: Readonly<Record<string, boolean>>;
}
export interface FileContract {
  readonly name?: Text;
  readonly description?: Text;
  readonly references: Readonly<Record<string, Reference>>; // {} when absent
  readonly region: FileRegion;
  readonly minUnit: Units;
  readonly week: readonly WorkWeekEntry[];
  readonly rules: readonly FileRule[];
}
export type EntryWhen =
  | { readonly date: DayNumber }
  | { readonly match: DayMatch; readonly validFrom?: number; readonly validUntil?: number; readonly except?: readonly DayNumber[] };
export type Entry<T> = EntryWhen & { readonly name?: Text } & T;
export type Color = { readonly slot: string } | { readonly rgb: string };
interface SourceBase {
  readonly id: string;
  readonly name: Text;
  readonly color: Color;
  readonly visible: boolean;
  readonly origin?: string;
}
export interface OtherPlanRef {
  readonly id: string;
  readonly name: Text;
  readonly revision: number;
}
export type FileSource = SourceBase &
  (
    | { readonly type: "holiday"; readonly entries: readonly Entry<{ readonly required: Units; readonly part?: Part }>[] }
    | { readonly type: "paidClosure" | "info"; readonly entries: readonly Entry<object>[] }
    | { readonly type: "mandatory" | "needed"; readonly entries: readonly Entry<{ readonly take: Units; readonly part?: Part }>[] }
    | {
        readonly type: "otherPlan";
        readonly plan: OtherPlanRef;
        readonly entries: readonly ({
          readonly date: DayNumber;
          readonly from: Units;
          readonly to: Units;
          readonly kind: "leave" | "mandatory";
        } & { readonly name?: Text })[];
      }
  );
export interface TemplateImage {
  readonly name: string;
  readonly type: "image/png" | "image/jpeg" | "image/svg+xml";
  readonly data: string; // Base64
}
export interface Template {
  readonly id: string;
  readonly name: Text;
  readonly api: number;
  readonly typst: string;
  readonly typ: string;
  readonly images?: readonly TemplateImage[];
  readonly origin?: string;
}
export type Theme = Readonly<Record<string, unknown>> | null;
export interface Note {
  readonly day: DayNumber;
  readonly text: string;
}
export interface FilePlan {
  readonly range: PlanPeriod;
  readonly allowance: Units;
  readonly days: readonly LeaveDay[];
  readonly overrides: readonly RequiredOverride[];
  readonly notes: readonly Note[];
}
export interface RuleSetFile {
  readonly kind: "ruleSet";
  readonly id: string;
  readonly revision: number;
  readonly contract: FileContract;
  readonly sources: readonly FileSource[];
  readonly templates: readonly Template[];
  readonly theme: Theme;
}
export interface PlanFile extends Omit<RuleSetFile, "kind"> {
  readonly kind: "plan";
  readonly ruleSet?: OtherPlanRef;
  readonly plan: FilePlan;
}
export type AnyFile = PlanFile | RuleSetFile;
