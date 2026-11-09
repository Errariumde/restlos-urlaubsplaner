// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The leave bar of the day detail (docs/SPEC.md, "Detail view"): the day in parts of the plan's smallest leave unit,
// each part with work a switch drawn over its working time; time without work, and the parts that mandatory leave or
// another plan's leave cover wholly, as fixed blocks; and the "Full day" checkbox. Own leave that overlaps no work at
// all (from a file) turns the time without work it covers into switches that take it away. The bar draws leave where
// it lies in the day: own and mandatory leave at the start or the end as its `part` says, another plan's leave at its
// span. No press books own leave that would lie only on time without work.
import { evaluateLeave, type LeaveKind, type LeavePiece } from "../../engine/counting/leave.ts";
import type { DayResult } from "../../engine/counting/plan.ts";
import type { Part } from "../../engine/counting/types.ts";
import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
import type { LeaveChange } from "../worker/protocol.ts";
import { changeFor, whollyFree } from "./range.ts";

/** A switch's state for `aria-pressed` and a checkbox's for `checked`/`indeterminate`: all, none or part of it. */
export type Pressed = "true" | "false" | "mixed";

/** A stretch of a day in day positions, `from` < `to`. */
export interface Fill {
  readonly from: Units;
  readonly to: Units;
  readonly kind: LeaveKind;
}

/** A part of the day: the whole day, a half, or the `index`-th (from 1) of `count` parts. */
export type PartName =
  | { readonly kind: "day" }
  | { readonly kind: "half"; readonly half: "morning" | "afternoon" }
  | { readonly kind: "part"; readonly index: number; readonly count: number };

export type LeaveSegment =
  | {
      readonly kind: "switch";
      /**
       * The drawn span: the part cut to its working time, or the part's time without work beside it where own leave
       * lies that overlaps no work at all (a part without work gives one such switch over the whole part).
       */
      readonly from: Units;
      readonly to: Units;
      readonly name: PartName;
      /** Whether own leave covers all, none or part of the drawn span's time beside the other kinds of leave. */
      readonly pressed: Pressed;
      /** Where each kind of leave lies inside the drawn span. */
      readonly fills: readonly Fill[];
      /** What a click changes; undefined when it can't change anything. */
      readonly change?: LeaveChange;
    }
  | {
      /** Time without work, or time that mandatory leave or another plan's leave fixes. */
      readonly kind: "free" | "mandatory" | "otherPlan";
      readonly from: Units;
      readonly to: Units;
      /** The first and the last part the block lies in. */
      readonly first: PartName;
      readonly last: PartName;
    };

export interface LeaveSwitch {
  /** All leave of the day, whatever its kind, charged or not. */
  readonly amount: Units;
  /** How many parts the day is split into (`partCount` of the plan's unit). */
  readonly parts: number;
  readonly segments: readonly LeaveSegment[];
  /** The "Full day" checkbox: only with more than one part and at least one switch. */
  readonly fullDay?: { readonly checked: Pressed; readonly change?: LeaveChange };
}

/** The most parts a bar has: finer units are drawn in a multiple of them. */
const MAX_PARTS = 32;

/** How many parts the bar has for a smallest leave unit: the most that are a multiple of it, at most 32. */
export function partCount(minUnit: Units): number {
  const units = UNITS_PER_DAY / minUnit;
  for (let count = Math.min(units, MAX_PARTS); count > 1; count--) if (units % count === 0) return count;
  return 1;
}

