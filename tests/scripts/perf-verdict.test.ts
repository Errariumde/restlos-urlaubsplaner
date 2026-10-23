// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkScenarios, verdict, type Counts } from "../../scripts/perf-verdict";

const env = { node: "v24.21.0", valgrind: "valgrind-3.26.0" };

/** Counts in `env` with the instructions of each scenario at 8× and 16×. */
const counts = (work: Record<string, readonly [number, number]>, environment = env): Counts => ({ ...environment, work });

describe("verdict", () => {
  it("passes when the work grows at most 2.2× and stays within 5 %", () => {
    expect(verdict(counts({ a: [1000, 1950] }), counts({ a: [1000, 1950] }))).toEqual({ failed: false, findings: [] });
  });

  it("fails a scenario that grows more than 2.2× for twice the input", () => {
    expect(verdict(counts({ a: [1000, 2300] }), counts({ a: [1000, 2300] }))).toEqual({
      failed: true,
      findings: [{ kind: "growth", scenario: "a", growth: 2.3 }],
    });
  });

  it("allows exactly 2.2×", () => {
    expect(verdict(counts({ a: [1000, 2200] }), counts({ a: [1000, 2200] }))).toEqual({ failed: false, findings: [] });
  });

  describe("budget", () => {
    const baseline = counts({ a: [1000, 2000] });

    it("allows exactly 5 % over the baseline and fails above it", () => {
      expect(verdict(counts({ a: [1050, 2000] }), baseline)).toEqual({ failed: false, findings: [] });

      const over = verdict(counts({ a: [1051, 2000] }), baseline);
      expect(over.failed).toBe(true);
      expect(over.findings).toHaveLength(1);
      const finding = over.findings[0];
      expect(finding).toMatchObject({ kind: "overBudget", scenario: "a", size: 8 });
      expect(finding?.kind === "overBudget" ? finding.change : undefined).toBeCloseTo(0.051);
    });

    it("notes a scenario that got more than 5 % cheaper", () => {
      expect(verdict(counts({ a: [900, 1800] }), baseline)).toEqual({
        failed: false,
        findings: [
          { kind: "cheaper", scenario: "a", size: 8, change: expect.closeTo(-0.1) as number },
          { kind: "cheaper", scenario: "a", size: 16, change: expect.closeTo(-0.1) as number },
        ],
      });
    });
  });

  it("checks only growth for a scenario without a baseline", () => {
    const baseline = counts({ b: [1000, 2000] });
    expect(verdict(counts({ a: [1000, 1950], b: [1000, 2000] }), baseline)).toEqual({ failed: false, findings: [{ kind: "noBaseline", scenario: "a" }] });
    expect(verdict(counts({ a: [1000, 2300], b: [1000, 2000] }), baseline)).toEqual({
      failed: true,
      findings: [
        { kind: "growth", scenario: "a", growth: 2.3 },
        { kind: "noBaseline", scenario: "a" },
      ],
    });
  });

  it("fails on a baseline from another Node or Valgrind", () => {
    const other = { node: "v24.20.0", valgrind: "valgrind-3.26.0" };
    expect(verdict(counts({ a: [2000, 4000] }), counts({ a: [1000, 2000] }, other))).toEqual({
      failed: true,
      findings: [{ kind: "otherEnvironment", baseline: other, measured: env }],
    });
    const otherValgrind = { node: "v24.21.0", valgrind: "valgrind-3.25.1" };
    expect(verdict(counts({ a: [1000, 2000] }), counts({ a: [1000, 2000] }, otherValgrind)).findings).toEqual([
      { kind: "otherEnvironment", baseline: otherValgrind, measured: env },
    ]);
    // Growth is still checked.
    expect(verdict(counts({ a: [1000, 2300] }), counts({ a: [1000, 2300] }, other))).toEqual({
      failed: true,
      findings: [
        { kind: "otherEnvironment", baseline: other, measured: env },
        { kind: "growth", scenario: "a", growth: 2.3 },
      ],
    });
  });

  it("treats a missing baseline file as no baseline for every scenario", () => {
    expect(verdict(counts({ a: [1000, 1950], b: [500, 1000] }), undefined)).toEqual({
      failed: false,
      findings: [
        { kind: "noBaseline", scenario: "a" },
        { kind: "noBaseline", scenario: "b" },
      ],
    });
  });

  describe("fails closed", () => {
    it.each([
      ["no work at 8×", [0, 1000], Infinity],
      ["no work at all", [0, 0], Number.NaN],
      ["a count that isn't a number", [1000, Number.NaN], Number.NaN],
    ] as const)("on a growth that isn't a finite number: %s", (_name, work, growth) => {
      expect(verdict(counts({ a: work }), counts({ a: [1000, 2000] })).findings[0]).toEqual({ kind: "growth", scenario: "a", growth });
      expect(verdict(counts({ a: work }), counts({ a: [1000, 2000] })).failed).toBe(true);
    });

    it("on a change against the baseline that isn't a number", () => {
      expect(verdict(counts({ a: [1000, 2000] }), counts({ a: [1000, Number.NaN] }))).toEqual({
        failed: true,
        findings: [{ kind: "overBudget", scenario: "a", size: 16, change: Number.NaN }],
      });
    });

    it("on no scenarios at all", () => {
      expect(verdict(counts({}), undefined)).toEqual({ failed: true, findings: [{ kind: "noScenarios" }] });
      expect(verdict(counts({}), counts({}))).toEqual({ failed: true, findings: [{ kind: "noScenarios" }] });
    });

    it("on a baseline entry without a scenario, which a renamed scenario would leave behind", () => {
      expect(verdict(counts({ b: [1000, 2000] }), counts({ a: [1000, 2000], b: [1000, 2000] }))).toEqual({
        failed: true,
        findings: [{ kind: "baselineOnly", scenario: "a" }],
      });
    });
  });
});

describe("checkScenarios", () => {
  it("accepts scenarios with distinct names", () => expect(checkScenarios(["a", "b"])).toEqual([]));
  it("fails an empty list", () => expect(checkScenarios([])).toEqual([{ kind: "noScenarios" }]));
  it("fails each name used more than once, once", () =>
    expect(checkScenarios(["a", "b", "a", "c", "a", "b"])).toEqual([
      { kind: "duplicateScenario", scenario: "a" },
      { kind: "duplicateScenario", scenario: "b" },
    ]));
});
