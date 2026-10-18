// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computePlan, type DayResult, type PlanResult } from "../../src/engine/counting/plan";
import { dayFromIso, isoFromDay, weekdayOf, type Weekday } from "../../src/engine/days";
import { planInput } from "../../src/engine/file/model";
import { importOtherPlan } from "../../src/engine/file/other-plan";
import type { FileSource, PlanFile, Text } from "../../src/engine/file/types";
import { toRuleSet, writeFile } from "../../src/engine/file/write";
import { PLAN_DIR, RULE_SET_DIR, fmt, readPlan, readRuleSet, readText } from "./helpers";

const FILES = ["beispiel-gmbh-2027.urlaub.json", "muster-ag-2027.urlaub.json", "muster-ag-2028.urlaub.json"];
const path = (name: string): string => `${PLAN_DIR}/${name}`;
const BEISPIEL = path("beispiel-gmbh-2027.urlaub.json");
const MUSTER_2027 = path("muster-ag-2027.urlaub.json");
const MUSTER_2028 = path("muster-ag-2028.urlaub.json");
const BEISPIEL_RULES = `${RULE_SET_DIR}/beispiel-gmbh.regeln.json`;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bothLanguages = (text: Text | undefined): boolean =>
  typeof text === "object" && typeof text["de"] === "string" && text["de"] !== "" && typeof text["en"] === "string" && text["en"] !== "";

const run = (file: PlanFile): PlanResult => computePlan(planInput(file));
const listed = (result: PlanResult): string[] => result.stretches.filter((s) => s.listed).map(fmt);
const isos = (list: readonly { readonly day: number }[]): string[] => list.map((entry) => isoFromDay(entry.day));
function day(result: PlanResult, iso: string): DayResult {
  const found = result.days.find((entry) => entry.day === dayFromIso(iso));
  if (!found) throw new Error(`${iso} is outside the computed days`);
  return found;
}
const required = (result: PlanResult, iso: string) => {
  const { value, freePart, decidedBy } = day(result, iso).required;
  return { value, freePart, by: decidedBy.kind };
};
function source<T extends FileSource["type"]>(file: PlanFile, id: string, type: T): FileSource & { readonly type: T } {
  const found = file.sources.find((entry) => entry.id === id);
  if (found?.type !== type) throw new Error(`${file.id} has no ${type} source ${id}`);
  return found as FileSource & { readonly type: T };
}
/** Every day from `from` to `to` (ISO dates, inclusive) with the given weekday. */
function weekdays(from: string, to: string, weekday: Weekday): string[] {
  const days: string[] = [];
  for (let d = dayFromIso(from); d <= dayFromIso(to); d++) if (weekdayOf(d) === weekday) days.push(isoFromDay(d));
  return days;
}
const once = (date: string) => ({ type: "once", date });

describe("example plans: files", () => {
  it("are exactly the three of the design", () =>
    expect(readdirSync(PLAN_DIR).filter((name) => name.endsWith(".urlaub.json")).sort()).toEqual([...FILES].sort()));

  it.each(FILES)("%s loads with an empty report and is written canonically", (name) => {
    expect(writeFile(readPlan(path(name)))).toBe(readText(path(name)));
  });

  it.each(FILES)("%s has a fixed UUID v4, revision 1 and its texts in both languages", (name) => {
    const file = readPlan(path(name));
    expect(file.id).toMatch(UUID_V4);
    expect(file.revision).toBe(1);
    expect(bothLanguages(file.contract.name)).toBe(true);
    expect(bothLanguages(file.contract.description)).toBe(true);
    for (const rule of file.contract.rules) expect(bothLanguages(rule.label), rule.id).toBe(true);
    for (const entry of file.sources) expect(bothLanguages(entry.name), entry.id).toBe(true);
  });

  it("have distinct IDs, also the fictional 2026 plan that Beispiel GmbH 2027 takes leave from", () => {
    const previous = source(readPlan(BEISPIEL), "previous-year", "otherPlan").plan.id;
    expect(previous).toMatch(UUID_V4);
    const ids = [...FILES.map((name) => readPlan(path(name)).id), previous];
    expect(new Set(ids).size).toBe(4);
  });
});

