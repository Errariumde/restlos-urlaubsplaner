// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromIso } from "../../../src/engine/days";
import { checkRules } from "../../../src/engine/file/check";
import { readFile } from "../../../src/engine/file/read";
import { readSources } from "../../../src/engine/file/read-sources";
import { Report } from "../../../src/engine/file/report";
import { MINIMAL_CONTRACT, minimal } from "./helpers";

const withSources = (sources: unknown, extra: Record<string, unknown> = {}) => readFile(minimal({ sources, ...extra }));
const codes = (result: ReturnType<typeof readFile>) => (result.ok ? result.report.map((e) => `${e.code}@${e.path}`) : [`refused:${result.refusal.code}`]);
const sourcesOf = (result: ReturnType<typeof readFile>) => {
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.file.sources;
};
const source = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  name: "School",
  type: "info",
  color: { slot: "accent-3" },
  visible: true,
  entries: [] as unknown[],
  ...extra,
});
const day = (iso: string) => dayFromIso(iso);

describe("a valid file", () => {
  it("loads one source of every type with an empty report", () => {
    const sources = [
      source({
        id: "h",
        type: "holiday",
        name: { de: "Feiertage", en: "Holidays" },
        entries: [
          { date: "2027-12-24", required: "1/2", part: "end", name: { de: "Heiligabend" } },
          { date: "2027-01-01" },
        ],
      }),
      source({ id: "p", type: "paidClosure", entries: [{ date: "2027-05-14", name: "Brückentag" }] }),
      source({
        id: "m",
        type: "mandatory",
        color: { rgb: "#1a7f37" },
        visible: false,
        entries: [
          {
            match: { type: "range", from: { type: "fixed", month: 12, day: 27 }, to: { type: "fixed", month: 12, day: 30 } },
            validFrom: 2026,
            validUntil: 2030,
            except: ["2027-12-28"],
            take: "1/2",
            part: "start",
          },
        ],
      }),
      source({ id: "i", type: "info", entries: [{ date: "2027-08-02" }] }),
      source({
        id: "o",
        type: "otherPlan",
        plan: { id: "plan-2", name: "Partner", revision: 4 },
        entries: [{ date: "2027-03-01", from: "0", to: "1", kind: "leave", name: "x" }],
      }),
      source({ id: "n", type: "needed", entries: [{ date: "2027-06-01" }] }),
    ];
    const report = new Report();
    const read = readSources(sources, "sources", "plan", report);
    expect(report.entries).toEqual([]);
    expect(read).toEqual([
      {
        id: "h",
        name: { de: "Feiertage", en: "Holidays" },
        type: "holiday",
        color: { slot: "accent-3" },
        visible: true,
        entries: [
          { date: day("2027-01-01"), required: 0 },
          { date: day("2027-12-24"), name: { de: "Heiligabend" }, required: 240, part: "end" },
        ],
      },
      { id: "p", name: "School", type: "paidClosure", color: { slot: "accent-3" }, visible: true, entries: [{ date: day("2027-05-14"), name: "Brückentag" }] },
      {
        id: "m",
        name: "School",
        type: "mandatory",
        color: { rgb: "#1a7f37" },
        visible: false,
        entries: [
          {
            match: { type: "range", from: { type: "fixed", month: 12, day: 27 }, to: { type: "fixed", month: 12, day: 30 } },
            validFrom: 2026,
            validUntil: 2030,
            except: [day("2027-12-28")],
            take: 240,
            part: "start",
          },
        ],
      },
      { id: "i", name: "School", type: "info", color: { slot: "accent-3" }, visible: true, entries: [{ date: day("2027-08-02") }] },
      {
        id: "o",
        name: "School",
        type: "otherPlan",
        color: { slot: "accent-3" },
        visible: true,
        plan: { id: "plan-2", name: "Partner", revision: 4 },
        entries: [{ date: day("2027-03-01"), from: 0, to: 480, kind: "leave", name: "x" }],
      },
      { id: "n", name: "School", type: "needed", color: { slot: "accent-3" }, visible: true, entries: [{ date: day("2027-06-01"), take: 480 }] },
    ]);
  });
  it("sorts date entries by date, then match entries in list order", () => {
    const match = (day: number) => ({ match: { type: "fixed", month: 1, day } });
    const report = new Report();
    const [read] = readSources(
      [source({ entries: [match(5), { date: "2027-02-01" }, match(3), { date: "2027-01-01" }] })],
      "sources",
      "plan",
      report,
    );
    expect(read?.entries.map((e) => ("date" in e ? e.date : e.match.type === "fixed" ? e.match.day : -1))).toEqual([day("2027-01-01"), day("2027-02-01"), 5, 3]);
  });
  it("sorts other-plan entries by date, then from", () => {
    const report = new Report();
    const [read] = readSources(
      [
        source({
          type: "otherPlan",
          plan: { id: "p", name: "P", revision: 1 },
          entries: [
            { date: "2027-03-02", from: "0", to: "1/2", kind: "leave" },
            { date: "2027-03-01", from: "1/2", to: "1", kind: "leave" },
            { date: "2027-03-01", from: "0", to: "1/2", kind: "mandatory" },
          ],
        }),
      ],
      "sources",
      "plan",
      report,
    );
    expect(read?.entries.map((e): [number, number] => [(e as { date: number }).date, "from" in e ? e.from : -1])).toEqual([
      [day("2027-03-01"), 0],
      [day("2027-03-01"), 240],
      [day("2027-03-02"), 0],
    ]);
  });
  it("reads missing sources as an empty list without a report entry", () => {
    const result = readFile(JSON.stringify({ schema: "restlos/1", kind: "ruleSet", id: "x", revision: 1, contract: MINIMAL_CONTRACT }));
    expect(codes(result)).toEqual([]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("reads a source without visible and entries", () => {
    const result = withSources([{ id: "s1", name: "School", type: "info", color: { slot: "accent-3" } }]);
    expect(result).toMatchObject({ ok: true, report: [] });
    expect(sourcesOf(result)).toEqual([{ id: "s1", name: "School", type: "info", color: { slot: "accent-3" }, visible: true, entries: [] }]);
  });
  it("drops a match entry whose validFrom is after validUntil", () => {
    const result = withSources([source({ entries: [{ match: { type: "fixed", month: 12, day: 24 }, validFrom: 2030, validUntil: 2029 }] })]);
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "sources[0].entries[0].validUntil", dropped: "sources[0].entries[0]" }]);
  });
  it("reads a range with a leap-year length without a report entry", () => {
    const result = withSources([
      source({
        entries: [{ match: { type: "range", from: { type: "fixed", month: 2, day: 1 }, days: 30 } }],
      }),
    ]);
    expect(result).toMatchObject({ ok: true, report: [] });
    if (result.ok) expect(checkRules(result.file, result.positions)).toEqual([{ code: "leapYearLength", path: "sources[0].entries[0]" }]);
  });
});

