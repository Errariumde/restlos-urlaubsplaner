// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { checkUnits, UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";
import type { RequiredWork } from "./required";
import type { Part } from "./types";

export type LeaveKind = "own" | "mandatory" | "otherPlan";

/**
 * A piece of leave on a day. Own and mandatory leave lie at the start or the end of the work block.
 * Leave from another plan lies at day positions (units of a full day, 0 = start of a full working day)
 * and covers the part of the work block inside them.
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

/** A span of a day that this plan charges, in day positions. */
export interface ChargedSpan {
  readonly from: Units;
  readonly to: Units;
  readonly kind: "leave" | "mandatory";
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
  /**
   * The charged time in day positions, sorted by `from`, non-overlapping, with lengths adding up to
   * `cost`: "mandatory" spans are the charged mandatory leave (`mandatoryCost`), "leave" spans the
   * rest of the charged own leave. Empty when the day is not charged.
   */
  readonly charged: readonly ChargedSpan[];
}

/** Half-open interval [from, to). Entries of a list have from < to. */
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

/** The total length of the parts of `list` that lie inside the window [from, to); the window may be empty. */
function measureWithin(list: readonly Interval[], from: number, to: number): Units {
  let sum = 0;
  for (const [start, end] of list) sum += Math.max(0, Math.min(end, to) - Math.max(start, from));
  return sum;
}

/** Throws RangeError unless `from` and `to` are day positions, whole units with 0 ≤ from < to ≤ 480. */
export function checkSpan(from: number, to: number, what: string): void {
  checkUnits(from, `The start of ${what}`);
  checkUnits(to, `The end of ${what}`);
  if (from >= to) throw new RangeError(`The start of ${what} must lie before its end`);
}

function checkInputs(r: Units, pieces: readonly LeavePiece[]): void {
  checkUnits(r, "Required work");
  for (const piece of pieces) {
    if (piece.kind === "otherPlan") checkSpan(piece.from, piece.to, "leave from another plan");
    else checkUnits(piece.take, "Leave take", 1);
  }
}

/** The day position where the work block starts: the free time of a day below a full day lies at `freePart`. */
function blockStart(required: Pick<RequiredWork, "value" | "freePart">): Units {
  return required.freePart === "end" ? 0 : UNITS_PER_DAY - required.value;
}

/** The part of the work block `[0, r)` that a piece covers, for a block starting at day position `a`; null when it covers nothing. */
function pieceInterval(piece: LeavePiece, r: Units, a: Units): Interval | null {
  if (piece.kind === "otherPlan") {
    const from = Math.max(0, piece.from - a);
    const to = Math.min(r, piece.to - a);
    return from < to ? [from, to] : null;
  }
  const length = Math.min(piece.take, r);
  if (length <= 0) return null;
  return piece.part === "start" ? [0, length] : [r - length, r];
}

/** Block intervals as charged spans in day positions. */
function spans(list: readonly Interval[], a: Units, kind: ChargedSpan["kind"]): ChargedSpan[] {
  return list.map(([from, to]) => ({ from: from + a, to: to + a, kind }));
}

/** IDs of the other-plan pieces that overlap own leave, each once, in input order. Throws RangeError for units or spans out of range. */
export function overlappingOtherPlanIds(required: Pick<RequiredWork, "value" | "freePart">, pieces: readonly LeavePiece[]): string[] {
  const r = required.value;
  checkInputs(r, pieces);
  const a = blockStart(required);
  const own = pieces.flatMap((piece) => (piece.kind === "own" ? [pieceInterval(piece, r, a)] : [])).filter((x) => x !== null);
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (piece.kind !== "otherPlan" || piece.sourceId === undefined) continue;
    const span = pieceInterval(piece, r, a);
    if (span !== null && measureWithin(own, span[0], span[1]) > 0) ids.add(piece.sourceId);
  }
  return [...ids];
}

/**
 * Cost of one day and where its free time lies. Own and mandatory leave lie at an edge of the work
 * block of length `required.value`, which starts at day position 0 or ends at 480 as
 * `required.freePart` says; leave from another plan and the charged spans are day positions.
 * `charge` is false for days outside the plan period, where leave frees time but costs nothing in
 * this plan. Throws RangeError for units or spans out of range.
 */
export function evaluateLeave(
  required: Pick<RequiredWork, "value" | "freePart">,
  pieces: readonly LeavePiece[],
  charge: boolean,
): DayLeave {
  const r = required.value;
  checkInputs(r, pieces);
  const a = blockStart(required);
  const sets: Record<LeaveKind, Interval[]> = { own: [], mandatory: [], otherPlan: [] };
  for (const piece of pieces) {
    const span = pieceInterval(piece, r, a);
    if (span !== null) sets[piece.kind].push(span);
  }
  const own = union(sets.own);
  const mand = union(sets.mandatory);
  const other = union(sets.otherPlan);

  // The free time at an edge of the block is the free stretch touching it; a piece in the middle frees neither edge.
  const free = union(own, mand, other);
  const first = free[0];
  const last = free.at(-1);
  const p = first !== undefined && first[0] === 0 ? first[1] : 0;
  const q = last !== undefined && last[1] === r ? r - last[0] : 0;
  const remaining = r - measure(free);
  const whole = remaining === 0;

  const mandCharged = charge ? difference(mand, other) : [];
  const ownCharged = charge ? difference(own, mandCharged) : [];
  const chargedBlock = union(ownCharged, mandCharged);
  const mandatoryCost = measure(mandCharged);
  const ownCost = measure(ownCharged);
  const cost = ownCost + mandatoryCost;

  return {
    cost,
    ownCost,
    mandatoryCost,
    remaining,
    whole,
    freeStart: whole ? UNITS_PER_DAY : a + p,
    freeEnd: whole ? UNITS_PER_DAY : UNITS_PER_DAY - a - r + q,
    costStart: whole ? cost : measureWithin(chargedBlock, 0, p),
    costEnd: whole ? 0 : measureWithin(chargedBlock, r - q, r),
    ownCoveredByOtherPlan: measure(own) > measure(difference(own, other)),
    charged: [...spans(ownCharged, a, "leave"), ...spans(mandCharged, a, "mandatory")].toSorted((x, y) => x.from - y.from),
  };
}
