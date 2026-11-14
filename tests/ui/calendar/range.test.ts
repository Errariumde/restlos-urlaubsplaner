// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LeavePiece } from "../../../src/engine/counting/leave.ts";
import type { DayResult, PlanResult } from "../../../src/engine/counting/plan.ts";
import type { RequiredWork } from "../../../src/engine/counting/required.ts";
import type { Part } from "../../../src/engine/counting/types.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";
import {
  actionForDrag,
  changeFor,
  halfDayFits,
  rangeChanges,
  toggleDay,
  weekChanges,
  weekSelection,
  whollyFree,
  workLeft,
} from "../../../src/ui/calendar/range.ts";

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const d = (y: number, m: number, day: number): number => dayFromYmd(y, m, day);

function opened(): { session: Session; state: PlanState } {
  const session = new Session();
  return { session, state: session.open(example, true) as PlanState };
}

/** The result's day; the test fails when it lies outside the computed window. */
function dayIn(result: PlanResult, day: number): DayResult {
  const found = result.days.find((candidate) => candidate.day === day);
  if (found === undefined) throw new Error(`No day ${String(day)} in the result`);
  return found;
}

describe("halfDayFits", () => {
  it("allows half days only where ½ is a multiple of the smallest leave unit", () => {
    expect(halfDayFits(240)).toBe(true); // ½
    expect(halfDayFits(120)).toBe(true); // ¼
    expect(halfDayFits(15)).toBe(true); // 1/32
    expect(halfDayFits(480)).toBe(false); // whole days
    expect(halfDayFits(160)).toBe(false); // ⅓
  });
});

