// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import Holidays from "date-holidays";
import { beforeAll, expect, it } from "vitest";
import { countries } from "../../src/data/holidays/index";
import { dayFromYmd } from "../../src/engine/days";
import { holidaysBetween } from "../../src/engine/holidays/holidays";
import { diffHolidays, explain } from "./compare";
import type { Difference, ReferenceHoliday } from "./compare";
import { KNOWN_DIFFERENCES } from "./known-differences";
import { FIRST_YEAR, LAST_YEAR, VARIANTS } from "./variants";

const de = countries.DE!;

// [state, region, drop entries on 15 Aug]
const REFERENCE: Record<string, [string, string | undefined, boolean]> = {
  "BY+assumption": ["BY", "KATH", false],
  "BY+assumption+augsburg": ["BY", "A", false],
  "BY+augsburg": ["BY", "A", true],
  "SN+corpusChristi": ["SN", "BZ", false],
  "TH+corpusChristi": ["TH", "EIC", false],
};

function referenceHolidays(key: string): ReferenceHoliday[] {
  const [state, region, dropAssumption] = REFERENCE[key] ?? [key, undefined, false];
  const reference = region === undefined ? new Holidays("DE", state) : new Holidays("DE", state, region);
  const result: ReferenceHoliday[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    for (const holiday of reference.getHolidays(year)) {
      const date = holiday.date.slice(0, 10);
      if (holiday.type !== "public" || (dropAssumption && date.endsWith("-08-15"))) continue;
      result.push({ date, name: holiday.name });
    }
  }
  return result;
}

const diffs = new Map<string, Difference[]>();

beforeAll(() => {
  for (const { key, selection } of VARIANTS) {
    const ours = holidaysBetween(de, selection, dayFromYmd(FIRST_YEAR, 1, 1), dayFromYmd(LAST_YEAR, 12, 31));
    diffs.set(key, diffHolidays(key, ours, referenceHolidays(key)));
  }
}, 120_000);

it.each(VARIANTS.map((v) => v.key))("%s matches date-holidays apart from known differences", (key) => {
  expect(explain("date-holidays", diffs.get(key) ?? [], KNOWN_DIFFERENCES).unexplained).toEqual([]);
});

it("has no unused known differences", () => {
  expect(explain("date-holidays", [...diffs.values()].flat(), KNOWN_DIFFERENCES).unused).toEqual([]);
});
