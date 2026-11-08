// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { EXAMPLE_PLANNED_DAYS } from "../../fixtures/example-planned.ts";
import { respond, Session } from "../../../src/ui/worker/session.ts";

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const june = (day: number): number => dayFromYmd(2027, 6, day);

describe("Session", () => {
  const s = new Session();
  const opened = s.open(example, true) as PlanState;

  it("opens the example with its period and allowance", () => {
    expect(opened.meta.period).toEqual({ from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } });
    expect(opened.meta.allowance).toBe(30 * 480);
    expect(opened.meta).toMatchObject({ countryNameKey: "country.DE", regionNameKey: "region.DE.BY", weekStart: "mon", example: true });
    // The smallest leave unit, ½ day in the example; the actions follow it.
    expect(opened.meta.minUnit).toBe(240);
    expect(opened.canUndo).toBe(false);
    expect(opened.canRedo).toBe(false);
    expect(opened.changed).toBe(false);
  });

  it("passes on a plan's smallest leave unit", () => {
    const wholeDays = example.replace('"minUnit": "1/2"', '"minUnit": "1"');
    expect(wholeDays).not.toBe(example);
    expect((new Session().open(wholeDays, true) as PlanState).meta.minUnit).toBe(480);
  });

  // e2e/allowance.spec.ts uses the same constant.
  it("plans the pinned days of leave in the example", () => {
    expect(opened.result.totals.planned / 480).toBe(EXAMPLE_PLANNED_DAYS);
  });

  it("applies, undoes and redoes a change", () => {
    const day = june(14); // Monday, a working day
    const after = s.apply([{ day, take: 480 }]);
    expect(after.result.totals.planned).toBe(opened.result.totals.planned + 480);
    expect(after).toMatchObject({ canUndo: true, canRedo: false, changed: true });
    const undone = s.undo();
    expect(undone.result.totals.planned).toBe(opened.result.totals.planned);
    expect(undone).toMatchObject({ canUndo: false, canRedo: true, changed: false });
    expect(s.redo().result.totals.planned).toBe(opened.result.totals.planned + 480);
  });

  it("adds no undo step when nothing changes", () => {
    // Review Focus 4
    const fresh = new Session();
    fresh.open(example, true);
    const state = fresh.apply([]);
    expect(state.canUndo).toBe(false);
    expect(state.changed).toBe(false);
    // Leave the example already has, and removing leave that isn't there, change nothing either.
    const same = fresh.apply([
      { day: dayFromYmd(2027, 1, 7), take: 480 },
      { day: june(14), take: 0 },
    ]);
    expect(same.canUndo).toBe(false);
    expect(same.changed).toBe(false);
  });

  it("is unchanged again when a change is taken back by hand", () => {
    const fresh = new Session();
    fresh.open(example, true);
    fresh.apply([{ day: june(14), take: 480 }]);
    const back = fresh.apply([{ day: june(14), take: 0 }]);
    expect(back.changed).toBe(false);
    expect(back.canUndo).toBe(true);
  });

  it("drops the redo branch on a new change", () => {
    const fresh = new Session();
    fresh.open(example, true);
    fresh.apply([{ day: june(14), take: 480 }]);
    fresh.undo();
    const state = fresh.apply([{ day: june(15), take: 240, part: "start" }]);
    expect(state.canRedo).toBe(false);
    expect(fresh.redo().canRedo).toBe(false);
  });

  it("keeps at most 200 undo steps", () => {
    const fresh = new Session();
    const start = fresh.open(example, true) as PlanState;
    for (let i = 0; i < 201; i++) fresh.apply([{ day: june(14), take: i % 2 === 0 ? 480 : 0 }]);
    let undone = 0;
    while (fresh.undo().canUndo) undone++;
    expect(undone + 1).toBe(200);
    // The oldest step is gone: the state after it is as far back as undo goes.
    expect(fresh.undo().result.totals.planned).toBe(start.result.totals.planned + 480);
  });

  it("previews without changing the plan", () => {
    const fresh = new Session();
    const start = fresh.open(example, true) as PlanState;
    const hint = fresh.preview([14, 15, 16].map((d) => ({ day: june(d), take: 480 as const })));
    expect(hint).toMatchObject({ days: 3, cost: 3 * 480, remaining: start.result.totals.remaining - 3 * 480 });
    expect(hint.stretch).toMatchObject({ start: { day: dayFromYmd(2027, 6, 12), offset: 0 }, listed: true });
    expect(fresh.apply([]).result.totals.planned).toBe(start.result.totals.planned);
  });

  it("counts only the days a preview alters", () => {
    const fresh = new Session();
    const start = fresh.open(example, true) as PlanState;
    const hint = fresh.preview([
      { day: dayFromYmd(2027, 1, 7), take: 480 }, // already leave
      { day: june(14), take: 0 }, // no leave to remove
    ]);
    expect(hint).toEqual({ days: 0, cost: 0, remaining: start.result.totals.remaining, stretch: undefined });
  });

  it("refuses a broken file", () => {
    expect(new Session().open("{", false)).toEqual({ refused: "notJson" });
  });
});

describe("respond", () => {
  it("answers open, apply and preview", () => {
    const session = new Session();
    expect(respond(session, { id: 1, type: "open", text: example, example: true })).toMatchObject({ id: 1, type: "state" });
    expect(respond(session, { id: 2, type: "preview", changes: [{ day: june(14), take: 480 }] })).toMatchObject({
      id: 2,
      type: "hint",
      hint: { days: 1, cost: 480 },
    });
    expect(respond(session, { id: 3, type: "undo" })).toMatchObject({ id: 3, type: "state", state: { canUndo: false } });
  });

  it("answers a refused file with its code", () => {
    expect(respond(new Session(), { id: 4, type: "open", text: "{", example: false })).toEqual({ id: 4, type: "refused", code: "notJson" });
  });

  it("turns an exception into failed", () => {
    const answer = respond(new Session(), { id: 5, type: "apply", changes: [] });
    expect(answer).toMatchObject({ id: 5, type: "failed" });
  });
});
