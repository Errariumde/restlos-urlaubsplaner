// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { computePlan } from "../../../src/engine/counting/plan";
import { dayFromIso, isoFromDay } from "../../../src/engine/days";
import { planInput } from "../../../src/engine/file/model";
import { readFile } from "../../../src/engine/file/read";
import type { PlanFile } from "../../../src/engine/file/types";
import type { ReadResult } from "../../../src/engine/file/report";
import { BAVARIA_CONTRACT, planFile } from "./helpers";

// lib has no DOM; performance exists in Node and in Firefox.
declare const performance: { now(): number };

const d = dayFromIso;
const load = (result: ReadResult): PlanFile => {
  if (!result.ok) throw new Error(`refused: ${result.refusal.code}`);
  if (result.file.kind !== "plan") throw new Error("not a plan");
  return result.file;
};
const codes = (result: ReadResult): string[] =>
  result.ok ? result.report.map((entry) => `${entry.code}@${entry.path}`) : [`refused:${result.refusal.code}@${result.refusal.path ?? ""}`];
const read = (plan: Record<string, unknown>, top: Record<string, unknown> = {}) => readFile(planFile(plan, top));

describe("plan section: range and allowance", () => {
  it("reads the range and the allowance", () => {
    const file = load(read({ range: { from: "2027-01", to: "2028-01" }, allowance: "33" }));
    expect(file.plan.range).toEqual({ from: { year: 2027, month: 1 }, to: { year: 2028, month: 1 } });
    expect(file.plan.allowance).toBe(15_840);
  });
  it.each([
    ["2027-1", "2027-12"],
    ["2027-01", "2027-13"],
    ["2027-12", "2027-01"],
    [5, "2027-12"],
  ])("refuses the range %j to %j", (from, to) =>
    expect(codes(read({ range: { from, to } }))).toEqual(["refused:invalidCore@plan.range"]));
  it("refuses 37 months", () =>
    expect(read({ range: { from: "2027-01", to: "2030-01" } })).toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "periodMonths" } } }));
  it("accepts 36 months", () => expect(read({ range: { from: "2027-01", to: "2029-12" } }).ok).toBe(true));
  it.each(["99999999999999999999", "-1", "x", 30])("refuses the allowance %j", (allowance) =>
    expect(codes(read({ allowance }))).toEqual(["refused:invalidCore@plan.allowance"]));
  it("refuses a plan file without plan", () => {
    const json = JSON.parse(planFile()) as Record<string, unknown>;
    delete json["plan"];
    expect(codes(readFile(JSON.stringify(json)))).toEqual(["refused:invalidCore@plan"]);
  });
  it("refuses a plan file without contract.region.state", () =>
    expect(codes(readFile(planFile({}, { contract: { ...BAVARIA_CONTRACT, region: { country: "DE" } } })))).toEqual([
      "refused:invalidCore@contract.region.state",
    ]));
  it("reports unknown plan fields", () => expect(codes(read({ colour: 1 }))).toEqual(["unknownField@plan.colour"]));
});

describe("plan section: missing lists", () => {
  it("reads missing days, overrides and notes as empty lists without a report", () => {
    const json = JSON.parse(planFile()) as { plan: Record<string, unknown> };
    json.plan = { range: json.plan["range"], allowance: "30" };
    const result = readFile(JSON.stringify(json));
    expect(codes(result)).toEqual([]);
    expect(load(result).plan).toMatchObject({ days: [], overrides: [], notes: [] });
  });
  it.each(["days", "overrides", "notes"])("refuses %s that is not a list", (key) =>
    expect(codes(read({ [key]: {} }))).toEqual([`refused:invalidCore@plan.${key}`]));
});

describe("plan section: ruleSet", () => {
  it("reads the reference to the rule set", () =>
    expect(load(readFile(planFile({}, { ruleSet: { id: "a", name: "Set", revision: 3 } }))).ruleSet).toEqual({ id: "a", name: "Set", revision: 3 }));
  it("drops an invalid reference", () => {
    const result = readFile(planFile({}, { ruleSet: { id: "a", name: "Set", revision: 0 } }));
    expect(codes(result)).toContain("invalidEntry@ruleSet");
    expect(load(result).ruleSet).toBeUndefined();
  });
});

