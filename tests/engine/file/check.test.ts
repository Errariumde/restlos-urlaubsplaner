// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkCount, checkRules } from "../../../src/engine/file/check";
import { readFile } from "../../../src/engine/file/read";
import { BAVARIA_CONTRACT, minimal, planFile } from "./helpers";

const carnival = {
  id: "carnival",
  match: { type: "range", from: { type: "easter", offset: -52 }, to: { type: "fixed", month: 3, day: 1 } },
  requiredAtMost: "1/2",
};
const oldClosure = { id: "old-closure", match: { type: "once", date: "2019-07-01" }, validFrom: 2020, requiredAtMost: "0" };

function load(text: string) {
  const result = readFile(text);
  if (!result.ok) throw new Error(`refused: ${result.refusal.code}`);
  return result;
}

describe("checkRules", () => {
  it("gives each hint of a contract rule with its path", () => {
    const { file, positions } = load(planFile({}, { contract: { ...BAVARIA_CONTRACT, rules: [carnival, oldClosure] } }));
    expect(checkRules(file, positions)).toEqual([
      { code: "mixedRangeEnds", path: "contract.rules[0]" },
      { code: "neverApplies", path: "contract.rules[1]" },
    ]);
  });
  it("points to a source entry by its position in the text", () => {
    const sources = [
      {
        id: "s",
        name: "S",
        type: "info",
        color: { slot: "accent-1" },
        visible: true,
        entries: [{ match: { type: "range", from: { type: "fixed", month: 2, day: 27 }, days: 4 } }, { date: "2027-03-01" }],
      },
    ];
    const { file, positions } = load(planFile({}, { sources }));
    expect(file.sources[0]?.entries[1]).toHaveProperty("match");
    expect(checkRules(file, positions)).toEqual([{ code: "leapYearLength", path: "sources[0].entries[0]" }]);
  });
  it("gives a hint and a report entry about the same rule the same path", () => {
    const result = load(planFile({}, { contract: { ...BAVARIA_CONTRACT, rules: [{ id: 5 }, { ...carnival, colour: "red" }] } }));
    expect(result.report).toEqual([
      { code: "invalidEntry", path: "contract.rules[0]", data: { field: "id" } },
      { code: "unknownField", path: "contract.rules[1].colour" },
    ]);
    expect(checkRules(result.file, result.positions)).toEqual([{ code: "mixedRangeEnds", path: "contract.rules[1]" }]);
  });
  it("checks a rule set like a plan file", () => {
    const { file, positions } = load(minimal({ contract: { ...BAVARIA_CONTRACT, rules: [carnival, oldClosure] } }));
    expect(checkRules(file, positions)).toEqual([
      { code: "mixedRangeEnds", path: "contract.rules[0]" },
      { code: "neverApplies", path: "contract.rules[1]" },
    ]);
  });
  it("reports progress from 0 to N, one step per rule", () => {
    const rules = [
      { id: "a", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2" },
      { id: "b", match: { type: "fixed", month: 12, day: 31 }, requiredAtMost: "1/2" },
    ];
    const sources = [
      {
        id: "s",
        name: "S",
        type: "info",
        color: { slot: "accent-1" },
        visible: true,
        entries: [{ date: "2027-03-01" }, { match: { type: "fixed", month: 5, day: 1 } }, { match: { type: "fixed", month: 6, day: 1 } }],
      },
    ];
    const { file, positions } = load(planFile({}, { contract: { ...BAVARIA_CONTRACT, rules }, sources }));
    const calls: [number, number][] = [];
    checkRules(file, positions, (done, total) => calls.push([done, total]));
    expect(checkCount(file)).toBe(4);
    expect(calls).toEqual([[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]]);
  });
  it("reports 0 of 0 once for a file without rules or match entries", () => {
    const { file, positions } = load(minimal());
    const calls: [number, number][] = [];
    expect(checkRules(file, positions, (done, total) => calls.push([done, total]))).toEqual([]);
    expect(calls).toEqual([[0, 0]]);
  });
  it("gives the hint once for each of 1000 identical rules", () => {
    const rules = Array.from({ length: 1000 }, (_, i) => ({ ...oldClosure, id: `r${String(i)}` }));
    const { file, positions } = load(minimal({ contract: { ...BAVARIA_CONTRACT, rules } }));
    const entries = checkRules(file, positions);
    expect(entries).toHaveLength(1000);
    expect(entries.every((entry) => entry.code === "neverApplies")).toBe(true);
    expect(entries[999]?.path).toBe("contract.rules[999]");
  });
});
