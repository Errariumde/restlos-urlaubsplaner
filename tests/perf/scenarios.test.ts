// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkScenarios } from "../../scripts/perf-verdict";
import { minimal } from "../engine/file/helpers";
import { SCENARIOS, type Scenario } from "./scenarios";

const reading = SCENARIOS.filter((scenario) => scenario.name.startsWith("read"));
const named = (name: string): Scenario => {
  const scenario = SCENARIOS.find((candidate) => candidate.name === name);
  if (scenario === undefined) throw new Error(`no scenario ${name}`);
  return scenario;
};

describe("the scenarios of the performance gate", () => {
  it("have distinct names", () => expect(checkScenarios(SCENARIOS.map((scenario) => scenario.name))).toEqual([]));
  it.each(reading.map((scenario) => [scenario.name, scenario] as const))("%s runs on its own input", (_name, scenario) =>
    expect(() => { scenario.run(scenario.input(8)); }).not.toThrow());
  // A refused input would measure only the refusal, and the gate would pass on work that was never done.
  it.each(reading.map((scenario) => [scenario.name, scenario] as const))("%s throws on a refused input", (_name, scenario) =>
    expect(() => { scenario.run("{"); }).toThrow(/refused/));
  it("readAndCompute throws on a rule set, which it can't compute", () =>
    expect(() => { named("readAndCompute:limitsPlan").run(minimal()); }).toThrow(/not a plan file/));
});
