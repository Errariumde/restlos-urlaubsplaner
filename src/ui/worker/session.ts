// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The open plan inside the engine worker: the file, its leave with undo and redo, and the computed result.
// Pure: the worker wiring (`self`) lives in engine-worker.ts.
import { countries } from "../../data/holidays/index.ts";
import { computePlan } from "../../engine/counting/plan.ts";
import type { PlanResult } from "../../engine/counting/plan.ts";
import type { LeaveDay, PlanInput } from "../../engine/counting/types.ts";
import type { DayNumber } from "../../engine/days.ts";
import { planInput } from "../../engine/file/model.ts";
import { readFile } from "../../engine/file/read.ts";
import type { PlanFile } from "../../engine/file/types.ts";
import { UNITS_PER_DAY } from "../../engine/weight.ts";
import type { Hint, LeaveChange, PlanMeta, PlanState, Request, Response } from "./protocol.ts";

/** The most undo steps a session keeps; the oldest goes first. */
export const MAX_UNDO_STEPS = 200;

type Leave = readonly LeaveDay[];

/** Whether two leave entries of the same day mean the same; the part only counts below a full day. */
function sameEntry(a: LeaveDay | undefined, b: LeaveDay | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.day === b.day && a.take === b.take && (a.take >= UNITS_PER_DAY || (a.part ?? "end") === (b.part ?? "end"));
}

function byDay(leave: Leave): Map<DayNumber, LeaveDay> {
  return new Map(leave.map((entry) => [entry.day, entry]));
}

/** Two leave lists with the same entries, in any order. */
function sameLeave(a: Leave, b: Leave): boolean {
  if (a.length !== b.length) return false;
  const days = byDay(b);
  return a.every((entry) => sameEntry(entry, days.get(entry.day)));
}

interface Changed {
  readonly leave: Leave;
  readonly altered: readonly DayNumber[]; // the changed days, each once, in the order of the changes
}

/** The leave after the changes. Days whose entry stays the same keep their entry object. */
function applyChanges(leave: Leave, changes: readonly LeaveChange[]): Changed {
  const days = byDay(leave);
  const before = new Map(days);
  for (const change of changes) {
    if (change.take === 0) days.delete(change.day);
    else if (change.take >= UNITS_PER_DAY) days.set(change.day, { day: change.day, take: change.take });
    else days.set(change.day, { day: change.day, take: change.take, part: change.part ?? "end" });
  }
  const altered: DayNumber[] = [];
  const seen = new Set<DayNumber>();
  for (const { day } of changes) {
    if (seen.has(day)) continue;
    seen.add(day);
    const old = before.get(day);
    const now = days.get(day);
    if (sameEntry(old, now)) {
      if (old) days.set(day, old);
    } else {
      altered.push(day);
    }
  }
  if (altered.length === 0) return { leave, altered };
  return { leave: [...days.values()].sort((a, b) => a.day - b.day), altered };
}

/** The listed stretch of the result that contains the day, if any. */
function stretchAt(result: PlanResult, day: DayNumber): Hint["stretch"] {
  return result.stretches.find(
    (s) => s.listed && s.start.day <= day && (day < s.end.day || (day === s.end.day && s.end.offset > 0)),
  );
}

function metaOf(file: PlanFile, example: boolean): PlanMeta {
  const { region } = file.contract;
  const country = Object.hasOwn(countries, region.country) ? countries[region.country] : undefined;
  if (!country) throw new RangeError("Unknown country");
  return {
    name: file.contract.name,
    countryNameKey: country.nameKey,
    regionNameKey: country.regions.find((r) => r.id === region.state)?.nameKey,
    weekStart: country.weekStart,
    weekend: country.weekend,
    period: file.plan.range,
    allowance: file.plan.allowance,
    minUnit: file.contract.minUnit,
    sources: file.sources.map(({ id, name, type, color, visible }) => ({ id, name, type, color, visible })),
    rules: file.contract.rules.map(({ id, label }) => ({ id, label })),
    example,
  };
}

interface Opened {
  readonly file: PlanFile;
  readonly input: PlanInput;
  readonly meta: PlanMeta;
  /** Leave lists from the oldest kept to the newest; `at` is the current one. */
  readonly history: Leave[];
  at: number;
  result: PlanResult;
}

export class Session {
  #open: Opened | undefined;

  /** Opens a plan file from its text; a file that can't be opened gives the refusal code. */
  open(text: string, example: boolean): PlanState | { refused: string } {
    const read = readFile(text);
    if (!read.ok) return { refused: read.refusal.code };
    // A rule set opens for editing, which is a later step of the UI.
    if (read.file.kind !== "plan") return { refused: "notAPlan" };
    const file = read.file;
    const input = planInput(file);
    this.#open = { file, input, meta: metaOf(file, example), history: [file.plan.days], at: 0, result: computePlan(input) };
    return this.#state();
  }

  /** Applies the changes as one undo step; changes that alter no day add no step. */
  apply(changes: readonly LeaveChange[]): PlanState {
    const open = this.#current();
    const { leave, altered } = applyChanges(open.history[open.at]!, changes);
    if (altered.length === 0) return this.#state();
    const result = this.#compute(leave);
    open.history.splice(open.at + 1);
    open.history.push(leave);
    if (open.history.length > MAX_UNDO_STEPS + 1) open.history.shift();
    open.at = open.history.length - 1;
    open.result = result;
    return this.#state();
  }

  /** What the changes would do, without changing the plan. */
  preview(changes: readonly LeaveChange[]): Hint {
    const open = this.#current();
    const before = open.result.totals;
    const { leave, altered } = applyChanges(open.history[open.at]!, changes);
    const first = altered[0];
    if (first === undefined) return { days: 0, cost: 0, remaining: before.remaining, stretch: undefined };
    const after = this.#compute(leave);
    return {
      days: altered.length,
      cost: after.totals.planned - before.planned,
      remaining: after.totals.remaining,
      stretch: stretchAt(after, first),
    };
  }

  undo(): PlanState {
    return this.#step(-1);
  }

  redo(): PlanState {
    return this.#step(1);
  }

  #step(by: -1 | 1): PlanState {
    const open = this.#current();
    const at = open.at + by;
    if (at < 0 || at >= open.history.length) return this.#state();
    open.result = this.#compute(open.history[at]!);
    open.at = at;
    return this.#state();
  }

  #compute(leave: Leave): PlanResult {
    return computePlan({ ...this.#current().input, leave });
  }

  #current(): Opened {
    if (!this.#open) throw new Error("No plan is open");
    return this.#open;
  }

  #state(): PlanState {
    const open = this.#current();
    return {
      meta: open.meta,
      result: open.result,
      canUndo: open.at > 0,
      canRedo: open.at < open.history.length - 1,
      changed: !sameLeave(open.history[open.at]!, open.file.plan.days),
    };
  }
}

/** The answer to one request; an exception becomes `failed`. */
export function respond(session: Session, request: Request): Response {
  const { id } = request;
  try {
    switch (request.type) {
      case "open": {
        const opened = session.open(request.text, request.example);
        return "refused" in opened ? { id, type: "refused", code: opened.refused } : { id, type: "state", state: opened };
      }
      case "apply":
        return { id, type: "state", state: session.apply(request.changes) };
      case "preview":
        return { id, type: "hint", hint: session.preview(request.changes) };
      case "undo":
        return { id, type: "state", state: session.undo() };
      case "redo":
        return { id, type: "state", state: session.redo() };
    }
  } catch (error) {
    return { id, type: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}
