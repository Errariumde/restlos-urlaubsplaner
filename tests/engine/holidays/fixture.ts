// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { CountryData, HolidayRule } from "../../../src/engine/holidays/types";

const sub = { when: ["sat", "sun"] } as const;

function rule(id: string, rest: Omit<HolidayRule, "id" | "nameKey" | "sources">): HolidayRule {
  return { id, nameKey: `holiday.${id}`, sources: ["law"], ...rest };
}

export const testCountry: CountryData = {
  schema: 1,
  country: "XX",
  nameKey: "country.XX",
  weekStart: "mon",
  weekend: ["sat", "sun"],
  workWeek: { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" },
  sources: { law: { title: "Test law", url: "https://example.org/law", checked: "2026-10-18" } },
  regions: [
    { id: "A", nameKey: "region.XX.A" },
    { id: "B", nameKey: "region.XX.B" },
  ],
  localRules: [
    {
      id: "special",
      regions: ["A"],
      nameKey: "localRule.XX.special",
      explanationKey: "localRule.XX.special.help",
      sources: ["law"],
    },
  ],
  holidays: [
    rule("new-year", { date: { type: "fixed", month: 1, day: 1 }, regions: "all", substitute: { when: [...sub.when] } }),
    rule("second-day", { date: { type: "fixed", month: 1, day: 2 }, regions: "all", substitute: { when: [...sub.when] } }),
    rule("labour", { date: { type: "fixed", month: 5, day: 1 }, regions: "all" }),
    rule("ascension", { date: { type: "easter", offset: 39 }, regions: "all" }),
    rule("region-a-day", {
      date: { type: "fixed", month: 3, day: 15 },
      regions: ["A"],
      validFrom: 2020,
      validUntil: 2025,
    }),
    rule("special-day", { date: { type: "fixed", month: 6, day: 1 }, regions: ["A"], localRule: "special" }),
    rule("once-day", { date: { type: "once", date: "2026-07-01" }, regions: ["B"] }),
    rule("christmas", { date: { type: "fixed", month: 12, day: 25 }, regions: "all", substitute: { when: [...sub.when] } }),
    rule("boxing", { date: { type: "fixed", month: 12, day: 26 }, regions: "all", substitute: { when: [...sub.when] } }),
  ],
};

export const testCountryFriSat: CountryData = {
  ...testCountry,
  weekend: ["fri", "sat"],
  holidays: [
    rule("new-year", { date: { type: "fixed", month: 1, day: 1 }, regions: "all", substitute: { when: ["fri", "sat"] } }),
  ],
};
