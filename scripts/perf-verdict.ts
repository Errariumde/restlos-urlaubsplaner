// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The verdict of the performance gate (npm run perf, scripts/perf.js) on the instruction counts it measured.

/** Every scenario runs at these multiples of its base size. */
export const SIZES = [8, 16] as const;
/** Twice the input may cost at most this many times the work. */
export const GROWTH_LIMIT = 2.2;
/** A scenario may cost at most this much over its baseline; a scenario this much cheaper is noted. */
export const BUDGET_TOLERANCE = 0.05;

/** Instruction counts of one run of the gate, and the tools that counted them; tests/perf/baseline.json holds one. */
export interface Counts {
  readonly node: string; // process.version
  readonly valgrind: string; // first line of `valgrind --version`
  readonly work: Readonly<Record<string, readonly [number, number]>>; // instructions at 8× and 16×
}

/** `change` is measured / baseline − 1; `growth` is the work at 16× divided by the work at 8×. */
export type Finding =
  | { readonly kind: "growth"; readonly scenario: string; readonly growth: number }
  | { readonly kind: "overBudget"; readonly scenario: string; readonly size: 8 | 16; readonly change: number }
  | { readonly kind: "cheaper"; readonly scenario: string; readonly size: 8 | 16; readonly change: number }
  | { readonly kind: "noBaseline"; readonly scenario: string }
  | { readonly kind: "baselineOnly"; readonly scenario: string }
  | { readonly kind: "noScenarios" }
  | { readonly kind: "duplicateScenario"; readonly scenario: string }
  | { readonly kind: "otherEnvironment"; readonly baseline: { node: string; valgrind: string }; readonly measured: { node: string; valgrind: string } };

/** The findings that are only notices; every other finding fails the gate. */
const NOTICES: ReadonlySet<Finding["kind"]> = new Set(["cheaper", "noBaseline"]);

/**
 * The problems of the scenario list itself, found before anything is counted: an empty list, and each name
 * used more than once (perf-run.js finds a scenario by its name, and the baseline is keyed by it).
 */
export function checkScenarios(names: readonly string[]): readonly Finding[] {
  if (names.length === 0) return [{ kind: "noScenarios" }];
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) twice.add(name);
    seen.add(name);
  }
  return [...twice].map((scenario) => ({ kind: "duplicateScenario", scenario }));
}

/**
 * Every finding fails the gate except cheaper and noBaseline, which are notices. A growth or change that isn't
 * a number within its limit fails too. A baseline counted with another Node or Valgrind is not comparable: then
 * only growth is checked. A comparable baseline must not hold a scenario that isn't measured (baselineOnly):
 * a renamed scenario would otherwise escape the budget.
 */
export function verdict(measured: Counts, baseline: Counts | undefined): { readonly failed: boolean; readonly findings: readonly Finding[] } {
  const findings: Finding[] = [];
  const comparable = baseline === undefined || (baseline.node === measured.node && baseline.valgrind === measured.valgrind);
  if (!comparable) {
    findings.push({
      kind: "otherEnvironment",
      baseline: { node: baseline.node, valgrind: baseline.valgrind },
      measured: { node: measured.node, valgrind: measured.valgrind },
    });
  }
  const scenarios = Object.entries(measured.work);
  if (scenarios.length === 0) findings.push({ kind: "noScenarios" });
  for (const [scenario, work] of scenarios) {
    const growth = work[1] / work[0];
    if (!(growth <= GROWTH_LIMIT)) findings.push({ kind: "growth", scenario, growth });
    if (!comparable) continue;
    const before = baseline?.work[scenario];
    if (before === undefined) {
      findings.push({ kind: "noBaseline", scenario });
      continue;
    }
    const bySize = [[SIZES[0], work[0], before[0]], [SIZES[1], work[1], before[1]]] as const;
    for (const [size, now, was] of bySize) {
      const change = (now - was) / was; // measured / baseline − 1, without rounding the quotient first
      if (!(change <= BUDGET_TOLERANCE)) findings.push({ kind: "overBudget", scenario, size, change });
      else if (change < -BUDGET_TOLERANCE) findings.push({ kind: "cheaper", scenario, size, change });
    }
  }
  if (comparable && baseline !== undefined) {
    for (const scenario of Object.keys(baseline.work)) {
      if (!Object.hasOwn(measured.work, scenario)) findings.push({ kind: "baselineOnly", scenario });
    }
  }
  const failed = findings.some((finding) => !NOTICES.has(finding.kind));
  return { failed, findings };
}
