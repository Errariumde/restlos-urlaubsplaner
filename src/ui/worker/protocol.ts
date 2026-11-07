// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The messages between the page and the engine worker (docs/SPEC.md, Architecture, "Worker"). Every
// message is a plain object: the model stays in the worker, the page receives only what it shows.
import type { Part, PlanPeriod } from "../../engine/counting/types.ts";
import type { PlanResult } from "../../engine/counting/plan.ts";
import type { Stretch } from "../../engine/counting/stretches.ts";
import type { DayNumber, Weekday } from "../../engine/days.ts";
import type { Color, FileSource, Text } from "../../engine/file/types.ts";
import type { Units } from "../../engine/weight.ts";

/** One day of the plan's own leave to set; `take: 0` removes it. `part` only counts for 240. */
export type LeaveChange = { readonly day: DayNumber; readonly take: 0 | 240 | 480; readonly part?: Part };

export interface SourceMeta {
  readonly id: string;
  readonly name: Text;
  readonly type: FileSource["type"];
  readonly color: Color;
  readonly visible: boolean;
}

/** What the page shows of the opened file besides the result; it doesn't change while the file is open. */
export interface PlanMeta {
  readonly name: Text | undefined; // contract.name
  readonly countryNameKey: string;
  readonly regionNameKey: string | undefined;
  readonly weekStart: Weekday;
  readonly weekend: readonly Weekday[];
  readonly period: PlanPeriod;
  readonly allowance: Units;
  readonly sources: readonly SourceMeta[];
  readonly example: boolean;
}

export interface PlanState {
  readonly meta: PlanMeta;
  readonly result: PlanResult;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** The plan's own leave differs from the leave it was opened with. */
  readonly changed: boolean;
}

/** What a change would do, for the hint line while a gesture is going on. */
export interface Hint {
  readonly days: number; // the days the change would alter
  readonly cost: Units; // planned after − planned before
  readonly remaining: Units; // after the change
  readonly stretch: Stretch | undefined; // the listed stretch after the change that contains the first changed day
}

export type Request =
  | { readonly id: number; readonly type: "open"; readonly text: string; readonly example: boolean }
  | { readonly id: number; readonly type: "apply" | "preview"; readonly changes: readonly LeaveChange[] }
  | { readonly id: number; readonly type: "undo" | "redo" };

export type Response =
  | { readonly id: number; readonly type: "state"; readonly state: PlanState }
  | { readonly id: number; readonly type: "hint"; readonly hint: Hint }
  | { readonly id: number; readonly type: "refused"; readonly code: string }
  | { readonly id: number; readonly type: "failed"; readonly message: string };
