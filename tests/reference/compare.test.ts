// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { expect, it } from "vitest";
import { dayFromIso } from "../../src/engine/days";
import type { Holiday } from "../../src/engine/holidays/types";
import { diffHolidays, explain } from "./compare";

const h = (iso: string, ruleId: string): Holiday => ({ day: dayFromIso(iso), ruleId, nameKey: `holiday.${ruleId}`, substitute: false });

it("finds dates on one side only", () => {
  expect(
    diffHolidays(
      "BB",
      [h("2027-01-01", "new-years-day"), h("2027-03-28", "easter-sunday")],
      [
        { date: "2027-01-01", name: "Neujahr" },
        { date: "2027-12-24", name: "Heiligabend" },
      ],
    ),
  ).toEqual([
    { variant: "BB", date: "2027-03-28", kind: "onlyRestlos", label: "easter-sunday" },
    { variant: "BB", date: "2027-12-24", kind: "onlyReference", label: "Heiligabend" },
  ]);
});

it("explains matching differences and reports unused entries", () => {
  const diff = { variant: "HE", date: "2027-03-28", kind: "onlyRestlos", label: "easter-sunday" } as const;
  const entry = {
    reference: "date-holidays",
    variants: ["HE"],
    kind: "onlyRestlos",
    label: "easter-sunday",
    correct: "restlos",
    reason: "r",
    source: "https://example.org",
  } as const;
  expect(explain("date-holidays", [diff], [entry])).toEqual({ unexplained: [], unused: [] });
  expect(explain("date-holidays", [diff], [{ ...entry, years: [2028, 2100] }]).unexplained).toEqual([diff]);
  expect(explain("date-holidays", [], [entry]).unused).toEqual([entry]);
  expect(explain("python-holidays", [diff], [entry])).toEqual({ unexplained: [diff], unused: [] });
});
