// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import Holidays from "date-holidays";
import { beforeAll, expect, it } from "vitest";
import { countries } from "../../src/data/holidays/index";
import { dayFromYmd } from "../../src/engine/days";
import { holidaysBetween } from "../../src/engine/holidays/holidays";
import { comparisonOf, diffHolidays, explain } from "./compare";
import type { Comparison, ReferenceHoliday } from "./compare";
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

const results = new Map<string, Comparison>();

beforeAll(() => {
  for (const { key, selection } of VARIANTS) {
    const ours = holidaysBetween(de, selection, dayFromYmd(FIRST_YEAR, 1, 1), dayFromYmd(LAST_YEAR, 12, 31));
    const theirs = referenceHolidays(key);
    results.set(key, { ours: ours.length, theirs: theirs.length, diffs: diffHolidays(key, ours, theirs) });
  }
}, 120_000);

it("maps exactly the variants with local rules to a date-holidays region", () => {
  const withOptions = VARIANTS.filter((v) => v.selection.options !== undefined).map((v) => v.key);
  expect(Object.keys(REFERENCE).sort()).toEqual(withOptions.sort());
});

it.each(VARIANTS.map((v) => v.key))("%s matches date-holidays apart from known differences", (key) => {
  const { ours, theirs, diffs } = comparisonOf(results, key);
  const minimum = 9 * (LAST_YEAR - FIRST_YEAR + 1);
  expect(ours).toBeGreaterThanOrEqual(minimum);
  expect(theirs).toBeGreaterThanOrEqual(minimum);
  expect(explain("date-holidays", diffs, KNOWN_DIFFERENCES).unexplained).toEqual([]);
});

it("has no unused known differences", () => {
  const diffs = [...results.values()].flatMap((r) => r.diffs);
  expect(explain("date-holidays", diffs, KNOWN_DIFFERENCES).unused).toEqual([]);
});
