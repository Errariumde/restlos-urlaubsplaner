// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import type { Problem } from "../../../src/engine/counting/plan.ts";
import { problemsByDay } from "../../../src/ui/calendar/problems.ts";

describe("problemsByDay", () => {
  it("groups the problems' codes by day, in the result's order", () => {
    const problems: Problem[] = [
      { code: "leaveWithoutRequiredWork", day: 10 },
      { code: "leaveTakenInOtherPlan", day: 10, sourceIds: ["previous-year"] },
      { code: "uncoveredNeed", day: 12, sourceIds: ["kita"] },
    ];
    const byDay = problemsByDay(problems);
    expect(byDay.get(10)).toEqual(["leaveWithoutRequiredWork", "leaveTakenInOtherPlan"]);
    expect(byDay.get(12)).toEqual(["uncoveredNeed"]);
    expect(byDay.get(11)).toBeUndefined();
  });

  it("is empty without problems", () => {
    expect(problemsByDay([]).size).toBe(0);
  });
});
