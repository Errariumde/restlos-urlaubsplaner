// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { validateCountryData } from "../../../src/engine/holidays/validate";
import { testCountry, testCountryFriSat } from "./fixture";

// Mutable, untyped copy of the fixture addressed by dotted paths ("holidays.0.date").
class Doc {
  readonly root: Record<string, unknown>;
  constructor(root: Record<string, unknown>) {
    this.root = root;
  }

  private parent(path: string): { holder: Record<string, unknown>; key: string } {
    const parts = path.split(".");
    const key = parts.pop() ?? "";
    let holder: unknown = this.root;
    for (const part of parts) holder = (holder as Record<string, unknown>)[part];
    return { holder: holder as Record<string, unknown>, key };
  }

  get(path: string): unknown {
    const { holder, key } = this.parent(path);
    return holder[key];
  }

  set(path: string, value: unknown): void {
    const { holder, key } = this.parent(path);
    holder[key] = value;
  }

  del(path: string): void {
    const { holder, key } = this.parent(path);
    delete holder[key];
  }
}

function change(mutate: (d: Doc) => void): unknown {
  const doc = new Doc(JSON.parse(JSON.stringify(testCountry)) as Record<string, unknown>);
  mutate(doc);
  return doc.root;
}

describe("validateCountryData", () => {
  it("accepts the fixtures", () => {
    expect(validateCountryData(testCountry)).toEqual([]);
    expect(validateCountryData(testCountryFriSat)).toEqual([]);
  });

  it.each([null, [], "XX", 1])("rejects %j as a whole", (input) => {
    expect(validateCountryData(input).map((i) => i.path)).toEqual([""]);
  });

  it.each<[string, (d: Doc) => void]>([
    ["schema", (d) => { d.del("schema"); }],
    ["weekStart", (d) => { d.set("weekStart", "monday"); }],
    ["workWeek.fri", (d) => { d.set("workWeek.fri", "0,5"); }],
    ["holidays[1].id", (d) => { d.set("holidays.1.id", d.get("holidays.0.id")); }],
    ["holidays[0].validfrom", (d) => { d.set("holidays.0.validfrom", 2020); }],
    ["holidays[0].date.nonLeap", (d) => { d.set("holidays.0.date", { type: "fixed", month: 2, day: 29 }); }],
    ["holidays[0].date.day", (d) => { d.set("holidays.0.date", { type: "fixed", month: 2, day: 30 }); }],
    ["holidays[0].date.nonLeap", (d) => { d.set("holidays.0.date", { type: "fixed", month: 3, day: 1, nonLeap: "drop" }); }],
    ["holidays[0].date.day", (d) => { d.set("holidays.0.date", { type: "weekdayRelative", weekday: "mon", relation: "after", month: 2, day: 29 }); }],
    ["holidays[0].date.n", (d) => { d.set("holidays.0.date", { type: "nthWeekday", month: 5, weekday: "mon", n: 5 }); }],
    ["holidays[0].date.date", (d) => { d.set("holidays.0.date", { type: "once", date: "2017-02-30" }); }],
    ["holidays[0].date.offset", (d) => { d.set("holidays.0.date", { type: "easter", offset: 1.5 }); }],
    ["holidays[0].regions[0]", (d) => { d.set("holidays.0.regions", ["Z"]); }],
    ["holidays[0].regions", (d) => { d.set("holidays.0.regions", []); }],
    ["holidays[0].localRule", (d) => { d.set("holidays.0.localRule", "nope"); }],
    ["holidays[0].regions", (d) => { d.set("holidays.0.localRule", "special"); d.set("holidays.0.regions", ["B"]); }],
    ["holidays[0].regions", (d) => { d.set("holidays.0.localRule", "special"); }],
    ["holidays[0].validUntil", (d) => { d.set("holidays.0.validFrom", 2026); d.set("holidays.0.validUntil", 2020); }],
    ["holidays[0].substitute.when[0]", (d) => { d.set("holidays.0.substitute", { when: ["mon"] }); }],
    ["holidays[0].sources", (d) => { d.set("holidays.0.sources", []); }],
    ["holidays[0].sources[0]", (d) => { d.set("holidays.0.sources", ["missing"]); }],
    ["sources.unused", (d) => { d.set("sources.unused", { title: "T", url: "https://example.org", checked: "2026-10-18" }); }],
    ["sources.law.url", (d) => { d.set("sources.law.url", "http://example.org"); }],
    ["sources.law.checked", (d) => { d.set("sources.law.checked", "2026-13-01"); }],
    ["localRules[0].regions[0]", (d) => { d.set("localRules.0.regions", ["Z"]); }],
    ["country", (d) => { d.set("country", "xx"); }],
    ["weekend", (d) => { d.set("weekend", []); }],
    ["weekend[1]", (d) => { d.set("weekend", ["sat", "sat"]); }],
    ["weekend", (d) => { d.set("weekend", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]); }],
    ["holidays[0].regions[1]", (d) => { d.set("holidays.0.regions", ["A", "A"]); }],
    ["holidays[0].sources[1]", (d) => { d.set("holidays.0.sources", ["law", "law"]); }],
    ["localRules[0].regions[1]", (d) => { d.set("localRules.0.regions", ["A", "A"]); }],
    ["localRules[0].sources[1]", (d) => { d.set("localRules.0.sources", ["law", "law"]); }],
    ["holidays[0].substitute.when[1]", (d) => { d.set("holidays.0.substitute", { when: ["sat", "sat"] }); }],
    ["workWeek.xyz", (d) => { d.set("workWeek.xyz", "1"); }],
    ["workWeek.sun", (d) => { d.del("workWeek.sun"); }],
    ["regions[1].id", (d) => { d.set("regions.1.id", "A"); }],
    ["regions", (d) => { d.set("regions", []); d.set("holidays", []); d.set("localRules", []); }],
    ["localRules[0].sources", (d) => { d.set("localRules.0.sources", []); }],
    ["localRules[0].explanationKey", (d) => { d.set("localRules.0.explanationKey", ""); }],
    ["holidays[0].validFrom", (d) => { d.set("holidays.0.validFrom", 1.5); }],
    ["holidays[0].validUntil", (d) => { d.set("holidays.0.validUntil", 10000); }],
    ["holidays[0].substitute.when", (d) => { d.set("holidays.0.substitute", { when: [] }); }],
    ["holidays[0].date.type", (d) => { d.set("holidays.0.date", { type: "lunar" }); }],
    ["holidays[0].date.month", (d) => { d.set("holidays.0.date", { type: "fixed", month: 13, day: 1 }); }],
    ["holidays[0].date.offset", (d) => { d.set("holidays.0.date", { type: "orthodoxEaster", offset: 201 }); }],
    ["holidays[0].date.relation", (d) => { d.set("holidays.0.date", { type: "weekdayRelative", weekday: "mon", relation: "near", month: 3, day: 1 }); }],
    ["holidays[0].date.weekday", (d) => { d.set("holidays.0.date", { type: "nthWeekday", month: 5, weekday: "x", n: 1 }); }],
    ["holidays[0].date.extra", (d) => { d.set("holidays.0.date", { type: "easter", offset: 0, extra: 1 }); }],
    ["holidays", (d) => { d.set("holidays", "none"); }],
    ["holidays[0].date", (d) => { d.set("holidays.0.date", 5); }],
    ["extra", (d) => { d.set("extra", 1); }],
    ["sources.law.title", (d) => { d.set("sources.law.title", ""); }],
  ])("reports %s", (path, mutate) => {
    expect(validateCountryData(change(mutate)).map((i) => i.path)).toContain(path);
  });

  it("reports a duplicate local rule ID once and keeps the first definition", () => {
    const input = change((d) => {
      d.set("localRules.1", {
        id: "special",
        regions: ["B"],
        nameKey: "localRule.XX.other",
        explanationKey: "localRule.XX.other.help",
        sources: ["law"],
      });
    });
    expect(validateCountryData(input).map((i) => i.path)).toEqual(["localRules[1].id"]);
  });

  it("never throws on odd input", () => {
    const odd = [undefined, {}, { holidays: [null, 3, []], regions: {}, sources: [] }, { workWeek: null, weekend: "x" }];
    for (const input of odd) expect(() => validateCountryData(input)).not.toThrow();
  });
});
