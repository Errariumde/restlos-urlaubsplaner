// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { beforeAll, describe, expect, it } from "vitest";
import { largestModel, largestModelJson } from "../../scripts/feasibility-model";

/** Paths to every Map or Set below `value` (JSON.stringify would write them as {}). */
function hiddenCollections(value: unknown, path = "$"): string[] {
  if (value instanceof Map || value instanceof Set) return [path];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => hiddenCollections(child, `${path}.${key}`));
}

describe("largestModelJson", () => {
  // Reading and computing the largest plan takes seconds: build it once here (largestModel keeps it) for both tests.
  beforeAll(() => {
    largestModel();
  }, 60_000);

  it("writes the read result with positions as pairs, and the computed plan", () => {
    const model = JSON.parse(largestModelJson()) as { read: { ok: boolean; positions: [string, number][] }; plan: { days: unknown[] } };
    expect(model.read.ok).toBe(true);
    expect(model.read.positions.length).toBeGreaterThan(70_000);
    expect(model.read.positions.every(([path, offset]) => typeof path === "string" && Number.isInteger(offset))).toBe(true);
    expect(model.plan.days.length).toBeGreaterThan(0);
  }, 60_000);

  it("hides no Map or Set in the model, which JSON.stringify would write as {}", () => {
    expect(hiddenCollections(largestModel())).toEqual([]);
  }, 60_000);

  it("survives a JSON round trip unchanged (no NaN, Infinity, typed array or Date that JSON would change)", () => {
    expect(JSON.parse(largestModelJson())).toEqual(largestModel());
  }, 60_000);
});
