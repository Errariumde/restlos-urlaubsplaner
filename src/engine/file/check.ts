// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { dayRuleWarningsMemo, type RuleWarningCode } from "../counting/warnings";
import { textPath, type Positions } from "./positions";
import type { AnyFile } from "./types";

export type CheckCode = RuleWarningCode;

export interface CheckEntry {
  readonly code: CheckCode;
  /** "contract.rules[i]" or "sources[i].entries[j]": positions in the text that was read. */
  readonly path: string;
}

/** Called with (0, total) before the first rule, then after each rule; the last call is (total, total). */
export type CheckProgress = (done: number, total: number) => void;

/** The N of "rule n of N": day rules plus match entries of all sources. */
export function checkCount(file: AnyFile): number {
  let count = file.contract.rules.length;
  for (const source of file.sources) {
    for (const entry of source.entries) if ("match" in entry) count++;
  }
  return count;
}

/** Hints for a loaded file: contract rules in order, then each source's match entries in loaded order. */
export function checkRules(file: AnyFile, positions: Positions, onProgress?: CheckProgress): CheckEntry[] {
  const total = checkCount(file);
  const warnings = dayRuleWarningsMemo(); // rules and entries with the same match and validity are checked once
  const entries: CheckEntry[] = [];
  let done = 0;
  onProgress?.(0, total);
  const step = (): void => onProgress?.(++done, total);

  file.contract.rules.forEach((rule, i) => {
    const path = textPath(positions, `contract.rules[${String(i)}]`);
    for (const warning of warnings(rule)) entries.push({ code: warning.code, path });
    step();
  });
  file.sources.forEach((source, i) => {
    source.entries.forEach((entry, j) => {
      if (!("match" in entry)) return;
      const rule = {
        id: source.id,
        match: entry.match,
        ...(entry.validFrom !== undefined ? { validFrom: entry.validFrom } : {}),
        ...(entry.validUntil !== undefined ? { validUntil: entry.validUntil } : {}),
        requiredAtMost: 0,
      };
      const path = textPath(positions, `sources[${String(i)}].entries[${String(j)}]`);
      for (const warning of warnings(rule)) entries.push({ code: warning.code, path });
      step();
    });
  });
  return entries;
}
