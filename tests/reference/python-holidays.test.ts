// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { beforeAll, expect, it } from "vitest";
import { countries } from "../../src/data/holidays/index";
import { dayFromYmd } from "../../src/engine/days";
import { holidaysBetween } from "../../src/engine/holidays/holidays";
import { comparisonOf, diffHolidays, explain } from "./compare";
import type { Comparison, ReferenceHoliday } from "./compare";
import { KNOWN_DIFFERENCES } from "./known-differences";
import reference from "./python-holidays-de.json";
import { FIRST_YEAR, LAST_YEAR, VARIANTS } from "./variants";

interface ReferenceFile {
  version: string;
  years: number[];
  variants: Record<string, { holidays: Record<string, string[]> }>;
}

const file = reference as unknown as ReferenceFile;
const de = countries.DE!;

function referenceHolidays(key: string): ReferenceHoliday[] {
  const variant = file.variants[key];
  if (variant === undefined) throw new Error(`variant ${key} missing in the python-holidays reference`);
  return Object.entries(variant.holidays).flatMap(([name, dates]) => dates.map((date) => ({ date, name })));
}

const results = new Map<string, Comparison>();

beforeAll(() => {
  for (const { key, selection } of VARIANTS) {
    const ours = holidaysBetween(de, selection, dayFromYmd(FIRST_YEAR, 1, 1), dayFromYmd(LAST_YEAR, 12, 31));
    const theirs = referenceHolidays(key);
    results.set(key, { ours: ours.length, theirs: theirs.length, diffs: diffHolidays(key, ours, theirs) });
  }
}, 120_000);

it("uses the pinned python-holidays version, the full year range and all variants", () => {
  expect(file.version).toBe("0.97");
  expect(file.years).toEqual([FIRST_YEAR, LAST_YEAR]);
  expect(Object.keys(file.variants).sort()).toEqual(VARIANTS.map((v) => v.key).sort());
});

it.each(VARIANTS.map((v) => v.key))("%s matches python-holidays apart from known differences", (key) => {
  const { ours, theirs, diffs } = comparisonOf(results, key);
  const minimum = 9 * (LAST_YEAR - FIRST_YEAR + 1);
  expect(ours).toBeGreaterThanOrEqual(minimum);
  expect(theirs).toBeGreaterThanOrEqual(minimum);
  expect(explain("python-holidays", diffs, KNOWN_DIFFERENCES).unexplained).toEqual([]);
});

it("has no unused known differences", () => {
  const diffs = [...results.values()].flatMap((r) => r.diffs);
  expect(explain("python-holidays", diffs, KNOWN_DIFFERENCES).unused).toEqual([]);
});
