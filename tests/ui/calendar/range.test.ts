// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";
import { actionForDrag, rangeChanges, toggleDay, weekChanges } from "../../../src/ui/calendar/range.ts";

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const d = (y: number, m: number, day: number): number => dayFromYmd(y, m, day);

function opened(): { session: Session; state: PlanState } {
  const session = new Session();
  return { session, state: session.open(example, true) as PlanState };
}

describe("rangeChanges", () => {
  const { session, state } = opened();
  const r = state.result;

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
    expect(rangeChanges(r, d(2027, 1, 29), d(2027, 2, 2), "full").map((c) => c.day)).toEqual([d(2027, 1, 29), d(2027, 2, 1), d(2027, 2, 2)]);
  });

  it("sets nothing outside the period", () => {
    // Review Focus 3: 30 Dec is mandatory leave, 31 Dec has half required work, 2028 is outside the period.
    expect(rangeChanges(r, d(2027, 12, 30), d(2028, 1, 5), "full")).toEqual([{ day: d(2027, 12, 31), take: 480 }]);
    expect(rangeChanges(r, d(2028, 1, 3), d(2028, 1, 7), "full")).toEqual([]);
  });

  it("is used by the session without side effects", () => {
    expect(session.apply([]).canUndo).toBe(false);
  });
});

describe("weekChanges", () => {
  it("sets the week, then takes it away again", () => {
    const { session, state } = opened();
    const monday = d(2027, 6, 14);
    const set = weekChanges(state.result, monday);
    expect(set).toHaveLength(5);
    const after = session.apply(set);
    const removed = weekChanges(after.result, monday);
    expect(removed).toHaveLength(5);
    expect(removed.every((c) => c.take === 0)).toBe(true);
  });

  it("changes nothing in a week without working days", () => {
    // Review Focus 4: the week of 4 Jan is other-plan leave on 4 and 5 Jan plus Epiphany on 6 Jan, and 7 and 8 Jan
    // already have own leave: nothing to set, so the click removes exactly those two.
    const { state } = opened();
    expect(weekChanges(state.result, d(2027, 1, 4))).toEqual([
      { day: d(2027, 1, 7), take: 0 },
      { day: d(2027, 1, 8), take: 0 },
    ]);
    // A week past the period end has nothing to change.
    expect(weekChanges(state.result, d(2028, 1, 3))).toEqual([]);
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