describe("rangeChanges", () => {
  const r = opened().state.result;

  it("sets the five working days of the week of 14 June 2027", () => {
    const changes = rangeChanges(r, d(2027, 6, 14), d(2027, 6, 20), "full");
    expect(changes).toEqual([14, 15, 16, 17, 18].map((day) => ({ day: d(2027, 6, day), take: 480 })));
  });

  it("accepts the days in reversed order", () => {
    expect(rangeChanges(r, d(2027, 6, 20), d(2027, 6, 14), "full")).toEqual(rangeChanges(r, d(2027, 6, 14), d(2027, 6, 20), "full"));
  });

  it("skips holidays and weekends", () => {
    // 15 May Sat, 16 May Sun, 17 May Whit Monday (holiday), 18 May Tue
    expect(rangeChanges(r, d(2027, 5, 15), d(2027, 5, 18), "full")).toEqual([{ day: d(2027, 5, 18), take: 480 }]);
    // Corpus Christi (27 May) is a holiday; 28 May already has leave; 29 and 30 May are the weekend; 31 May is a Monday.
    expect(rangeChanges(r, d(2027, 5, 27), d(2027, 5, 31), "full")).toEqual([{ day: d(2027, 5, 31), take: 480 }]);
  });

  it("leaves mandatory leave alone", () => {
    expect(rangeChanges(r, d(2027, 12, 27), d(2027, 12, 30), "full")).toEqual([]);
  });

  it("leaves leave from another plan alone", () => {
    expect(rangeChanges(r, d(2027, 1, 4), d(2027, 1, 5), "full")).toEqual([]);
  });

  it("sets a full day on a day with half required work", () => {
    expect(rangeChanges(r, d(2027, 12, 24), d(2027, 12, 24), "full")).toEqual([{ day: d(2027, 12, 24), take: 480 }]);
  });

  it("gives half days as 240 at the end", () => {
    expect(rangeChanges(r, d(2027, 6, 14), d(2027, 6, 15), "half")).toEqual([
      { day: d(2027, 6, 14), take: 240, part: "end" },
      { day: d(2027, 6, 15), take: 240, part: "end" },
    ]);
  });

  it("turns an existing half day into a full day, and a full day again changes nothing", () => {
    const s = opened().session;
    s.apply([{ day: d(2027, 6, 14), take: 240, part: "start" }]);
    const half = s.apply([]).result;
    expect(rangeChanges(half, d(2027, 6, 14), d(2027, 6, 14), "full")).toEqual([{ day: d(2027, 6, 14), take: 480 }]);
    // Half at the start becomes half at the end; half at the end stays.
    expect(rangeChanges(half, d(2027, 6, 14), d(2027, 6, 14), "half")).toEqual([{ day: d(2027, 6, 14), take: 240, part: "end" }]);
    const full = s.apply([{ day: d(2027, 6, 14), take: 480 }]).result;
    expect(rangeChanges(full, d(2027, 6, 14), d(2027, 6, 14), "full")).toEqual([]);
    const end = s.apply([{ day: d(2027, 6, 14), take: 240, part: "end" }]).result;
    expect(rangeChanges(end, d(2027, 6, 14), d(2027, 6, 14), "half")).toEqual([]);
  });

  it("removes own leave over a range", () => {
    const s = opened().session;
    s.apply([14, 15, 16, 17, 18].map((day) => ({ day: d(2027, 6, day), take: 480 as const })));
    const after = s.apply([]).result;
    expect(actionForDrag(after, d(2027, 6, 14))).toBe("remove");
    expect(rangeChanges(after, d(2027, 6, 14), d(2027, 6, 20), "remove")).toEqual(
      [14, 15, 16, 17, 18].map((day) => ({ day: d(2027, 6, day), take: 0 })),
    );
    expect(actionForDrag(r, d(2027, 6, 14))).toBe("full");
  });

  it("does not count mandatory or other-plan leave as own leave", () => {
    expect(actionForDrag(r, d(2027, 12, 27))).toBe("full");
    expect(actionForDrag(r, d(2027, 1, 4))).toBe("full");
    expect(rangeChanges(r, d(2027, 12, 27), d(2027, 12, 30), "remove")).toEqual([]);
  });

  it("crosses the month gap between two tiles", () => {
    // Review Focus 3: 29 Jan Fri, 30 and 31 Jan weekend, 1 Feb Mon, 2 Feb Tue
    expect(rangeChanges(r, d(2027, 1, 29), d(2027, 2, 2), "full")).toEqual([
      { day: d(2027, 1, 29), take: 480 },
      { day: d(2027, 2, 1), take: 480 },
      { day: d(2027, 2, 2), take: 480 },
    ]);
  });

  it("sets nothing outside the period", () => {
    // Review Focus 3: 30 Dec is mandatory leave, 31 Dec has half required work, 2028 is outside the period.
    expect(rangeChanges(r, d(2027, 12, 30), d(2028, 1, 5), "full")).toEqual([{ day: d(2027, 12, 31), take: 480 }]);
    expect(rangeChanges(r, d(2028, 1, 3), d(2028, 1, 7), "full")).toEqual([]);
  });

  it("gives half over an existing full own day as a half day at the end", () => {
    expect(rangeChanges(r, d(2027, 1, 7), d(2027, 1, 7), "half")).toEqual([{ day: d(2027, 1, 7), take: 240, part: "end" }]);
  });

  it("sets no half day where there is no required work", () => {
    expect(rangeChanges(r, d(2027, 6, 19), d(2027, 6, 20), "half")).toEqual([]);
  });

  it("changes nothing for a drag over a weekend", () => {
    // Review Focus 4
    expect(rangeChanges(r, d(2027, 6, 19), d(2027, 6, 20), "full")).toEqual([]);
  });

  it("handles the first day of the period", () => {
    // 1 Jan 2027 is a holiday: nothing to set, but own leave from a file there can be removed (synthetic own leave).
    const first = d(2027, 1, 1);
    expect(rangeChanges(r, d(2026, 12, 28), first, "full")).toEqual([]);
    const withOwn = {
      ...r,
      days: r.days.map((x) => (x.day === first ? { ...x, leave: [{ kind: "own" as const, take: 480, part: "end" as const }] } : x)),
    };
    expect(rangeChanges(withOwn, d(2026, 12, 28), first, "remove")).toEqual([{ day: first, take: 0 }]);
  });

  it("does not touch own leave outside the period", () => {
    // The example has no own leave outside the period, so remove over the margin days is the only check possible.
    expect(rangeChanges(r, d(2026, 11, 1), d(2026, 12, 31), "remove")).toEqual([]);
    expect(rangeChanges(r, d(2028, 1, 1), d(2028, 1, 31), "remove")).toEqual([]);
  });

  it("leaves a day with own and mandatory leave alone when setting, and removes the own leave on a click", () => {
    const day = d(2027, 12, 28);
    const both = {
      ...r,
      days: r.days.map((x) => (x.day === day ? { ...x, leave: [...x.leave, { kind: "own" as const, take: 480, part: "end" as const }] } : x)),
    };
    expect(rangeChanges(both, day, day, "full")).toEqual([]);
    expect(toggleDay(both, day)).toEqual([{ day, take: 0 }]);
  });
});

