// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromIso } from "../../../src/engine/days";
import { checkRules } from "../../../src/engine/file/check";
import { readFile } from "../../../src/engine/file/read";
import { readContract } from "../../../src/engine/file/read-contract";
import { Report } from "../../../src/engine/file/report";
import { BAVARIA_CONTRACT, FULL_TIME_WEEK, MINIMAL_CONTRACT, core, minimal, planFile, refusedWith } from "./helpers";

const withContract = (contract: Record<string, unknown>) => readFile(minimal({ contract: { ...MINIMAL_CONTRACT, ...contract } }));
const codes = (result: ReturnType<typeof readFile>) => (result.ok ? result.report.map((e) => `${e.code}@${e.path}`) : [`refused:${result.refusal.code}`]);
const contractOf = (result: ReturnType<typeof readFile>) => {
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.file.contract;
};
const reportOf = (result: ReturnType<typeof readFile>) => {
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.report;
};
const rule = (extra: Record<string, unknown> = {}) => ({ id: "r1", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2", ...extra });

describe("region", () => {
  it("refuses an unknown country", () =>
    expect(withContract({ region: { country: "XX" } })).toEqual(refusedWith(core("invalidValue", "contract.region.country"))));
  it.each(["constructor", "__proto__", "toString"])("refuses the prototype key %j as country", (country) =>
    expect(readFile(minimal({ contract: JSON.parse(`{"region":{"country":"${country}","state":"BY"},"week":${JSON.stringify(MINIMAL_CONTRACT.week)},"rules":[]}`) as unknown })))
      .toEqual(refusedWith(core("invalidValue", "contract.region.country"))));
  it.each([
    ["no region", undefined, core("missingValue", "contract.region")],
    ["a region that isn't an object", "DE", core("invalidValue", "contract.region")],
    ["no country", { state: "BY" }, core("missingValue", "contract.region.country")],
  ])("refuses %s", (_name, region, entry) => expect(withContract({ region })).toEqual(refusedWith(entry)));
  it("loads a rule set without a state", () => expect(contractOf(withContract({ region: { country: "DE" } })).region).toEqual({ country: "DE" }));
  it("drops an invalid state", () => {
    const result = withContract({ region: { country: "DE", state: "ZZ" } });
    expect(reportOf(result)).toEqual([{ code: "invalidValue", path: "contract.region.state", dropped: "contract.region.state" }]);
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
  it("skips the state and options of an unknown country (Review Focus 2)", () =>
    expect(withContract({ region: { country: "XX", state: "BY", options: { foo: true } } })).toEqual(
      refusedWith(core("invalidValue", "contract.region.country")),
    ));
  it.each([
    ["missing", undefined, core("missingValue", "contract.region.state")],
    ["invalid", "ZZ", core("invalidValue", "contract.region.state")],
  ])("skips the options of a plan file whose required state is %s", (_name, state, entry) =>
    expect(readFile(planFile({}, { contract: { ...BAVARIA_CONTRACT, region: { country: "DE", state, options: { assumption: true } } } }))).toEqual(
      refusedWith(entry),
    ));
  it("keeps the follow-ons of a rule set whose optional state is dropped, which loads", () =>
    expect(reportOf(withContract({ region: { country: "DE", state: "ZZ", options: { assumption: true } } }))).toEqual([
      { code: "invalidValue", path: "contract.region.state", dropped: "contract.region.state" },
      { code: "unknownLocalRule", path: "contract.region.options.assumption", dropped: "contract.region.options.assumption" },
    ]));
  it("reports a non-boolean option", () =>
    expect(reportOf(withContract({ region: { country: "DE", state: "BY", options: { assumption: "yes" } } }))).toEqual([
      { code: "invalidValue", path: "contract.region.options.assumption", dropped: "contract.region.options.assumption" },
    ]));
});

describe("minUnit", () => {
  it("defaults to 240 silently", () => expect(contractOf(withContract({})).minUnit).toBe(240));
  it("gives 240 for the plan when the contract isn't an object, and reads nothing inside", () => {
    const report = new Report();
    expect(readContract("x", "contract", "plan", report)).toEqual({ contract: undefined, minUnit: 240 });
    expect(report.entries).toEqual([core("invalidValue", "contract")]);
  });
  it("gives the plan the contract's minUnit when the contract is refused", () => {
    const report = new Report();
    expect(readContract({ ...BAVARIA_CONTRACT, week: undefined, minUnit: "1/4" }, "contract", "plan", report)).toEqual({ contract: undefined, minUnit: 120 });
    expect(report.entries).toEqual([core("missingValue", "contract.week")]);
  });
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
    ["empty", [], core("invalidValue", "contract.week")],
    ["no sunday", [{ ...FULL_TIME_WEEK, required: noSun }], core("missingValue", "contract.week[0].required.sun")],
    ["comma", [{ ...FULL_TIME_WEEK, required: { ...FULL_TIME_WEEK.required, mon: "0,5" } }], core("invalidValue", "contract.week[0].required.mon")],
    ["impossible date", [{ ...FULL_TIME_WEEK, from: "2027-02-29" }], core("invalidValue", "contract.week[0].from")],
    ["not increasing", [FULL_TIME_WEEK, FULL_TIME_WEEK], core("invalidValue", "contract.week[1].from")],
    ["not a list", {}, core("invalidValue", "contract.week")],
    ["missing", undefined, core("missingValue", "contract.week")],
    ["an entry that isn't an object", [FULL_TIME_WEEK, "x"], core("invalidValue", "contract.week[1]")],
    ["an entry without from", [{ required: FULL_TIME_WEEK.required }], core("missingValue", "contract.week[0].from")],
    ["required that isn't an object", [{ ...FULL_TIME_WEEK, required: "1" }], core("invalidValue", "contract.week[0].required")],
  ])("refuses %s", (_name, week, entry) => expect(withContract({ week })).toEqual(refusedWith(entry)));
  it("checks the order of from only against a valid previous from", () => {
    const week = [FULL_TIME_WEEK, { ...FULL_TIME_WEEK, from: "x" }, { ...FULL_TIME_WEEK, from: "2019-01-01" }];
    expect(withContract({ week })).toEqual(refusedWith(core("invalidValue", "contract.week[1].from")));
  });
  it("reports the unknown fields of a refused week, which drop only themselves", () => {
    const week = [{ ...FULL_TIME_WEEK, required: { ...FULL_TIME_WEEK.required, mon: "x", hol: "0" }, note: "n" }];
    expect(withContract({ week })).toEqual(
      refusedWith(
        core("invalidValue", "contract.week[0].required.mon"),
        { code: "unknownField", path: "contract.week[0].required.hol", dropped: "contract.week[0].required.hol" },
        { code: "unknownField", path: "contract.week[0].note", dropped: "contract.week[0].note" },
      ),
    );
  });
  it("reports every invalid work-week entry", () => {
    const week = [
      { from: "2020-01-01", required: { ...FULL_TIME_WEEK.required, mon: "x" } },
      { from: "2019-01-01", required: FULL_TIME_WEEK.required },
    ];
    expect(withContract({ week })).toEqual(
      refusedWith(core("invalidValue", "contract.week[0].required.mon"), core("invalidValue", "contract.week[1].from")),
    );
  });
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
  const effects = { oneOf: ["requiredAtMost", "requiredExactly", "mandatory"] };
  it.each([
    ["two effects", rule({ requiredExactly: "0" }), "invalidValue", "", effects],
    ["mandatory 0", rule({ requiredAtMost: undefined, mandatory: "0" }), "invalidValue", ".mandatory"],
    ["30 February", rule({ match: { type: "fixed", month: 2, day: 30 } }), "invalidValue", ".match.day"],
    ["range without end", rule({ match: { type: "range", from: { type: "fixed", month: 1, day: 1 } } }), "missingValue", ".match", { oneOf: ["to", "days"] }],
    ["validFrom 1500", rule({ validFrom: 1500 }), "invalidValue", ".validFrom"],
    ["29 February without nonLeap", rule({ match: { type: "fixed", month: 2, day: 29 } }), "missingValue", ".match.nonLeap"],
    ["easter offset 367", rule({ match: { type: "easter", offset: 367 } }), "invalidValue", ".match.offset"],
    [
      "range in range",
      rule({ match: { type: "range", days: 3, from: { type: "range", days: 2, from: { type: "fixed", month: 1, day: 1 } } } }),
      "invalidValue",
      ".match.from.type",
    ],
    ["range days 367", rule({ match: { type: "range", days: 367, from: { type: "fixed", month: 1, day: 1 } } }), "invalidValue", ".match.days"],
    ["empty weekdays", rule({ match: { type: "range", days: 3, weekdays: [], from: { type: "fixed", month: 1, day: 1 } } }), "invalidValue", ".match.weekdays"],
    [
      "duplicate weekdays",
      rule({ match: { type: "range", days: 3, weekdays: ["mon", "mon"], from: { type: "fixed", month: 1, day: 1 } } }),
      "invalidValue",
      ".match.weekdays[1]",
    ],
    ["no id", rule({ id: "" }), "invalidValue", ".id"],
  ])("drops an invalid rule: %s", (_name, bad, code, key, data?: Record<string, unknown>) => {
    const result = withContract({ rules: [rule({ id: "first" }), bad, rule({ id: "last" })] });
    expect(reportOf(result)).toEqual([{ code, path: `contract.rules[1]${key}`, dropped: "contract.rules[1]", ...(data ? { data } : {}) }]);
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
    expect(codes(result)).toEqual([]);
    expect(contractOf(result).rules).toHaveLength(7);
  });
  it("keeps the first of two rules with the same id", () => {
    const result = withContract({ rules: [rule(), rule({ requiredAtMost: "0" })] });
    expect(codes(result)).toEqual(["duplicateId@contract.rules[1].id"]);
    expect(contractOf(result).rules).toHaveLength(1);
  });
  it("reads a rule with a duplicate id no further", () => {
    const result = withContract({ rules: [rule(), rule({ validFrom: 1500, colour: "red" })] });
    expect(reportOf(result)).toEqual([{ code: "duplicateId", path: "contract.rules[1].id", dropped: "contract.rules[1]" }]);
  });
  it("drops a citation of an unknown reference", () => {
    const result = withContract({ rules: [rule({ references: ["nope"] })] });
    expect(codes(result)).toEqual(["unknownReference@contract.rules[0].references[0]"]);
    expect(contractOf(result).rules[0]?.references).toEqual([]);
  });
  it("reads a rule that never applies without a report entry", () => {
    const result = withContract({ rules: [rule({ match: { type: "once", date: "2027-03-13" }, validFrom: 2030 })] });
    expect(result).toMatchObject({ ok: true, report: [] });
    if (result.ok) expect(checkRules(result.file, result.positions)).toEqual([{ code: "neverApplies", path: "contract.rules[0]" }]);
    expect(contractOf(result).rules).toHaveLength(1);
  });
  it("reports every problem of a rule", () => {
    const bad = { match: { type: "fixed", month: 13, day: 1 }, validFrom: 1500, requiredAtMost: "1/2", requiredExactly: "0", colour: "red" };
    const result = withContract({ rules: [bad] });
    expect(reportOf(result)).toEqual([
      { code: "missingValue", path: "contract.rules[0].id", dropped: "contract.rules[0]" },
      { code: "invalidValue", path: "contract.rules[0].match.month", dropped: "contract.rules[0]" },
      { code: "invalidValue", path: "contract.rules[0].validFrom", dropped: "contract.rules[0]" },
      { code: "invalidValue", path: "contract.rules[0]", dropped: "contract.rules[0]", data: { oneOf: ["requiredAtMost", "requiredExactly", "mandatory"] } },
      { code: "unknownField", path: "contract.rules[0].colour", dropped: "contract.rules[0].colour" },
    ]);
    expect(contractOf(result).rules).toEqual([]);
  });
  it("skips the fields of a match whose type is unknown (Review Focus 2)", () => {
    const result = withContract({ rules: [rule({ match: { type: "fixd", month: 13, day: 99 } })] });
    expect(reportOf(result)).toEqual([{ code: "invalidValue", path: "contract.rules[0].match.type", dropped: "contract.rules[0]" }]);
  });
  it("keeps the Error of an unknown citation when the rule is dropped", () => {
    const result = withContract({ rules: [rule({ requiredAtMost: undefined, references: ["nope"] })] });
    expect(reportOf(result)).toEqual([
      { code: "missingValue", path: "contract.rules[0]", dropped: "contract.rules[0]", data: { oneOf: ["requiredAtMost", "requiredExactly", "mandatory"] } },
      { code: "unknownReference", path: "contract.rules[0].references[0]", dropped: "contract.rules[0].references[0]", data: { reference: "nope" } },
    ]);
    expect(contractOf(result).rules).toEqual([]);
  });
  it("reads a contract without rules", () => {
    const result = readFile(minimal({ contract: { region: MINIMAL_CONTRACT.region, week: MINIMAL_CONTRACT.week } }));
    expect(result).toMatchObject({ ok: true, report: [] });
    expect(contractOf(result).rules).toEqual([]);
  });
  it("refuses 1001 rules", () =>
    expect(withContract({ rules: Array.from({ length: 1001 }, (_, i) => rule({ id: `r${String(i)}` })) }))
      .toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "rules" } } }));
});