describe("colours", () => {
  it("keeps a slot and an own colour", () => {
    const result = withSources([source({ id: "a", color: { slot: "accent-3" } }), source({ id: "b", color: { rgb: "#1a7f37" } })]);
    expect(codes(result)).toEqual([]);
  });
  const keys = { oneOf: ["slot", "rgb"] };
  it.each([
    ["a slot with a space", { slot: "Accent 3" }, "invalidValue", ".slot"],
    ["a colour name", { rgb: "green" }, "invalidValue", ".rgb"],
    ["both keys", { slot: "accent-3", rgb: "#1a7f37" }, "invalidValue", "", keys],
    ["no key", {}, "missingValue", "", keys],
    ["a string", "accent-3", "invalidValue", ""],
  ])("drops the source for %s", (_name, color, code, key, data?: Record<string, unknown>) => {
    const result = withSources([source({ color })]);
    expect(result.ok && result.report).toEqual([{ code, path: `sources[0].color${key}`, dropped: "sources[0]", ...(data ? { data } : {}) }]);
    expect(sourcesOf(result)).toEqual([]);
  });
});

describe("invalid entries", () => {
  const entries = (type: string, list: unknown[], extra: Record<string, unknown> = {}) => withSources([source({ type, entries: list, ...extra })]);
  const when = { oneOf: ["date", "match"] };
  it.each([
    ["both date and match", "info", { date: "2027-01-01", match: { type: "fixed", month: 1, day: 1 } }, "invalidValue", "", when],
    ["neither date nor match", "info", {}, "missingValue", "", when],
    ["mandatory with take 0", "mandatory", { date: "2027-01-01", take: "0" }, "invalidValue", ".take"],
    ["holiday with required 1,5", "holiday", { date: "2027-01-01", required: "1,5" }, "invalidValue", ".required"],
    ["holiday with required above 1", "holiday", { date: "2027-01-01", required: "2" }, "invalidValue", ".required"],
    ["mandatory with a bad part", "mandatory", { date: "2027-01-01", part: "middle" }, "invalidValue", ".part"],
    ["a bad date", "info", { date: "2027-13-01" }, "invalidValue", ".date"],
    ["a bad match", "info", { match: { type: "fixed", month: 2, day: 30 } }, "invalidValue", ".match.day"],
    ["a bad validFrom", "info", { match: { type: "fixed", month: 1, day: 1 }, validFrom: 1500 }, "invalidValue", ".validFrom"],
    ["a non-object", "info", "2027-01-01", "invalidValue", ""],
  ])("drops %s", (_name, type, entry, code, key, data?: Record<string, unknown>) => {
    const result = entries(type, [entry, { date: "2027-02-02" }]);
    expect(result.ok && result.report).toEqual([
      { code, path: `sources[0].entries[0]${key}`, dropped: "sources[0].entries[0]", ...(data ? { data } : {}) },
    ]);
    expect(sourcesOf(result)[0]?.entries).toHaveLength(1);
  });
  const entry0 = "sources[0].entries[0]";
  it.each([
    ["from after to", { date: "2027-03-01", from: "1/2", to: "1/4", kind: "leave" }, [{ code: "invalidValue", path: `${entry0}.to`, dropped: entry0 }]],
    ["from equal to", { date: "2027-03-01", from: "1/2", to: "1/2", kind: "leave" }, [{ code: "invalidValue", path: `${entry0}.to`, dropped: entry0 }]],
    ["a weight above 1", { date: "2027-03-01", from: "0", to: "2", kind: "leave" }, [{ code: "invalidValue", path: `${entry0}.to`, dropped: entry0 }]],
    [
      "a match",
      { match: { type: "fixed", month: 1, day: 1 }, from: "0", to: "1", kind: "leave" },
      [
        { code: "missingValue", path: `${entry0}.date`, dropped: entry0 },
        { code: "unknownField", path: `${entry0}.match`, dropped: `${entry0}.match` },
      ],
    ],
    ["no kind", { date: "2027-03-01", from: "0", to: "1" }, [{ code: "missingValue", path: `${entry0}.kind`, dropped: entry0 }]],
    ["a bad kind", { date: "2027-03-01", from: "0", to: "1", kind: "own" }, [{ code: "invalidValue", path: `${entry0}.kind`, dropped: entry0 }]],
  ])("drops an other-plan entry with %s", (_name, entry, expected) => {
    const report = new Report();
    const [read] = readSources(
      [source({ type: "otherPlan", plan: { id: "p", name: "P", revision: 1 }, entries: [entry] })],
      "sources",
      "plan",
      report,
    );
    expect(report.entries).toEqual(expected);
    expect(read?.entries).toEqual([]);
  });
  it("drops a needed entry with take 0 in a plan file", () => {
    const report = new Report();
    const [read] = readSources([source({ type: "needed", entries: [{ date: "2027-01-01", take: "0" }] })], "sources", "plan", report);
    expect(report.entries).toEqual([{ code: "invalidValue", path: "sources[0].entries[0].take", dropped: "sources[0].entries[0]" }]);
    expect(read?.entries).toEqual([]);
  });
  it("drops only the invalid except date", () => {
    const result = entries("info", [{ match: { type: "fixed", month: 1, day: 1 }, except: ["2027-01-01", "2027-13-01", "2028-01-01"] }]);
    expect(result.ok && result.report).toEqual([
      { code: "invalidValue", path: "sources[0].entries[0].except[1]", dropped: "sources[0].entries[0].except[1]" },
    ]);
    expect(sourcesOf(result)[0]?.entries[0]).toMatchObject({ except: [day("2027-01-01"), day("2028-01-01")] });
  });
  it("reports unknown fields of an entry and of a source", () => {
    const result = withSources([source({ extra: 1, entries: [{ date: "2027-01-01", colour: "red" }] })]);
    expect(codes(result)).toEqual(["unknownField@sources[0].entries[0].colour", "unknownField@sources[0].extra"]);
  });
  it("keeps a source entry whose name is too long, without the name", () => {
    const result = withSources([source({ entries: [{ date: "2027-01-01", name: "x".repeat(201) }] })]);
    expect(result.ok && result.report).toEqual([
      { code: "textTooLong", path: "sources[0].entries[0].name", dropped: "sources[0].entries[0].name", data: { limit: 200 } },
    ]);
    expect(sourcesOf(result)[0]?.entries).toEqual([{ date: day("2027-01-01") }]);
  });
  it.each([
    ["an entry", source({ entries: [{ date: "2027-01-01", name: 5 }] }), { date: day("2027-01-01") }],
    [
      "an other-plan entry",
      source({ type: "otherPlan", plan: { id: "p", name: "P", revision: 1 }, entries: [{ date: "2027-03-01", from: "0", to: "1", kind: "leave", name: {} }] }),
      { date: day("2027-03-01"), from: 0, to: 480, kind: "leave" },
    ],
  ])("keeps %s without its invalid name", (_name, value, entry) => {
    const report = new Report();
    const [read] = readSources([value], "sources", "plan", report);
    expect(report.entries).toEqual([{ code: "invalidValue", path: "sources[0].entries[0].name", dropped: "sources[0].entries[0].name" }]);
    expect(read?.entries).toEqual([entry]);
  });
  it("still drops a source whose name is too long", () => {
    const result = withSources([source({ name: "x".repeat(201) })]);
    expect(result.ok && result.report).toEqual([{ code: "textTooLong", path: "sources[0].name", dropped: "sources[0]", data: { limit: 200 } }]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it.each([
    ["no id", { id: undefined }, "missingValue", "id"],
    ["an empty id", { id: "" }, "invalidValue", "id"],
    ["no name", { name: undefined }, "missingValue", "name"],
    ["a bad type", { type: "holidays" }, "invalidValue", "type"],
    ["a visible that isn't a boolean", { visible: "yes" }, "invalidValue", "visible"],
    ["entries not a list", { entries: {} }, "invalidValue", "entries"],
  ])("drops a source with %s", (_name, extra, code, key) => {
    const result = withSources([source(extra)]);
    expect(result.ok && result.report).toEqual([{ code, path: `sources[0].${key}`, dropped: "sources[0]" }]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("reports every problem of an entry in the order of its keys", () => {
    const entry = {
      colour: 1,
      part: "middle",
      take: "0",
      except: ["x"],
      validUntil: 2029,
      validFrom: 2030,
      match: { type: "range", weekdays: ["mon", "x"], from: { type: "fixed", month: 1, day: 1 } },
    };
    const result = withSources([source({ type: "mandatory", entries: [entry] })]);
    const path = "sources[0].entries[0]";
    expect(result.ok && result.report).toEqual([
      { code: "missingValue", path: `${path}.match`, dropped: path, data: { oneOf: ["to", "days"] } },
      { code: "invalidValue", path: `${path}.match.weekdays[1]`, dropped: path },
      { code: "invalidValue", path: `${path}.validUntil`, dropped: path },
      { code: "invalidValue", path: `${path}.except[0]`, dropped: `${path}.except[0]` },
      { code: "invalidValue", path: `${path}.take`, dropped: path },
      { code: "invalidValue", path: `${path}.part`, dropped: path },
      { code: "unknownField", path: `${path}.colour`, dropped: `${path}.colour` },
    ]);
    expect(sourcesOf(result)[0]?.entries).toEqual([]);
  });
  it("skips the entries of a source with an unknown type (Review Focus 2)", () => {
    const result = withSources([source({ type: "holidays", entries: [{}, { date: "x" }, 5] })]);
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "sources[0].type", dropped: "sources[0]" }]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("reports a missing color and an invalid visible together", () => {
    const result = withSources([source({ color: undefined, visible: "yes" })]);
    expect(result.ok && result.report).toEqual([
      { code: "missingValue", path: "sources[0].color", dropped: "sources[0]" },
      { code: "invalidValue", path: "sources[0].visible", dropped: "sources[0]" },
    ]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("drops an other-plan source with a bad plan reference", () => {
    const report = new Report();
    const read = readSources([source({ type: "otherPlan", plan: { id: "p", name: "P", revision: 0 }, entries: [] })], "sources", "plan", report);
    expect(report.entries).toEqual([{ code: "invalidValue", path: "sources[0].plan.revision", dropped: "sources[0]" }]);
    expect(read).toEqual([]);
  });
});

describe("limits", () => {
  it("drops a source with 2001 entries", () => {
    const entries = Array.from({ length: 2001 }, () => ({ date: "2027-01-01" }));
    const result = withSources([source({ entries })]);
    expect(codes(result)).toEqual(["sourceTooLarge@sources[0]"]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("keeps a source with 2000 entries", () => {
    const entries = Array.from({ length: 2000 }, () => ({ date: "2027-01-01" }));
    expect(codes(withSources([source({ entries })]))).toEqual([]);
  });
  it("drops a source with an entry of 401 except dates", () => {
    const except = Array.from({ length: 401 }, () => "2027-01-01");
    const result = withSources([source({ entries: [{ match: { type: "fixed", month: 1, day: 1 }, except }] })]);
    expect(codes(result)).toEqual(["sourceTooLarge@sources[0]"]);
    expect(sourcesOf(result)).toEqual([]);
  });
  it("refuses 51 sources", () => {
    const sources = Array.from({ length: 51 }, (_, i) => source({ id: `s${String(i)}` }));
    expect(withSources(sources)).toMatchObject({ ok: false, refusal: { code: "limitExceeded", path: "sources", data: { limit: "sources" } } });
  });
  it("accepts 50 sources", () => {
    const sources = Array.from({ length: 50 }, (_, i) => source({ id: `s${String(i)}` }));
    expect(codes(withSources(sources))).toEqual([]);
  });
});

describe("personal sources in a rule set", () => {
  it("drops otherPlan and needed, keeps the others", () => {
    const plan = { id: "p", name: "P", revision: 1 };
    const result = withSources([
      source({ id: "a", type: "otherPlan", plan, entries: [] }),
      source({ id: "b", type: "needed", entries: [] }),
      source({ id: "c", type: "holiday" }),
      source({ id: "d", type: "paidClosure" }),
      source({ id: "e", type: "mandatory" }),
      source({ id: "f", type: "info" }),
    ]);
    expect(codes(result)).toEqual(["personalSourceInRuleSet@sources[0]", "personalSourceInRuleSet@sources[1]"]);
    expect(sourcesOf(result).map((s) => s.id)).toEqual(["c", "d", "e", "f"]);
  });
});

describe("duplicate ids", () => {
  it("keeps the first source", () => {
    const result = withSources([source({ name: "first" }), source({ name: "second" })]);
    expect(codes(result)).toEqual(["duplicateId@sources[1].id"]);
    expect(sourcesOf(result).map((s) => s.name)).toEqual(["first"]);
  });
});

describe("fields that need a match", () => {
  it.each(["validFrom", "validUntil", "except"])("reports %s on a date entry as unknown and drops it", (field) => {
    const value = field === "except" ? ["2027-01-02"] : 2027;
    const result = withSources([source({ entries: [{ date: "2027-01-01", [field]: value }] })]);
    expect(codes(result)).toEqual([`unknownField@sources[0].entries[0].${field}`]);
    expect(sourcesOf(result)[0]?.entries).toEqual([{ date: day("2027-01-01") }]);
  });
});

describe("origin", () => {
  it("is an unknown field of a source in a rule set", () => {
    const result = withSources([source({ origin: "set-1" })]);
    expect(codes(result)).toEqual(["unknownField@sources[0].origin"]);
    expect(sourcesOf(result)[0]).not.toHaveProperty("origin");
  });
  it("is kept on a source in a plan file", () => {
    const report = new Report();
    const [read] = readSources([source({ origin: "set-1" })], "sources", "plan", report);
    expect(report.entries).toEqual([]);
    expect(read).toMatchObject({ origin: "set-1" });
  });
  it("is an unknown field of a rule in a rule set", () => {
    const rule = { id: "r", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: "1/2", origin: "set-1" };
    const result = readFile(minimal({ contract: { ...MINIMAL_CONTRACT, rules: [rule] } }));
    expect(codes(result)).toEqual(["unknownField@contract.rules[0].origin"]);
    expect(result.ok && result.file.contract.rules[0]).not.toHaveProperty("origin");
  });
});
