// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";
import type { RequiredWork } from "./required";
import type { Part } from "./types";

export type LeaveKind = "own" | "mandatory" | "otherPlan";

export interface LeavePiece {
  readonly kind: LeaveKind;
  readonly take: Units; // 1 … 480
  readonly part: Part;
  readonly ruleId?: string; // mandatory leave from a day rule
  readonly sourceId?: string; // mandatory or other-plan leave from a calendar source
}

export interface DayLeave {
  readonly cost: Units; // ownCost + mandatoryCost
  readonly ownCost: Units;
  readonly mandatoryCost: Units;
  readonly remaining: Units; // work left
  readonly whole: boolean; // remaining === 0
  readonly freeStart: Units; // free time at the start of the day; 480 when whole
  readonly freeEnd: Units; // free time at the end of the day; 480 when whole
  readonly costStart: Units; // cost inside the free time at the start; the whole cost when whole
  readonly costEnd: Units; // cost inside the free time at the end; 0 when whole
  readonly ownCoveredByOtherPlan: boolean;
}

/** Half-open interval [from, to) with from < to. */
type Interval = readonly [from: number, to: number];

/** Sorted, non-overlapping, non-touching intervals. */
function union(...lists: readonly (readonly Interval[])[]): Interval[] {
  const all = lists.flat().toSorted((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [from, to] of all) {
    const last = out[out.length - 1];
    if (last !== undefined && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

function difference(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [from, to] of a) {
    let cursor = from;
    for (const [bFrom, bTo] of b) {
      if (bTo <= cursor || bFrom >= to) continue;
      if (bFrom > cursor) out.push([cursor, bFrom]);
      cursor = Math.max(cursor, bTo);
    }
    if (cursor < to) out.push([cursor, to]);
  }
  return out;
}

function measure(list: readonly Interval[], within: Interval = [-Infinity, Infinity]): Units {
  let sum = 0;
  for (const [from, to] of list) sum += Math.max(0, Math.min(to, within[1]) - Math.max(from, within[0]));
  return sum;
}

/**
 * Cost of one day and where its free time lies. Positions are relative to the work block of
 * length `required.value`; `charge` is false for days outside the plan period or without
 * allowance cost, which frees time but charges nothing.
 */
export function evaluateLeave(
  required: Pick<RequiredWork, "value" | "freePart">,
  pieces: readonly LeavePiece[],
  charge: boolean,
): DayLeave {
  const r = required.value;
  const sets: Record<LeaveKind, Interval[]> = { own: [], mandatory: [], otherPlan: [] };
  let p = 0;
  let q = 0;
  for (const piece of pieces) {
    const length = Math.min(piece.take, r);
    if (length <= 0) continue;
    if (piece.part === "start") {
      sets[piece.kind].push([0, length]);
      p = Math.max(p, length);
    } else {
      sets[piece.kind].push([r - length, r]);
      q = Math.max(q, length);
    }
  }
  const own = union(sets.own);
  const mand = union(sets.mandatory);
  const other = union(sets.otherPlan);

  const remaining = Math.max(0, r - p - q);
  const whole = remaining === 0;

  const mandCharged = difference(mand, other);
  const charged = charge ? union(own, mandCharged) : [];
  const cost = measure(charged);
  const mandatoryCost = charge ? measure(mandCharged) : 0;

  const a = required.freePart === "end" ? 0 : UNITS_PER_DAY - r;
  return {
    cost,
    ownCost: cost - mandatoryCost,
    mandatoryCost,
    remaining,
    whole,
    freeStart: whole ? UNITS_PER_DAY : a + p,
    freeEnd: whole ? UNITS_PER_DAY : UNITS_PER_DAY - a - r + q,
    costStart: whole ? cost : measure(charged, [0, p]),
    costEnd: whole ? 0 : measure(charged, [r - q, r]),
    ownCoveredByOtherPlan: measure(difference(own, difference(own, other))) > 0,
  };
}