describe("references", () => {
  const good = { title: "T", version: "1", url: "https://example.org", checked: "2026-10-18" };
  it("drops invalid entries", () => {
    const result = withContract({ references: { ok: good, http: { ...good, url: "http://example.org" }, noDate: { title: "T", version: "1", url: "https://example.org" } } });
    expect(reportOf(result)).toEqual([
      { code: "invalidValue", path: "contract.references.http.url", dropped: "contract.references.http" },
      { code: "missingValue", path: "contract.references.noDate.checked", dropped: "contract.references.noDate" },
    ]);
    expect(Object.keys(contractOf(result).references)).toEqual(["ok"]);
  });
  it("drops the keys __proto__, constructor and prototype, and a rule's citation of one", () => {
    const references = JSON.parse(`{"__proto__":${JSON.stringify(good)},"constructor":${JSON.stringify(good)},"prototype":${JSON.stringify(good)},"ok":${JSON.stringify(good)}}`) as unknown;
    const result = withContract({ references, rules: [rule({ references: ["constructor", "ok"] })] });
    expect(reportOf(result)).toEqual([
      { code: "invalidValue", path: "contract.references.__proto__", dropped: "contract.references.__proto__" },
      { code: "invalidValue", path: "contract.references.constructor", dropped: "contract.references.constructor" },
      { code: "invalidValue", path: "contract.references.prototype", dropped: "contract.references.prototype" },
      { code: "unknownReference", path: "contract.rules[0].references[0]", dropped: "contract.rules[0].references[0]", data: { reference: "constructor" } },
    ]);
    expect(Object.keys(contractOf(result).references)).toEqual(["ok"]);
    expect(contractOf(result).rules[0]?.references).toEqual(["ok"]);
  });
});

