// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// How a day's leave looks (docs/SPEC.md, "Day cell: what is shown how"): one reading of where the engine placed
// each kind of leave, for the cell's fill, its label and the detail alike. Shares are drawn on the cell's
// diagonal so that the area before a stop is the share of the day.
import type { DayResult } from "../../engine/counting/plan.ts";
import type { RequiredWork } from "../../engine/counting/required.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";

/** Where a share lies: half a day in the morning or the afternoon, else at the start, the end or in the middle; "spread" over several spans. */
export type Where = "morning" | "afternoon" | "start" | "end" | "middle" | "spread";

export interface Span {
  readonly from: Units;
  readonly to: Units;
}

/** Own or mandatory leave on a day that is not wholly of one kind: its amount, where it lies, and its spans in day positions. */
export interface LeaveShare {
  readonly kind: "own" | "mandatory";
  readonly units: Units;
  readonly where: Where;
  readonly spans: readonly Span[];
}

export interface DayLeaveView {
  /**
   * "full": only own leave, and no work left; "mandatory": only mandatory leave, and no work left; "part": the
   * shares, each drawn where it lies; "none": no own or mandatory leave on the day.
   */
  readonly fill: "none" | "full" | "mandatory" | "part";
  /** For "part": own leave first, then mandatory leave; empty otherwise. */
  readonly shares: readonly LeaveShare[];
  /** Leave from another plan lies on the day (the cell's dashed border). */
  readonly otherPlan: boolean;
}

function whereOf(spans: readonly Span[]): Where {
  const [span] = spans;
  if (span === undefined || spans.length > 1) return "spread";
  const half = span.to - span.from === UNITS_PER_DAY / 2;
  if (span.from === 0) return half ? "morning" : "start";
  if (span.to === UNITS_PER_DAY) return half ? "afternoon" : "end";
  return "middle";
}

function share(kind: LeaveShare["kind"], spans: readonly Span[]): LeaveShare {
  let units = 0;
  for (const span of spans) units += span.to - span.from;
  return { kind, units, where: whereOf(spans), spans };
}

/**
 * The leave of a day as the cell, its label and the detail show it. A kind fills the cell only when it is the
 * day's only leave and no work is left; leave on a day without work lies nowhere, and own leave there fills it
 * too. Otherwise each share is drawn where the engine placed it: own leave where no mandatory leave lies.
 */
export function dayLeave(day: DayResult): DayLeaveView {
  const { placed, whole } = day.evaluation;
  const own: Span[] = [];
  const mandatory: Span[] = [];
  let otherPlaced = false;
  for (const span of placed) {
    if (span.kind === "own") own.push({ from: span.from, to: span.to });
    else if (span.kind === "mandatory") mandatory.push({ from: span.from, to: span.to });
    else otherPlaced = true;
  }
  const hasOwn = day.leave.some((piece) => piece.kind === "own" && piece.take > 0);
  const hasMandatory = day.leave.some((piece) => piece.kind === "mandatory");
  const otherPlan = day.leave.some((piece) => piece.kind === "otherPlan");
  if (whole && !otherPlaced && mandatory.length === 0 && hasOwn) return { fill: "full", shares: [], otherPlan };
  if (whole && !otherPlaced && own.length === 0 && hasMandatory) return { fill: "mandatory", shares: [], otherPlan };
  const shares: LeaveShare[] = [];
  if (own.length > 0) shares.push(share("own", own));
  if (mandatory.length > 0) shares.push(share("mandatory", mandatory));
  return { fill: shares.length > 0 ? "part" : "none", shares, otherPlan };
}

/**
 * Where on the cell's 135° diagonal (0 at the start corner, 1 at the end corner) a line must lie so that the
 * triangle or pentagon before it covers `share` of a square cell: ½ stays the middle, ⅛ moves to a quarter.
 */
export function areaStop(share: number): number {
  return share <= 0.5 ? Math.sqrt(share / 2) : 1 - Math.sqrt((1 - share) / 2);
}

/** A stop on the diagonal as a CSS percentage, with at most two decimals. */
function percent(units: Units): string {
  return `${String(Number((areaStop(units / UNITS_PER_DAY) * 100).toFixed(2)))}%`;
}

/**
 * The color stops of a mask along the diagonal that shows the spans and hides the rest (opaque `currentColor`
 * shows, `transparent` hides), for `linear-gradient(<diagonal>, …)`.
 */
export function maskStops(spans: readonly Span[]): string {
  const stops: string[] = [];
  let cursor = "0%";
  for (const span of spans) {
    const from = percent(span.from);
    const to = percent(span.to);
    stops.push(`transparent ${cursor} ${from}`, `currentColor ${from} ${to}`);
    cursor = to;
  }
  stops.push(`transparent ${cursor} 100%`);
  return stops.join(", ");
}

/** Where the work block of a partly free day lies on the diagonal: at the start, or at the end when the free time is at the start. */
export function workStops(required: Pick<RequiredWork, "value" | "freePart">): { from: string; to: string } {
  const start = required.freePart === "end" ? 0 : UNITS_PER_DAY - required.value;
  return { from: percent(start), to: percent(start + required.value) };
}
