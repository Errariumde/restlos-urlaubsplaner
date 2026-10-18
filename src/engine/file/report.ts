// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { AnyFile } from "./types";

export type RefusalCode =
  | "notJson"
  | "tooLarge"
  | "limitExceeded"
  | "unknownSchema"
  | "newerSchema"
  | "unknownKind"
  | "settingsNotSupported"
  | "kindMismatch"
  | "invalidCore";
export type ReportCode =
  | "unknownField"
  | "invalidEntry"
  | "duplicateDate"
  | "duplicateId"
  | "unknownReference"
  | "textTooLong"
  | "sourceTooLarge"
  | "templateTooLarge"
  | "unknownLocalRule"
  | "personalSourceInRuleSet"
  | "invalidMinUnit"
  | "notMultipleOfMinUnit"
  | "partSuggested"
  | "outsidePeriod"
  | "ruleWarning";
export type ReportData = Readonly<Record<string, string | number>>;
export interface ReportEntry {
  readonly code: ReportCode;
  readonly path: string;
  readonly data?: ReportData;
}
export interface Refusal {
  readonly code: RefusalCode;
  readonly path?: string;
  readonly data?: ReportData;
}
export type ReadResult =
  | { readonly ok: true; readonly file: AnyFile; readonly report: readonly ReportEntry[] }
  | { readonly ok: false; readonly refusal: Refusal };

export class Report {
  readonly entries: ReportEntry[] = [];

  add(code: ReportCode, path: string, data?: ReportData): void {
    this.entries.push(data === undefined ? { code, path } : { code, path, data });
  }
}

/** Thrown inside readers, caught only by `readFile`. */
export class Refused extends Error {
  constructor(readonly refusal: Refusal) {
    super(`Refused: ${refusal.code}`);
    this.name = "Refused";
  }
}

/** `child("", "contract")` is "contract"; `child("contract", "rules")` is "contract.rules". */
export const child = (path: string, key: string): string => (path === "" ? key : `${path}.${key}`);
/** `at("contract.rules", 2)` is "contract.rules[2]". */
export const at = (path: string, index: number): string => `${path}[${String(index)}]`;

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reports `unknownField` for every key of `value` that is not allowed. Never looks inside the values. */
export function checkKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[], path: string, report: Report): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) report.add("unknownField", child(path, key));
  }
}
