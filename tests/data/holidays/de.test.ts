// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, it } from "vitest";
import { countries } from "../../../src/data/holidays/index";
import { dayFromYmd, isoFromDay } from "../../../src/engine/days";
import { holidaysBetween } from "../../../src/engine/holidays/holidays";
import { validateCountryData } from "../../../src/engine/holidays/validate";

const de = countries.DE!;
const year = (state: string, y: number, options?: Record<string, boolean>) =>
  holidaysBetween(de, { country: "DE", state, ...(options && { options }) }, dayFromYmd(y, 1, 1), dayFromYmd(y, 12, 31))
    .map((h) => `${isoFromDay(h.day).slice(5)} ${h.ruleId}`);
const has = (state: string, y: number, entry: string, options?: Record<string, boolean>) => year(state, y, options).includes(entry);

it.each(Object.entries(countries))("data file %s is valid", (_, data) => expect(validateCountryData(data)).toEqual([]));

// Every recurring rule on three years; values computed independently (Python dateutil / python-holidays), never from engine output.
const RECURRING: [ruleId: string, state: string, options: Record<string, boolean> | undefined, dates: [string, string, string]][] = [
  ["new-years-day", "HB", undefined, ["2026-01-01", "2027-01-01", "2028-01-01"]],
  ["epiphany", "ST", undefined, ["2026-01-06", "2027-01-06", "2028-01-06"]],
  ["womens-day-be", "BE", undefined, ["2026-03-08", "2027-03-08", "2028-03-08"]],
  ["womens-day-mv", "MV", undefined, ["2026-03-08", "2027-03-08", "2028-03-08"]],
  ["good-friday", "HB", undefined, ["2026-04-03", "2027-03-26", "2028-04-14"]],
  ["easter-sunday", "BB", undefined, ["2026-04-05", "2027-03-28", "2028-04-16"]],
  ["easter-monday", "HB", undefined, ["2026-04-06", "2027-03-29", "2028-04-17"]],
  ["labour-day", "HB", undefined, ["2026-05-01", "2027-05-01", "2028-05-01"]],
  ["ascension-day", "HB", undefined, ["2026-05-14", "2027-05-06", "2028-05-25"]],
  ["whit-sunday", "BB", undefined, ["2026-05-24", "2027-05-16", "2028-06-04"]],
  ["whit-monday", "HB", undefined, ["2026-05-25", "2027-05-17", "2028-06-05"]],
  ["corpus-christi", "NW", undefined, ["2026-06-04", "2027-05-27", "2028-06-15"]],
  ["corpus-christi-local", "TH", { corpusChristi: true }, ["2026-06-04", "2027-05-27", "2028-06-15"]],
  ["augsburg-peace-festival", "BY", { augsburg: true }, ["2026-08-08", "2027-08-08", "2028-08-08"]],
  ["assumption-day", "SL", undefined, ["2026-08-15", "2027-08-15", "2028-08-15"]],
  ["assumption-day-local", "BY", { assumption: true }, ["2026-08-15", "2027-08-15", "2028-08-15"]],
  ["world-childrens-day", "TH", undefined, ["2026-09-20", "2027-09-20", "2028-09-20"]],
  ["german-unity-day", "HB", undefined, ["2026-10-03", "2027-10-03", "2028-10-03"]],
  ["reformation-day", "BB", undefined, ["2026-10-31", "2027-10-31", "2028-10-31"]],
  ["reformation-day-north", "NI", undefined, ["2026-10-31", "2027-10-31", "2028-10-31"]],
  ["all-saints-day", "RP", undefined, ["2026-11-01", "2027-11-01", "2028-11-01"]],
  ["repentance-day", "SN", undefined, ["2026-11-18", "2027-11-17", "2028-11-22"]],
  ["christmas-day", "HB", undefined, ["2026-12-25", "2027-12-25", "2028-12-25"]],
  ["second-christmas-day", "HB", undefined, ["2026-12-26", "2027-12-26", "2028-12-26"]],
];
it.each(RECURRING)("has %s in %s on three years", (id, state, options, dates) => {
  for (const iso of dates) expect(has(state, Number(iso.slice(0, 4)), `${iso.slice(5)} ${id}`, options)).toBe(true);
});
it("has the complete Bavarian year 2027 without switches", () => {
  expect(year("BY", 2027)).toEqual([
    "01-01 new-years-day", "01-06 epiphany", "03-26 good-friday", "03-29 easter-monday", "05-01 labour-day",
    "05-06 ascension-day", "05-17 whit-monday", "05-27 corpus-christi", "10-03 german-unity-day",
    "11-01 all-saints-day", "12-25 christmas-day", "12-26 second-christmas-day",
  ]);
});
it("applies the Bavarian switches independently", () => {
  expect(has("BY", 2027, "08-15 assumption-day-local", { assumption: true })).toBe(true);
  expect(has("BY", 2027, "08-08 augsburg-peace-festival", { augsburg: true })).toBe(true);
  expect(has("BY", 2027, "08-15 assumption-day-local", { augsburg: true })).toBe(false);
});
it("has Assumption Day statewide in Saarland", () => expect(has("SL", 2027, "08-15 assumption-day")).toBe(true));
it("has Corpus Christi in SN and TH only with the switch", () => {
  for (const state of ["SN", "TH"]) {
    expect(has(state, 2027, "05-27 corpus-christi-local")).toBe(false);
    expect(has(state, 2027, "05-27 corpus-christi-local", { corpusChristi: true })).toBe(true);
  }
});
// Review Focus 5: 23 Nov is a Wednesday in 2016, 2022 and 2033
it.each([[2016, "11-16"], [2022, "11-16"], [2027, "11-17"], [2033, "11-16"]])(
  "has the Day of Repentance and Prayer %i on %s in SN", (y, md) => expect(has("SN", y, `${md} repentance-day`)).toBe(true));
