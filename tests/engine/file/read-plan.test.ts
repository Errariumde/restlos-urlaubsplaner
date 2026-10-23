// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { computePlan } from "../../../src/engine/counting/plan";
import { dayFromIso, isoFromDay } from "../../../src/engine/days";
import { checkRules } from "../../../src/engine/file/check";
import { planInput } from "../../../src/engine/file/model";
import { readFile } from "../../../src/engine/file/read";
import type { PlanFile } from "../../../src/engine/file/types";
import { readPlanDraft } from "../../../src/engine/file/read-plan";
import { Report, type ReadResult } from "../../../src/engine/file/report";
import { BAVARIA_CONTRACT, core, planFile, refusedWith } from "./helpers";

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
    ["2027-1", "2027-12", "from"],
    ["2027-01", "2027-13", "to"],
    ["2027-12", "2027-01", "to"],
    [5, "2027-12", "from"],
  ])("refuses the range %j to %j", (from, to, key) =>
    expect(read({ range: { from, to } })).toEqual(refusedWith(core("invalidValue", `plan.range.${key}`))));
  it.each([
    ["no range", undefined, [core("missingValue", "plan.range")]],
    ["a range that isn't an object", "2027", [core("invalidValue", "plan.range")]],
    ["a range without from and to", {}, [core("missingValue", "plan.range.from"), core("missingValue", "plan.range.to")]],
  ])("refuses %s", (_name, range, report) => expect(read({ range })).toEqual(refusedWith(...report)));
  it("checks no leave against a broken range", () => {
    const report = new Report();
    const days = [{ date: "2020-01-01", take: "1" }];
    expect(readPlanDraft({ range: { from: "2027-01" }, allowance: "30", days }, "plan", 240, report)).toBeUndefined();
    expect(report.entries).toEqual([core("missingValue", "plan.range.to")]);
  });
  it("refuses 37 months", () =>
    expect(read({ range: { from: "2027-01", to: "2030-01" } })).toMatchObject({ ok: false, refusal: { code: "limitExceeded", data: { limit: "periodMonths" } } }));
  it("accepts 36 months", () => expect(read({ range: { from: "2027-01", to: "2029-12" } }).ok).toBe(true));
  it.each(["99999999999999999999", "-1", "x", 30])("refuses the allowance %j", (allowance) =>
    expect(read({ allowance })).toEqual(refusedWith(core("invalidValue", "plan.allowance"))));
  it("refuses a plan file without plan", () => {
    const json = JSON.parse(planFile()) as Record<string, unknown>;
    delete json["plan"];
    expect(readFile(JSON.stringify(json))).toEqual(refusedWith(core("missingValue", "plan")));
  });
  it("refuses a plan file whose plan isn't an object", () =>
    expect(readFile(planFile({}, { plan: [] }))).toEqual(refusedWith(core("invalidValue", "plan"))));
  it("refuses a plan file without contract.region.state", () =>
    expect(readFile(planFile({}, { contract: { ...BAVARIA_CONTRACT, region: { country: "DE" } } }))).toEqual(
      refusedWith(core("missingValue", "contract.region.state")),
    ));
  it("refuses a plan file with an invalid state, with one report entry", () =>
    expect(readFile(planFile({}, { contract: { ...BAVARIA_CONTRACT, region: { country: "DE", state: "ZZ" } } }))).toEqual(
      refusedWith(core("invalidValue", "contract.region.state")),
    ));
  it("refuses a plan file whose contract isn't an object, and still reads the plan", () =>
    expect(readFile(planFile({ allowance: "x" }, { contract: "x" }))).toEqual(
      refusedWith(core("invalidValue", "contract"), core("invalidValue", "plan.allowance")),
    ));
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
});

