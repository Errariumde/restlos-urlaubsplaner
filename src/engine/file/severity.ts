// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { CheckCode } from "./check";
import type { ReportCode } from "./report";

/** Error: not loaded, lost when saving. Warning: loaded, but changed or probably wrong. Info: loaded unchanged. */
export type Severity = "error" | "warning" | "info";
/** `checkSkipped` is never produced by the engine: the UI adds it when the user skips the check. */
export type Code = ReportCode | CheckCode | "checkSkipped";

/** The fixed severity of every code of reading and checking (docs/file-format.md, Reading). */
export const SEVERITY: Readonly<Record<Code, Severity>> = {
  missingValue: "error",
  invalidValue: "error",
  duplicateDate: "error",
  duplicateId: "error",
  textTooLong: "error",
  sourceTooLarge: "error",
  templateTooLarge: "error",
  unknownReference: "error",
  unknownLocalRule: "error",
  personalSourceInRuleSet: "error",
  unknownField: "error",
  invalidMinUnit: "warning",
  partSuggested: "warning",
  notMultipleOfMinUnit: "warning",
  neverApplies: "warning",
  leapYearLength: "warning",
  mixedRangeEnds: "warning",
  outsidePeriod: "info",
  checkSkipped: "info",
};
