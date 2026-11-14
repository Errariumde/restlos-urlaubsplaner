// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayResult, PlanResult } from "../../engine/counting/plan.ts";
import type { LeavePiece } from "../../engine/counting/leave.ts";
import type { Part } from "../../engine/counting/types.ts";
import type { DayNumber } from "../../engine/days.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { LeaveChange } from "../worker/protocol.ts";

export type RangeAction = "full" | "half" | "remove";

const FULL = UNITS_PER_DAY;
const HALF = UNITS_PER_DAY / 2;

type OwnPiece = Extract<LeavePiece, { kind: "own" | "mandatory" }> & { readonly kind: "own" };
type Span = readonly [from: Units, to: Units];

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
function ownPiece(day: Pick<DayResult, "leave"> | undefined): OwnPiece | undefined {
  return day?.leave.find((piece): piece is OwnPiece => piece.kind === "own");
}

/** "remove" when the day the drag starts on has own leave, otherwise "full". */
export function actionForDrag(result: PlanResult, startDay: DayNumber): "full" | "remove" {
  return ownPiece(dayAt(result, startDay)) === undefined ? "full" : "remove";
}

/** Where a piece lies in the day, in day positions: own and mandatory leave at the start or the end of the day. */
function spanOf(piece: LeavePiece): Span {
  if (piece.kind === "otherPlan") return [piece.from, piece.to];
  const take = Math.min(piece.take, UNITS_PER_DAY);
  return piece.part === "start" ? [0, take] : [UNITS_PER_DAY - take, UNITS_PER_DAY];
}

/** The work block in day positions: the required work from the start of the day, or up to its end when the free time lies at the start. */
function workBlock(day: Pick<DayResult, "required">): Span {
  const from = day.required.freePart === "end" ? 0 : UNITS_PER_DAY - day.required.value;
  return [from, from + day.required.value];
}

/** The stretches of the work block that none of the pieces covers, sorted. */
function uncoveredWork(day: Pick<DayResult, "required">, pieces: readonly LeavePiece[]): [from: Units, to: Units][] {
  const [start, end] = workBlock(day);
  const gaps: [Units, Units][] = [];
  let cursor = start;
  for (const [from, to] of pieces.map(spanOf).toSorted((a, b) => a[0] - b[0])) {
    if (from >= end) break;
    if (from > cursor) gaps.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) gaps.push([cursor, end]);
  return gaps;
}

/** Whether leave of any kind covers all of the day's work; true on a day without work. */
export function whollyFree(day: Pick<DayResult, "required" | "leave">): boolean {
  return uncoveredWork(day, day.leave).length === 0;
}

/**
 * The work that mandatory leave and other plans' leave leave free, in day positions, sorted: where own leave can
 * free work. Own leave doesn't count.
 */
export function workLeft(day: Pick<DayResult, "required" | "leave">): readonly [from: Units, to: Units][] {
  return uncoveredWork(day, day.leave.filter((piece) => piece.kind !== "own"));
}

/**
 * The change a day needs for the action, or undefined when the day stays as it is. Own leave lies at an edge of the
 * day and may reach the work across time without work. Without other leave on the work, setting gives a full day,
 * or half a day at the end unless the end half has no work, then at the start. Beside mandatory leave and other
 * plans' leave, it fills the work they leave free (all of it for a full day, half a day of it at most for a half
 * day), from the edge of the day that work reaches; work left on both sides of such leave is left alone. A day that
 * is wholly free with own leave on it counts as set.
 */
export function changeFor(day: Pick<DayResult, "day" | "inPeriod" | "required" | "leave">, action: RangeAction): LeaveChange | undefined {
  if (!day.inPeriod) return undefined;
  const own = ownPiece(day);
  if (action === "remove") return own === undefined ? undefined : { day: day.day, take: 0 };
  if (day.required.value <= 0) return undefined;
  if (action === "full" && own !== undefined && whollyFree(day)) return undefined;
  const [start, end] = workBlock(day);
  const rest = workLeft(day);
  const [only] = rest;
  if (only === undefined || rest.length > 1) return undefined;
  const [from, to] = only;
  let take: Units;
  let part: Part;
  if (from === start && to === end) {
    // No other leave lies on the work. Half a day goes at the end, unless the end half has no work.
    take = action === "full" ? FULL : HALF;
    part = action === "full" || end > UNITS_PER_DAY - HALF ? "end" : "start";
  } else if (from === start) {
    // The work left reaches the start of the work block, and from there across any free time the start of the day.
    take = action === "full" ? to : Math.min(to, from + HALF);
    part = "start";
  } else if (to === end) {
    take = UNITS_PER_DAY - (action === "full" ? from : Math.max(from, to - HALF));
    part = "end";
  } else {
    return undefined;
  }
  if (own !== undefined && own.take === take && (take >= UNITS_PER_DAY || own.part === part)) return undefined;
  return take >= UNITS_PER_DAY ? { day: day.day, take } : { day: day.day, take, part };
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
