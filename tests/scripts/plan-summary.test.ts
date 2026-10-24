// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { readFile } from "../../src/engine/file/read";
import { formatSummary } from "../../scripts/plan-summary";
import { BAVARIA_CONTRACT, minimal, planFile } from "../engine/file/helpers";

describe("formatSummary", () => {
  it("prints a plan file with a partial start, a problem and a report entry", () => {
    const text = planFile(
      { days: [{ date: "2027-12-24", take: "1/2" }, { date: "2027-05-08", take: "1" }] },
      { savedAt: "x", contract: { ...BAVARIA_CONTRACT, name: { de: "Beispiel GmbH", en: "Example Ltd" } } },
    );
    expect(formatSummary(readFile(text))).toBe(
      [
        "Example Ltd — plan 2027-01 to 2027-12, revision 1",
        "Report:",
        "  error unknownField at savedAt",
        "  warning partSuggested at plan.days[0] (part=end)",
        "Hints: none",
        "Allowance 30, planned 1/2, remaining 29 1/2",
        "2027: 1/2",
        "Stretches:",
        "  2027-12-24@1/2 – 2027-12-26: 2 1/2 days off, cost 1/2",
        "Problems:",
        "  leaveWithoutRequiredWork 2027-05-08",
      ].join("\n"),
    );
  });

  it("prints a rule set with one line per rule", () => {
    const contract = {
      ...BAVARIA_CONTRACT,
      rules: [{ id: "xmas-eve", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2", label: { en: "Christmas Eve" } }],
    };
    const result = readFile(minimal({ contract }));
    expect(formatSummary(result)).toBe(
      ["test-rule-set — rule set, revision 1", "Report: none", "Hints: none", "Rules:", "  xmas-eve: requiredAtMost 1/2 — Christmas Eve"].join("\n"),
    );
  });

  it("prints a rule set without rules", () =>
    expect(formatSummary(readFile(minimal()))).toBe(["test-rule-set — rule set, revision 1", "Report: none", "Hints: none", "Rules: none"].join("\n")));

  it('prints a root key "" as ""', () =>
    expect(formatSummary(readFile(minimal({ "": 1 })))).toBe(
      ["test-rule-set — rule set, revision 1", 'Report: error unknownField at ""', "Hints: none", "Rules: none"].join("\n"),
    ));

  it("prints the effects requiredExactly and mandatory", () => {
    const rule = (id: string, effect: Record<string, string>) => ({ id, match: { type: "fixed", month: 12, day: 31 }, ...effect });
    const contract = { ...BAVARIA_CONTRACT, rules: [rule("a", { requiredExactly: "0" }), rule("b", { mandatory: "1/4" })] };
    expect(formatSummary(readFile(minimal({ contract })))).toContain("  a: requiredExactly 0\n  b: mandatory 1/4");
  });

  it("prints a negative remaining allowance and no stretches", () => {
    const summary = formatSummary(readFile(planFile({ allowance: "0", days: [{ date: "2027-05-07", take: "1" }] })));
    expect(summary).toContain("Allowance 0, planned 1, remaining -1");
    expect(formatSummary(readFile(planFile()))).toContain("Stretches: none");
  });

  it("prints a refusal", () => expect(formatSummary(readFile("{"))).toBe("Refused: notJson"));
  it("prints a refused file with severities", () =>
    expect(formatSummary(readFile(minimal({ revision: 0 })))).toBe("Refused: invalidCore\nReport: error invalidValue at revision; drops the file"));

  it("prints the hints with their severity", () => {
    const rule = { id: "old-closure", match: { type: "once", date: "2019-07-01" }, validFrom: 2020, requiredAtMost: "0" };
    const summary = formatSummary(readFile(minimal({ contract: { ...BAVARIA_CONTRACT, rules: [rule] } })));
    expect(summary).toContain("Hints: warning neverApplies at contract.rules[0]");
  });

  it("prints what an Error drops", () => {
    const rule = { id: "r", match: { type: "fixed", month: 12, day: 24 }, validFrom: 1500, requiredAtMost: "0" };
    const summary = formatSummary(readFile(minimal({ contract: { ...BAVARIA_CONTRACT, rules: [rule] } })));
    expect(summary).toContain("Report: error invalidValue at contract.rules[0].validFrom; drops contract.rules[0]");
  });
});