describe("example plans: Beispiel GmbH 2027", () => {
  const plan = (): PlanFile => readPlan(BEISPIEL);

  it("is made from beispiel-gmbh.regeln.json as \"New → From rule set\" makes it", () => {
    const file = plan();
    const ruleSet = readRuleSet(BEISPIEL_RULES);
    expect(file.ruleSet).toEqual({ id: ruleSet.id, name: ruleSet.contract.name, revision: ruleSet.revision });
    // The rules are copied with the rule set's ID as their origin; the plan's own sources have none.
    expect(file.contract.rules).toEqual(ruleSet.contract.rules.map((rule) => ({ ...rule, origin: ruleSet.id })));
    expect(file.sources.filter((entry) => entry.origin !== undefined)).toEqual([]);
    // "Save as rule set" without the plan's own info source gives the rule set back, byte for byte.
    expect(writeFile({ ...toRuleSet(file, ruleSet.id), sources: [] })).toBe(readText(BEISPIEL_RULES));
  });

  it("holds a project phase and two days of leave from a fictional 2026 plan", () => {
    const file = plan();
    expect(file.sources.map((entry) => [entry.id, entry.type])).toEqual([
      ["project", "info"],
      ["previous-year", "otherPlan"],
    ]);
    expect(source(file, "project", "info").entries).toEqual([
      { match: { type: "range", from: once("2027-09-06"), to: once("2027-10-29") }, name: "Release 3" },
    ]);
    const previous = source(file, "previous-year", "otherPlan");
    expect(previous.plan).toEqual({ id: "7005d0ea-dbdf-48e9-a000-d7a22608ca76", name: "Beispiel GmbH (ohne Tarifvertrag)", revision: 9 });
    // Whole days: the other plan charged Mon 4 and Tue 5 Jan 2027 from the start (0) to the end (1) of the working time.
    expect(previous.entries).toEqual([
      { date: dayFromIso("2027-01-04"), from: 0, to: 480, kind: "leave" },
      { date: dayFromIso("2027-01-05"), from: 0, to: 480, kind: "leave" },
    ]);
  });

  it("plans the leave around Easter, on the bridge days after Ascension and Corpus Christi and for two summer weeks", () => {
    const { plan: p } = plan();
    expect(p.range).toEqual({ from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } });
    expect(p.allowance).toBe(30 * 480);
    expect(p.days.filter((entry) => entry.take !== 480 || entry.part !== undefined)).toEqual([]);
    expect(isos(p.days)).toEqual([
      "2027-01-07", "2027-01-08",
      "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02",
      "2027-05-07",
      "2027-05-28",
      "2027-08-02", "2027-08-03", "2027-08-04", "2027-08-05", "2027-08-06",
      "2027-08-09", "2027-08-10", "2027-08-11", "2027-08-12", "2027-08-13",
    ]);
    expect(p.overrides).toEqual([]);
    expect(p.notes).toEqual([
      { day: dayFromIso("2027-05-07"), text: "Brückentag" },
      { day: dayFromIso("2027-05-28"), text: "Brückentag" },
    ]);
  });

  it("costs 22 days and lists six stretches", () => {
    const result = run(plan());
    // Own leave: 7–8 Jan (2) + 30 Mar – 2 Apr (4) + 7 May (1) + 28 May (1) + 2–13 Aug (10) = 18 days; the closure
    // Mon 27 – Thu 30 Dec is mandatory leave (4). 22 × 480 = 10,560; 30 − 22 = 8 days = 3840 remain.
    expect(result.totals).toEqual({ allowance: 14400, planned: 10560, remaining: 3840, byYear: [{ year: 2027, planned: 10560 }] });
    // Mon 4 and Tue 5 Jan are free by the 2026 plan's leave and cost nothing here; Wed 6 Jan is Epiphany.
    expect(day(result, "2027-01-04").evaluation).toMatchObject({ whole: true, cost: 0 });
    expect(day(result, "2027-01-05").evaluation).toMatchObject({ whole: true, cost: 0 });
    expect(required(result, "2027-01-06")).toEqual({ value: 0, freePart: "end", by: "publicHoliday" });
    expect(listed(result)).toEqual([
      // Thu 31 Dec 2026 ends at noon (rule, 240 free); Fri 1 Jan (holiday), the weekend, the other plan's 4–5 Jan,
      // Epiphany and own 7–8 Jan to Sun 10 Jan: 240 + 10 × 480 = 5040 off, only own 7–8 Jan cost (960).
      // The closure of 2026 (Mon 28 – Wed 30 Dec 2026) ends before the working morning of 31 Dec 2026.
      "2026-12-31@240 2027-01-10@480 960/5040 listed",
      // Good Friday 26 Mar, Easter Monday 29 Mar, own Tue 30 Mar – Fri 2 Apr (4 × 480), weekend to Sun 4 Apr: 10 days.
      "2027-03-26@0 2027-04-04@480 1920/4800 listed",
      // Ascension Thu 6 May, own Fri 7 May, weekend: 4 days for 1.
      "2027-05-06@0 2027-05-09@480 480/1920 listed",
      // Corpus Christi Thu 27 May (Bavaria), own Fri 28 May, weekend: 4 days for 1.
      "2027-05-27@0 2027-05-30@480 480/1920 listed",
      // Sat 31 Jul to Sun 15 Aug (Assumption Day, a Sunday): 16 days, own Mon 2 – Fri 13 Aug cost 10.
      "2027-07-31@0 2027-08-15@480 4800/7680 listed",
      // Fri 24 Dec afternoon (rule, 240), Christmas weekend, closure Mon 27 – Thu 30 Dec (4 × 480): 240 + 6 × 480 = 3120.
      // Fri 31 Dec is a working morning again, so the afternoon to Sun 2 Jan 2028 is a stretch of its own, without cost.
      "2027-12-24@240 2027-12-30@480 1920/3120 listed",
    ]);
    expect(result.problems).toEqual([]);
  });
});

