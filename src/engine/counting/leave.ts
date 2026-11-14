// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { checkSpan, checkUnits, UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";
import type { RequiredWork } from "./required";
import type { Part } from "./types";

export type LeaveKind = "own" | "mandatory" | "otherPlan";

/**
 * A piece of leave on a day, at day positions (units of a full day, 0 = the start of the day, 480 = its end).
 * Own and mandatory leave lie at the start or the end of the day: `part: "start"` covers [0, take), `"end"`
 * covers [480 − take, 480). Leave from another plan covers [from, to).
 */
export type LeavePiece =
  | {
      readonly kind: "own" | "mandatory";
      readonly take: Units; // 1 … 480
      readonly part: Part;
      readonly ruleId?: string; // mandatory leave from a day rule
      readonly sourceId?: string; // mandatory leave from a calendar source
    }
  | {
      readonly kind: "otherPlan";
      readonly from: Units; // day positions, 0 ≤ from < to ≤ 480
      readonly to: Units;
      readonly sourceId?: string; // the calendar source holding the other plan's leave
    };

/** A span of a day that this plan charges, in day positions; it lies inside the work. */
export interface ChargedSpan {
  readonly from: Units;
  readonly to: Units;
  readonly kind: "leave" | "mandatory";
}

/** A span of a day where one kind of leave lies, in day positions. */
export interface PlacedSpan {
  readonly from: Units;
  readonly to: Units;
  readonly kind: LeaveKind;
}

/**
 * One day's leave measured against its work, in day positions. The work is one block of `required.value` units from
 * the start of the day, or up to its end when the free time lies at the start (`required.freePart`); the rest of the
 * day is time without work. Leave is charged only where it overlaps the work.
 */
export interface DayLeave {
  readonly cost: Units; // ownCost + mandatoryCost
  readonly ownCost: Units; // charged own leave: own leave on work where no charged mandatory leave lies
  readonly mandatoryCost: Units; // charged mandatory leave: mandatory leave on work where no other plan's leave lies
  readonly ownWorkOverlap: Units; // how much of own leave overlaps the work, charged or not; 0 without own leave
  readonly remaining: Units; // work that no leave covers
  readonly whole: boolean; // remaining === 0
  readonly freeStart: Units; // free time at the start of the day: time without work or with leave, from 0; 480 when whole
  readonly freeEnd: Units; // free time at the end of the day: time without work or with leave, up to 480; 480 when whole
  readonly costStart: Units; // cost inside the free time at the start; the whole cost when whole
  readonly costEnd: Units; // cost inside the free time at the end; 0 when whole
  readonly ownCoveredByOtherPlan: boolean; // own leave on work overlaps another plan's leave
  /**
   * The charged time in day positions, sorted by `from`, non-overlapping, with lengths adding up to
   * `cost`: "mandatory" spans are the charged mandatory leave (`mandatoryCost`), "leave" spans the
   * rest of the charged own leave. Empty when the day is not charged.
   */
  readonly charged: readonly ChargedSpan[];
  /**
   * Where each kind of leave lies, in day positions, charged or not (also outside the plan period and on time
   * without work), sorted by `from`, non-overlapping: mandatory leave where no other plan's leave lies, own leave
   * where no such mandatory leave lies (inside the work and with charging, the spans of `charged`), another plan's
   * leave where neither lies. Empty only on a day without leave.
   */
  readonly placed: readonly PlacedSpan[];
}

/** Half-open interval [from, to). Entries of a list have from < to. */
type Interval = readonly [from: number, to: number];

/** Sorted, non-overlapping, non-touching intervals. */
function union(...lists: readonly (readonly Interval[])[]): Interval[] {
  // Most days with leave have one piece: nothing to sort or merge.
  let count = 0;
  let only: Interval | undefined;
  for (const list of lists) {
    count += list.length;
    only = list[0] ?? only;
  }
  if (count <= 1) return only === undefined ? [] : [only];
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

/** The total length of the parts of `list` that lie inside the window [from, to); the window may be empty. */
function measureWithin(list: readonly Interval[], from: number, to: number): Units {
  let sum = 0;
  for (const [start, end] of list) sum += Math.max(0, Math.min(end, to) - Math.max(start, from));
  return sum;
}

function checkInputs(r: Units, pieces: readonly LeavePiece[]): void {
  checkUnits(r, "Required work");
  for (const piece of pieces) {
    if (piece.kind === "otherPlan") checkSpan(piece.from, piece.to, "leave from another plan");
    else checkUnits(piece.take, "Leave take", 1);
  }
}

/** The parts of `list` inside the window [from, to); the window may be empty. Keeps the order of `list`. */
function within(list: readonly Interval[], from: number, to: number): Interval[] {
  const out: Interval[] = [];
  for (const [start, end] of list) {
    const clippedFrom = Math.max(start, from);
    const clippedTo = Math.min(end, to);
    if (clippedFrom < clippedTo) out.push([clippedFrom, clippedTo]);
  }
  return out;
}

/** The day position where the work block starts: the free time of a day below a full day lies at `freePart`. */
function blockStart(required: Pick<RequiredWork, "value" | "freePart">): Units {
  return required.freePart === "end" ? 0 : UNITS_PER_DAY - required.value;
}

/** Where a piece lies in the day, in day positions. */
function pieceSpan(piece: LeavePiece): Interval {
  if (piece.kind === "otherPlan") return [piece.from, piece.to];
  return piece.part === "start" ? [0, piece.take] : [UNITS_PER_DAY - piece.take, UNITS_PER_DAY];
}

/** Intervals as spans of one kind. */
function spans<K extends string>(list: readonly Interval[], kind: K): { from: Units; to: Units; kind: K }[] {
  return list.map(([from, to]) => ({ from, to, kind }));
}

const byFrom = (x: { readonly from: Units }, y: { readonly from: Units }): number => x.from - y.from;

/**
 * IDs of the other-plan pieces that overlap own leave on work, each once, in input order. Own leave on time without
 * work overlaps nothing here. Throws RangeError for units or spans out of range.
 */
export function overlappingOtherPlanIds(required: Pick<RequiredWork, "value" | "freePart">, pieces: readonly LeavePiece[]): string[] {
  const r = required.value;
  checkInputs(r, pieces);
  const a = blockStart(required);
  const own = pieces.flatMap((piece) => (piece.kind === "own" ? [pieceSpan(piece)] : []));
  const ownWork = within(own, a, a + r);
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (piece.kind !== "otherPlan" || piece.sourceId === undefined) continue;
    if (measureWithin(ownWork, piece.from, piece.to) > 0) ids.add(piece.sourceId);
  }
  return [...ids];
}

