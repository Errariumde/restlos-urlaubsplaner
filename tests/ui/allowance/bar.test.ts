// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { barGeometry } from "../../../src/ui/allowance/bar.ts";

describe("barGeometry", () => {
  it("scales to the allowance while planned stays under it", () => {
    expect(barGeometry(14400, 7200)).toEqual({ scale: 14400, plannedShare: 0.5, tickShare: 1, overShare: 0 });
  });

  it("fills the bar exactly at the allowance", () => {
    expect(barGeometry(14400, 14400)).toEqual({ scale: 14400, plannedShare: 1, tickShare: 1, overShare: 0 });
  });

  it("scales to what is planned and shows the overdraft", () => {
    const { scale, plannedShare, tickShare, overShare } = barGeometry(14400, 18000);
    expect(scale).toBe(18000);
    expect(tickShare).toBeCloseTo(0.8);
    expect(plannedShare).toBeCloseTo(0.8);
    expect(overShare).toBeCloseTo(0.2);
  });

  it("does not divide by zero", () => {
    expect(barGeometry(0, 0)).toEqual({ scale: 1, plannedShare: 0, tickShare: 0, overShare: 0 });
  });

  it("handles planned leave without any allowance", () => {
    expect(barGeometry(0, 480)).toEqual({ scale: 480, plannedShare: 0, tickShare: 0, overShare: 1 });
  });
});
