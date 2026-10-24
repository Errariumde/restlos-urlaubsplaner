// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Crafted worst-case file shapes, shared by the content tests and the perf gate.

import { dayFromIso, isoFromDay } from "../../../src/engine/days";
import { BAVARIA_CONTRACT, planFile } from "./helpers";

export type EntryShape = () => Generator<Record<string, unknown>>;

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Shape X of issue 0015: ranges from an early Easter date to the next January or February, on a weekday they never cover. */
export const earlyEasterRangesOffWeekday: EntryShape = function* () {
  for (let validFrom = 1600; ; validFrom++) {
    for (let k = 286; k <= 338; k++) {
      const dayOfYear = k - 281; // the 0-based day of the next year: 5 (6 January) for k = 286
      const [month, day] = dayOfYear < 31 ? [1, dayOfYear + 1] : [2, dayOfYear - 30];
      yield { match: { type: "range", from: { type: "easter", offset: k }, to: { type: "fixed", month, day }, weekdays: [WEEKDAYS[(k + 12) % 7]] }, validFrom };
    }
  }
};

/** Ranges from an Easter date to a date in the next year that is just out of reach. */
export const easterRangesJustOutOfReach: EntryShape = function* () {
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
};

/** Two-day ranges given by the calendar, on a weekday they never cover. */
export const calendarRangesOffWeekday: EntryShape = function* () {
  for (let validFrom = 1600; ; validFrom++) {
    for (let month = 1; month <= 12; month++) {
      for (let w = 0; w < 7; w++) {
        // The first weekday w of the month, to the weekday w + 1 after its first day: always the next day.
        const from = { type: "nthWeekday", month, weekday: WEEKDAYS[w], n: 1 };
        const to = { type: "weekdayRelative", weekday: WEEKDAYS[(w + 1) % 7], relation: "after", month, day: 1 };
        yield { match: { type: "range", from, to, weekdays: [WEEKDAYS[(w + 3) % 7]] }, validFrom };
      }
    }
  }
};

/** The first `count` entries of `shape`. */
export function takeEntries(shape: EntryShape, count: number): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = [];
  if (count <= 0) return entries;
  for (const entry of shape()) {
    entries.push(entry);
    if (entries.length === count) break;
  }
  return entries;
}

/** As many entries of `shape` as a plan file of 10 MiB - 20,000 bytes holds, at most 50 x 2000. */
export function fillToLimits(shape: EntryShape): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = [];
  let bytes = 0;
  for (const entry of shape()) {
    bytes += JSON.stringify(entry).length + 1;
    if (bytes > 10_485_760 - 20_000 || entries.length === 50 * 2000) break;
    entries.push(entry);
  }
  return entries;
}

/** A plan file with `entries` as info sources of at most 2000 entries each, ids "s0", "s1", ... */
export function entriesPlan(entries: readonly Record<string, unknown>[]): string {
  const sources = Array.from({ length: Math.ceil(entries.length / 2000) }, (_, i) => ({
    id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries: entries.slice(i * 2000, (i + 1) * 2000),
  }));
  return planFile({}, { sources });
}

/**
 * A plan file at the limits, scaled by n <= 2000: n leave days and n notes from 2026-10-01, floor(n / 2) rules,
 * 50 sources x 2 ranges of floor(n / 4) days. limitsPlan(2000) has 50,000 source days, the limit.
 */
export function limitsPlan(n: number): string {
  const rules = Array.from({ length: Math.floor(n / 2) }, (_, i) => ({
    id: `r${String(i)}`, match: { type: "fixed", month: (i % 12) + 1, day: (i % 28) + 1 }, requiredAtMost: "1",
  }));
  // 50 sources x 2 entries x floor(n / 4) days, inside the window of the 36-month period.
  const last = isoFromDay(dayFromIso("2027-01-01") + Math.floor(n / 4) - 1);
  const entries = [0, 1].map(() => ({ match: { type: "range", from: { type: "once", date: "2027-01-01" }, to: { type: "once", date: last } } }));
  const sources = Array.from({ length: 50 }, (_, i) => ({
    id: `s${String(i)}`, name: "S", type: "info", color: { slot: "accent-1" }, visible: true, entries,
  }));
  // n unique dates from 2026-10-01 on: the first ~92 lie before the period and are kept with outsidePeriod.
  // Every 7th leave day is half a day; those with i % 14 === 0 give no `part` (drafted, then suggested inside the period).
  const first = dayFromIso("2026-10-01");
  const days = Array.from({ length: n }, (_, i) => ({
    date: isoFromDay(first + i),
    take: i % 7 === 0 ? "1/2" : "1",
    ...(i % 14 === 7 ? { part: "start" } : {}),
  }));
  const notes = Array.from({ length: n }, (_, i) => ({ date: isoFromDay(first + i), text: "n" }));
  return planFile({ range: { from: "2027-01", to: "2029-12" }, days, notes }, { contract: { ...BAVARIA_CONTRACT, rules }, sources });
}
