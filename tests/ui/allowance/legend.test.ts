// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legendOf } from "../../../src/ui/allowance/legend.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";

const EXAMPLE = "examples/plans/beispiel-gmbh-2027.urlaub.json";

type ExampleFile = Record<string, unknown> & {
  contract: { rules: Record<string, unknown>[] };
  plan: Record<string, unknown>;
  sources: Record<string, unknown>[];
};

/** The example plan, changed by `edit` before it is opened. */
function openExample(edit: (file: ExampleFile) => void = () => {}): PlanState {
  const file = JSON.parse(readFileSync(EXAMPLE, "utf8")) as ExampleFile;
  edit(file);
  return new Session().open(JSON.stringify(file), true) as PlanState;
}

describe("legendOf", () => {
  it("shows what the example's period has, in a fixed order, and its calendars in the order of the sources", () => {
    const { meta, result } = openExample();
    const legend = legendOf(result, meta);
    // Mandatory leave from the company closure (27 to 30 December), half working days on 24 and 31 December.
    expect(legend.marks).toEqual(["leave", "mandatory", "otherPlan", "weekend", "holiday", "halfRequired"]);
    expect(legend.calendars.map(({ source, accent, style }) => [source.id, accent, style])).toEqual([
      ["project", 2, "solid"],
      ["previous-year", 3, "dashed"],
    ]);
  });

  it("adds a day off and the problem mark where they occur", () => {
    const { meta, result } = openExample((file) => {
      file.sources.push({ id: "closure", name: "Closure", type: "paidClosure", color: { slot: "accent-5" }, entries: [{ date: "2027-03-03" }] });
      file.plan.days = [{ date: "2027-02-13", take: "1" }];
    });
    expect(legendOf(result, meta).marks).toEqual(["leave", "mandatory", "otherPlan", "weekend", "holiday", "halfRequired", "free", "problem"]);
  });

  it("leaves out mandatory leave when no day has any", () => {
    const { meta, result } = openExample((file) => {
      file.contract.rules = file.contract.rules.filter((rule) => rule.id !== "company-closure");
    });
    expect(legendOf(result, meta).marks).toEqual(["leave", "otherPlan", "weekend", "holiday", "halfRequired"]);
  });

  it("leaves out leave and problems outside the plan period, which the calendar doesn't show", () => {
    const { meta, result } = openExample((file) => {
      file.plan.days = [{ date: "2028-01-03", take: "1" }];
    });
    expect(result.problems.map((problem) => problem.code)).toEqual(["leaveOutsidePeriod"]);
    const { marks } = legendOf(result, meta);
    expect(marks).not.toContain("leave");
    expect(marks).not.toContain("problem");
  });

  it("leaves out hidden calendars and calendars without a day in the period", () => {
    const { meta, result } = openExample((file) => {
      const project = file.sources.find((source) => source.id === "project");
      if (project) project.visible = false;
      file.sources.push({ id: "later", name: "Later", type: "info", color: { slot: "accent-6" }, entries: [{ date: "2028-03-01" }] });
    });
    expect(legendOf(result, meta).calendars.map(({ source }) => source.id)).toEqual(["previous-year"]);
  });
});
