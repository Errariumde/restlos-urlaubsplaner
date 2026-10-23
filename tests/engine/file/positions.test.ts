// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { readFile } from "../../../src/engine/file/read";
import { textPath } from "../../../src/engine/file/positions";
import { BAVARIA_CONTRACT, FULL_TIME_WEEK, planFile } from "./helpers";

const positionsOf = (text: string): ReadonlyMap<string, number> => {
  const result = readFile(text);
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.positions;
};
const rule = (id: string) => ({ id, match: { type: "fixed", month: 5, day: 1 }, requiredAtMost: "1/2" });
const infoSource = (id: string, entries: unknown[]) => ({ id, name: "S", type: "info", color: { slot: "a" }, visible: true, entries });

describe("textPath", () => {
  it("maps every list index along a path", () => {
    const positions = new Map([
      ["sources[0]", 1],
      ["sources[0].entries[0]", 7],
    ]);
    expect(textPath(positions, "sources[0].entries[0].match")).toBe("sources[1].entries[7].match");
    expect(textPath(positions, "contract.rules[3]")).toBe("contract.rules[3]");
  });
});

describe("positions of kept elements", () => {
  it("gives a rule after a dropped rule its position in the text", () => {
    const text = planFile({}, { contract: { ...BAVARIA_CONTRACT, week: [FULL_TIME_WEEK], rules: [{ id: 5 }, rule("a"), rule("b")] } });
    const positions = positionsOf(text);
    expect(positions.get("contract.rules[0]")).toBe(1);
    expect(positions.get("contract.rules[1]")).toBe(2);
  });

  it("follows the entries that reading sorted", () => {
    const entries = [{ match: { type: "fixed", month: 5, day: 1 } }, { date: "2027-03-01" }, { date: "2027-02-01" }];
    const positions = positionsOf(planFile({}, { sources: [infoSource("s", entries)] }));
    expect(positions.get("sources[0].entries[0]")).toBe(2);
    expect(positions.get("sources[0].entries[1]")).toBe(1);
    expect(positions.get("sources[0].entries[2]")).toBe(0);
  });

  it("maps a kept source after a dropped one, with its entries", () => {
    const sources = [{ id: "bad" }, infoSource("s", [{ date: "2027-02-01" }, { date: "2027-03-01" }])];
    const positions = positionsOf(planFile({}, { sources }));
    expect(positions.get("sources[0]")).toBe(1);
    expect(positions.get("sources[0].entries[0]")).toBe(0);
    expect(positions.get("sources[0].entries[1]")).toBe(1);
  });

  it("maps leave days, overrides, notes and templates", () => {
    const days = [
      { date: "2027-05-03", take: "1" },
      { date: "x", take: "1" },
      { date: "2027-02-01", take: "1" },
    ];
    const template = { id: "t", name: "T", api: 1, typst: "0.14", typ: "#let x = 1" };
    const positions = positionsOf(planFile({ days, overrides: [{ date: "2027-05-03", required: "0" }], notes: [{ date: "2027-04-01", text: "n" }] }, { templates: [{ id: 5 }, template] }));
    expect(positions.get("plan.days[0]")).toBe(2);
    expect(positions.get("plan.days[1]")).toBe(0);
    expect(positions.get("plan.overrides[0]")).toBe(0);
    expect(positions.get("plan.notes[0]")).toBe(0);
    expect(positions.get("templates[0]")).toBe(1);
  });
});