it.each([["BE", "womens-day-be", 2018, 2019], ["MV", "womens-day-mv", 2022, 2023]] as const)(
  "starts Women's Day in %s", (state, id, before, from) => {
    expect(has(state, before, `03-08 ${id}`)).toBe(false);
    expect(has(state, from, `03-08 ${id}`)).toBe(true);
    expect(has(state, 2027, `03-08 ${id}`)).toBe(true);
  });
it("starts World Children's Day in TH in 2019", () => {
  expect([2018, 2019, 2027].map((y) => has("TH", y, "09-20 world-childrens-day"))).toEqual([false, true, true]);
});
it("has the Berlin one-off days only in their years", () => {
  expect(has("BE", 2020, "05-08 liberation-day-2020")).toBe(true);
  expect(has("BE", 2025, "05-08 liberation-day-2025")).toBe(true);
  expect([2021, 2026].some((y) => year("BE", y).some((e) => e.startsWith("05-08")))).toBe(false);
});
it("has the 2028 uprising anniversary in Berlin only in 2028", () => {
  expect(has("BE", 2028, "06-17 uprising-anniversary-2028")).toBe(true);
  expect(year("BE", 2027).some((e) => e.startsWith("06-17"))).toBe(false);
  expect(has("BB", 2028, "06-17 uprising-anniversary-2028")).toBe(false);
});
it.each(["BB", "BY", "HB", "SN"])("has exactly one Reformation Day entry in %s in 2017", (state) => {
  expect(year(state, 2017).filter((e) => e.startsWith("10-31"))).toHaveLength(1);
});
it("has Reformation Day in the northern states from 2018", () => {
  for (const state of ["HB", "HH", "NI", "SH"])
    expect([2016, 2017, 2018, 2027].map((y) => year(state, y).some((e) => e.startsWith("10-31")))).toEqual([false, true, true, true]);
  expect([2016, 2017, 2018].map((y) => year("BY", y).some((e) => e.startsWith("10-31")))).toEqual([false, true, false]);
});
it("returns both holidays on 1 May 2008", () => {
  expect(year("NW", 2008).filter((e) => e.startsWith("05-01"))).toEqual(["05-01 ascension-day", "05-01 labour-day"]);
});
it("has Easter Sunday and Whit Sunday in Brandenburg", () => {
  expect(has("BB", 2027, "03-28 easter-sunday") && has("BB", 2027, "05-16 whit-sunday")).toBe(true);
});
it.each(de.regions.map((r) => r.id))("has the nationwide holidays in %s", (state) => {
  const ids = year(state, 2027).map((e) => e.slice(6));
  for (const id of ["new-years-day", "good-friday", "easter-monday", "labour-day", "ascension-day", "whit-monday",
    "german-unity-day", "christmas-day", "second-christmas-day"]) expect(ids).toContain(id);
});