describe("plan section: ruleSet", () => {
  it("reads the reference to the rule set", () =>
    expect(load(readFile(planFile({}, { ruleSet: { id: "a", name: "Set", revision: 3 } }))).ruleSet).toEqual({ id: "a", name: "Set", revision: 3 }));
  it("drops an invalid reference", () => {
    const result = readFile(planFile({}, { ruleSet: { id: "a", name: "Set", revision: 0 } }));
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "ruleSet.revision", dropped: "ruleSet" }]);
    expect(load(result).ruleSet).toBeUndefined();
  });
});

describe("plan section: days", () => {
  it("loads a full day", () => expect(load(read({ days: [{ date: "2027-05-07", take: "1" }] })).plan.days).toEqual([{ day: d("2027-05-07"), take: 480 }]));
  it.each([
    ["0,5", { take: "0,5" }, ".take"],
    ["too much", { take: "2" }, ".take"],
    ["zero", { take: "0" }, ".take"],
    ["impossible date", { date: "2027-02-29" }, ".date"],
    ["bad part", { take: "1/2", part: "morning" }, ".part"],
    ["not an object", 5, ""],
  ])("drops a day entry with %s", (_name, change, key) => {
    const entry = typeof change === "object" ? { date: "2027-05-07", take: "1", ...change } : change;
    const result = read({ days: [entry] });
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: `plan.days[0]${key}`, dropped: "plan.days[0]" }]);
    expect(load(result).plan.days).toEqual([]);
  });
  it("reports every problem of a leave day in the order of its keys", () => {
    const result = read({ days: [{ colour: 1, part: "middle", take: "x" }] });
    expect(result.ok && result.report).toEqual([
      { code: "missingValue", path: "plan.days[0].date", dropped: "plan.days[0]" },
      { code: "invalidValue", path: "plan.days[0].take", dropped: "plan.days[0]" },
      { code: "invalidValue", path: "plan.days[0].part", dropped: "plan.days[0]" },
      { code: "unknownField", path: "plan.days[0].colour", dropped: "plan.days[0].colour" },
    ]);
  });
  it("drops a leave day without its Warnings (Review Focus 3)", () => {
    const result = readFile(
      planFile({ days: [{ date: "2026-05-01", take: "1/4", part: "middle" }] }, { contract: { ...BAVARIA_CONTRACT, minUnit: "1/2" } }),
    );
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "plan.days[0].part", dropped: "plan.days[0]" }]);
    expect(load(result).plan.days).toEqual([]);
  });
  it("keeps the first of two entries for one date", () => {
    const result = read({ days: [{ date: "2027-05-07", take: "1" }, { date: "2027-05-07", take: "1/2", part: "end" }] });
    expect(codes(result)).toEqual(["duplicateDate@plan.days[1].date"]);
    expect(load(result).plan.days).toEqual([{ day: d("2027-05-07"), take: 480 }]);
  });
  it("reads no further into a duplicate: no unknownField or notMultipleOfMinUnit for it", () => {
    const result = readFile(
      planFile(
        { days: [{ date: "2027-05-07", take: "1" }, { date: "2027-05-07", take: "1/4", part: "end", colour: 1 }, { date: "2027-05-10", take: "1" }] },
        { contract: { ...BAVARIA_CONTRACT, minUnit: "1/2" } },
      ),
    );
    expect(codes(result)).toEqual(["duplicateDate@plan.days[1].date"]);
    expect(load(result).plan.days.map((day) => day.day)).toEqual([d("2027-05-07"), d("2027-05-10")]);
  });
  it("keeps a later entry of a date when the first is invalid", () => {
    const result = read({ days: [{ date: "2027-05-07", take: "0" }, { date: "2027-05-07", take: "1" }] });
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "plan.days[0].take", dropped: "plan.days[0]" }]);
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
  it.each([
    [{ required: "2" }, "required"],
    [{ required: "0,5" }, "required"],
    [{ date: "2027-02-29" }, "date"],
    [{ part: "morning" }, "part"],
  ])("drops an override with %j", (change, key) => {
    const result = read({ overrides: [{ date: "2027-05-07", required: "1", ...change }] });
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: `plan.overrides[0].${key}`, dropped: "plan.overrides[0]" }]);
  });
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
  it("drops a note with an empty text", () => {
    const result = read({ notes: [{ date: "2027-05-07", text: "" }] });
    expect(result.ok && result.report).toEqual([{ code: "invalidValue", path: "plan.notes[0].text", dropped: "plan.notes[0]" }]);
  });
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
  it("reports nothing but duplicateDate for a dropped duplicate of a drafted half day", () => {
    const result = read({ days: [{ date: "2026-12-30", take: "1/2" }, { date: "2026-12-30", take: "1/2" }] });
    expect(codes(result)).toEqual(["outsidePeriod@plan.days[0]", "duplicateDate@plan.days[1].date", "partSuggested@plan.days[0]"]);
    expect(load(result).plan.days).toEqual([{ day: d("2026-12-30"), take: 240, part: "end" }]);
  });
  it("reports partSuggested in file order across the period's start", () => {
    const result = read({ days: [{ date: "2027-05-12", take: "1/2" }, { date: "2026-12-30", take: "1/2" }, { date: "2027-05-10", take: "1/2" }] });
    expect(codes(result)).toEqual(["outsidePeriod@plan.days[1]", "partSuggested@plan.days[0]", "partSuggested@plan.days[1]", "partSuggested@plan.days[2]"]);
    expect(result.ok && result.report.slice(1).map((entry) => entry.data?.["part"])).toEqual(["end", "end", "start"]);
  });
  it("drafts a half day outside the period as end and reports it", () => {
    const result = read({ days: [{ date: "2026-12-30", take: "1/2" }] });
    expect(codes(result)).toEqual(["outsidePeriod@plan.days[0]", "partSuggested@plan.days[0]"]);
    expect(result.ok && result.report[1]?.data).toEqual({ part: "end" });
    expect(load(result).plan.days).toEqual([{ day: d("2026-12-30"), take: 240, part: "end" }]);
  });
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
    // 50 sources x 2 entries x 500 days = 50,000 source days (the limit), inside the window of the 36-month period.
    const last = isoFromDay(d("2027-01-01") + 499);
    const entries = [0, 1].map(() => ({ match: { type: "range", from: { type: "once", date: "2027-01-01" }, to: { type: "once", date: last } } }));
    const sources = Array.from({ length: 50 }, (_, i) => ({
      id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries,
    }));
    // 2000 unique dates from 2026-10-01 on: the first ~92 lie before the period and are kept with outsidePeriod.
    // Every 7th leave day is half a day; those with i % 14 === 0 give no `part` (drafted, then suggested inside the period).
    const first = d("2026-10-01");
    const days = Array.from({ length: 2000 }, (_, i) => ({
      date: isoFromDay(first + i),
      take: i % 7 === 0 ? "1/2" : "1",
      ...(i % 14 === 7 ? { part: "start" } : {}),
    }));
    const notes = Array.from({ length: 2000 }, (_, i) => ({ date: isoFromDay(first + i), text: "n" }));
    const text = planFile({ range: { from: "2027-01", to: "2029-12" }, days, notes }, { contract: { ...BAVARIA_CONTRACT, rules }, sources });
    const run = () => {
      const result = readFile(text);
      const file = load(result);
      computePlan(planInput(file));
      return result;
    };
    run(); // warm-up
    const startedAt = performance.now();
    const result = run();
    const elapsed = performance.now() - startedAt;
    expect(result.ok && result.report.some((entry) => entry.code === "outsidePeriod")).toBe(true);
    expect(result.ok && result.report.some((entry) => entry.code === "partSuggested")).toBe(true);
    expect(load(result).plan.days).toHaveLength(2000);
    expect(load(result).plan.notes).toHaveLength(2000);
    expect(elapsed).toBeLessThan(1000);
  });

  /** Times `readFile` like the test above, after two warm-up reads: one is not enough for a file of 10 MiB. */
  const timedRead = (text: string): { result: ReadResult; elapsed: number } => {
    readFile(text);
    readFile(text);
    const startedAt = performance.now();
    const result = readFile(text);
    return { result, elapsed: performance.now() - startedAt };
  };
  const warningsOf = (result: ReadResult, warning: string): number =>
    result.ok ? checkRules(result.file, result.positions).filter((entry) => entry.code === warning).length : -1;

  it.each([
    ["1 January to 31 December", { type: "range", from: { type: "fixed", month: 1, day: 1 }, to: { type: "fixed", month: 12, day: 31 } }],
    ["366 days from Easter", { type: "range", from: { type: "easter", offset: 0 }, days: 366 }],
    ["the Kita's Tuesdays from 1 September to 31 August", { type: "range", from: { type: "fixed", month: 9, day: 1 }, to: { type: "fixed", month: 8, day: 31 }, weekdays: ["tue"] }],
  ])("reads 1000 rules of %s without validity years in under 1000 ms", (_name, match) => {
    const rules = Array.from({ length: 1000 }, (_, i) => ({ id: `r${String(i)}`, match, requiredAtMost: "1" }));
    const { result, elapsed } = timedRead(planFile({}, { contract: { ...BAVARIA_CONTRACT, rules } }));
    expect(load(result).contract.rules).toHaveLength(1000);
    expect(elapsed).toBeLessThan(1000);
  });

  // The two costliest of the never-applying match entries tried: as many as a file of 10 MiB holds (a few
  // ten thousand, up to 50 × 2000), each with its own `validFrom` or match, so no two are checked as one.
  const entryShapes: [string, () => Generator<Record<string, unknown>>][] = [
    [
      "ranges from an Easter date to a date in the next year that is just out of reach",
      function* () {
        for (let validFrom = 1600; ; validFrom++) {
          for (let offset = 366; offset >= 286; offset--) {
            // The end, in the next year, lies one or two days before the earliest start possible (22 March
            // plus `offset` days), so only the years themselves tell that it is never reached.
            for (const back of [0, 1]) {
              const dayOfYear = offset - 286 - back;
              const [month, day] = dayOfYear < 31 ? [1, dayOfYear + 1] : dayOfYear < 59 ? [2, dayOfYear - 30] : [3, dayOfYear - 58];
              if (dayOfYear >= 0) yield { match: { type: "range", from: { type: "easter", offset }, to: { type: "fixed", month, day } }, validFrom };
            }
          }
        }
      },
    ],
    [
      "two-day ranges given by the calendar, on a weekday they never cover",
      function* () {
        const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
        for (let validFrom = 1600; ; validFrom++) {
          for (let month = 1; month <= 12; month++) {
            for (let w = 0; w < 7; w++) {
              // The first weekday w of the month, to the weekday w + 1 after its first day: always the next day.
              const from = { type: "nthWeekday", month, weekday: weekdays[w], n: 1 };
              const to = { type: "weekdayRelative", weekday: weekdays[(w + 1) % 7], relation: "after", month, day: 1 };
              yield { match: { type: "range", from, to, weekdays: [weekdays[(w + 3) % 7]] }, validFrom };
            }
          }
        }
      },
    ],
  ];
  it.each(entryShapes)("reads distinct never-applying %s, as many as 10 MiB hold, in under 1000 ms", (_name, shape) => {
    const entries: Record<string, unknown>[] = [];
    let bytes = 0;
    for (const entry of shape()) {
      bytes += JSON.stringify(entry).length + 1;
      if (bytes > 10_485_760 - 20_000 || entries.length === 50 * 2000) break;
      entries.push(entry);
    }
    const sources = Array.from({ length: Math.ceil(entries.length / 2000) }, (_, i) => ({
      id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries: entries.slice(i * 2000, (i + 1) * 2000),
    }));
    const { result, elapsed } = timedRead(planFile({}, { sources }));
    expect(entries.length).toBeGreaterThan(45_000);
    expect(warningsOf(result, "neverApplies")).toBe(entries.length);
    expect(elapsed).toBeLessThan(1000);
  }, 30_000);
});
