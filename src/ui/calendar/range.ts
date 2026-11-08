// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayResult, PlanResult } from "../../engine/counting/plan.ts";
import type { LeavePiece } from "../../engine/counting/leave.ts";
import type { DayNumber } from "../../engine/days.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { LeaveChange } from "../worker/protocol.ts";

export type RangeAction = "full" | "half" | "remove";

// LeaveChange takes literal amounts; they equal UNITS_PER_DAY and UNITS_PER_DAY / 2.
const FULL = 480;
const HALF = 240;

type OwnPiece = Extract<LeavePiece, { kind: "own" | "mandatory" }> & { readonly kind: "own" };

/** Whether half days fit a plan's smallest leave unit: ½ must be a multiple of it, so not under "1" or "1/3". */
export function halfDayFits(minUnit: Units): boolean {
  return (UNITS_PER_DAY / 2) % minUnit === 0;
}

/** The day's result; undefined outside the computed window. */
function dayAt(result: PlanResult, day: DayNumber): DayResult | undefined {
  const first = result.days[0];
  return first === undefined ? undefined : result.days[day - first.day];
}

/** The plan's own leave on a day. Mandatory leave and leave from other plans are not own leave. */
function ownPiece(day: DayResult | undefined): OwnPiece | undefined {
  return day?.leave.find((piece): piece is OwnPiece => piece.kind === "own");
}

/** "remove" when the day the drag starts on has own leave, otherwise "full". */
export function actionForDrag(result: PlanResult, startDay: DayNumber): "full" | "remove" {
  return ownPiece(dayAt(result, startDay)) === undefined ? "full" : "remove";
}

/** The change a day needs for the action, or undefined when the day stays as it is. */
function changeFor(day: DayResult, action: RangeAction): LeaveChange | undefined {
  if (!day.inPeriod) return undefined;
  const own = ownPiece(day);
  if (action === "remove") return own === undefined ? undefined : { day: day.day, take: 0 };
  if (day.required.value <= 0) return undefined;
  if (day.leave.some((piece) => piece.kind === "mandatory" || piece.kind === "otherPlan")) return undefined;
  if (action === "full") {
    return own?.take === UNITS_PER_DAY ? undefined : { day: day.day, take: FULL };
  }
  return own?.take === UNITS_PER_DAY / 2 && own.part === "end" ? undefined : { day: day.day, take: HALF, part: "end" };
}

/** The changes for the days from `from` to `to` (either order), ascending. Days outside the period are never touched. */
export function rangeChanges(result: PlanResult, from: DayNumber, to: DayNumber, action: RangeAction): LeaveChange[] {
  const changes: LeaveChange[] = [];
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  for (let d = lo; d <= hi; d++) {
    const day = dayAt(result, d);
    const change = day === undefined ? undefined : changeFor(day, action);
    if (change !== undefined) changes.push(change);
  }
  return changes;
}

/** A click on a week number: sets the week's days, or takes the week's own leave away when there is nothing to set. */
export function weekChanges(result: PlanResult, weekStartDay: DayNumber): LeaveChange[] {
  const set = rangeChanges(result, weekStartDay, weekStartDay + 6, "full");
  return set.length > 0 ? set : rangeChanges(result, weekStartDay, weekStartDay + 6, "remove");
}

/**
 * A week-number tap in the selection mode: the week's working days in the period, from its first to its last,
 * whatever leave they have (the selection bar decides what to do with them). Undefined when there is none.
 */
export function weekSelection(result: PlanResult, weekStartDay: DayNumber): { anchor: DayNumber; head: DayNumber } | undefined {
  let anchor: DayNumber | undefined;
  let head: DayNumber | undefined;
  for (let d = weekStartDay; d <= weekStartDay + 6; d++) {
    const day = dayAt(result, d);
    if (day === undefined || !day.inPeriod || day.required.value <= 0) continue;
    anchor ??= d;
    head = d;
  }
  return anchor === undefined || head === undefined ? undefined : { anchor, head };
}

/** A click on one day: own leave is removed, otherwise a full day is set where that is possible. */
export function toggleDay(result: PlanResult, day: DayNumber): LeaveChange[] {
  return rangeChanges(result, day, day, actionForDrag(result, day));
}
