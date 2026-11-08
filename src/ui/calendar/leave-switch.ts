// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The leave bar of the day detail (docs/SPEC.md, "Detail view"): one switch per segment of the day, mandatory leave
// and another plan's leave locked where they cover a whole segment, and the "Full day" checkbox. The bar draws the
// leave where the plan puts it in the day: own and mandatory leave at the start or the end as its `part` says, another
// plan's leave at its span. The engine still places own and mandatory leave inside the working time, so on a partly
// free day such as 24 December the cell can show it elsewhere until issue 0031 (charge leave only where it overlaps
// the working time) is done.
import type { LeaveKind, LeavePiece } from "../../engine/counting/leave.ts";
import type { DayResult } from "../../engine/counting/plan.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { LeaveChange } from "../worker/protocol.ts";
import { halfDayFits } from "./range.ts";

/** A switch's state for `aria-pressed` and a checkbox's for `checked`/`indeterminate`: all, none or part of it. */
export type Pressed = "true" | "false" | "mixed";

/** A stretch of a day in day positions, `from` < `to`. */
export interface Fill {
  readonly from: Units;
  readonly to: Units;
  readonly kind: LeaveKind;
}

export type LeaveSegment =
  | {
      readonly kind: "switch";
      readonly from: Units;
      readonly to: Units;
      /** "day" when the plan counts in whole days. */
      readonly name: "morning" | "afternoon" | "day";
      /** Whether own leave covers all, none or part of the segment's free time. */
      readonly pressed: Pressed;
      /** Where each kind of leave lies inside the segment. */
      readonly fills: readonly Fill[];
      /** What a click changes; undefined when it can't change anything. */
      readonly change?: LeaveChange;
    }
  | { readonly kind: "mandatory" | "otherPlan"; readonly from: Units; readonly to: Units };

export interface LeaveSwitch {
  /** All leave of the day, whatever its kind, charged or not. */
  readonly amount: Units;
  readonly segments: readonly LeaveSegment[];
  /** The "Full day" checkbox: only in half days and with at least one switch. */
  readonly fullDay?: { readonly checked: Pressed; readonly change?: LeaveChange };
}

type Span = readonly [from: Units, to: Units];