function partName(index: number, count: number): PartName {
  if (count === 1) return { kind: "day" };
  if (count === 2) return { kind: "half", half: index === 0 ? "morning" : "afternoon" };
  return { kind: "part", index: index + 1, count };
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

type OwnPiece = Extract<LeavePiece, { kind: "own" | "mandatory" }>;

/** The bar's parts, segments without their changes, and the change that makes own leave cover a run of parts. */
interface Model {
  readonly parts: number;
  readonly segments: readonly LeaveSegment[];
  /** The pressed state of every part: its switch over the work, else its switch over free time, else "false". */
  readonly pressed: readonly Pressed[];
  /** Whether any switch is pressed, also one over free time. */
  readonly anyPressed: boolean;
  /** Where the switches over free time start: they are for own leave lying only on free time, and a press takes it away. */
  readonly freeSwitches: ReadonlySet<Units>;
  readonly own: OwnPiece | undefined;
  readonly canSet: boolean;
  readonly removal: LeaveChange | undefined;
  /** Own leave over the parts [first, last); see `model`. */
  readonly changeTo: (first: number, last: number) => LeaveChange | undefined;
  readonly amount: Units;
}

function model(day: DayResult, minUnit: Units): Model {
  const parts = partCount(minUnit);
  const size = UNITS_PER_DAY / parts;
  const own = day.leave.find((piece): piece is OwnPiece => piece.kind === "own");
  const ownSpan = own === undefined ? [] : [spanOf(own)];
  const mandatory = spansOf(day, "mandatory");
  const other = spansOf(day, "otherPlan");
  const workFrom = day.required.freePart === "end" ? 0 : UNITS_PER_DAY - day.required.value;
  const workTo = workFrom + day.required.value;
  // Mandatory leave lies over own leave, own leave over another plan's leave, as in the engine.
  const ownShown = minus(ownSpan, mandatory);
  const otherShown = minus(minus(other, mandatory), ownSpan);
  const locked = union([...mandatory, ...otherShown]);
  const blocking = union([...mandatory, ...other]);
  // On time without work the fixed blocks show mandatory leave, else another plan's leave, else free time.
  const otherOffWork = minus(other, mandatory);
  const canSet = day.inPeriod && day.required.value > 0;
  const removal: LeaveChange | undefined = own === undefined ? undefined : { day: day.day, take: 0 };
  // Own leave that overlaps no work (from a file, or a booking a later change of the required work left on free time).
  const ownOnFree = own !== undefined && measure(within(ownSpan, workFrom, workTo)) === 0;

  /**
   * The change that makes own leave cover the parts [first, last): only the time beside the other kinds of leave,
   * which must touch an edge of the day; overlapping mandatory leave is all right, as it counts once. Leave that would
   * overlap no work is no booking: the change then takes the own leave away.
   */
  function changeTo(first: number, last: number): LeaveChange | undefined {
    if (first >= last) return removal;
    const wanted: Span = [first * size, last * size];
    const free = minus([wanted], blocking);
    let span: Span | undefined;
    const [only] = free;
    if (free.length === 0) return removal;
    if (free.length === 1 && only !== undefined && (only[0] === 0 || only[1] === UNITS_PER_DAY)) span = only;
    else if (measure(within(other, wanted[0], wanted[1])) === 0 && (wanted[0] === 0 || wanted[1] === UNITS_PER_DAY)) span = wanted;
    if (span === undefined) return undefined;
    if (measure(within([span], workFrom, workTo)) === 0) return removal;
    const take = span[1] - span[0];
    const part: Part = span[0] === 0 ? "start" : "end";
    if (own !== undefined && own.take === take && (take >= UNITS_PER_DAY || own.part === part)) return undefined;
    return take >= UNITS_PER_DAY ? { day: day.day, take } : { day: day.day, take, part };
  }

  const segments: LeaveSegment[] = [];
  const pressed: Pressed[] = [];
  const freeSwitches = new Set<Units>();
  let anyPressed = false;
  const nameAt = (position: Units): PartName => partName(Math.floor(position / size), parts);

  /** A fixed block; it merges with the one before it when that is of the same kind and touches it. */
  function fixed(kind: "free" | "mandatory" | "otherPlan", from: Units, to: Units): void {
    const last = segments.at(-1);
    if (last !== undefined && last.kind === kind && last.to === from) segments[segments.length - 1] = { ...last, to, last: nameAt(to - 1) };
    else segments.push({ kind, from, to, first: nameAt(from), last: nameAt(to - 1) });
  }

  /** Time without work beside the switches, as fixed blocks in the order of the day. */
  function offWork(from: Units, to: Units): void {
    if (from >= to) return;
    const mandatoryHere = within(mandatory, from, to);
    const otherHere = within(otherOffWork, from, to);
    const blocks = [
      ...mandatoryHere.map(([a, b]) => ({ kind: "mandatory" as const, from: a, to: b })),
      ...otherHere.map(([a, b]) => ({ kind: "otherPlan" as const, from: a, to: b })),
      ...minus([[from, to]], union([...mandatoryHere, ...otherHere])).map(([a, b]) => ({ kind: "free" as const, from: a, to: b })),
    ].toSorted((a, b) => a.from - b.from);
    for (const block of blocks) fixed(block.kind, block.from, block.to);
  }

  /** A switch over [a, b) in the part `index`, named after the part; gives its pressed state. */
  function addSwitch(a: Units, b: Units, index: number, onFree: boolean): Pressed {
    const ownTime = measure(within(ownShown, a, b));
    const state: Pressed = ownTime === 0 ? "false" : ownTime >= measure(minus([[a, b]], locked)) ? "true" : "mixed";
    const fills: Fill[] = [
      ...within(mandatory, a, b).map(([x, y]): Fill => ({ from: x, to: y, kind: "mandatory" })),
      ...within(ownShown, a, b).map(([x, y]): Fill => ({ from: x, to: y, kind: "own" })),
      ...within(otherShown, a, b).map(([x, y]): Fill => ({ from: x, to: y, kind: "otherPlan" })),
    ].toSorted((x, y) => x.from - y.from);
    segments.push({ kind: "switch", from: a, to: b, name: partName(index, parts), pressed: state, fills });
    if (onFree) freeSwitches.add(a);
    if (state !== "false") anyPressed = true;
    return state;
  }

  /**
   * Time without work [a, b) in the part `index`: one switch over it where own leave that overlaps no work at all
   * covers some of it, so that a press takes that leave away; else fixed blocks. Gives the switch's pressed state.
   */
  function withoutWork(a: Units, b: Units, index: number): Pressed | undefined {
    if (a >= b) return undefined;
    if (ownOnFree && measure(within(ownShown, a, b)) > 0) return addSwitch(a, b, index, true);
    offWork(a, b);
    return undefined;
  }

  for (let index = 0; index < parts; index++) {
    const from = index * size;
    const to = from + size;
    pressed.push("false");
    if (minus([[from, to]], locked).length === 0) {
      // Locked wholly: one block of the kind that covers more of the part.
      fixed(measure(within(mandatory, from, to)) >= measure(within(otherShown, from, to)) ? "mandatory" : "otherPlan", from, to);
      continue;
    }
    const a = Math.max(from, workFrom);
    const b = Math.min(to, workTo);
    if (a >= b) {
      pressed[index] = withoutWork(from, to, index) ?? "false";
      continue;
    }
    withoutWork(from, a, index);
    pressed[index] = addSwitch(a, b, index, false);
    withoutWork(b, to, index);
  }

  const amount = measure(union([...ownSpan, ...mandatory, ...other]));
  return { parts, segments, pressed, anyPressed, freeSwitches, own, canSet, removal, changeTo, amount };
}

/**
 * What a press on the switch over the work of the part `index` changes. A press on a free part extends own leave up
 * to and including it, one on a booked part shrinks it to just before it; with no own leave it fills from the nearer
 * edge of the day. Own leave can be set only on a day in the plan period with required work; elsewhere it can only be
 * taken away.
 */
function press(bar: Model, index: number): LeaveChange | undefined {
  const { parts, pressed, own, changeTo } = bar;
  if (!bar.canSet) return pressed[index] === "false" ? undefined : bar.removal;
  const nearStart = 2 * index < parts;
  if (!bar.anyPressed) return nearStart ? changeTo(0, index + 1) : changeTo(index, parts);
  const ownPart = own !== undefined && own.take < UNITS_PER_DAY ? own.part : undefined;
  if (ownPart === undefined) return nearStart ? changeTo(index + 1, parts) : changeTo(0, index);
  const extend = pressed[index] !== "true"; // a free part, or one own leave covers only in part
  if (ownPart === "start") return extend ? changeTo(0, index + 1) : changeTo(0, index);
  return extend ? changeTo(index, parts) : changeTo(index + 1, parts);
}

/**
 * The leave bar of a day, in parts of `minUnit`, the plan's smallest leave unit (more than 32 parts fall back to a
 * multiple of it).
 */
export function leaveSwitch(day: DayResult, minUnit: Units): LeaveSwitch {
  const bar = model(day, minUnit);
  const size = UNITS_PER_DAY / bar.parts;
  const segments = bar.segments.map((segment): LeaveSegment => {
    if (segment.kind !== "switch") return segment;
    // A switch over free time is there only to take own leave away that lies on free time alone.
    const change = bar.freeSwitches.has(segment.from) ? bar.removal : press(bar, Math.floor(segment.from / size));
    return change === undefined ? segment : { ...segment, change };
  });
  const base = { amount: bar.amount, parts: bar.parts, segments };
  if (bar.parts === 1 || !segments.some((segment) => segment.kind === "switch")) return base;
  const checked: Pressed = day.leave.length === 0 ? "false" : whollyFree(day) ? "true" : "mixed";
  const change = checked !== "true" && bar.canSet ? changeFor(day, "full") : bar.removal;
  return { ...base, fullDay: change === undefined ? { checked } : { checked, change } };
}

/**
 * Of the stretches `spans`, the one nearest to `span`, one over it first; of two as near, the earlier one. For the
 * switch the focus goes to when the pressed one is gone (in day positions).
 */
export function nearest<T extends { readonly from: number; readonly to: number }>(spans: readonly T[], span: { readonly from: number; readonly to: number }): T | undefined {
  const distance = (item: T): number => Math.max(0, item.from - span.to, span.from - item.to);
  return spans.reduce<T | undefined>((best, item) => (best === undefined || distance(item) < distance(best) ? item : best), undefined);
}

/** Own leave from the edge `edge` of the day through the part `index` (from 0), with the guards of a press: for dragging along the bar. */
export function reach(day: DayResult, minUnit: Units, edge: Part, index: number): LeaveChange | undefined {
  const bar = model(day, minUnit);
  if (!bar.canSet) return bar.pressed[index] === "false" ? undefined : bar.removal;
  return edge === "start" ? bar.changeTo(0, index + 1) : bar.changeTo(index, bar.parts);
}

/** The day with its own leave replaced by the change (none for `take` 0), evaluated again: for drawing a preview. */
export function withOwnLeave(day: DayResult, change: LeaveChange): DayResult {
  const others = day.leave.filter((piece) => piece.kind !== "own");
  const leave: LeavePiece[] = change.take > 0 ? [...others, { kind: "own", take: change.take, part: change.part ?? "end" }] : others;
  return { ...day, leave, evaluation: evaluateLeave(day.required, leave, day.inPeriod) };
}
