// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromIso } from "../../../src/engine/days";
import { readFile } from "../../../src/engine/file/read";
import { FULL_TIME_WEEK, MINIMAL_CONTRACT, minimal } from "./helpers";

const withContract = (contract: Record<string, unknown>) => readFile(minimal({ contract: { ...MINIMAL_CONTRACT, ...contract } }));
const codes = (result: ReturnType<typeof readFile>) => (result.ok ? result.report.map((e) => `${e.code}@${e.path}`) : [`refused:${result.refusal.code}`]);
const contractOf = (result: ReturnType<typeof readFile>) => {
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.file.contract;
};
const rule = (extra: Record<string, unknown> = {}) => ({ id: "r1", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2", ...extra });

describe("region", () => {
  it("refuses an unknown country", () =>
    expect(withContract({ region: { country: "XX" } })).toMatchObject({ ok: false, refusal: { code: "invalidCore", path: "contract.region.country" } }));
  it.each(["constructor", "__proto__", "toString"])("refuses the prototype key %j as country", (country) =>
    expect(readFile(minimal({ contract: JSON.parse(`{"region":{"country":"${country}","state":"BY"},"week":${JSON.stringify(MINIMAL_CONTRACT.week)},"rules":[]}`) as unknown })))
      .toMatchObject({ ok: false, refusal: { code: "invalidCore", path: "contract.region.country" } }));
  it("loads a rule set without a state", () => expect(contractOf(withContract({ region: { country: "DE" } })).region).toEqual({ country: "DE" }));
  it("drops an invalid state", () => {
    const result = withContract({ region: { country: "DE", state: "ZZ" } });
    expect(codes(result)).toEqual(["invalidEntry@contract.region.state"]);
    expect(contractOf(result).region).toEqual({ country: "DE" });
  });
  it("drops options the holiday data does not define (0001)", () => {
    const result = withContract({ region: { country: "DE", state: "BY", options: { assumption: true, renamedOption: false } } });
    expect(codes(result)).toEqual(["unknownLocalRule@contract.region.options.renamedOption"]);
    expect(contractOf(result).region).toEqual({ country: "DE", state: "BY", options: { assumption: true } });
  });
  it.each(["__proto__", "constructor", "prototype"])("drops the option %s", (key) => {
    const options = JSON.parse(`{"${key}":true,"assumption":true}`) as unknown;
    const result = withContract({ region: { country: "DE", state: "BY", options } });
    expect(codes(result)).toEqual([`unknownLocalRule@contract.region.options.${key}`]);
    expect(Object.keys(contractOf(result).region.options ?? {})).toEqual(["assumption"]);
  });
  it("reports a non-boolean option", () =>
    expect(codes(withContract({ region: { country: "DE", state: "BY", options: { assumption: "yes" } } }))).toEqual(["invalidEntry@contract.region.options.assumption"]));
});

describe("minUnit", () => {
  it("defaults to 240 silently", () => expect(contractOf(withContract({})).minUnit).toBe(240));
  it("reads a fraction", () => expect(contractOf(withContract({ minUnit: "1/4" })).minUnit).toBe(120));
  it.each(["3/8", "0", "x", 5])("reports %j and uses 240", (minUnit) => {
    const result = withContract({ minUnit });
    expect(codes(result)).toEqual(["invalidMinUnit@contract.minUnit"]);
    expect(contractOf(result).minUnit).toBe(240);
  });
});

describe("week", () => {
  const noSun = Object.fromEntries(Object.entries(FULL_TIME_WEEK.required).filter(([day]) => day !== "sun"));
  it("reads the entries as day numbers and units", () =>
    expect(contractOf(withContract({})).week).toEqual([{ from: dayFromIso("2020-01-01"), required: { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0 } }]));
  it.each([
    ["empty", []],
    ["no sunday", [{ ...FULL_TIME_WEEK, required: noSun }]],
    ["comma", [{ ...FULL_TIME_WEEK, required: { ...FULL_TIME_WEEK.required, mon: "0,5" } }]],
    ["impossible date", [{ ...FULL_TIME_WEEK, from: "2027-02-29" }]],
    ["not increasing", [FULL_TIME_WEEK, FULL_TIME_WEEK]],
    ["not a list", {}],
  ])("refuses %s", (_name, week) =>
    expect(withContract({ week })).toMatchObject({ ok: false, refusal: { code: "invalidCore", path: "contract.week" } }));
  it("refuses more than 100 entries", () => {
    const week = Array.from({ length: 101 }, (_, i) => ({ ...FULL_TIME_WEEK, from: `${String(2000 + i)}-01-01` }));
    expect(withContract({ week })).toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "weekEntries" } } });
  });
});