describe("weekChanges", () => {
  it("sets the week, then takes it away again", () => {
    const { session, state } = opened();
    const monday = d(2027, 6, 14);
    const set = weekChanges(state.result, monday);
    expect(set).toEqual([14, 15, 16, 17, 18].map((day) => ({ day: d(2027, 6, day), take: 480 })));
    const after = session.apply(set);
    expect(weekChanges(after.result, monday)).toEqual([14, 15, 16, 17, 18].map((day) => ({ day: d(2027, 6, day), take: 0 })));
  });

  it("falls back to removing the own leave when there is nothing to set", () => {
    // The week of 4 Jan: other-plan leave on 4 and 5 Jan, Epiphany on 6 Jan, own leave on 7 and 8 Jan.
    const { state } = opened();
    expect(weekChanges(state.result, d(2027, 1, 4))).toEqual([
      { day: d(2027, 1, 7), take: 0 },
      { day: d(2027, 1, 8), take: 0 },
    ]);
  });

  it("changes nothing when there is nothing to set and nothing to remove", () => {
    // Review Focus 4. The week of 28 Dec 2026 has only 1 Jan (holiday) and a weekend in the period; the rest is before it.
    const { state } = opened();
    expect(weekChanges(state.result, d(2026, 12, 28))).toEqual([]);
    // A week past the period end.
    expect(weekChanges(state.result, d(2028, 1, 3))).toEqual([]);
  });
});

describe("weekSelection", () => {
  const r = opened().state.result;

  it("selects the week's working days, from its first to its last", () => {
    expect(weekSelection(r, d(2027, 6, 14))).toEqual({ anchor: d(2027, 6, 14), head: d(2027, 6, 18) });
    // Whit Monday (17 May) is a holiday.
    expect(weekSelection(r, d(2027, 5, 17))).toEqual({ anchor: d(2027, 5, 18), head: d(2027, 5, 21) });
  });

  it("keeps days with leave on them: the selection bar's Remove takes it away", () => {
    // The week of 4 Jan: other-plan leave on 4 and 5 Jan, Epiphany on 6 Jan, own leave on 7 and 8 Jan.
    expect(weekSelection(r, d(2027, 1, 4))).toEqual({ anchor: d(2027, 1, 4), head: d(2027, 1, 8) });
  });

  it("is clipped to the plan period", () => {
    // The week of 27 Dec 2027 ends with a weekend in 2028; 31 Dec has half required work.
    expect(weekSelection(r, d(2027, 12, 27))).toEqual({ anchor: d(2027, 12, 27), head: d(2027, 12, 31) });
    // A period that ended on Thursday 17 June.
    const ended = { ...r, days: r.days.map((x) => (x.day > d(2027, 6, 17) ? { ...x, inPeriod: false } : x)) };
    expect(weekSelection(ended, d(2027, 6, 14))).toEqual({ anchor: d(2027, 6, 14), head: d(2027, 6, 17) });
  });

  it("selects nothing in a week without a working day in the period", () => {
    // The week of 28 Dec 2026 has only 1 Jan (holiday) and a weekend in the period; the rest is before it.
    expect(weekSelection(r, d(2026, 12, 28))).toBeUndefined();
    expect(weekSelection(r, d(2028, 1, 3))).toBeUndefined();
  });
});

