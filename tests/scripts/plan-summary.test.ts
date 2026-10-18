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
        "  unknownField at savedAt",
        "  partSuggested at plan.days[0] (part=end)",
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
      ["test-rule-set — rule set, revision 1", "Report: none", "Rules:", "  xmas-eve: requiredAtMost 1/2 — Christmas Eve"].join("\n"),
    );
  });

  it("prints a refusal", () => expect(formatSummary(readFile("{"))).toBe("Refused: notJson"));
  it("prints the path of a refusal", () =>
    expect(formatSummary(readFile(minimal({ revision: 0 })))).toBe("Refused: invalidCore at revision"));
});