/**
 * Cost of one day and where its free time lies, all in day positions. The work block of length `required.value`
 * starts at 0 or ends at 480 as `required.freePart` says (see `DayLeave`). Leave lies where it lies in the day,
 * also on time without work, but is charged only where it overlaps the work: mandatory leave where no other plan's
 * leave lies, own leave where no such mandatory leave lies, each once. Leave from another plan is never charged.
 * `charge` is false for days outside the plan period, where leave frees time but costs nothing in this plan.
 * Throws RangeError for units or spans out of range.
 */
export function evaluateLeave(
  required: Pick<RequiredWork, "value" | "freePart">,
  pieces: readonly LeavePiece[],
  charge: boolean,
): DayLeave {
  const r = required.value;
  checkInputs(r, pieces);
  const a = blockStart(required);
  const workEnd = a + r;
  if (pieces.length === 0) {
    // Most days have no leave; they skip building the lists. The free time is the time without work.
    const noWork = r === 0;
    return {
      cost: 0,
      ownCost: 0,
      mandatoryCost: 0,
      ownWorkOverlap: 0,
      remaining: r,
      whole: noWork,
      freeStart: noWork ? UNITS_PER_DAY : a,
      freeEnd: noWork ? UNITS_PER_DAY : UNITS_PER_DAY - workEnd,
      costStart: 0,
      costEnd: 0,
      ownCoveredByOtherPlan: false,
      charged: [],
      placed: [],
    };
  }

  const sets: Record<LeaveKind, Interval[]> = { own: [], mandatory: [], otherPlan: [] };
  for (const piece of pieces) sets[piece.kind].push(pieceSpan(piece));
  const own = union(sets.own);
  const mand = union(sets.mandatory);
  const other = union(sets.otherPlan);
  const leave = union(own, mand, other);

  const remaining = r - measureWithin(leave, a, workEnd);
  const whole = remaining === 0;
  // The free time at an edge of the day is the stretch of time without work or with leave touching it: from 0 over the
  // time without work before the block, then over leave without a gap; the same backwards from 480. Leave on time
  // without work doesn't change it, and a piece in the middle frees neither edge.
  let p = a;
  for (const [from, to] of leave) {
    if (from > p) break;
    p = Math.max(p, to);
  }
  let endFrom = workEnd;
  for (let i = leave.length - 1; i >= 0; i--) {
    const span = leave[i];
    if (span === undefined || span[1] < endFrom) break;
    endFrom = Math.min(endFrom, span[0]);
  }
  const q = UNITS_PER_DAY - endFrom;

  const mandPlaced = mand.length === 0 ? mand : difference(mand, other);
  const ownPlaced = own.length === 0 ? own : difference(own, mandPlaced);
  const otherPlaced = other.length === 0 ? other : difference(other, ownPlaced);
  // Only the part of the placed leave that overlaps the work is charged.
  const mandCharged = charge ? within(mandPlaced, a, workEnd) : [];
  const ownCharged = charge ? within(ownPlaced, a, workEnd) : [];
  const mandatoryCost = measure(mandCharged);
  const ownCost = measure(ownCharged);
  const cost = ownCost + mandatoryCost;
  const ownWorkOverlap = measureWithin(own, a, workEnd);

  return {
    cost,
    ownCost,
    mandatoryCost,
    ownWorkOverlap,
    remaining,
    whole,
    freeStart: whole ? UNITS_PER_DAY : p,
    freeEnd: whole ? UNITS_PER_DAY : q,
    costStart: whole ? cost : measureWithin(ownCharged, 0, p) + measureWithin(mandCharged, 0, p),
    costEnd: whole ? 0 : measureWithin(ownCharged, endFrom, UNITS_PER_DAY) + measureWithin(mandCharged, endFrom, UNITS_PER_DAY),
    ownCoveredByOtherPlan: ownWorkOverlap > 0 && other.some(([from, to]) => measureWithin(own, Math.max(from, a), Math.min(to, workEnd)) > 0),
    charged: spans<ChargedSpan["kind"]>(ownCharged, "leave").concat(spans(mandCharged, "mandatory")).sort(byFrom),
    placed: spans<LeaveKind>(ownPlaced, "own").concat(spans(mandPlaced, "mandatory"), spans(otherPlaced, "otherPlan")).sort(byFrom),
  };
}
