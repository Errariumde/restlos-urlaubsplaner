// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { AnyFile } from "./types";
import type { Positions } from "./positions";

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
  | "outsidePeriod";
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
  | { readonly ok: true; readonly file: AnyFile; readonly report: readonly ReportEntry[]; readonly positions: Positions }
  | { readonly ok: false; readonly refusal: Refusal };

export class Report {
  readonly entries: ReportEntry[] = [];

  add(code: ReportCode, path: string, data?: ReportData): void {
    this.entries.push(data === undefined ? { code, path } : { code, path, data });
  }
}

/** Thrown inside readers, caught only by `readFile`. */
export class Refused extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(`Refused: ${refusal.code}`);
    this.refusal = refusal;
    this.name = "Refused";
  }
}

/** `child("", "contract")` is "contract"; `child("contract", "rules")` is "contract.rules". */
export const child = (path: string, key: string): string => (path === "" ? key : `${path}.${key}`);
/** `at("contract.rules", 2)` is "contract.rules[2]". */
export const at = (path: string, index: number): string => `${path}[${String(index)}]`;

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PROTOTYPE_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

/**
 * True for a key that must not become a key of an object the reader returns: copying or merging such an
 * object naively into another could change a prototype (SPEC, Security).
 */
export const isPrototypeKey = (key: string): boolean => PROTOTYPE_KEYS.includes(key);

/** Reports `unknownField` for every key of `value` that is not allowed. Never looks inside the values. */
export function checkKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[], path: string, report: Report): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) report.add("unknownField", child(path, key));
  }
}