describe("toggleDay", () => {
  const { session, state } = opened();

  it("changes nothing on a Saturday", () => {
    expect(toggleDay(state.result, d(2027, 6, 19))).toEqual([]);
  });

  it("changes nothing on a holiday, on mandatory leave or on another plan's leave", () => {
    expect(toggleDay(state.result, d(2027, 5, 27))).toEqual([]);
    expect(toggleDay(state.result, d(2027, 12, 28))).toEqual([]);
    expect(toggleDay(state.result, d(2027, 1, 4))).toEqual([]);
  });

  it("sets a full day, and removes own leave with the next click", () => {
    expect(toggleDay(state.result, d(2027, 6, 14))).toEqual([{ day: d(2027, 6, 14), take: 480 }]);
    expect(toggleDay(state.result, d(2027, 1, 7))).toEqual([{ day: d(2027, 1, 7), take: 0 }]);
    const half = session.apply([{ day: d(2027, 6, 15), take: 240, part: "end" }]).result;
    expect(toggleDay(half, d(2027, 6, 15))).toEqual([{ day: d(2027, 6, 15), take: 0 }]);
  });

  it("sets a full day on a day with half required work", () => {
    expect(toggleDay(state.result, d(2027, 12, 24))).toEqual([{ day: d(2027, 12, 24), take: 480 }]);
  });
});

// Days that mandatory leave or another plan's leave covers in part: setting fills the free rest of the work, at the
// free side, as long as it is one stretch reaching an edge of the day; a span in the middle that leaves two gaps is
// left alone.
describe("partly covered days", () => {
  const file = JSON.parse(example) as { contract: { rules: unknown[] }; sources: { entries: unknown[] }[] };
  file.contract.rules.push(
    { id: "half-closure", match: { type: "fixed", month: 3, day: 4 }, mandatory: "1/2", part: "end" },
    { id: "quarter-closure", match: { type: "fixed", month: 3, day: 5 }, mandatory: "1/4", part: "end" },
  );
  file.sources[1]!.entries.push({ date: "2027-03-02", from: "0", to: "1/2", kind: "leave" }, { date: "2027-03-03", from: "1/4", to: "3/4", kind: "leave" });
  const session = new Session();
  const r = (session.open(JSON.stringify(file), true) as PlanState).result;
  const march = (day: number): number => d(2027, 3, day);

  it("fills the free rest beside mandatory leave or another plan's leave", () => {
    expect(rangeChanges(r, march(4), march(4), "full")).toEqual([{ day: march(4), take: 240, part: "start" }]);
    expect(rangeChanges(r, march(5), march(5), "full")).toEqual([{ day: march(5), take: 360, part: "start" }]);
    expect(rangeChanges(r, march(2), march(2), "full")).toEqual([{ day: march(2), take: 240, part: "end" }]);
  });

  it("leaves a day alone whose free time lies on both sides of another plan's leave", () => {
    expect(rangeChanges(r, march(3), march(3), "full")).toEqual([]);
    expect(rangeChanges(r, march(3), march(3), "half")).toEqual([]);
  });

  it("sets half a day at the free side where the rest is larger, else the rest", () => {
    expect(rangeChanges(r, march(5), march(5), "half")).toEqual([{ day: march(5), take: 240, part: "start" }]);
    expect(rangeChanges(r, march(4), march(4), "half")).toEqual([{ day: march(4), take: 240, part: "start" }]);
    expect(rangeChanges(r, march(2), march(2), "half")).toEqual([{ day: march(2), take: 240, part: "end" }]);
  });

  it("goes through the same rule for a range, a click and the hint", () => {
    expect(rangeChanges(r, march(1), march(5), "full")).toEqual([
      { day: march(1), take: 480 },
      { day: march(2), take: 240, part: "end" },
      { day: march(4), take: 240, part: "start" },
      { day: march(5), take: 360, part: "start" },
    ]);
    expect(toggleDay(r, march(4))).toEqual([{ day: march(4), take: 240, part: "start" }]);
    const hint = session.preview(rangeChanges(r, march(4), march(4), "full"));
    expect(hint).toMatchObject({ days: 1, cost: 240 });
  });

  it("changes nothing once the rest is set, and removes the own leave again", () => {
    const after = new Session();
    after.open(JSON.stringify(file), true);
    const filled = after.apply(rangeChanges(r, march(4), march(4), "full")).result;
    expect(rangeChanges(filled, march(4), march(4), "full")).toEqual([]);
    expect(toggleDay(filled, march(4))).toEqual([{ day: march(4), take: 0 }]);
  });
});

