// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Problem } from "../../../src/engine/counting/plan.ts";
import { problemsByDay, problemText } from "../../../src/ui/calendar/problems.ts";

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

describe("problemText", () => {
  const catalog = (locale: "de" | "en") => {
    const entries = JSON.parse(readFileSync(`src/ui/i18n/${locale}.json`, "utf8")) as Record<string, string>;
    return (key: string) => entries[key] ?? key;
  };
  it("says that leave lies on time that is off anyway", () => {
    expect(problemText("leaveOnFreeTime", catalog("de"))).toBe("Dieser Urlaub liegt auf ohnehin freier Zeit.");
    expect(problemText("leaveOnFreeTime", catalog("en"))).toBe("This leave lies on time that is off anyway.");
  });
});
