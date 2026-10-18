// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { isoFromDay } from "../../src/engine/days";
import type { Holiday } from "../../src/engine/holidays/types";

export interface ReferenceHoliday {
  date: string; // ISO date
  name: string; // the reference's own name
}

export interface Difference {
  variant: string;
  date: string;
  kind: "onlyRestlos" | "onlyReference";
  label: string;
}

export interface KnownDifference {
  reference: "date-holidays" | "python-holidays";
  variants: readonly string[] | "all";
  kind: Difference["kind"];
  label: string; // our ruleId (onlyRestlos) or the reference's name (onlyReference), exact
  years?: readonly [number, number]; // inclusive; omitted = all years
  correct: "restlos" | "reference";
  reason: string;
  source: string; // URL of the official source that settles it
}

const KIND_ORDER: Record<Difference["kind"], number> = { onlyRestlos: 0, onlyReference: 1 };

export function diffHolidays(variant: string, ours: readonly Holiday[], reference: readonly ReferenceHoliday[]): Difference[] {
  const oursByDate = new Map<string, Set<string>>();
  for (const holiday of ours) {
    const iso = isoFromDay(holiday.day);
    oursByDate.set(iso, (oursByDate.get(iso) ?? new Set()).add(holiday.ruleId));
  }
  const referenceByDate = new Map<string, Set<string>>();
  for (const holiday of reference) {
    referenceByDate.set(holiday.date, (referenceByDate.get(holiday.date) ?? new Set()).add(holiday.name));
  }

  const result: Difference[] = [];
  for (const [date, labels] of oursByDate) {
    if (!referenceByDate.has(date)) for (const label of labels) result.push({ variant, date, kind: "onlyRestlos", label });
  }
  for (const [date, labels] of referenceByDate) {
    if (!oursByDate.has(date)) for (const label of labels) result.push({ variant, date, kind: "onlyReference", label });
  }
  return result.sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
  );
}

function matches(entry: KnownDifference, diff: Difference): boolean {
  if (entry.variants !== "all" && !entry.variants.includes(diff.variant)) return false;
  if (entry.kind !== diff.kind || entry.label !== diff.label) return false;
  if (entry.years !== undefined) {
    const year = Number(diff.date.slice(0, 4));
    if (year < entry.years[0] || year > entry.years[1]) return false;
  }
  return true;
}

export function explain(
  reference: KnownDifference["reference"],
  diffs: readonly Difference[],
  known: readonly KnownDifference[],
): { unexplained: Difference[]; unused: KnownDifference[] } {
  const entries = known.filter((entry) => entry.reference === reference);
  const used = new Set<KnownDifference>();
  const unexplained = diffs.filter((diff) => {
    const found = entries.filter((entry) => matches(entry, diff));
    for (const entry of found) used.add(entry);
    return found.length === 0;
  });
  return { unexplained, unused: entries.filter((entry) => !used.has(entry)) };
}

/** One variant compared with a reference: the holiday counts on both sides and the differences. */
export interface Comparison {
  ours: number;
  theirs: number;
  diffs: Difference[];
}

/** The comparison of a variant; throws when the variant was never compared. */
export function comparisonOf(results: ReadonlyMap<string, Comparison>, variant: string): Comparison {
  const result = results.get(variant);
  if (result === undefined) throw new Error(`variant ${variant} was not compared`);
  return result;
}
