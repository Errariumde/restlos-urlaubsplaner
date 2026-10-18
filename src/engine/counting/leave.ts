// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { checkUnits, UNITS_PER_DAY } from "../weight";
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

/** Half-open interval [from, to). Entries of a list have from < to; a window passed to `measureWithin` may be empty. */
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

/** The parts of `a` not covered by `b`. Both lists must be sorted and disjoint, as `union` returns them. */
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

function measure(list: readonly Interval[]): Units {
  let sum = 0;
  for (const [from, to] of list) sum += to - from;
  return sum;
}

/** The total length of the parts of `list` that lie inside the window [from, to). */
function measureWithin(list: readonly Interval[], from: number, to: number): Units {
  let sum = 0;
  for (const [start, end] of list) sum += Math.max(0, Math.min(end, to) - Math.max(start, from));
  return sum;
}

function checkInputs(r: Units, pieces: readonly LeavePiece[]): void {
  checkUnits(r, "Required work");
  for (const piece of pieces) checkUnits(piece.take, "Leave take", 1);
}

/** The part of the work block `[0, r)` a piece covers; null when it covers nothing. */
function pieceInterval(piece: LeavePiece, r: Units): Interval | null {
  const length = Math.min(piece.take, r);
  if (length <= 0) return null;
  return piece.part === "start" ? [0, length] : [r - length, r];
}

/** IDs of the other-plan pieces that overlap own leave, each once, in input order. Throws RangeError for units out of range. */
export function overlappingOtherPlanIds(r: Units, pieces: readonly LeavePiece[]): string[] {
  checkInputs(r, pieces);
  const own = pieces.flatMap((piece) => (piece.kind === "own" ? [pieceInterval(piece, r)] : [])).filter((x) => x !== null);
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (piece.kind !== "otherPlan" || piece.sourceId === undefined) continue;
    const span = pieceInterval(piece, r);
    if (span !== null && measureWithin(own, span[0], span[1]) > 0) ids.add(piece.sourceId);
  }
  return [...ids];
}

/**
 * Cost of one day and where its free time lies. Positions are relative to the work block of
 * length `required.value`; `charge` is false for days outside the plan period, where
 * leave frees time but costs nothing in this plan. Throws RangeError for units out of range.
 */
export function evaluateLeave(
  required: Pick<RequiredWork, "value" | "freePart">,
  pieces: readonly LeavePiece[],
  charge: boolean,
): DayLeave {
  const r = required.value;
  checkInputs(r, pieces);
  const sets: Record<LeaveKind, Interval[]> = { own: [], mandatory: [], otherPlan: [] };
  let p = 0;
  let q = 0;
  for (const piece of pieces) {
    const span = pieceInterval(piece, r);
    if (span === null) continue;
    sets[piece.kind].push(span);
    if (piece.part === "start") p = Math.max(p, span[1]);
    else q = Math.max(q, r - span[0]);
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
    costStart: whole ? cost : measureWithin(charged, 0, p),
    costEnd: whole ? 0 : measureWithin(charged, r - q, r),
    ownCoveredByOtherPlan: measure(own) > measure(difference(own, other)),
  };
}
