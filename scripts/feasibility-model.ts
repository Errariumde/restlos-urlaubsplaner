// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The model the worker page (T3, feasibility/README.md) embeds: the largest plan file within the limits (the file
// `npm run perf -- --largest-file` writes), read by the engine, plus what the counting model computes for it (as in
// the perf scenario readAndCompute). Builds the model once and keeps it in this module; no file access:
// scripts/feasibility.js writes it into the pages.
import { computePlan, type PlanResult } from "../src/engine/counting/plan";
import { planInput } from "../src/engine/file/model";
import { readFile } from "../src/engine/file/read";
import type { ReadResult } from "../src/engine/file/report";
import { earlyEasterRangesOffWeekday, entriesPlan, fillToLimits } from "../tests/engine/file/shapes";

type ReadOk = Extract<ReadResult, { ok: true }>;

/** The model as JSON can hold it: `positions` (a Map, which JSON.stringify would write as {}) as [path, index] pairs. */
export interface LargestModel {
  readonly read: Omit<ReadOk, "positions"> & { readonly positions: readonly (readonly [string, number])[] };
  readonly plan: PlanResult;
}

let built: LargestModel | undefined;

/**
 * The read result of the largest plan, with `positions` as pairs, and its computed plan. Reading and computing take
 * seconds, so the model is built once and kept. Throws if the file is refused or is not a plan file.
 */
export function largestModel(): LargestModel {
  if (built !== undefined) return built;
  const read = readFile(entriesPlan(fillToLimits(earlyEasterRangesOffWeekday)));
  if (!read.ok) throw new Error(`The largest plan file is refused (${read.refusal.code}).`);
  if (read.file.kind !== "plan") throw new Error("The largest file is not a plan file.");
  const plan = computePlan(planInput(read.file));
  built = { read: { ...read, positions: [...read.positions] }, plan };
  return built;
}

/** `largestModel()` as JSON text: `{ read, plan }`. */
export function largestModelJson(): string {
  return JSON.stringify(largestModel());
}
