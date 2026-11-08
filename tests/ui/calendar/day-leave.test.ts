// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { evaluateLeave, type LeavePiece } from "../../../src/engine/counting/leave.ts";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import type { Part } from "../../../src/engine/counting/types.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { areaStop, dayLeave, maskStops, workStops } from "../../../src/ui/calendar/day-leave.ts";

const friday = dayFromYmd(2027, 5, 7);
const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mand = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "m" });
const other = (from: number, to: number): LeavePiece => ({ kind: "otherPlan", from, to, sourceId: "o" });

/** A day result with the engine's own evaluation of its leave. */
function day(leave: LeavePiece[], { required = 480, freePart = "end", inPeriod = true }: { required?: number; freePart?: Part; inPeriod?: boolean } = {}): DayResult {
  return {
    day: friday,
    inPeriod,
    facts: { day: friday, holidays: [], sources: [] },
    required: { value: required, freePart },
    leave,
    evaluation: evaluateLeave({ value: required, freePart }, leave, inPeriod),
  } as unknown as DayResult;
}

describe("dayLeave", () => {
  it("fills a day without leave with nothing", () => {
    expect(dayLeave(day([]))).toEqual({ fill: "none", shares: [], otherPlan: false });
  });

  it("fills the cell when own leave covers all the work", () => {
    expect(dayLeave(day([own(480)])).fill).toBe("full");
    // A half working day whose work lies in the morning: half a day of leave there leaves no work.
    expect(dayLeave(day([own(240, "start")], { required: 240 })).fill).toBe("full");
    // Leave on a day without work lies nowhere, but there is nothing left to work either.
    expect(dayLeave(day([own(480)], { required: 0 })).fill).toBe("full");
  });

  it("fills the cell with mandatory leave that covers all the work", () => {
    expect(dayLeave(day([mand(480)])).fill).toBe("mandatory");
    expect(dayLeave(day([mand(480)], { required: 0 })).fill).toBe("mandatory");
  });

  it("gives each share its amount and where it lies", () => {
    expect(dayLeave(day([own(240)]))).toEqual({
      fill: "part",
      shares: [{ kind: "own", units: 240, where: "afternoon", spans: [{ from: 240, to: 480 }] }],
      otherPlan: false,
    });
    expect(dayLeave(day([own(240, "start")])).shares[0]?.where).toBe("morning");
    expect(dayLeave(day([own(120, "start")])).shares).toEqual([{ kind: "own", units: 120, where: "start", spans: [{ from: 0, to: 120 }] }]);
    expect(dayLeave(day([own(360)])).shares).toEqual([{ kind: "own", units: 360, where: "end", spans: [{ from: 120, to: 480 }] }]);
    // Own leave beside two pieces of mandatory leave lies in the middle.
    const middle = day([own(480), mand(120, "start"), { kind: "mandatory", take: 120, part: "end", ruleId: "n" }]);
    expect(dayLeave(middle).shares.map((share) => [share.kind, share.units, share.where])).toEqual([
      ["own", 240, "middle"],
      ["mandatory", 240, "spread"],
    ]);
  });

  it("shows own and mandatory leave side by side, own leave only where no mandatory leave lies", () => {
    // A full day of own leave and an afternoon of mandatory leave: the own leave counts only in the morning.
    expect(dayLeave(day([own(480), mand(240)]))).toEqual({
      fill: "part",
      shares: [
        { kind: "own", units: 240, where: "morning", spans: [{ from: 0, to: 240 }] },
        { kind: "mandatory", units: 240, where: "afternoon", spans: [{ from: 240, to: 480 }] },
      ],
      otherPlan: false,
    });
    expect(dayLeave(day([mand(240)])).shares).toEqual([{ kind: "mandatory", units: 240, where: "afternoon", spans: [{ from: 240, to: 480 }] }]);
  });

  it("keeps another plan's leave to the border", () => {
    expect(dayLeave(day([other(0, 480)]))).toEqual({ fill: "none", shares: [], otherPlan: true });
    const shared = dayLeave(day([own(240, "start"), other(240, 480)]));
    expect(shared.fill).toBe("part");
    expect(shared.shares.map((share) => share.where)).toEqual(["morning"]);
    expect(shared.otherPlan).toBe(true);
  });

  it("shows leave outside the plan period where it lies, although it costs nothing there", () => {
    expect(dayLeave(day([own(120, "start")], { inPeriod: false })).shares[0]).toMatchObject({ units: 120, where: "start" });
  });
});

describe("areaStop", () => {
  it("puts the diagonal so that the area before it is the share", () => {
    expect(areaStop(0)).toBe(0);
    expect(areaStop(0.5)).toBe(0.5);
    expect(areaStop(1)).toBe(1);
    expect(areaStop(0.125)).toBeCloseTo(0.25);
    expect(areaStop(0.875)).toBeCloseTo(0.75);
  });
});

describe("maskStops", () => {
  it("lets the spans through and hides the rest, along the diagonal", () => {
    expect(maskStops([{ from: 0, to: 240 }])).toBe("transparent 0% 0%, currentColor 0% 50%, transparent 50% 100%");
    expect(maskStops([{ from: 240, to: 480 }])).toBe("transparent 0% 50%, currentColor 50% 100%, transparent 100% 100%");
    expect(maskStops([{ from: 0, to: 60 }])).toBe("transparent 0% 0%, currentColor 0% 25%, transparent 25% 100%");
  });
});

describe("workStops", () => {
  it("places the work block of a partly free day on the diagonal", () => {
    expect(workStops({ value: 240, freePart: "end" })).toEqual({ from: "0%", to: "50%" });
    expect(workStops({ value: 240, freePart: "start" })).toEqual({ from: "50%", to: "100%" });
    // Three quarters of the area lie before 64.64 % of the diagonal.
    expect(workStops({ value: 360, freePart: "end" })).toEqual({ from: "0%", to: "64.64%" });
  });
});