describe("rule values that are only shown", () => {
  const match = { type: "fixed", month: 12, day: 24 };
  it("keeps a rule whose label is too long, without the label", () => {
    const result = withContract({ rules: [rule({ label: "x".repeat(201) })] });
    expect(reportOf(result)).toEqual([
      { code: "textTooLong", path: "contract.rules[0].label", dropped: "contract.rules[0].label", data: { limit: 200 } },
    ]);
    expect(contractOf(result).rules).toEqual([{ id: "r1", match, requiredAtMost: 240 }]);
  });
  it("keeps a rule whose note is too long, without the note", () => {
    const result = withContract({ rules: [rule({ note: { de: "x", en: "y".repeat(2001) } }), rule({ id: "r2", note: "n" })] });
    expect(reportOf(result)).toEqual([
      { code: "textTooLong", path: "contract.rules[0].note.en", dropped: "contract.rules[0].note", data: { limit: 2000 } },
    ]);
    expect(contractOf(result).rules).toEqual([
      { id: "r1", match, requiredAtMost: 240 },
      { id: "r2", match, requiredAtMost: 240, note: "n" },
    ]);
  });
  it.each([
    ["label", { label: 5 }, "contract.rules[0].label", "contract.rules[0].label", {}],
    ["note", { note: { EN: "x" } }, "contract.rules[0].note.EN", "contract.rules[0].note", {}],
    ["references", { references: "x" }, "contract.rules[0].references", "contract.rules[0].references", {}],
    ["citation", { references: [5] }, "contract.rules[0].references[0]", "contract.rules[0].references[0]", { references: [] }],
  ])("keeps a rule without the invalid %s", (_name, extra, path, dropped, kept) => {
    const result = withContract({ rules: [rule(extra)] });
    expect(reportOf(result)).toEqual([{ code: "invalidValue", path, dropped }]);
    expect(contractOf(result).rules).toEqual([{ id: "r1", match, requiredAtMost: 240, ...kept }]);
  });
  it("still drops a rule whose other values are invalid, and reports its dropped label too", () => {
    const result = withContract({ rules: [rule({ label: 5, validFrom: 1500 })] });
    expect(reportOf(result)).toEqual([
      { code: "invalidValue", path: "contract.rules[0].label", dropped: "contract.rules[0].label" },
      { code: "invalidValue", path: "contract.rules[0].validFrom", dropped: "contract.rules[0]" },
    ]);
    expect(contractOf(result).rules).toEqual([]);
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
