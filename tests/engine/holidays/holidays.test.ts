// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromIso, isoFromDay } from "../../../src/engine/days";
import { holidaysBetween } from "../../../src/engine/holidays/holidays";
import type { CountryData, RegionSelection } from "../../../src/engine/holidays/types";
import { testCountry, testCountryFriSat } from "./fixture";

const sel = (state: string, options?: Record<string, boolean>): RegionSelection => ({
  country: "XX",
  state,
  ...(options && { options }),
});
const between = (data: CountryData, s: RegionSelection, from: string, to: string) =>
  holidaysBetween(data, s, dayFromIso(from), dayFromIso(to)).map(
    (h) => `${isoFromDay(h.day)} ${h.ruleId}${h.substitute ? " (substitute)" : ""}`,
  );

describe("holidaysBetween", () => {
  it("moves colliding substitutes to the next free working day", () => {
    expect(between(testCountry, sel("B"), "2021-12-01", "2022-01-31")).toEqual([
      "2021-12-25 christmas",
      "2021-12-26 boxing",
      "2021-12-27 christmas (substitute)",
      "2021-12-28 boxing (substitute)",
      "2022-01-01 new-year",
      "2022-01-02 second-day",
      "2022-01-03 new-year (substitute)",
      "2022-01-04 second-day (substitute)",
    ]);
  });
  it("finds substitutes whose original day lies before the range", () => {
    expect(between(testCountry, sel("B"), "2022-01-03", "2022-01-04")).toEqual([
      "2022-01-03 new-year (substitute)",
      "2022-01-04 second-day (substitute)",
    ]);
  });
  it("uses the country's own weekend", () => {
    expect(between(testCountryFriSat, sel("A"), "2027-01-01", "2027-01-05")).toEqual([
      "2027-01-01 new-year",
      "2027-01-03 new-year (substitute)",
    ]);
  });
  it("respects validity years inclusively", () => {
    for (const [year, expected] of [[2019, 0], [2020, 1], [2025, 1], [2026, 0]] as const)
      expect(between(testCountry, sel("A"), `${year}-03-15`, `${year}-03-15`)).toHaveLength(expected);
  });
  it("applies local rules only when switched on", () => {
    expect(between(testCountry, sel("A"), "2027-06-01", "2027-06-01")).toEqual([]);
    expect(between(testCountry, sel("A", { special: false }), "2027-06-01", "2027-06-01")).toEqual([]);
    expect(between(testCountry, sel("A", { special: true }), "2027-06-01", "2027-06-01")).toEqual(["2027-06-01 special-day"]);
  });
  it("applies one-off dates once and only in their regions", () => {
    expect(between(testCountry, sel("B"), "2026-07-01", "2026-07-01")).toEqual(["2026-07-01 once-day"]);
    expect(between(testCountry, sel("B"), "2027-07-01", "2027-07-01")).toEqual([]);
    expect(between(testCountry, sel("A"), "2026-07-01", "2026-07-01")).toEqual([]);
  });
  it("returns every holiday on a shared day", () => {
    expect(between(testCountry, sel("B"), "2008-05-01", "2008-05-01")).toEqual([
      "2008-05-01 ascension",
      "2008-05-01 labour",
    ]);
  });
  it.each([
    [{ country: "DE", state: "A" }],
    [sel("C")],
    [sel("B", { special: true })],
    [sel("A", { unknown: false })],
  ])("rejects selection %j", (s) => expect(() => holidaysBetween(testCountry, s, 0, 10)).toThrow(RangeError));
  it("returns nothing for an empty range", () => expect(holidaysBetween(testCountry, sel("A"), 10, 9)).toEqual([]));
  it("gives the same result across a year boundary as per year", () => {
    expect(between(testCountry, sel("B"), "2027-01-01", "2028-01-31")).toEqual([
      ...between(testCountry, sel("B"), "2027-01-01", "2027-12-31"),
      ...between(testCountry, sel("B"), "2028-01-01", "2028-01-31"),
    ]);
  });
  it("works at the limits of the supported years", () => {
    expect(between(testCountry, sel("B"), "9999-12-24", "9999-12-31")).toEqual([
      "9999-12-25 christmas",
      "9999-12-26 boxing",
      "9999-12-27 christmas (substitute)",
      "9999-12-28 boxing (substitute)",
    ]);
    expect(between(testCountry, sel("B"), "1583-01-01", "1583-01-02")).toEqual([
      "1583-01-01 new-year",
      "1583-01-02 second-day",
    ]);
  });
});
