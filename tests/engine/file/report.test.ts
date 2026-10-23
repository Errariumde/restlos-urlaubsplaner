// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { Report, at, child } from "../../../src/engine/file/report";

/** A part with one Error and one Info about the entry `a`. */
function part(): Report {
  const report = new Report();
  report.error("unknownField", "a.x", "a.x");
  report.notice("outsidePeriod", "a");
  return report;
}

describe("Report", () => {
  it("merges a kept part with all its entries", () => {
    const report = new Report();
    report.merge(part(), true);
    expect(report.entries).toEqual([
      { code: "unknownField", path: "a.x", dropped: "a.x" },
      { code: "outsidePeriod", path: "a" },
    ]);
  });
  it("merges a dropped part with its Errors only", () => {
    const report = new Report();
    report.merge(part(), false);
    expect(report.entries).toEqual([{ code: "unknownField", path: "a.x", dropped: "a.x" }]);
  });
  it("tells whether an Error drops exactly a path", () => {
    const report = part();
    report.error("invalidValue", "b.take", "b", { limit: 1 });
    expect([report.drops("b"), report.drops("a.x"), report.drops("a"), report.drops("b.take")]).toEqual([true, true, false, false]);
    expect(report.entries[2]).toEqual({ code: "invalidValue", path: "b.take", dropped: "b", data: { limit: 1 } });
  });
});

describe("paths", () => {
  it("joins keys with dots and indexes with brackets", () =>
    expect([child("", "contract"), child("contract", "rules"), at("contract.rules", 2)]).toEqual(["contract", "contract.rules", "contract.rules[2]"]));
  it('writes an empty key as "", so that it is never the whole file', () =>
    expect([child("", ""), child("contract", ""), child('""', "x")]).toEqual(['""', 'contract.""', '"".x']));
});
