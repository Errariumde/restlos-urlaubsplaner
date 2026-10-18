// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { isoFromDay } from "../../../src/engine/days";
import type { Weekday } from "../../../src/engine/days";
import { ruleDate } from "../../../src/engine/holidays/rules";
import type { DateRule } from "../../../src/engine/holidays/types";

const at = (rule: DateRule, year: number) => {
  const d = ruleDate(rule, year);
  return d === null ? null : isoFromDay(d);
};

type Relation = "before" | "onOrBefore" | "after" | "onOrAfter";
const rel = (weekday: Weekday, relation: Relation, month: number, day: number) =>
  ({ type: "weekdayRelative", weekday, relation, month, day }) as const;

describe("ruleDate fixed", () => {
  it.each([
    [{ type: "fixed", month: 10, day: 3 }, 2027, "2027-10-03"],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2024, "2024-02-29"],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2027, null],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "feb28" }, 2027, "2027-02-28"],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "mar1" }, 2027, "2027-03-01"],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "mar1" }, 2000, "2000-02-29"],
    [{ type: "fixed", month: 2, day: 29, nonLeap: "drop" }, 2100, null],
  ] as [DateRule, number, string | null][])("%j in %i", (rule, year, expected) => {
    expect(at(rule, year)).toBe(expected);
  });
});

describe("ruleDate easter", () => {
  it.each([
    [50, 2027, "2027-05-17"],
    [-2, 2027, "2027-03-26"],
    [39, 2008, "2008-05-01"],
  ])("offset %i in %i", (offset, year, expected) => {
    expect(at({ type: "easter", offset }, year)).toBe(expected);
  });
});

describe("ruleDate orthodoxEaster", () => {
  it.each([
    [0, 2027, "2027-05-02"],
    [1, 2027, "2027-05-03"],
  ])("offset %i in %i", (offset, year, expected) => {
    expect(at({ type: "orthodoxEaster", offset }, year)).toBe(expected);
  });
});

describe("ruleDate weekdayRelative", () => {
  // 23 Nov 2022 is a Wednesday, 23 Nov 2027 a Tuesday, 20 Jun 2027 a Sunday, 1 Jan 2027 a Friday
  it.each([
    [rel("wed", "before", 11, 23), 2027, "2027-11-17"],
    [rel("wed", "before", 11, 23), 2022, "2022-11-16"],
    [rel("wed", "onOrBefore", 11, 23), 2022, "2022-11-23"],
    [rel("thu", "after", 11, 23), 2027, "2027-11-25"],
    [rel("tue", "after", 11, 23), 2027, "2027-11-30"],
    [rel("tue", "onOrAfter", 11, 23), 2027, "2027-11-23"],
    [rel("sat", "onOrAfter", 6, 20), 2027, "2027-06-26"],
    [rel("mon", "after", 12, 31), 2027, "2028-01-03"],
    [rel("fri", "before", 1, 1), 2027, "2026-12-25"],
    [rel("sun", "before", 1, 1), 2027, "2026-12-27"],
  ] as [DateRule, number, string][])("%j in %i", (rule, year, expected) => {
    expect(at(rule, year)).toBe(expected);
  });
});

describe("ruleDate nthWeekday", () => {
  it.each([
    [{ type: "nthWeekday", month: 11, weekday: "thu", n: 4 }, 2027, "2027-11-25"],
    [{ type: "nthWeekday", month: 5, weekday: "mon", n: -1 }, 2027, "2027-05-31"],
    [{ type: "nthWeekday", month: 9, weekday: "mon", n: 1 }, 2027, "2027-09-06"],
    [{ type: "nthWeekday", month: 10, weekday: "mon", n: 2 }, 2027, "2027-10-11"],
    [{ type: "nthWeekday", month: 1, weekday: "mon", n: 3 }, 2027, "2027-01-18"],
    [{ type: "nthWeekday", month: 1, weekday: "fri", n: 3 }, 2027, "2027-01-15"],
    [{ type: "nthWeekday", month: 2, weekday: "sun", n: -1 }, 2028, "2028-02-27"],
  ] as [DateRule, number, string][])("%j in %i", (rule, year, expected) => {
    expect(at(rule, year)).toBe(expected);
  });
});

describe("ruleDate once", () => {
  it("returns the date in its own year only", () => {
    expect(at({ type: "once", date: "2017-10-31" }, 2017)).toBe("2017-10-31");
    expect(at({ type: "once", date: "2017-10-31" }, 2018)).toBeNull();
  });
});