/** Sorted, merged spans. */
function union(spans: readonly Span[]): Span[] {
  const out: [Units, Units][] = [];
  for (const [from, to] of spans.toSorted((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last !== undefined && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

/** The parts of the sorted spans `a` that the sorted spans `b` don't cover. */
function minus(a: readonly Span[], b: readonly Span[]): Span[] {
  const out: Span[] = [];
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

/** The parts of the sorted spans inside [from, to). */
function within(spans: readonly Span[], from: Units, to: Units): Span[] {
  return spans.flatMap(([a, b]): Span[] => (Math.max(a, from) < Math.min(b, to) ? [[Math.max(a, from), Math.min(b, to)]] : []));
}

function measure(spans: readonly Span[]): Units {
  return spans.reduce((sum, [from, to]) => sum + to - from, 0);
}

/** Where a piece lies in the day. */
function spanOf(piece: LeavePiece): Span {
  if (piece.kind === "otherPlan") return [piece.from, piece.to];
  const take = Math.min(piece.take, UNITS_PER_DAY);
  return piece.part === "start" ? [0, take] : [UNITS_PER_DAY - take, UNITS_PER_DAY];
}

const spansOf = (day: DayResult, kind: LeaveKind): Span[] => union(day.leave.filter((piece) => piece.kind === kind).map(spanOf));

/**
 * The leave bar of a day. `minUnit` is the plan's smallest leave unit: half days where they fit it, else one switch
 * for the whole day. Own leave can be set only on a day in the plan period with required work; elsewhere it can only
 * be taken away.
 */
export function leaveSwitch(day: DayResult, minUnit: Units): LeaveSwitch {
  const step = halfDayFits(minUnit) ? UNITS_PER_DAY / 2 : UNITS_PER_DAY;
  const count = UNITS_PER_DAY / step;
  const own = day.leave.find((piece) => piece.kind === "own");
  const ownSpan = own === undefined ? [] : [spanOf(own)];
  const mandatory = spansOf(day, "mandatory");
  const other = spansOf(day, "otherPlan");
  // Mandatory leave lies over own leave, own leave over another plan's leave, as in the engine.
  const ownShown = minus(ownSpan, mandatory);
  const otherShown = minus(minus(other, mandatory), ownSpan);
  const locked = union([...mandatory, ...otherShown]);
  const blocking = union([...mandatory, ...other]);
  const canSet = day.inPeriod && day.required.value > 0;
  const removal: LeaveChange | undefined = own === undefined ? undefined : { day: day.day, take: 0 };

  /**
   * The change that makes own leave cover the segments [first, last): only the free time beside the other kinds of
   * leave, which must touch an edge of the day; overlapping mandatory leave is all right, as it counts once.
   */
  function changeTo(first: number, last: number): LeaveChange | undefined {
    if (first >= last) return removal;
    const wanted: Span = [first * step, last * step];
    const free = minus([wanted], blocking);
    let span: Span | undefined;
    const [only] = free;
    if (free.length === 0) return removal;
    if (free.length === 1 && only !== undefined && (only[0] === 0 || only[1] === UNITS_PER_DAY)) span = only;
    else if (measure(within(other, wanted[0], wanted[1])) === 0 && (wanted[0] === 0 || wanted[1] === UNITS_PER_DAY)) span = wanted;
    if (span === undefined) return undefined;
    const take = span[1] - span[0];
    const part = span[0] === 0 ? "start" : "end";
    if (own?.kind === "own" && own.take === take && (take >= UNITS_PER_DAY || own.part === part)) return undefined;
    return take >= UNITS_PER_DAY ? { day: day.day, take } : { day: day.day, take, part };
  }

  const names = count === 1 ? (["day"] as const) : (["morning", "afternoon"] as const);
  const pressed: Pressed[] = [];
  const segments: LeaveSegment[] = [];
  for (let index = 0; index < count; index++) {
    const from = index * step;
    const to = from + step;
    const freeTime = minus([[from, to]], locked);
    if (freeTime.length === 0) {
      const kind = measure(within(mandatory, from, to)) >= measure(within(otherShown, from, to)) ? "mandatory" : "otherPlan";
      const last = segments.at(-1);
      // Neighbouring locked segments of one kind are one block.
      if (last !== undefined && last.kind === kind) segments[segments.length - 1] = { ...last, to };
      else segments.push({ kind, from, to });
      pressed.push("false");
      continue;
    }
    const ownTime = measure(within(ownShown, from, to));
    const state: Pressed = ownTime === 0 ? "false" : ownTime >= measure(freeTime) ? "true" : "mixed";
    pressed.push(state);
    const fills: Fill[] = [
      ...within(mandatory, from, to).map(([a, b]): Fill => ({ from: a, to: b, kind: "mandatory" })),
      ...within(ownShown, from, to).map(([a, b]): Fill => ({ from: a, to: b, kind: "own" })),
      ...within(otherShown, from, to).map(([a, b]): Fill => ({ from: a, to: b, kind: "otherPlan" })),
    ].toSorted((a, b) => a.from - b.from);
    segments.push({ kind: "switch", from, to, name: names[index] ?? "day", pressed: state, fills });
  }

  // The segments own leave covers: a block at the start or the end of the day, or all of it.
  const covered = pressed.flatMap((state, index) => (state === "false" ? [] : [index]));
  const ownPart = own?.kind === "own" && own.take < UNITS_PER_DAY ? own.part : undefined;

  /** A click on a free segment extends the block, on one of the block shrinks it from there; with no block it fills from the nearer edge. */
  function clicked(index: number): LeaveChange | undefined {
    if (!canSet) return pressed[index] === "false" ? undefined : removal;
    const nearStart = index < count / 2;
    if (covered.length === 0) return nearStart ? changeTo(0, index + 1) : changeTo(index, count);
    if (ownPart === undefined) return nearStart ? changeTo(index + 1, count) : changeTo(0, index);
    const extend = pressed[index] !== "true"; // a free segment, or one own leave covers only in part
    if (ownPart === "start") return extend ? changeTo(0, index + 1) : changeTo(0, index);
    return extend ? changeTo(index, count) : changeTo(index + 1, count);
  }

  const withChanges = segments.map((segment): LeaveSegment => {
    if (segment.kind !== "switch") return segment;
    const change = clicked(segment.from / step);
    return change === undefined ? segment : { ...segment, change };
  });

  const all = measure(union([...ownSpan, ...mandatory, ...other]));
  if (count === 1 || !withChanges.some((segment) => segment.kind === "switch")) return { amount: all, segments: withChanges };
  const checked: Pressed = all === 0 ? "false" : all >= UNITS_PER_DAY ? "true" : "mixed";
  const change = checked === "true" || !canSet ? removal : changeTo(0, count);
  return { amount: all, segments: withChanges, fullDay: change === undefined ? { checked } : { checked, change } };
}
