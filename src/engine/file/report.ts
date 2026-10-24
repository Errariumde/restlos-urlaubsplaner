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
/** Codes of what is not loaded; every such report entry says in `dropped` what. */
export const ERROR_CODES = [
  "unknownField", "missingValue", "invalidValue", "duplicateDate", "duplicateId", "unknownReference",
  "textTooLong", "sourceTooLarge", "templateTooLarge", "unknownLocalRule", "personalSourceInRuleSet",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
/** Codes of what is loaded, changed (Warning) or unchanged (Info). */
export type NoticeCode = "invalidMinUnit" | "notMultipleOfMinUnit" | "partSuggested" | "outsidePeriod";
export type ReportCode = ErrorCode | NoticeCode;
export type ReportData = Readonly<Record<string, string | number | readonly string[]>>;
export interface ReportEntry {
  readonly code: ReportCode;
  /** The key itself, in the text that was read; an empty key is written `""`. */
  readonly path: string;
  /** Set on every Error: the path of what is not loaded because of it; "" is the whole file. */
  readonly dropped?: string;
  readonly data?: ReportData;
}
/** Why a file is not loaded. `invalidCore` has no `path`: its report says where. */
export interface Refusal {
  readonly code: RefusalCode;
  readonly path?: string;
  readonly data?: ReportData;
}
/**
 * Loaded: the file, its report and `positions`. Refused: a stop with an empty report, or `invalidCore` with
 * every Error reading found, in reading order.
 */
export type ReadResult =
  | { readonly ok: true; readonly file: AnyFile; readonly report: readonly ReportEntry[]; readonly positions: Positions }
  | { readonly ok: false; readonly refusal: Refusal; readonly report: readonly ReportEntry[] };

const ERRORS: ReadonlySet<ReportCode> = new Set<ReportCode>(ERROR_CODES);

export class Report {
  readonly entries: ReportEntry[] = [];

  error(code: ErrorCode, path: string, dropped: string, data?: ReportData): void {
    this.entries.push(data === undefined ? { code, path, dropped } : { code, path, dropped, data });
  }

  notice(code: NoticeCode, path: string, data?: ReportData): void {
    this.entries.push(data === undefined ? { code, path } : { code, path, data });
  }

  /**
   * True when an Error was added whose `dropped` is exactly `path`. Linear in the report, so it is called once
   * per list entry, on that entry's scratch report.
   */
  drops(path: string): boolean {
    return this.entries.some((entry) => entry.dropped === path);
  }

  /** Appends `part`'s entries: all of them when `kept`, only its Errors otherwise. */
  merge(part: Report, kept: boolean): void {
    for (const entry of part.entries) {
      if (kept || ERRORS.has(entry.code)) this.entries.push(entry);
    }
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

/**
 * `child("", "contract")` is "contract"; `child("contract", "rules")` is "contract.rules". An empty key is
 * written `""` (two double quotes): `child("contract", "")` is `contract.""`, and a path is never "", which is
 * the whole file.
 */
export const child = (path: string, key: string): string => {
  const name = key === "" ? '""' : key;
  return path === "" ? name : `${path}.${name}`;
};
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
    if (!allowed.includes(key)) report.error("unknownField", child(path, key), child(path, key));
  }
}

/** Turns a value of a file into a value of the model; undefined when the value is invalid. */
export type Parse<T> = (value: unknown) => T | undefined;

/**
 * The optional `key` of `object` read by `parse`: undefined when it is absent, and also when it is invalid,
 * which is reported as `invalidValue` at the key.
 */
export function readOptional<T>(object: Readonly<Record<string, unknown>>, key: string, parse: Parse<T>, path: string, report: Report, dropped: string): T | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  const parsed = parse(value);
  if (parsed === undefined) report.error("invalidValue", child(path, key), dropped);
  return parsed;
}

/** The required `key` of `object` read by `parse`: like `readOptional`, and an absent key is reported as `missingValue`. */
export function readRequired<T>(object: Readonly<Record<string, unknown>>, key: string, parse: Parse<T>, path: string, report: Report, dropped: string): T | undefined {
  if (object[key] === undefined) {
    report.error("missingValue", child(path, key), dropped);
    return undefined;
  }
  return readOptional(object, key, parse, path, report, dropped);
}

/**
 * The one key of `keys` that `object` has. When it has none (`missingValue`) or several (`invalidValue`), that is
 * reported at the object itself with `data.oneOf`, and the result is undefined.
 */
export function readChoice<K extends string>(object: Readonly<Record<string, unknown>>, keys: readonly K[], path: string, report: Report, dropped: string): K | undefined {
  const present = keys.filter((key) => object[key] !== undefined);
  if (present.length === 1) return present[0];
  report.error(present.length === 0 ? "missingValue" : "invalidValue", path, dropped, { oneOf: keys });
  return undefined;
}