describe("rules", () => {
  it("reads one rule of every effect with the file-only fields", () => {
    const rules = [
      rule({ id: "a", label: { de: "Heiligabend" }, note: "n", references: ["law"] }),
      rule({ id: "b", requiredAtMost: undefined, requiredExactly: "0" }),
      rule({ id: "c", requiredAtMost: undefined, mandatory: "1/2", part: "start", validFrom: 2020, validUntil: 2030 }),
    ];
    const references = { law: { title: "Gesetz", version: "2020", url: "https://example.org/law", checked: "2026-10-18" } };
    const result = withContract({ rules, references });
    expect(codes(result)).toEqual([]);
    const contract = contractOf(result);
    expect(contract.rules).toEqual([
      { id: "a", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: 240, label: { de: "Heiligabend" }, note: "n", references: ["law"] },
      { id: "b", match: { type: "fixed", month: 12, day: 24 }, requiredExactly: 0 },
      { id: "c", match: { type: "fixed", month: 12, day: 24 }, mandatory: 240, part: "start", validFrom: 2020, validUntil: 2030 },
    ]);
    expect(contract.references.law).toEqual({ title: "Gesetz", version: "2020", url: "https://example.org/law", checked: dayFromIso("2026-10-18") });
  });
  it.each([
    ["two effects", rule({ requiredExactly: "0" })],
    ["mandatory 0", rule({ requiredAtMost: undefined, mandatory: "0" })],
    ["30 February", rule({ match: { type: "fixed", month: 2, day: 30 } })],
    ["range without end", rule({ match: { type: "range", from: { type: "fixed", month: 1, day: 1 } } })],
    ["validFrom 1500", rule({ validFrom: 1500 })],
    ["29 February without nonLeap", rule({ match: { type: "fixed", month: 2, day: 29 } })],
    ["easter offset 367", rule({ match: { type: "easter", offset: 367 } })],
    ["range in range", rule({ match: { type: "range", days: 3, from: { type: "range", days: 2, from: { type: "fixed", month: 1, day: 1 } } } })],
    ["range days 367", rule({ match: { type: "range", days: 367, from: { type: "fixed", month: 1, day: 1 } } })],
    ["empty weekdays", rule({ match: { type: "range", days: 3, weekdays: [], from: { type: "fixed", month: 1, day: 1 } } })],
    ["duplicate weekdays", rule({ match: { type: "range", days: 3, weekdays: ["mon", "mon"], from: { type: "fixed", month: 1, day: 1 } } })],
    ["no id", rule({ id: "" })],
  ])("drops an invalid rule: %s", (_name, bad) => {
    const result = withContract({ rules: [rule({ id: "first" }), bad, rule({ id: "last" })] });
    expect(codes(result)).toEqual(["invalidEntry@contract.rules[1]"]);
    expect(contractOf(result).rules.map((r) => r.id)).toEqual(["first", "last"]);
  });
  it("accepts every date rule and a range with weekdays", () => {
    const matches = [
      { type: "fixed", month: 2, day: 29, nonLeap: "feb28" },
      { type: "easter", offset: -366 },
      { type: "orthodoxEaster", offset: 1 },
      { type: "weekdayRelative", weekday: "wed", relation: "before", month: 11, day: 23 },
      { type: "nthWeekday", month: 5, weekday: "mon", n: -1 },
      { type: "once", date: "2027-03-13" },
      { type: "range", from: { type: "easter", offset: -52 }, days: 6, weekdays: ["mon", "tue"] },
    ];
    const rules = matches.map((match, i) => rule({ id: `m${String(i)}`, match }));
    const result = withContract({ rules });
    expect(codes(result).filter((c) => !c.startsWith("ruleWarning"))).toEqual([]);
    expect(contractOf(result).rules).toHaveLength(7);
  });
  it("keeps the first of two rules with the same id", () => {
    const result = withContract({ rules: [rule(), rule({ requiredAtMost: "0" })] });
    expect(codes(result)).toEqual(["duplicateId@contract.rules[1].id"]);
    expect(contractOf(result).rules).toHaveLength(1);
  });
  it("drops a citation of an unknown reference", () => {
    const result = withContract({ rules: [rule({ references: ["nope"] })] });
    expect(codes(result)).toEqual(["unknownReference@contract.rules[0].references[0]"]);
    expect(contractOf(result).rules[0]?.references).toEqual([]);
  });
  it("reports warnings and keeps the rule", () => {
    const result = withContract({ rules: [rule({ match: { type: "once", date: "2027-03-13" }, validFrom: 2030 })] });
    expect(result).toMatchObject({ ok: true, report: [{ code: "ruleWarning", path: "contract.rules[0]", data: { warning: "neverApplies" } }] });
    expect(contractOf(result).rules).toHaveLength(1);
  });
  it("refuses 1001 rules", () =>
    expect(withContract({ rules: Array.from({ length: 1001 }, (_, i) => rule({ id: `r${String(i)}` })) }))
      .toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "rules" } } }));
});

