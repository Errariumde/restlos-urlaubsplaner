// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import type { LeavePiece } from "../../../src/engine/counting/leave.ts";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import type { Part } from "../../../src/engine/counting/types.ts";
import { leaveSwitch, type LeaveSegment } from "../../../src/ui/calendar/leave-switch.ts";

const DAY = 20_000;

interface Stub {
  required?: number;
  inPeriod?: boolean;
  leave?: LeavePiece[];
}

/** A day with just what the switch reads. */
function stub({ required = 480, inPeriod = true, leave = [] }: Stub): DayResult {
  return { day: DAY, inPeriod, required: { value: required, freePart: "end" }, leave } as unknown as DayResult;
}

const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mandatory = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "closure" });
const otherPlan = (from: number, to: number): LeavePiece => ({ kind: "otherPlan", from, to, sourceId: "previous-year" });

const remove = { day: DAY, take: 0 };
const full = { day: DAY, take: 480 };
const morning = { day: DAY, take: 240, part: "start" };
const afternoon = { day: DAY, take: 240, part: "end" };

/** The segments in short: a switch as name, pressed state and change; a locked segment as its kind. */
function short(segments: readonly LeaveSegment[]): unknown[] {
  return segments.map((segment) =>
    segment.kind === "switch" ? [segment.name, segment.pressed, segment.change] : [segment.kind, segment.from, segment.to],
  );
}

describe("leaveSwitch on a working day, in half days", () => {
  it("fills the clicked half from its edge when nothing is set", () => {
    const view = leaveSwitch(stub({}), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "false", morning],
      ["afternoon", "false", afternoon],
    ]);
    expect(view.fullDay).toEqual({ checked: "false", change: full });
    expect(view.amount).toBe(0);
  });

  it("extends a half day with the other half and takes it away with its own", () => {
    const view = leaveSwitch(stub({ leave: [own(240, "start")] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "true", remove],
      ["afternoon", "false", full],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: full });
    expect(view.amount).toBe(240);
    expect(short(leaveSwitch(stub({ leave: [own(240, "end")] }), 240).segments)).toEqual([
      ["morning", "false", full],
      ["afternoon", "true", remove],
    ]);
  });

  it("shrinks a full day from the clicked side, and the checkbox takes it away", () => {
    const view = leaveSwitch(stub({ leave: [own(480)] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "true", afternoon],
      ["afternoon", "true", morning],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
    expect(view.amount).toBe(480);
  });

  it("completes a half that is only partly own leave", () => {
    const view = leaveSwitch(stub({ leave: [own(120, "start")] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "mixed", morning],
      ["afternoon", "false", full],
    ]);
  });

  it("marks where the own leave lies inside each half", () => {
    const [first] = leaveSwitch(stub({ leave: [own(120, "start")] }), 240).segments;
    expect(first?.kind === "switch" ? first.fills : []).toEqual([{ from: 0, to: 120, kind: "own" }]);
  });
});

describe("leaveSwitch in whole days", () => {
  it("has one switch for the whole day and no checkbox", () => {
    expect(short(leaveSwitch(stub({}), 480).segments)).toEqual([["day", "false", full]]);
    expect(short(leaveSwitch(stub({ leave: [own(480)] }), 480).segments)).toEqual([["day", "true", remove]]);
    expect(leaveSwitch(stub({}), 480).fullDay).toBeUndefined();
  });

  it("keeps half days in a plan with a finer unit", () => {
    expect(leaveSwitch(stub({}), 120).segments).toHaveLength(2);
  });
});

describe("leaveSwitch beside mandatory leave and another plan's leave", () => {
  it("locks a day of mandatory leave or another plan's leave as one block, without a checkbox", () => {
    const mandatoryDay = leaveSwitch(stub({ leave: [mandatory(480)] }), 240);
    expect(short(mandatoryDay.segments)).toEqual([["mandatory", 0, 480]]);
    expect(mandatoryDay.fullDay).toBeUndefined();
    expect(mandatoryDay.amount).toBe(480);
    expect(short(leaveSwitch(stub({ leave: [otherPlan(0, 480)] }), 240).segments)).toEqual([["otherPlan", 0, 480]]);
  });

  it("locks only the half that mandatory leave covers, and fills the other half", () => {
    const view = leaveSwitch(stub({ leave: [mandatory(240, "end")] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "false", morning],
      ["mandatory", 240, 480],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: morning });
    const filled = leaveSwitch(stub({ leave: [mandatory(240, "end"), own(240, "start")] }), 240);
    expect(short(filled.segments)).toEqual([
      ["morning", "true", remove],
      ["mandatory", 240, 480],
    ]);
    expect(filled.fullDay).toEqual({ checked: "true", change: remove });
    expect(filled.amount).toBe(480);
  });

  it("locks the half of another plan's leave", () => {
    const view = leaveSwitch(stub({ leave: [otherPlan(240, 480)] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "false", morning],
      ["otherPlan", 240, 480],
    ]);
  });

  it("shows own leave over another plan's leave, so it can be taken away", () => {
    const view = leaveSwitch(stub({ leave: [own(480), otherPlan(0, 480)] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "true", remove],
      ["afternoon", "true", remove],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
  });

  it("fills the free rest of a half partly covered by mandatory leave", () => {
    const view = leaveSwitch(stub({ leave: [mandatory(160, "start")] }), 240);
    const [first] = view.segments;
    expect(first?.kind === "switch" ? [first.pressed, first.fills] : []).toEqual(["false", [{ from: 0, to: 160, kind: "mandatory" }]]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: { day: DAY, take: 320, part: "end" } });
  });

  it("keeps own leave off another plan's leave, and offers no full day where the free time lies on both sides", () => {
    const view = leaveSwitch(stub({ leave: [otherPlan(120, 360)] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "false", { day: DAY, take: 120, part: "start" }],
      ["afternoon", "false", { day: DAY, take: 120, part: "end" }],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed" });
  });
});

describe("leaveSwitch where no leave can be set", () => {
  it("only takes own leave away on a day without required work", () => {
    const view = leaveSwitch(stub({ required: 0, leave: [own(480)] }), 240);
    expect(short(view.segments)).toEqual([
      ["morning", "true", remove],
      ["afternoon", "true", remove],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
    const empty = leaveSwitch(stub({ required: 0, leave: [own(240, "start")] }), 240);
    expect(short(empty.segments)).toEqual([
      ["morning", "true", remove],
      ["afternoon", "false", undefined],
    ]);
    expect(empty.fullDay).toEqual({ checked: "mixed", change: remove });
  });

  it("offers nothing outside the plan period but taking own leave away", () => {
    expect(short(leaveSwitch(stub({ inPeriod: false }), 240).segments)).toEqual([
      ["morning", "false", undefined],
      ["afternoon", "false", undefined],
    ]);
    expect(leaveSwitch(stub({ inPeriod: false }), 240).fullDay).toEqual({ checked: "false" });
    expect(leaveSwitch(stub({ inPeriod: false, leave: [own(480)] }), 240).fullDay).toEqual({ checked: "true", change: remove });
  });
});
