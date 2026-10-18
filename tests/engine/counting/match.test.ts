// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { ruleDays } from "../../../src/engine/counting/match";
import type { DayMatch, RangeMatch } from "../../../src/engine/counting/types";
import { d, easter, fixed, isoDays, once, span } from "./helpers";

const days = (match: DayMatch, from: string, to: string, validity: { validFrom?: number; validUntil?: number } = {}) =>
  isoDays(ruleDays({ match, ...validity }, d(from), d(to)));
const newYear: RangeMatch = { type: "range", from: fixed(12, 27), to: fixed(1, 2) };

describe("ruleDays", () => {
  it("evaluates single-day date rules per year", () =>
    expect(days(fixed(12, 31), "2027-01-01", "2028-12-31")).toEqual(["2027-12-31", "2028-12-31"]));
  it("applies validity years to single-day rules", () =>
    expect(days(fixed(3, 8), "2018-01-01", "2020-12-31", { validFrom: 2019 })).toEqual(["2019-03-08", "2020-03-08"]));
  it("crosses New Year with `to`, including an occurrence that started the year before", () => {
    expect(days(newYear, "2027-12-01", "2028-01-31")).toEqual(span("2027-12-27", "2028-01-02"));
    expect(days(newYear, "2026-12-30", "2027-01-03")).toEqual(span("2026-12-30", "2027-01-02"));
  });
  it("combines a `once` start with an Easter end", () =>
    expect(days({ type: "range", from: once("2028-03-20"), to: easter(1) }, "2027-01-01", "2029-12-31")).toEqual(
      span("2028-03-20", "2028-04-17"),
    ));
  it("uses a `once` end only in its own year", () =>
    expect(days({ type: "range", from: fixed(12, 27), to: once("2028-01-04") }, "2026-01-01", "2029-12-31")).toEqual(
      span("2027-12-27", "2028-01-04"),
    ));
  it("skips years in which `to` gives no day on or after the start", () =>
    expect(days({ type: "range", from: fixed(3, 1), to: once("2020-01-01") }, "2027-01-01", "2027-12-31")).toEqual([]));
  it("counts `days` from the start", () =>
    expect(days({ type: "range", from: easter(-52), days: 6 }, "2027-01-01", "2027-12-31")).toEqual(
      span("2027-02-04", "2027-02-09"),
    ));
  it("keeps only the listed weekdays", () =>
    expect(
      days({ type: "range", from: fixed(12, 1), to: fixed(12, 31), weekdays: ["sat"] }, "2027-01-01", "2027-12-31"),
    ).toEqual(["2027-12-04", "2027-12-11", "2027-12-18", "2027-12-25"]));
  it("applies validity to the year in which a range starts", () =>
    expect(days(newYear, "2027-12-01", "2029-01-31", { validUntil: 2027 })).toEqual(span("2027-12-27", "2028-01-02")));
  it("keeps the length with `days` and the end date with `to` in leap years", () => {
    const length: RangeMatch = { type: "range", from: fixed(2, 27), days: 4 };
    expect(days(length, "2027-01-01", "2027-12-31")).toEqual(span("2027-02-27", "2027-03-02"));
    expect(days(length, "2028-01-01", "2028-12-31")).toEqual(span("2028-02-27", "2028-03-01"));
    expect(days({ type: "range", from: fixed(2, 27), to: fixed(3, 2) }, "2028-01-01", "2028-12-31")).toEqual(
      span("2028-02-27", "2028-03-02"),
    );
  });
  it("counts a day matched by two occurrences once", () =>
    expect(days({ type: "range", from: fixed(1, 1), days: 366 }, "2027-12-31", "2028-01-02")).toEqual([
      "2027-12-31",
      "2028-01-01",
      "2028-01-02",
    ]));
  it("stays within the supported years without throwing", () => {
    expect(days({ type: "range", from: fixed(12, 27), days: 7 }, "9999-12-01", "9999-12-31")).toEqual(
      span("9999-12-27", "9999-12-31"),
    );
    expect(days(newYear, "9999-12-01", "9999-12-31")).toEqual([]); // its end would lie in 10000
    expect(days(newYear, "1583-01-01", "1583-01-05")).toEqual([]);
  });
  it("finds occurrences whose date lies in the neighbouring calendar year", () => {
    const satBeforeNewYear: DayMatch = { type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 };
    expect(days(satBeforeNewYear, "2027-01-01", "2027-12-31")).toEqual(["2027-12-25"]);
    expect(days({ type: "weekdayRelative", weekday: "mon", relation: "after", month: 12, day: 31 }, "2027-01-01", "2027-12-31")).toEqual(["2027-01-04"]);
    expect(days({ type: "range", from: { type: "weekdayRelative", weekday: "fri", relation: "before", month: 1, day: 1 }, days: 3 }, "2027-01-01", "2027-12-31")).toEqual(["2027-12-31"]);
  });
  it("applies validity to the rule's year, not to the year of the day", () =>
    expect(days({ type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 }, "2027-01-01", "2027-12-31", { validFrom: 2028, validUntil: 2028 })).toEqual(["2027-12-25"]));
  it("returns nothing for a day that belongs to a rule year beyond the supported years", () =>
    expect(days({ type: "weekdayRelative", weekday: "sat", relation: "before", month: 1, day: 1 }, "9999-01-01", "9999-12-31")).toEqual([]));
  it.each([
    [{ type: "range", from: fixed(1, 1), days: 0 }],
    [{ type: "range", from: fixed(1, 1), days: 367 }],
    [{ type: "range", from: fixed(1, 1), days: 1.5 }],
    [{ type: "range", from: fixed(1, 1), to: fixed(1, 2), days: 2 }],
    [{ type: "range", from: fixed(1, 1) }],
    [{ type: "range", from: fixed(1, 1), days: 2, weekdays: [] }],
  ] as [RangeMatch][])("rejects %j", (match) =>
    expect(() => ruleDays({ match }, d("2027-01-01"), d("2027-12-31"))).toThrow(RangeError),
  );
});