describe("example plans: Muster AG 2027", () => {
  const plan = (): PlanFile => readPlan(MUSTER_2027);

  it("is fictional, has no rule set and lies in the City of Augsburg", () => {
    const file = plan();
    expect(file.ruleSet).toBeUndefined();
    expect(file.contract.rules.filter((rule) => rule.origin !== undefined)).toEqual([]);
    expect(file.sources.filter((entry) => entry.origin !== undefined)).toEqual([]);
    // The City of Augsburg: Art. 1 FTG (source "by-law") makes the Peace Festival on 8 August a holiday only there
    // (`augsburg`), and Assumption Day only in municipalities with a predominantly Catholic population as the Bavarian
    // State Office for Statistics determines them (`assumption`, source "by-assumption"). Augsburg has more Catholic
    // than Protestant residents and keeps Assumption Day, so the official list gives both for the city. The switches are
    // independent in the data (`augsburg` alone does not add 15 August, tests/data/holidays/de.test.ts), so both are on;
    // the reference models agree (python-holidays' subdivision "Augsburg" and date-holidays' BY/A both hold 15 August).
    expect(file.contract.region).toEqual({ country: "DE", state: "BY", options: { assumption: true, augsburg: true } });
    expect(file.contract.references).toEqual({});
  });

  it("changes its work week on 1 September 2027 to a half Tuesday", () => {
    const file = plan();
    const full = { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0 };
    expect(file.contract.week).toEqual([
      { from: dayFromIso("2027-01-01"), required: full },
      { from: dayFromIso("2027-09-01"), required: { ...full, tue: 240 } },
    ]);
    const result = run(file);
    // The work week has no part of the day, so the free time of the half Tuesday lies at the end.
    expect(required(result, "2027-08-31")).toEqual({ value: 480, freePart: "end", by: "workWeek" });
    expect(required(result, "2027-09-07")).toEqual({ value: 240, freePart: "end", by: "workWeek" });
  });

  it("has rules for 24 and 31 December, the company closure and a working Saturday", () => {
    const rules = plan().contract.rules.map(({ id, match, requiredAtMost, requiredExactly, mandatory, part }) => ({
      id, match, requiredAtMost, requiredExactly, mandatory, part,
    }));
    const weekdaysMonFri = ["mon", "tue", "wed", "thu", "fri"];
    expect(rules).toEqual([
      { id: "christmas-eve", match: { type: "fixed", month: 12, day: 24 }, mandatory: 240, part: "end" },
      { id: "new-years-eve", match: { type: "fixed", month: 12, day: 31 }, requiredAtMost: 240, part: "end" },
      {
        id: "company-closure",
        match: { type: "range", from: { type: "fixed", month: 12, day: 27 }, to: { type: "fixed", month: 1, day: 4 }, weekdays: weekdaysMonFri },
        mandatory: 480,
      },
      { id: "working-saturday", match: once("2027-11-20"), requiredExactly: 480 },
    ]);
  });

  it("holds a source of every type a plan may hold, except the other plan (that is in 2028)", () => {
    const file = plan();
    expect(file.sources.map((entry) => [entry.id, entry.type])).toEqual([
      ["company-party", "holiday"],
      ["stocktaking", "paidClosure"],
      ["bridge-days", "mandatory"],
      ["kita", "needed"],
      ["trade-fair", "info"],
    ]);
    // Both kinds of colour and a hidden source.
    expect(file.sources.map((entry) => entry.color)).toContainEqual({ rgb: "#1a7f37" });
    expect(source(file, "trade-fair", "info").visible).toBe(false);
    expect(source(file, "company-party", "holiday").entries).toEqual([
      { date: dayFromIso("2027-07-02"), name: { de: "Sommerfest der Muster AG", en: "Muster AG summer party" }, required: 240, part: "end" },
    ]);
    expect(source(file, "stocktaking", "paidClosure").entries).toEqual([
      { date: dayFromIso("2027-10-15"), name: { de: "Inventur: Betrieb geschlossen", en: "Stocktaking: company closed" } },
    ]);
    expect(source(file, "bridge-days", "mandatory").entries).toEqual([
      { date: dayFromIso("2027-05-07"), name: { de: "Brückentag nach Christi Himmelfahrt", en: "Bridge day after Ascension Day" }, take: 480 },
    ]);
    expect(source(file, "trade-fair", "info").entries).toEqual([
      { match: { type: "range", from: once("2027-04-13"), days: 4 }, name: { de: "Fachmesse", en: "Trade fair" } },
    ]);
    // Single dates (by date), then the range of the summer closure and the Tuesday match with its `except`.
    expect(source(file, "kita", "needed").entries.map((entry) => entry.name)).toEqual([
      { de: "Sommerfest: Abholen um 12 Uhr", en: "Summer party: pickup at noon" },
      { de: "Pädagogischer Tag", en: "Staff training day" },
      { de: "Schließzeit Sommer", en: "Summer closure" },
      { de: "Abholen dienstags", en: "Tuesday pickup" },
    ]);
    const kita = source(file, "kita", "needed").entries.map((entry) => ({ ...entry, name: undefined }));
    expect(kita).toEqual([
      { date: dayFromIso("2027-07-02"), take: 240, part: "end" },
      { date: dayFromIso("2027-11-12"), take: 480 },
      { match: { type: "range", from: once("2027-08-02"), to: once("2027-08-13") }, take: 480 },
      {
        match: { type: "range", from: { type: "fixed", month: 9, day: 1 }, to: { type: "fixed", month: 8, day: 31 }, weekdays: ["tue"] },
        validFrom: 2027,
        validUntil: 2027,
        except: [dayFromIso("2027-12-28")],
        take: 240,
        part: "end",
      },
    ]);
  });

  it("plans own leave for the Kita's summer closure and around the turn of the year 2027/28", () => {
    const { plan: p } = plan();
    expect(p.range).toEqual({ from: { year: 2027, month: 1 }, to: { year: 2028, month: 1 } });
    expect(p.allowance).toBe(30 * 480);
    expect(p.days.map((entry) => [isoFromDay(entry.day), entry.take, entry.part])).toEqual([
      ...["02", "03", "04", "05", "06", "09", "10", "11", "12", "13"].map((d) => [`2027-08-${d}`, 480, undefined]),
      ["2027-12-24", 240, "start"],
      ["2028-01-05", 480, undefined],
      ["2028-01-07", 480, undefined],
    ]);
    expect(p.overrides).toEqual([{ day: dayFromIso("2027-11-11"), required: 240, part: "end" }]);
    expect(isos(p.notes)).toEqual(["2027-07-02", "2027-11-11", "2027-11-12", "2027-11-20", "2027-12-24"]);
  });

  it("Fri 24 Dec 2027: own leave in the morning and the mandatory afternoon free the whole day at a cost of 1", () => {
    const result = run(plan());
    const { evaluation } = day(result, "2027-12-24");
    // Required 480 (a Friday, no holiday): own ½ at the start [0, 240) and the rule's mandatory ½ at the end [240, 480).
    expect(evaluation).toMatchObject({ whole: true, cost: 480, ownCost: 240, mandatoryCost: 240 });
    expect(evaluation.charged).toEqual([
      { from: 0, to: 240, kind: "leave" },
      { from: 240, to: 480, kind: "mandatory" },
    ]);
  });

  it("the turn of the year 2027/28 is one stretch of 17 days for 8.5 days of leave", () => {
    const result = run(plan());
    // Fri 24 Dec 1 (above), Sat/Sun holidays, closure Mon 27 Dec 1, Tue 28 Dec ½ (the half Tuesday caps the closure),
    // Wed 29 and Thu 30 Dec 1 each, Fri 31 Dec ½ (the rule caps it at ½), Sat 1 Jan (holiday), Sun 2 Jan, Mon 3 Jan 1,
    // Tue 4 Jan ½, own Wed 5 Jan 1, Epiphany Thu 6 Jan, own Fri 7 Jan 1, weekend to Sun 9 Jan:
    // 480 + 480 + 240 + 480 + 480 + 240 + 480 + 240 + 480 + 480 = 4080 for 17 × 480 = 8160 off.
    expect(day(result, "2027-12-28").evaluation.cost).toBe(240);
    expect(required(result, "2027-12-31")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(day(result, "2027-12-31").evaluation.cost).toBe(240);
    expect(day(result, "2028-01-04").evaluation.cost).toBe(240);
    expect(result.stretches.map(fmt)).toContain("2027-12-24@0 2028-01-09@480 4080/8160 listed");
  });

  it("the company party, the override and the working Saturday", () => {
    const result = run(plan());
    // Fri 2 Jul: the holiday source lowers the required work to ½ with the free time at the end; nothing is taken.
    expect(required(result, "2027-07-02")).toEqual({ value: 240, freePart: "end", by: "holidaySource" });
    expect(day(result, "2027-07-02").evaluation).toMatchObject({ whole: false, freeStart: 0, freeEnd: 240, cost: 0 });
    // Thu 11 Nov: the override sets the required work to ½, free from noon; it costs nothing.
    expect(required(result, "2027-11-11")).toEqual({ value: 240, freePart: "end", by: "override" });
    expect(day(result, "2027-11-11").evaluation).toMatchObject({ whole: false, freeStart: 0, freeEnd: 240, cost: 0 });
    // Sat 20 Nov: 0 in the work week; the forced rule replaces the minimum of the lowering layers and makes it a full working day.
    expect(day(result, "2027-11-20").facts.base.value).toBe(0);
    expect(required(result, "2027-11-20")).toEqual({ value: 480, freePart: "end", by: "ruleExactly" });
    expect(day(result, "2027-11-20").evaluation).toMatchObject({ whole: false, remaining: 480, cost: 0 });
    // So that weekend is only Sunday, a stretch without cost.
    expect(result.stretches.map(fmt)).toContain("2027-11-21@0 2027-11-21@480 0/480");
  });

  it("the paid closure on Fri 15 Oct is listed without cost", () => {
    const result = run(plan());
    expect(required(result, "2027-10-15")).toEqual({ value: 0, freePart: "end", by: "paidClosure" });
    expect(day(result, "2027-10-15").closure).toBe(true);
    expect(result.stretches.map(fmt)).toContain("2027-10-15@0 2027-10-17@480 0/1440 listed");
  });

  it("only the Pädagogischer Tag is an uncovered need; the half Tuesday covers the pickup from September", () => {
    const file = plan();
    const result = run(file);
    // Fri 12 Nov: a full working day without leave. Fri 2 Jul (½ at the end) is covered by the company party,
    // 2–13 Aug by own leave and the weekends; every Tuesday from 7 Sep (Wed 1 Sep is the start) by the work week.
    expect(result.problems).toEqual([{ code: "uncoveredNeed", day: dayFromIso("2027-11-12"), sourceIds: ["kita"] }]);
    const tuesdays = weekdays("2027-09-01", "2028-01-31", "tue");
    expect(tuesdays[0]).toBe("2027-09-07");
    // The Tuesday match yields every Tuesday of the period from September except the dismissed 28 Dec.
    const needed = (iso: string): boolean => day(result, iso).facts.sources.some((entry) => entry.type === "needed");
    expect(tuesdays.filter((iso) => !needed(iso))).toEqual(["2027-12-28"]);
    expect(weekdays("2027-01-01", "2027-08-31", "tue").filter(needed)).toEqual(["2027-08-03", "2027-08-10"]); // the summer closure only
    // Without the change of the work week the pickup would be uncovered on every Tuesday from September, except on
    // the dismissed 28 Dec and on Tue 4 Jan 2028, which the closure frees entirely.
    const fullTime = run({ ...file, contract: { ...file.contract, week: file.contract.week.slice(0, 1) } });
    const uncovered = fullTime.problems.filter((problem) => problem.code === "uncoveredNeed").map((problem) => isoFromDay(problem.day));
    expect(uncovered).toEqual([...tuesdays.filter((iso) => iso !== "2027-12-28" && iso !== "2028-01-04"), "2027-11-12"].sort());
  });

  it("costs 20.5 days and lists five stretches", () => {
    const result = run(plan());
    // Own: 2–13 Aug 10 × 480 = 4800, ½ on 24 Dec = 240, 5 and 7 Jan 2028 = 960: 6000.
    // Mandatory: Mon 4 Jan 2027 (the 2026/27 closure) 480, the bridge day Fri 7 May 480, 24 Dec ½ 240,
    // 27–31 Dec 480 + 240 + 480 + 480 + 240 = 1920, Mon 3 Jan 2028 480 + Tue 4 Jan ½ 240 = 720: 3840.
    // 6000 + 3840 = 9840 (20.5 days); 14,400 − 9840 = 4560 (9.5 days) remain.
    // 2027: 4800 + 240 + 480 + 480 + 240 + 1920 = 8160; January 2028: 960 + 720 = 1680.
    expect(result.totals).toEqual({
      allowance: 14400,
      planned: 9840,
      remaining: 4560,
      byYear: [{ year: 2027, planned: 8160 }, { year: 2028, planned: 1680 }],
    });
    expect(listed(result)).toEqual([
      // Thu 24 Dec 2026 afternoon (mandatory ½, outside the period: free, no cost), Christmas, the closure from
      // Mon 28 Dec 2026 to Mon 4 Jan 2027 (Thu 31 Dec 2026: ½ by the rule, taken by the closure), New Year: 240 + 11 × 480 = 5520 off.
      // Only Mon 4 Jan 2027 lies in the period and costs 480; Tue 5 Jan is a working day.
      "2026-12-24@240 2027-01-04@480 480/5520 listed",
      // Ascension Thu 6 May, the mandatory bridge day Fri 7 May, weekend.
      "2027-05-06@0 2027-05-09@480 480/1920 listed",
      // Sat 31 Jul to Sun 15 Aug: own leave 2–13 Aug; the Peace Festival (8 Aug) and Assumption Day (15 Aug) are Sundays in 2027.
      "2027-07-31@0 2027-08-15@480 4800/7680 listed",
      // The paid closure: listed although it costs nothing.
      "2027-10-15@0 2027-10-17@480 0/1440 listed",
      "2027-12-24@0 2028-01-09@480 4080/8160 listed",
    ]);
  });
});

describe("example plans: Muster AG 2028", () => {
  const plan = (): PlanFile => readPlan(MUSTER_2028);

  it("has the contract of 2027 and the 2027 plan as leave from another plan, exactly as the import produces it", () => {
    const file = plan();
    const previous = readPlan(MUSTER_2027);
    expect(file.contract).toEqual(previous.contract);
    expect(file.ruleSet).toBeUndefined();
    expect(file.sources.map((entry) => [entry.id, entry.type])).toEqual([
      ["previous-year", "otherPlan"],
      ["kita", "needed"],
    ]);
    const imported = importOtherPlan(readText(MUSTER_2027), { id: file.id, revision: file.revision });
    if (!imported.ok) throw new Error(`The 2027 plan was refused: ${imported.refusal.code}`);
    expect(imported.notices).toEqual([]);
    expect(imported.report).toEqual([]);
    const other = source(file, "previous-year", "otherPlan");
    expect(other.plan).toEqual({ id: previous.id, name: previous.contract.name, revision: 1 });
    expect(other.plan).toEqual(imported.plan);
    expect(other.entries).toEqual(imported.entries);
    // What 2027 charged: 4 Jan 2027, 7 May, 2–13 Aug (10), 24 Dec (two spans), 27–31 Dec (5), 3, 4, 5 and 7 Jan 2028.
    expect(other.entries).toHaveLength(23);
    const spans = (iso: string) => other.entries.filter((entry) => entry.date === dayFromIso(iso)).map(({ from, to, kind }) => [from, to, kind]);
    expect(spans("2027-12-24")).toEqual([[0, 240, "leave"], [240, 480, "mandatory"]]);
    // A half Tuesday's work block is the morning, so the closure charged 0 to ½ on 28 Dec and 4 Jan; 31 Dec likewise.
    expect(spans("2027-12-28")).toEqual([[0, 240, "mandatory"]]);
    expect(spans("2027-12-31")).toEqual([[0, 240, "mandatory"]]);
    expect(spans("2028-01-03")).toEqual([[0, 480, "mandatory"]]);
    expect(spans("2028-01-04")).toEqual([[0, 240, "mandatory"]]);
    expect(spans("2028-01-05")).toEqual([[0, 480, "leave"]]);
  });

  it("3 and 4 Jan 2028 cost nothing here: the 2027 plan charged them (0006)", () => {
    const result = run(plan());
    const previous = run(readPlan(MUSTER_2027));
    for (const iso of ["2028-01-03", "2028-01-04"]) {
      // The closure is mandatory leave here too, but the other plan's span covers it.
      expect(day(result, iso).leave.map((piece) => piece.kind).sort(), iso).toEqual(["mandatory", "otherPlan"]);
      expect(day(result, iso).evaluation).toMatchObject({ whole: true, cost: 0 });
    }
    // Each day is charged in exactly one plan: 480 and 240 in 2027, nothing in 2028.
    expect([day(previous, "2028-01-03").evaluation.cost, day(previous, "2028-01-04").evaluation.cost]).toEqual([480, 240]);
    // The turn of the year 2027/28 is still free time here, but costs nothing in 2028 and is not listed.
    expect(result.stretches.map(fmt)).toContain("2027-12-24@0 2028-01-09@480 0/8160");
  });

  it("costs 13.5 days and lists four stretches", () => {
    const file = plan();
    const result = run(file);
    expect(file.plan.range).toEqual({ from: { year: 2028, month: 1 }, to: { year: 2029, month: 1 } });
    expect(isos(file.plan.days)).toEqual([
      "2028-05-26", "2028-06-16", "2028-08-07", "2028-08-09", "2028-08-10", "2028-08-11", "2028-08-14", "2029-01-05",
    ]);
    // The City of Augsburg in 2028: the Peace Festival and Assumption Day fall on Tuesdays.
    expect(required(result, "2028-08-08")).toEqual({ value: 0, freePart: "end", by: "publicHoliday" });
    expect(required(result, "2028-08-15")).toEqual({ value: 0, freePart: "end", by: "publicHoliday" });
    // Own: 8 days = 3840. Mandatory: the closure Wed 27 – Fri 29 Dec 2028 (1440), Mon 1 Jan 2029 is a holiday,
    // Tue 2 Jan ½ (240), Wed 3 and Thu 4 Jan (960): 2640. Sun 24 and Sun 31 Dec have no work, so their rules cost nothing.
    // 3840 + 2640 = 6480 (13.5 days); 14,400 − 6480 = 7920 (16.5 days) remain.
    // 2028: 7 own days 3360 + 1440 = 4800; January 2029: own 5 Jan 480 + 240 + 960 = 1680.
    expect(result.totals).toEqual({
      allowance: 14400,
      planned: 6480,
      remaining: 7920,
      byYear: [{ year: 2028, planned: 4800 }, { year: 2029, planned: 1680 }],
    });
    expect(listed(result)).toEqual([
      // Easter 2028 is 16 Apr: Ascension Thu 25 May, own Fri 26 May, weekend.
      "2028-05-25@0 2028-05-28@480 480/1920 listed",
      // Corpus Christi Thu 15 Jun, own Fri 16 Jun (the Kita is closed), weekend.
      "2028-06-15@0 2028-06-18@480 480/1920 listed",
      // Sat 5 Aug to Assumption Day Tue 15 Aug: own Mon 7, Wed 9 – Fri 11 and Mon 14 Aug, the Peace Festival Tue 8 Aug:
      // 11 days off for 5.
      "2028-08-05@0 2028-08-15@480 2400/5280 listed",
      // Sat 23 Dec 2028 to Sun 7 Jan 2029: Christmas Mon 25 / Tue 26 Dec, closure 27–29 Dec and 2–4 Jan,
      // New Year Mon 1 Jan, own Fri 5 Jan, Epiphany Sat 6 Jan: 1440 + 240 + 960 + 480 = 3120 for 16 × 480 = 7680.
      "2028-12-23@0 2029-01-07@480 3120/7680 listed",
    ]);
    // The pickup is covered by the half Tuesday; the Kita's bridge day and summer week by own leave and the holiday.
    expect(result.problems).toEqual([]);
  });
});
