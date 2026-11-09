// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import type { LeavePiece } from "../../../src/engine/counting/leave.ts";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import type { Part } from "../../../src/engine/counting/types.ts";
import { leaveSwitch, partCount, reach, withOwnLeave, type LeaveSegment, type PartName } from "../../../src/ui/calendar/leave-switch.ts";

const DAY = 20_000;

interface Stub {
  required?: number;
  freePart?: Part;
  inPeriod?: boolean;
  leave?: LeavePiece[];
}

/** A day with just what the switch reads. */
function stub({ required = 480, freePart = "end", inPeriod = true, leave = [] }: Stub): DayResult {
  return { day: DAY, inPeriod, required: { value: required, freePart }, leave } as unknown as DayResult;
}

/** 24 December: half a day of work in the morning, the afternoon free. */
const christmasEve = (leave: LeavePiece[] = []): DayResult => stub({ required: 240, leave });

const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
const mandatory = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "closure" });
const otherPlan = (from: number, to: number): LeavePiece => ({ kind: "otherPlan", from, to, sourceId: "previous-year" });

const remove = { day: DAY, take: 0 };
const full = { day: DAY, take: 480 };
const morning = { day: DAY, take: 240, part: "start" };
const afternoon = { day: DAY, take: 240, part: "end" };

const WHOLE: PartName = { kind: "day" };
const MORNING: PartName = { kind: "half", half: "morning" };
const AFTERNOON: PartName = { kind: "half", half: "afternoon" };
const part = (index: number, count: number): PartName => ({ kind: "part", index, count });

/** The segments in short: a switch as name, pressed state and change; a fixed block as its kind and span. */
function short(segments: readonly LeaveSegment[]): unknown[] {
  return segments.map((segment) =>
    segment.kind === "switch" ? [segment.name, segment.pressed, segment.change] : [segment.kind, segment.from, segment.to],
  );
}

/** Where the segments lie: their kind and drawn span. */
const spans = (segments: readonly LeaveSegment[]): unknown[] => segments.map((segment) => [segment.kind, segment.from, segment.to]);

describe("partCount", () => {
  it("splits the day into the plan's unit, at most into 32 parts", () => {
    expect([480, 240, 120, 30, 160, 10, 1].map(partCount)).toEqual([1, 2, 4, 16, 3, 24, 32]);
  });
});