// Leave lies at day positions: own leave starts at an edge of the day and may reach the work across time without work.
describe("leave in day positions", () => {
  const DAY = 20_000;
  const own = (take: number, part: Part = "end"): LeavePiece => ({ kind: "own", take, part });
  const mandatory = (take: number, part: Part = "end"): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "closure" });
  const otherPlan = (from: number, to: number): LeavePiece => ({ kind: "otherPlan", from, to, sourceId: "previous-year" });

  /** A day with just what the range rules read. */
  function stub(required: number, leave: LeavePiece[] = [], freePart: Part = "end"): Pick<DayResult, "day" | "inPeriod" | "required" | "leave"> {
    return { day: DAY, inPeriod: true, required: { value: required, freePart } as RequiredWork, leave };
  }

  const christmas = d(2027, 12, 24);
  const christmasEve = dayIn(opened().state.result, christmas);

  it("puts H on 24 December in the morning, where the work is", () => {
    expect(changeFor(christmasEve, "half")).toEqual({ day: christmas, take: 240, part: "start" });
    // Space and a click still book the full day, which costs ½ there.
    expect(changeFor(christmasEve, "full")).toEqual({ day: christmas, take: 480 });
  });

  it("keeps H in the afternoon of a ¾ day, which has work there", () => {
    expect(changeFor(stub(360), "half")).toEqual({ day: DAY, take: 240, part: "end" });
  });

  it("books the afternoon of a day whose free time lies in the morning", () => {
    expect(changeFor(stub(240, [], "start"), "half")).toEqual({ day: DAY, take: 240, part: "end" });
  });

  it("reaches the work left across free time", () => {
    // Work in the morning, mandatory leave in its first quarter: the work left is the second quarter, which own
    // leave reaches from the end of the day across the free afternoon.
    const day = stub(240, [mandatory(120, "start")]);
    expect(workLeft(day)).toEqual([[120, 240]]);
    expect(changeFor(day, "full")).toEqual({ day: DAY, take: 360, part: "end" });
    expect(changeFor(day, "half")).toEqual({ day: DAY, take: 360, part: "end" });
  });

  it("books the morning beside mandatory leave in the last quarter", () => {
    expect(changeFor(stub(480, [mandatory(120, "end")]), "half")).toEqual({ day: DAY, take: 240, part: "start" });
    expect(changeFor(stub(480, [mandatory(120, "end")]), "full")).toEqual({ day: DAY, take: 360, part: "start" });
  });

  it("books no more than half a day of the work left with H", () => {
    // The work left is [0, 400); H covers half a day of it from the start of the day.
    expect(changeFor(stub(480, [otherPlan(400, 480)]), "half")).toEqual({ day: DAY, take: 240, part: "start" });
    // The work left is [100, 480): H reaches half a day of it from the end of the day.
    expect(changeFor(stub(480, [mandatory(100, "start")]), "half")).toEqual({ day: DAY, take: 240, part: "end" });
  });

  it("leaves a day alone whose work left lies on both sides of another plan's leave", () => {
    const day = stub(480, [otherPlan(300, 420)]);
    expect(workLeft(day)).toEqual([
      [0, 300],
      [420, 480],
    ]);
    expect(changeFor(day, "half")).toBeUndefined();
    expect(changeFor(day, "full")).toBeUndefined();
  });

  it("books a full day where mandatory leave lies only on time without work", () => {
    // Mandatory leave on the free afternoon covers no work: the day is booked as if it weren't there.
    const day = stub(240, [mandatory(240, "end")]);
    expect(workLeft(day)).toEqual([[0, 240]]);
    expect(changeFor(day, "full")).toEqual({ day: DAY, take: 480 });
    expect(changeFor(day, "half")).toEqual({ day: DAY, take: 240, part: "start" });
  });

  it("moves leave from the free afternoon to the morning with H", () => {
    // Own leave on time without work, from a file: H books the work instead.
    expect(changeFor(stub(240, [own(240, "end")]), "half")).toEqual({ day: DAY, take: 240, part: "start" });
    expect(changeFor(stub(240, [own(240, "end")]), "full")).toEqual({ day: DAY, take: 480 });
  });

  it("counts a day made wholly free by own leave as set", () => {
    const session = opened().session;
    const morning = session.apply([{ day: christmas, take: 240, part: "start" }]).result;
    expect(changeFor(dayIn(morning, christmas), "full")).toBeUndefined();
    expect(rangeChanges(morning, christmas, christmas, "full")).toEqual([]);
    // H on it again changes nothing either.
    expect(changeFor(dayIn(morning, christmas), "half")).toBeUndefined();
    // A full day there is set too, but H still puts its half day there: the full day becomes the morning.
    const fullDay = opened().session.apply([{ day: christmas, take: 480 }]).result;
    expect(changeFor(dayIn(fullDay, christmas), "full")).toBeUndefined();
    expect(changeFor(dayIn(fullDay, christmas), "half")).toEqual({ day: christmas, take: 240, part: "start" });
    // The week of 20 December: four full days and the morning of 24 December are all set, so a week click takes
    // the week away.
    const monday = d(2027, 12, 20);
    const week = session.apply([20, 21, 22, 23].map((day) => ({ day: d(2027, 12, day), take: 480 }))).result;
    expect(weekChanges(week, monday)).toEqual([20, 21, 22, 23, 24].map((day) => ({ day: d(2027, 12, day), take: 0 })));
  });

  it("tells whether the work is all covered and which of it other leave leaves free", () => {
    expect(whollyFree(christmasEve)).toBe(false);
    expect(workLeft(christmasEve)).toEqual([[0, 240]]);
    const morning = { ...christmasEve, leave: [own(240, "start")] };
    expect(whollyFree(morning)).toBe(true);
    // Own leave is no other leave: the work left stays.
    expect(workLeft(morning)).toEqual([[0, 240]]);
    // Leave on the free afternoon covers none of the work.
    expect(whollyFree({ ...christmasEve, leave: [own(240, "end")] })).toBe(false);
    // A day without work is wholly free, with nothing left.
    expect(whollyFree(stub(0))).toBe(true);
    expect(workLeft(stub(0))).toEqual([]);
    // The work of a day free in the morning lies in the afternoon.
    expect(workLeft(stub(240, [], "start"))).toEqual([[240, 480]]);
    expect(whollyFree(stub(480, [mandatory(240, "start"), otherPlan(240, 480)]))).toBe(true);
  });
});