describe("plan section: days", () => {
  it("loads a full day", () => expect(load(read({ days: [{ date: "2027-05-07", take: "1" }] })).plan.days).toEqual([{ day: d("2027-05-07"), take: 480 }]));
  it.each([
    ["0,5", { take: "0,5" }],
    ["too much", { take: "2" }],
    ["zero", { take: "0" }],
    ["impossible date", { date: "2027-02-29" }],
    ["bad part", { take: "1/2", part: "morning" }],
    ["not an object", 5],
  ])("drops a day entry with %s", (_name, change) => {
    const entry = typeof change === "object" ? { date: "2027-05-07", take: "1", ...change } : change;
    const result = read({ days: [entry] });
    expect(codes(result)).toEqual(["invalidEntry@plan.days[0]"]);
    expect(load(result).plan.days).toEqual([]);
  });
  it("keeps the first of two entries for one date", () => {
    const result = read({ days: [{ date: "2027-05-07", take: "1" }, { date: "2027-05-07", take: "1/2", part: "end" }] });
    expect(codes(result)).toEqual(["duplicateDate@plan.days[1].date"]);
    expect(load(result).plan.days).toEqual([{ day: d("2027-05-07"), take: 480 }]);
  });
  it("refuses 2001 entries", () => {
    const days = Array.from({ length: 2001 }, (_, i) => ({ date: isoFromDay(d("2027-01-01") + (i % 300)), take: "1" }));
    expect(read({ days })).toMatchObject({ ok: false, refusal: { code: "limitExceeded", path: "plan.days", data: { limit: "planDays" } } });
  });
  it("sorts by date", () => {
    const file = load(read({ days: [{ date: "2027-05-10", take: "1" }, { date: "2027-05-07", take: "1" }] }));
    expect(file.plan.days.map((day) => day.day)).toEqual([d("2027-05-07"), d("2027-05-10")]);
  });
  it("keeps a given part", () =>
    expect(load(read({ days: [{ date: "2027-05-12", take: "1/2", part: "start" }] })).plan.days).toEqual([{ day: d("2027-05-12"), take: 240, part: "start" }]));
});

describe("plan section: overrides", () => {
  it("loads an override", () =>
    expect(load(read({ overrides: [{ date: "2027-05-07", required: "1/2", part: "start" }] })).plan.overrides).toEqual([
      { day: d("2027-05-07"), required: 240, part: "start" },
    ]));
  it("allows required 0", () => expect(load(read({ overrides: [{ date: "2027-05-07", required: "0" }] })).plan.overrides).toEqual([{ day: d("2027-05-07"), required: 0 }]));
  it.each([{ required: "2" }, { required: "0,5" }, { date: "2027-02-29" }, { part: "morning" }])("drops an override with %j", (change) =>
    expect(codes(read({ overrides: [{ date: "2027-05-07", required: "1", ...change }] }))).toEqual(["invalidEntry@plan.overrides[0]"]));
  it("keeps the first for a date", () =>
    expect(codes(read({ overrides: [{ date: "2027-05-07", required: "1" }, { date: "2027-05-07", required: "0" }] }))).toEqual([
      "duplicateDate@plan.overrides[1].date",
    ]));
  it("refuses 2001 entries", () =>
    expect(read({ overrides: Array.from({ length: 2001 }, () => ({ date: "2027-05-07", required: "1" })) })).toMatchObject({
      ok: false,
      refusal: { code: "limitExceeded", data: { limit: "overrides" } },
    }));
});

describe("plan section: notes", () => {
  it("loads a note", () => expect(load(read({ notes: [{ date: "2027-05-07", text: "Flights" }] })).plan.notes).toEqual([{ day: d("2027-05-07"), text: "Flights" }]));
  it("drops a note with an empty text", () => expect(codes(read({ notes: [{ date: "2027-05-07", text: "" }] }))).toEqual(["invalidEntry@plan.notes[0]"]));
  it("drops a note with 2001 characters", () =>
    expect(codes(read({ notes: [{ date: "2027-05-07", text: "x".repeat(2001) }] }))).toEqual(["textTooLong@plan.notes[0].text"]));
  it("keeps a note with 2000 characters", () => expect(codes(read({ notes: [{ date: "2027-05-07", text: "x".repeat(2000) }] }))).toEqual([]));
  it("keeps the first note of a date", () =>
    expect(codes(read({ notes: [{ date: "2027-05-07", text: "a" }, { date: "2027-05-07", text: "b" }] }))).toEqual(["duplicateDate@plan.notes[1].date"]));
  it("sorts by date", () =>
    expect(load(read({ notes: [{ date: "2027-06-01", text: "b" }, { date: "2027-05-07", text: "a" }] })).plan.notes.map((note) => note.text)).toEqual(["a", "b"]));
  it("refuses 2001 entries", () =>
    expect(read({ notes: Array.from({ length: 2001 }, () => ({ date: "2027-05-07", text: "a" })) })).toMatchObject({
      ok: false,
      refusal: { code: "limitExceeded", data: { limit: "notes" } },
    }));
});