describe("leaveSwitch on a working day, in half days", () => {
  it("fills the clicked half from its edge when nothing is set", () => {
    const view = leaveSwitch(stub({}), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", morning],
      [AFTERNOON, "false", afternoon],
    ]);
    expect(view.fullDay).toEqual({ checked: "false", change: full });
    expect(view.amount).toBe(0);
    expect(view.parts).toBe(2);
  });

  it("extends a half day with the other half and takes it away with its own", () => {
    const view = leaveSwitch(stub({ leave: [own(240, "start")] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", remove],
      [AFTERNOON, "false", full],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: full });
    expect(view.amount).toBe(240);
    expect(short(leaveSwitch(stub({ leave: [own(240, "end")] }), 240).segments)).toEqual([
      [MORNING, "false", full],
      [AFTERNOON, "true", remove],
    ]);
  });

  it("shrinks a full day from the clicked side, and the checkbox takes it away", () => {
    const view = leaveSwitch(stub({ leave: [own(480)] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", afternoon],
      [AFTERNOON, "true", morning],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
    expect(view.amount).toBe(480);
  });

  it("completes a half that is only partly own leave", () => {
    const view = leaveSwitch(stub({ leave: [own(120, "start")] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "mixed", morning],
      [AFTERNOON, "false", full],
    ]);
  });

  it("marks where the own leave lies inside each half", () => {
    const [first] = leaveSwitch(stub({ leave: [own(120, "start")] }), 240).segments;
    expect(first?.kind === "switch" ? first.fills : []).toEqual([{ from: 0, to: 120, kind: "own" }]);
  });
});

describe("leaveSwitch on a day with time without work", () => {
  it("shows the free afternoon of 24 December as a fixed block", () => {
    const view = leaveSwitch(christmasEve(), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", morning],
      ["free", 240, 480],
    ]);
    expect(view.segments[1]).toMatchObject({ first: AFTERNOON, last: AFTERNOON });
    expect(view.fullDay).toEqual({ checked: "false", change: full });
  });

  it("ticks Ganzer Tag after H on 24 December", () => {
    const view = leaveSwitch(christmasEve([own(240, "start")]), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", remove],
      ["free", 240, 480],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
  });

  it("keeps the free afternoon fixed under a full day", () => {
    const view = leaveSwitch(christmasEve([own(480)]), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", remove],
      ["free", 240, 480],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
  });

  it("makes the free afternoon a switch for leave lying only there", () => {
    // Own leave on time without work, from a file, or a booked afternoon that a later work-week entry made free:
    // the part becomes a pressed switch, so that a click takes the leave away.
    const view = leaveSwitch(christmasEve([own(240, "end")]), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", full],
      [AFTERNOON, "true", remove],
    ]);
    expect(spans(view.segments)).toEqual([
      ["switch", 0, 240],
      ["switch", 240, 480],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: full });
  });

  it("makes only the parts that leave on free time covers switches", () => {
    // A quarter of own leave at the end of 24 December, in quarters: the third quarter stays free, and a press on
    // the work extends the leave from the end of the day.
    const view = leaveSwitch(christmasEve([own(120, "end")]), 120);
    expect(short(view.segments)).toEqual([
      [part(1, 4), "false", full],
      [part(2, 4), "false", { day: DAY, take: 360, part: "end" }],
      ["free", 240, 360],
      [part(4, 4), "true", remove],
    ]);
  });

  it("cuts the afternoon of a ¾ day to its work", () => {
    const view = leaveSwitch(stub({ required: 360 }), 240);
    expect(spans(view.segments)).toEqual([
      ["switch", 0, 240],
      ["switch", 240, 360],
      ["free", 360, 480],
    ]);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", morning],
      [AFTERNOON, "false", afternoon],
      ["free", 360, 480],
    ]);
    // Own leave on the afternoon's work presses its switch.
    const booked = leaveSwitch(stub({ required: 360, leave: [own(240, "end")] }), 240);
    expect(short(booked.segments)).toEqual([
      [MORNING, "false", full],
      [AFTERNOON, "true", remove],
      ["free", 360, 480],
    ]);
  });

  it("puts the switch of a day free in the morning over its afternoon", () => {
    const view = leaveSwitch(stub({ required: 240, freePart: "start" }), 240);
    expect(short(view.segments)).toEqual([
      ["free", 0, 240],
      [AFTERNOON, "false", afternoon],
    ]);
    // A ¾ day free in the morning: the morning switch is drawn over its last quarter only.
    expect(spans(leaveSwitch(stub({ required: 360, freePart: "start" }), 240).segments)).toEqual([
      ["free", 0, 120],
      ["switch", 120, 240],
      ["switch", 240, 480],
    ]);
  });

  it("takes own leave away instead of moving it onto free time", () => {
    // Free in the morning, a full day of own leave: shrinking it from the afternoon would leave it on the free
    // morning only, so the afternoon's switch takes it away.
    const view = leaveSwitch(stub({ required: 240, freePart: "start", leave: [own(480)] }), 240);
    expect(short(view.segments)).toEqual([
      ["free", 0, 240],
      [AFTERNOON, "true", remove],
    ]);
  });

  it("shows mandatory leave on free time as its block", () => {
    const view = leaveSwitch(stub({ required: 240, leave: [mandatory(480)] }), 240);
    expect(short(view.segments)).toEqual([["mandatory", 0, 480]]);
    expect(view.fullDay).toBeUndefined();
    // Mandatory leave on the free rest of a part with work.
    expect(short(leaveSwitch(stub({ required: 360, leave: [mandatory(120)] }), 240).segments)).toEqual([
      [MORNING, "false", morning],
      [AFTERNOON, "false", afternoon],
      ["mandatory", 360, 480],
    ]);
  });
});

describe("leaveSwitch in parts of the plan's unit", () => {
  it("has one switch for the whole day and no checkbox in whole days", () => {
    expect(short(leaveSwitch(stub({}), 480).segments)).toEqual([[WHOLE, "false", full]]);
    expect(short(leaveSwitch(stub({ leave: [own(480)] }), 480).segments)).toEqual([[WHOLE, "true", remove]]);
    expect(leaveSwitch(stub({}), 480).fullDay).toBeUndefined();
    expect(leaveSwitch(stub({}), 480).parts).toBe(1);
  });

  it("splits the day into quarters", () => {
    const view = leaveSwitch(stub({}), 120);
    expect(view.parts).toBe(4);
    expect(short(view.segments)).toEqual([
      [part(1, 4), "false", { day: DAY, take: 120, part: "start" }],
      [part(2, 4), "false", morning],
      [part(3, 4), "false", afternoon],
      [part(4, 4), "false", { day: DAY, take: 120, part: "end" }],
    ]);
    expect(view.fullDay).toEqual({ checked: "false", change: full });
  });

  it("splits the day into thirds", () => {
    const view = leaveSwitch(stub({}), 160);
    expect(view.parts).toBe(3);
    expect(short(view.segments)).toEqual([
      [part(1, 3), "false", { day: DAY, take: 160, part: "start" }],
      [part(2, 3), "false", { day: DAY, take: 320, part: "start" }],
      [part(3, 3), "false", { day: DAY, take: 160, part: "end" }],
    ]);
    expect(view.fullDay).toEqual({ checked: "false", change: full });
  });

  it("merges the free parts of 24 December in sixteenths", () => {
    const view = leaveSwitch(christmasEve(), 30);
    expect(view.parts).toBe(16);
    const switches = view.segments.filter((segment) => segment.kind === "switch");
    expect(switches.map((segment) => segment.name)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((index) => part(index, 16)));
    expect(view.segments.slice(8)).toEqual([{ kind: "free", from: 240, to: 480, first: part(9, 16), last: part(16, 16) }]);
  });

  it("extends and shrinks own leave part by part", () => {
    // Own leave over the last four sixteenths: a press on the 9th extends it to there, one on the 13th shrinks it.
    const view = leaveSwitch(stub({ leave: [own(120)] }), 30);
    const at = (index: number): unknown => (view.segments[index]?.kind === "switch" ? view.segments[index].change : undefined);
    expect(at(8)).toEqual({ day: DAY, take: 240, part: "end" });
    expect(at(12)).toEqual({ day: DAY, take: 90, part: "end" });
    expect(at(15)).toEqual(remove);
    expect(at(0)).toEqual(full);
  });

  it("makes switches of free parts only for leave that lies only on free time", () => {
    // Own leave over the last six sixteenths of 24 December lies only on free time: its parts are switches that
    // take it away, the two free parts before them stay one fixed block.
    const onFree = leaveSwitch(christmasEve([own(180)]), 30);
    const switches = onFree.segments.filter((segment) => segment.kind === "switch");
    expect(switches).toHaveLength(14);
    expect(switches.slice(8).map((segment) => [segment.pressed, segment.change])).toEqual(Array.from({ length: 6 }, () => ["true", remove]));
    expect(onFree.segments[8]).toEqual({ kind: "free", from: 240, to: 300, first: part(9, 16), last: part(10, 16) });
    // Own leave from the fifth sixteenth to the end of the day also covers work: the free afternoon stays fixed.
    const withWork = leaveSwitch(christmasEve([own(360)]), 30);
    expect(withWork.segments.filter((segment) => segment.kind === "switch")).toHaveLength(8);
    expect(withWork.segments[8]).toEqual({ kind: "free", from: 240, to: 480, first: part(9, 16), last: part(16, 16) });
  });

  it("splits a day of 1/480 into 32 parts and one of 1/48 into 24", () => {
    expect(leaveSwitch(stub({}), 1).segments).toHaveLength(32);
    expect(leaveSwitch(stub({}), 10).segments).toHaveLength(24);
    expect(leaveSwitch(stub({}), 10).segments[23]).toMatchObject({ name: part(24, 24), from: 460, to: 480 });
  });
});

describe("leaveSwitch beside mandatory leave and another plan's leave", () => {
  it("locks a day of mandatory leave or another plan's leave as one block, without a checkbox", () => {
    const mandatoryDay = leaveSwitch(stub({ leave: [mandatory(480)] }), 240);
    expect(short(mandatoryDay.segments)).toEqual([["mandatory", 0, 480]]);
    expect(mandatoryDay.segments[0]).toMatchObject({ first: MORNING, last: AFTERNOON });
    expect(mandatoryDay.fullDay).toBeUndefined();
    expect(mandatoryDay.amount).toBe(480);
    expect(short(leaveSwitch(stub({ leave: [otherPlan(0, 480)] }), 240).segments)).toEqual([["otherPlan", 0, 480]]);
  });

  it("locks only the half that mandatory leave covers, and fills the other half", () => {
    const view = leaveSwitch(stub({ leave: [mandatory(240, "end")] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", morning],
      ["mandatory", 240, 480],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed", change: morning });
    const filled = leaveSwitch(stub({ leave: [mandatory(240, "end"), own(240, "start")] }), 240);
    expect(short(filled.segments)).toEqual([
      [MORNING, "true", remove],
      ["mandatory", 240, 480],
    ]);
    expect(filled.fullDay).toEqual({ checked: "true", change: remove });
    expect(filled.amount).toBe(480);
  });

  it("locks the half of another plan's leave", () => {
    const view = leaveSwitch(stub({ leave: [otherPlan(240, 480)] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "false", morning],
      ["otherPlan", 240, 480],
    ]);
  });

  it("shows own leave over another plan's leave, so it can be taken away", () => {
    const view = leaveSwitch(stub({ leave: [own(480), otherPlan(0, 480)] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", remove],
      [AFTERNOON, "true", remove],
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
      [MORNING, "false", { day: DAY, take: 120, part: "start" }],
      [AFTERNOON, "false", { day: DAY, take: 120, part: "end" }],
    ]);
    expect(view.fullDay).toEqual({ checked: "mixed" });
  });
});

describe("leaveSwitch where no leave can be set", () => {
  it("only takes own leave away on a day without required work", () => {
    const view = leaveSwitch(stub({ required: 0, leave: [own(480)] }), 240);
    expect(short(view.segments)).toEqual([
      [MORNING, "true", remove],
      [AFTERNOON, "true", remove],
    ]);
    expect(view.fullDay).toEqual({ checked: "true", change: remove });
    // The part the own leave doesn't cover is time without work like any other.
    const half = leaveSwitch(stub({ required: 0, leave: [own(240, "start")] }), 240);
    expect(short(half.segments)).toEqual([
      [MORNING, "true", remove],
      ["free", 240, 480],
    ]);
    expect(half.fullDay).toEqual({ checked: "true", change: remove });
  });

  it("offers nothing outside the plan period but taking own leave away", () => {
    expect(short(leaveSwitch(stub({ inPeriod: false }), 240).segments)).toEqual([
      [MORNING, "false", undefined],
      [AFTERNOON, "false", undefined],
    ]);
    expect(leaveSwitch(stub({ inPeriod: false }), 240).fullDay).toEqual({ checked: "false" });
    expect(leaveSwitch(stub({ inPeriod: false, leave: [own(480)] }), 240).fullDay).toEqual({ checked: "true", change: remove });
  });
});

describe("reach", () => {
  it("gives own leave from an edge through a part", () => {
    expect(reach(stub({}), 30, "end", 12)).toEqual({ day: DAY, take: 120, part: "end" });
    expect(reach(stub({}), 30, "start", 3)).toEqual({ day: DAY, take: 120, part: "start" });
    expect(reach(stub({}), 30, "start", 15)).toEqual(full);
    // Unchanged leave is no change.
    expect(reach(stub({ leave: [own(120)] }), 30, "end", 12)).toBeUndefined();
  });

  it("takes own leave away instead of reaching only free time", () => {
    expect(reach(christmasEve(), 30, "end", 12)).toBeUndefined();
    expect(reach(christmasEve([own(240, "start")]), 30, "end", 12)).toEqual(remove);
    // Across the free afternoon into the work of the morning.
    expect(reach(christmasEve(), 30, "end", 6)).toEqual({ day: DAY, take: 300, part: "end" });
  });
});

describe("withOwnLeave", () => {
  const day = stub({ leave: [own(480), mandatory(120, "start")] });

  it("takes the own leave away for take 0 and keeps the other leave", () => {
    expect(withOwnLeave(day, { day: DAY, take: 0 }).leave).toEqual([mandatory(120, "start")]);
  });

  it("puts the changed own leave in place of the old", () => {
    const changed = withOwnLeave(day, { day: DAY, take: 240, part: "start" });
    expect(changed.leave.filter((piece) => piece.kind === "own")).toEqual([own(240, "start")]);
    expect(changed.leave).toHaveLength(2);
    // A full day lies over the whole day.
    expect(withOwnLeave(stub({}), full).leave).toEqual([own(480, "end")]);
    // The bar of the changed day draws the change.
    expect(short(leaveSwitch(withOwnLeave(christmasEve(), { day: DAY, take: 240, part: "start" }), 240).segments)).toEqual([
      [MORNING, "true", remove],
      ["free", 240, 480],
    ]);
  });
});
