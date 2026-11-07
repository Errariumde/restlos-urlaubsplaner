// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days";
import { initialFocusDay } from "../../../src/ui/state/today";

const year2027 = { from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } };
const winter = { from: { year: 2026, month: 10 }, to: { year: 2027, month: 3 } };

describe("initialFocusDay", () => {
  it("is the given day when it lies in the period", () => {
    expect(initialFocusDay(year2027, dayFromYmd(2027, 5, 7))).toBe(dayFromYmd(2027, 5, 7));
    expect(initialFocusDay(year2027, dayFromYmd(2027, 1, 1))).toBe(dayFromYmd(2027, 1, 1));
    expect(initialFocusDay(year2027, dayFromYmd(2027, 12, 31))).toBe(dayFromYmd(2027, 12, 31));
    expect(initialFocusDay(winter, dayFromYmd(2027, 3, 31))).toBe(dayFromYmd(2027, 3, 31));
  });

  it("is the period's first day otherwise", () => {
    expect(initialFocusDay(year2027, dayFromYmd(2026, 12, 31))).toBe(dayFromYmd(2027, 1, 1));
    expect(initialFocusDay(year2027, dayFromYmd(2028, 1, 1))).toBe(dayFromYmd(2027, 1, 1));
    expect(initialFocusDay(winter, dayFromYmd(2027, 4, 1))).toBe(dayFromYmd(2026, 10, 1));
  });
});
