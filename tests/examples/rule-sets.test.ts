// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computePlan, type PlanResult } from "../../src/engine/counting/plan";
import { dayFromIso } from "../../src/engine/days";
import { planInput } from "../../src/engine/file/model";
import type { RuleSetFile, Text } from "../../src/engine/file/types";
import { writeFile } from "../../src/engine/file/write";
import { MON_SAT, RULE_SET_DIR, fmt, planFrom, readRuleSet, readText, type PlanSetup } from "./helpers";

const FILES = [
  "oeffentlicher-dienst.regeln.json",
  "metall-elektro-bw.regeln.json",
  "banken.regeln.json",
  "versicherungen.regeln.json",
  "bauhauptgewerbe.regeln.json",
  "karneval-rheinland.regeln.json",
  "beispiel-gmbh.regeln.json",
];
const path = (name: string): string => `${RULE_SET_DIR}/${name}`;
const ruleSet = (name: string): RuleSetFile => readRuleSet(path(`${name}.regeln.json`));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bothLanguages = (text: Text | undefined): boolean =>
  typeof text === "object" && typeof text["de"] === "string" && text["de"] !== "" && typeof text["en"] === "string" && text["en"] !== "";

describe("example rule sets: files", () => {
  it("are exactly the seven of the design", () =>
    expect(readdirSync(RULE_SET_DIR).filter((name) => name.endsWith(".regeln.json")).sort()).toEqual([...FILES].sort()));

  it.each(FILES)("%s loads with an empty report and is written canonically", (name) => {
    const file = readRuleSet(path(name));
    expect(writeFile(file)).toBe(readText(path(name)));
  });

  it.each(FILES)("%s names its basis", (name) => {
    const { id, contract } = readRuleSet(path(name));
    expect(id).toMatch(UUID_V4);
    expect(bothLanguages(contract.name)).toBe(true);
    expect(bothLanguages(contract.description)).toBe(true);
    // Every file ends with the same warning that there is no guarantee.
    const description = contract.description as Readonly<Record<string, string>>;
    expect(description["de"]).toMatch(/ Es gibt keine Gewähr, dass die Regeln stimmen, vollständig oder aktuell sind\.$/);
    expect(description["en"]).toMatch(/ There is no guarantee that these rules are correct, complete or up to date\.$/);
    for (const text of Object.values(contract.name ?? {})) expect(text).toMatch(/\b\d{4}\b/); // the version year
    const keys = Object.keys(contract.references);
    expect(keys.length).toBeGreaterThan(0);
    for (const reference of Object.values(contract.references)) {
      expect(reference.title).toBeTruthy();
      expect(reference.version).toBeTruthy();
      expect(reference.url).toMatch(/^https:\/\//);
      expect(Number.isInteger(reference.checked)).toBe(true);
    }
    expect(contract.rules.length).toBeGreaterThan(0);
    for (const rule of contract.rules) {
      expect(bothLanguages(rule.label), rule.id).toBe(true);
      expect(rule.references?.length ?? 0, rule.id).toBeGreaterThan(0);
      expect(rule.origin, rule.id).toBeUndefined();
    }
    // No reference is listed without a rule that rests on it.
    const cited = new Set(contract.rules.flatMap((rule) => rule.references ?? []));
    expect(keys.filter((key) => !cited.has(key))).toEqual([]);
  });
});

const run = (name: string, setup: PlanSetup): PlanResult => computePlan(planInput(planFrom(ruleSet(name), setup)));
const year = (y: number) => ({ from: `${y}-01`, to: `${y}-12` });
const listed = (result: PlanResult): string[] => result.stretches.filter((s) => s.listed).map(fmt);
function day(result: PlanResult, iso: string) {
  const found = result.days.find((entry) => entry.day === dayFromIso(iso));
  if (!found) throw new Error(`${iso} is outside the computed days`);
  return found;
}
const required = (result: PlanResult, iso: string) => {
  const { value, freePart, decidedBy } = day(result, iso).required;
  return { value, freePart, by: decidedBy.kind };
};

describe("example rule sets: hand-worked plans", () => {
  // 2027: Fri 24 Dec, Sat 25 and Sun 26 Dec (holidays on a weekend), Mon 27 – Thu 30 Dec, Fri 31 Dec, Sat 1 Jan 2028, Sun 2 Jan.
  // Thu 31 Dec 2026 is also a free day by the rule; with Fri 1 Jan 2027 (holiday) and the weekend it forms a stretch that
  // reaches into the period and is listed because a working day (Thursday) was made free by a rule.
  const LEAVE_2027 = ["2027-12-27", "2027-12-28", "2027-12-29", "2027-12-30"];
  const FREE_24_31_2027 = ["2026-12-31@0 2027-01-03@480 0/1920 listed", "2027-12-24@0 2028-01-02@480 1920/4800 listed"];

  it("Öffentlicher Dienst, NW, 2027: 24 and 31 Dec (Fridays) are free, the leave around them costs 4 days", () => {
    const result = run("oeffentlicher-dienst", { state: "NW", range: year(2027), allowance: "30", days: LEAVE_2027 });
    expect(required(result, "2027-12-24")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-12-31")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    // Fri 24 Dec to Sun 2 Jan: ten days off, of which only Mon 27 – Thu 30 Dec cost leave.
    expect(listed(result)).toEqual(FREE_24_31_2027);
    expect(result.totals.planned).toBe(1920);
    expect(result.problems).toEqual([]);
  });

  it("Öffentlicher Dienst, NW, 2028: 24 and 31 Dec are Sundays, the rules change nothing", () => {
    // 2028: Sat 23 Dec, Sun 24 Dec, Mon 25 and Tue 26 Dec holidays, leave Wed 27 – Fri 29 Dec, Sat 30, Sun 31 Dec, Mon 1 Jan 2029 holiday.
    const result = run("oeffentlicher-dienst", { state: "NW", range: year(2028), allowance: "30", days: ["2028-12-27", "2028-12-28", "2028-12-29"] });
    // The work week already gives 0 on Sundays; it is the first layer with the lowest value, so it decides.
    expect(required(result, "2028-12-24")).toEqual({ value: 0, freePart: "end", by: "workWeek" });
    expect(required(result, "2028-12-31")).toEqual({ value: 0, freePart: "end", by: "workWeek" });
    // Fri 31 Dec 2027 (rule), Sat 1 Jan 2028 (holiday) and Sun 2 Jan reach into the period: listed, no cost.
    expect(listed(result)).toEqual(["2027-12-31@0 2028-01-02@480 0/1440 listed", "2028-12-23@0 2029-01-01@480 1440/4800 listed"]);
    expect(result.totals.planned).toBe(1440);
  });

  it("Metall-Elektro BW, 2027: 24 and 31 Dec end at noon", () => {
    const result = run("metall-elektro-bw", { state: "BW", range: year(2027), allowance: "30", days: LEAVE_2027 });
    expect(required(result, "2027-12-24")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-12-31")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    // The free afternoon of Fri 24 Dec (240) + Sat/Sun (960) + Mon–Thu leave (1920) = 3120 days off for 1920.
    // The morning of Fri 31 Dec is work, so the afternoon to Sun 2 Jan is a stretch of its own without cost (not listed).
    // Half days at the end are not closures (only a rule to 0 is), so Thu 31 Dec 2026 lists nothing either.
    expect(listed(result)).toEqual(["2027-12-24@240 2027-12-30@480 1920/3120 listed"]);
    expect(result.stretches.map(fmt)).toContain("2027-12-31@240 2028-01-02@480 0/1200");
    expect(result.totals.planned).toBe(1920);
  });

  it("Metall-Elektro BW, Mon–Sat week, 2028: the Saturdays before Christmas and New Year end at noon", () => {
    // 24 and 31 Dec 2028 are Sundays, so the working days (Werktage) right before Christmas Day and New Year's Day are
    // Sat 23 and Sat 30 Dec; the Sundays themselves are no working days by the work week.
    const result = run("metall-elektro-bw", { state: "BW", week: MON_SAT, range: year(2028), allowance: "30", days: [] });
    expect(required(result, "2028-12-23")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2028-12-30")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2028-12-24").value).toBe(0);
    expect(required(result, "2028-12-31").value).toBe(0);
    // In 2027 the Saturday rules don't apply: Thu 23 Dec is a full working day, Fri 24 Dec ends at noon.
    const previous = run("metall-elektro-bw", { state: "BW", week: MON_SAT, range: year(2027), allowance: "30", days: [] });
    expect(required(previous, "2027-12-23")).toEqual({ value: 480, freePart: "end", by: "workWeek" });
    expect(required(previous, "2027-12-24")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(listed(result)).toEqual([]);
  });

  it("Banken, HE, 2027: as Öffentlicher Dienst 2027", () => {
    const result = run("banken", { state: "HE", range: year(2027), allowance: "30", days: LEAVE_2027 });
    expect(required(result, "2027-12-24")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-12-31")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(listed(result)).toEqual(FREE_24_31_2027);
    expect(result.totals.planned).toBe(1920);
  });

  it("Versicherungen, HH, 2027: Easter leave; the Saturday before Easter is free by the work week", () => {
    // Easter Sunday 2027 is 28 Mar: Good Friday 26 Mar, Easter Monday 29 Mar, leave Tue 30 Mar – Fri 2 Apr, weekend to Sun 4 Apr.
    const result = run("versicherungen", { state: "HH", range: year(2027), allowance: "30", days: ["2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02"] });
    // The rule gives 0 as well, but the work week comes first among equal values and decides.
    expect(required(result, "2027-03-27")).toEqual({ value: 0, freePart: "end", by: "workWeek" });
    // 24 and 31 Dec 2027 are Fridays made free by the rules, each with its weekend (25/26 Dec are holidays, 1 Jan 2028 too).
    expect(listed(result)).toEqual([
      "2026-12-31@0 2027-01-03@480 0/1920 listed",
      "2027-03-26@0 2027-04-04@480 1920/4800 listed",
      "2027-12-24@0 2027-12-26@480 0/1440 listed",
      "2027-12-31@0 2028-01-02@480 0/1440 listed",
    ]);
    expect(result.totals.planned).toBe(1920);
  });

  it("Versicherungen, HH, Mon–Sat week, 2027: the Saturdays before Easter and Whit Sunday are free by the rules", () => {
    const result = run("versicherungen", {
      state: "HH",
      week: MON_SAT,
      range: year(2027),
      allowance: "30",
      days: ["2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02", "2027-04-03"],
    });
    // Whit Sunday 2027 is 16 May (Easter + 49), so the Saturday before it is 15 May (Easter + 48).
    expect(required(result, "2027-03-27")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-05-15")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    // Saturdays are working days now: leave Tue 30 Mar – Sat 3 Apr costs 5 days. (MTV § 13 says Saturdays are no leave
    // days, so the description recommends keeping Saturday at 0; this plan is what happens when Saturday work is entered.) Sat 2 Jan 2027 is a working day, so
    // the turn of the year 2026/27 is only Thu 31 Dec 2026 (rule) and Fri 1 Jan (holiday). Sat 15 May, Sun 16 May and
    // Whit Monday 17 May form a listed stretch: a working Saturday made free by a rule.
    expect(listed(result)).toEqual([
      "2026-12-31@0 2027-01-01@480 0/960 listed",
      "2027-03-26@0 2027-04-04@480 2400/4800 listed",
      "2027-05-15@0 2027-05-17@480 0/1440 listed",
      "2027-12-24@0 2027-12-26@480 0/1440 listed",
      "2027-12-31@0 2028-01-02@480 0/1440 listed",
    ]);
    expect(result.totals.planned).toBe(2400);
  });

  it("Bauhauptgewerbe, NI, 2027: as Öffentlicher Dienst 2027", () => {
    const result = run("bauhauptgewerbe", { state: "NI", range: year(2027), allowance: "30", days: LEAVE_2027 });
    expect(required(result, "2027-12-24")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-12-31")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(listed(result)).toEqual(FREE_24_31_2027);
    expect(result.totals.planned).toBe(1920);
  });

  it("Karneval Rheinland, NW, 2027: a Friday of leave between Weiberfastnacht and Rosenmontag", () => {
    // Easter 2027 is 28 Mar: Weiberfastnacht (−52) Thu 4 Feb, Rosenmontag (−48) Mon 8 Feb, Shrove Tuesday Tue 9 Feb.
    const result = run("karneval-rheinland", { state: "NW", range: year(2027), allowance: "30", days: ["2027-02-05"] });
    expect(required(result, "2027-02-04")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-02-08")).toEqual({ value: 0, freePart: "end", by: "ruleAtMost" });
    expect(required(result, "2027-02-09")).toEqual({ value: 480, freePart: "end", by: "workWeek" });
    // Thursday afternoon (240) + Friday (480) + weekend (960) + Monday (480) = 2160 days off for one day of leave.
    expect(listed(result)).toEqual(["2027-02-04@240 2027-02-08@480 480/2160 listed"]);
    expect(result.totals.planned).toBe(480);
  });

  it("Beispiel GmbH, 2027: the company closure costs 4 days", () => {
    // Bavaria; 24 and 31 Dec 2027 (Fridays) end at noon; closure Mon 27 – Thu 30 Dec as mandatory leave.
    const result = run("beispiel-gmbh", { state: "BY", range: year(2027), allowance: "30", days: [] });
    expect(required(result, "2027-12-24")).toEqual({ value: 240, freePart: "end", by: "ruleAtMost" });
    expect(day(result, "2027-12-27").evaluation.cost).toBe(480);
    // The closure of 2026 (Mon 28 – Wed 30 Dec 2026) lies before the period: its stretch is left out and costs nothing here.
    expect(listed(result)).toEqual(["2027-12-24@240 2027-12-30@480 1920/3120 listed"]);
    expect(result.totals.planned).toBe(1920);
    expect(result.problems).toEqual([]);
  });

  it("Beispiel GmbH, 2028: the closure covers Wed 27 – Fri 29 Dec, Saturday 30 Dec is left out", () => {
    const result = run("beispiel-gmbh", { state: "BY", range: year(2028), allowance: "30", days: [] });
    expect(day(result, "2028-12-29").evaluation.cost).toBe(480);
    expect(day(result, "2028-12-30").leave).toEqual([]); // the weekday filter: no mandatory leave on Saturday
    // Sat 23 Dec to Mon 1 Jan 2029 (holiday): 24 and 31 Dec are Sundays, 25/26 Dec holidays, three closure days cost.
    expect(listed(result)).toEqual(["2028-12-23@0 2029-01-01@480 1440/4800 listed"]);
    expect(result.totals.planned).toBe(1440);
    // The rule set's local rules: Assumption Day (Tue 15 Aug 2028) is a holiday, the Augsburg Peace Festival (Tue 8 Aug) is not.
    expect(required(result, "2028-08-15")).toEqual({ value: 0, freePart: "end", by: "publicHoliday" });
    expect(required(result, "2028-08-08").value).toBe(480);
  });
});
