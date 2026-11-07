// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { belowRem } from "../../../src/ui/state/width";

describe("belowRem", () => {
  it("compares a width in px with a limit in rem at the default text size", () => {
    expect(belowRem(519, 32.5, 16)).toBe(true);
    expect(belowRem(520, 32.5, 16)).toBe(false);
  });

  it("moves the limit with a larger text size", () => {
    // At a root font size of 20 px, 32.5rem is 650 px.
    expect(belowRem(600, 32.5, 20)).toBe(true);
    expect(belowRem(650, 32.5, 20)).toBe(false);
  });
});
