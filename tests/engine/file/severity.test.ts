// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../src/engine/file/report";
import { SEVERITY } from "../../../src/engine/file/severity";

describe("SEVERITY", () => {
  it("gives every code the severity the spec fixes", () =>
    expect(SEVERITY).toEqual({
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
    }));
  it("makes exactly the Error codes of the report errors", () =>
    expect(Object.keys(SEVERITY).filter((code) => SEVERITY[code as keyof typeof SEVERITY] === "error").sort()).toEqual([...ERROR_CODES].sort()));
});