describe("plan section: period and minUnit", () => {
  it("keeps entries outside the period and reports them", () => {
    const result = read({
      days: [{ date: "2026-12-30", take: "1" }],
      overrides: [{ date: "2026-12-29", required: "0" }],
      notes: [{ date: "2026-12-28", text: "old" }],
    });
    expect(codes(result)).toEqual(["outsidePeriod@plan.days[0]", "outsidePeriod@plan.overrides[0]", "outsidePeriod@plan.notes[0]"]);
    const file = load(result);
    expect([file.plan.days.length, file.plan.overrides.length, file.plan.notes.length]).toEqual([1, 1, 1]);
  });
  it("reports leave and overrides that are not a multiple of minUnit", () => {
    const result = readFile(
      planFile(
        { days: [{ date: "2027-05-12", take: "1/4", part: "end" }], overrides: [{ date: "2027-05-13", required: "1/4" }] },
        { contract: { ...BAVARIA_CONTRACT, minUnit: "1/2" } },
      ),
    );
    expect(codes(result)).toEqual(["notMultipleOfMinUnit@plan.days[0].take", "notMultipleOfMinUnit@plan.overrides[0].required"]);
    expect(load(result).plan.days).toHaveLength(1);
  });
});

describe("plan section: suggested parts", () => {
  it("suggests the start on a Monday after a free Sunday", () => {
    const result = read({ days: [{ date: "2027-05-10", take: "1/2" }] });
    expect(result.ok && result.report[0]).toEqual({ code: "partSuggested", path: "plan.days[0]", data: { part: "start" } });
    expect(load(result).plan.days).toEqual([{ day: d("2027-05-10"), take: 240, part: "start" }]);
  });
  it("falls back to the end when there is no suggestion (Friday after Ascension Day)", () => {
    const result = read({ days: [{ date: "2027-05-07", take: "1/2" }] });
    expect(result.ok && result.report[0]).toEqual({ code: "partSuggested", path: "plan.days[0]", data: { part: "end" } });
    expect(load(result).plan.days).toEqual([{ day: d("2027-05-07"), take: 240, part: "end" }]);
  });
  it("suggests the end between working days", () => {
    const result = read({ days: [{ date: "2027-05-12", take: "1/2" }] });
    expect(result.ok && result.report[0]).toEqual({ code: "partSuggested", path: "plan.days[0]", data: { part: "end" } });
    expect(load(result).plan.days).toEqual([{ day: d("2027-05-12"), take: 240, part: "end" }]);
  });
  it("gives no suggestion for a full day", () => expect(codes(read({ days: [{ date: "2027-05-12", take: "1" }] }))).toEqual([]));
  it("suggests 300 parts from one computation in under 500 ms", () => {
    const days = Array.from({ length: 300 }, (_, i) => ({ date: isoFromDay(d("2027-01-01") + i), take: "1/2" }));
    const startedAt = performance.now();
    const result = read({ days });
    const elapsed = performance.now() - startedAt;
    expect(result.ok && result.report.filter((entry) => entry.code === "partSuggested")).toHaveLength(300);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("source-day limit", () => {
  it("refuses sources that expand to more than 50,000 days in the window", () => {
    const entries = Array.from({ length: 1000 }, () => ({
      match: { type: "range", from: { type: "once", date: "2027-03-01" }, to: { type: "once", date: "2027-03-02" } },
    }));
    const sources = Array.from({ length: 50 }, (_, i) => ({
      id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries,
    }));
    expect(readFile(planFile({}, { sources }))).toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "sourceDays" } } });
  });
});

describe("at the limits", () => {
  it("reads and computes an accepted file in under 1000 ms", () => {
    const rules = Array.from({ length: 1000 }, (_, i) => ({
      id: `r${String(i)}`, match: { type: "fixed", month: (i % 12) + 1, day: (i % 28) + 1 }, requiredAtMost: "1",
    }));
    const last = isoFromDay(d("2027-01-01") + 499);
    const entries = [0, 1].map(() => ({ match: { type: "range", from: { type: "once", date: "2027-01-01" }, to: { type: "once", date: last } } }));
    const sources = Array.from({ length: 50 }, (_, i) => ({
      id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries,
    }));
    const days = Array.from({ length: 2000 }, (_, i) => ({ date: isoFromDay(d("2027-01-01") + (i % 365)), take: "1/2", part: "end" })).filter(
      (entry, i, all) => all.findIndex((other) => other.date === entry.date) === i,
    );
    const notes = Array.from({ length: 2000 }, (_, i) => ({ date: isoFromDay(d("2027-01-01") + (i % 365)), text: "n" })).filter(
      (entry, i, all) => all.findIndex((other) => other.date === entry.date) === i,
    );
    const text = planFile({ range: { from: "2027-01", to: "2029-12" }, days, notes }, { contract: { ...BAVARIA_CONTRACT, rules }, sources });
    const startedAt = performance.now();
    const result = readFile(text);
    const file = load(result);
    computePlan(planInput(file));
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