describe("references", () => {
  const good = { title: "T", version: "1", url: "https://example.org", checked: "2026-10-18" };
  it("drops invalid entries", () => {
    const result = withContract({ references: { ok: good, http: { ...good, url: "http://example.org" }, noDate: { title: "T", version: "1", url: "https://example.org" } } });
    expect(codes(result)).toEqual(["invalidEntry@contract.references.http", "invalidEntry@contract.references.noDate"]);
    expect(Object.keys(contractOf(result).references)).toEqual(["ok"]);
  });
  it("drops the keys __proto__, constructor and prototype, and a rule's citation of one", () => {
    const references = JSON.parse(`{"__proto__":${JSON.stringify(good)},"constructor":${JSON.stringify(good)},"prototype":${JSON.stringify(good)},"ok":${JSON.stringify(good)}}`) as unknown;
    const result = withContract({ references, rules: [rule({ references: ["constructor", "ok"] })] });
    expect(codes(result)).toEqual([
      "invalidEntry@contract.references.__proto__",
      "invalidEntry@contract.references.constructor",
      "invalidEntry@contract.references.prototype",
      "unknownReference@contract.rules[0].references[0]",
    ]);
    expect(Object.keys(contractOf(result).references)).toEqual(["ok"]);
    expect(contractOf(result).rules[0]?.references).toEqual(["ok"]);
  });
});

describe("over-long rule texts", () => {
  it.each([
    ["label", { label: "x".repeat(201) }, 200],
    ["note", { note: { de: "x", en: "y".repeat(2001) } }, 2000],
  ])("drops a rule with an over-long %s and reports the rule itself too (R20)", (field, extra, limit) => {
    const result = withContract({ rules: [rule(extra), rule({ id: "r2" })] });
    expect(result.ok && result.report).toEqual([
      { code: "textTooLong", path: `contract.rules[0].${field}`, data: field === "note" ? { limit, language: "en" } : { limit } },
      { code: "invalidEntry", path: "contract.rules[0]", data: { field } },
    ]);
    expect(contractOf(result).rules.map((r) => r.id)).toEqual(["r2"]);
  });
});

describe("name and description", () => {
  it("drops a name over 200 characters", () => {
    const result = withContract({ name: "x".repeat(201), description: "d" });
    expect(codes(result)).toEqual(["textTooLong@contract.name"]);
    expect(contractOf(result)).toMatchObject({ description: "d" });
    expect(contractOf(result).name).toBeUndefined();
  });
});
