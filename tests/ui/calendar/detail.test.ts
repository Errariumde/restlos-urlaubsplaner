// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateLeave, type LeavePiece } from "../../../src/engine/counting/leave.ts";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { dayDetail, detailActions } from "../../../src/ui/calendar/detail.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const state = new Session().open(example, true) as PlanState;
const first = state.result.days[0]!.day;

function at(month: number, day: number): DayResult {
  const result = state.result.days[dayFromYmd(2027, month, day) - first];
  if (!result) throw new Error("No such day");
  return result;
}

const detailOf = (month: number, day: number) => dayDetail(at(month, day), state.meta, state.result.problems, "en");

describe("dayDetail", () => {
  it("names the public holiday that frees Corpus Christi", () => {
    const detail = detailOf(5, 27);
    expect(detail.requiredReason).toEqual({ key: "detail.required.publicHoliday", args: { nameKey: "holiday.corpus-christi" } });
    expect(detail.leave).toBe("none");
    expect(detail.cost).toBe(0);
  });

  it("names the day rule that halves 24 December, with its label and value", () => {
    const detail = detailOf(12, 24);
    expect(detail.requiredReason).toEqual({ key: "detail.required.ruleAtMost", args: { label: "Christmas Eve: afternoon off", days: "½" } });
  });

  it("names the label in German", () => {
    expect(dayDetail(at(12, 24), state.meta, state.result.problems, "de").requiredReason.args).toEqual({ label: "Heiligabend: nachmittags frei", days: "½" });
  });

  it("lists the other-plan source of 4 January and its leave", () => {
    const detail = detailOf(1, 4);
    expect(detail.sources.map(({ source }) => source.id)).toEqual(["previous-year"]);
    expect(detail.sources[0]?.entries).toEqual([]);
    expect(detail.leave).toBe("otherPlan");
    expect(detail.cost).toBe(0);
  });

  it("gives the work week as the reason on an ordinary working day", () => {
    const detail = detailOf(6, 14);
    expect(detail.requiredReason).toEqual({ key: "detail.required.workWeek", args: {} });
    expect(detail.sources).toEqual([]);
    expect(detail.problems).toEqual([]);
  });

  it("lists the info source of a day in the project phase", () => {
    expect(detailOf(9, 6).sources.map(({ source }) => source.id)).toEqual(["project"]);
    // The entry's name comes with its calendar.
    expect(detailOf(9, 6).sources[0]?.entries).toEqual(["Release 3"]);
  });

  it("tells full days, mandatory leave and half days apart", () => {
    expect(detailOf(1, 7).leave).toBe("full");
    expect(detailOf(12, 27).leave).toBe("mandatory");
    // The working day 14 June with other leave, which the engine evaluates.
    const withLeave = (leave: LeavePiece[]): DayResult => {
      const day = at(6, 14);
      return { ...day, leave, evaluation: evaluateLeave(day.required, leave, true) };
    };
    expect(dayDetail(withLeave([{ kind: "own", take: 240, part: "start" }]), state.meta, [], "en").leave).toBe("halfStart");
    expect(dayDetail(withLeave([{ kind: "own", take: 240, part: "end" }]), state.meta, [], "en").leave).toBe("halfEnd");
    expect(dayDetail(withLeave([{ kind: "own", take: 120, part: "end" }]), state.meta, [], "en").leave).toBe("partial");
    // A full day of own leave beside an afternoon of mandatory leave is own leave in the morning, as in the cell.
    const both = withLeave([
      { kind: "own", take: 480, part: "end" },
      { kind: "mandatory", take: 240, part: "end", ruleId: "m" },
    ]);
    expect(dayDetail(both, state.meta, [], "en").leave).toBe("halfStart");
  });

  it("keeps only the problems of its day", () => {
    const day = at(6, 14);
    const problems = [
      { code: "leaveWithoutRequiredWork", day: day.day - 1 },
      { code: "uncoveredNeed", day: day.day, sourceIds: ["kita"] },
      { code: "leaveTakenInOtherPlan", day: day.day, sourceIds: ["previous-year"] },
    ] as const;
    expect(dayDetail(day, state.meta, problems, "en").problems).toEqual(["uncoveredNeed", "leaveTakenInOtherPlan"]);
  });

  it("names the entry of a holiday calendar in the reason and beside the calendar", () => {
    const day = at(6, 14);
    const bridge = { type: "holiday", day: day.day, sourceId: "project", required: 0, name: { de: "Brückentag", en: "Bridge day" } };
    const freed = {
      ...day,
      facts: { ...day.facts, sources: [bridge] },
      required: { ...day.required, value: 0, decidedBy: { kind: "holidaySource", value: 0, sourceId: "project" } },
    } as DayResult;
    const english = dayDetail(freed, state.meta, [], "en");
    expect(english.requiredReason).toEqual({ key: "detail.required.holidaySource", args: { name: "Bridge day" } });
    expect(english.sources.map(({ source, entries }) => [source.id, entries])).toEqual([["project", ["Bridge day"]]]);
    expect(dayDetail(freed, state.meta, [], "de").requiredReason.args).toEqual({ name: "Brückentag" });
  });

  it("maps every kind of required layer to a catalog key", () => {
    const day = at(6, 14);
    const reason = (decidedBy: unknown) => dayDetail({ ...day, required: { ...day.required, decidedBy } } as DayResult, state.meta, [], "en").requiredReason;
    expect(reason({ kind: "holidaySource", value: 0, sourceId: "project" })).toEqual({ key: "detail.required.holidaySource", args: { name: "Project phase" } });
    expect(reason({ kind: "paidClosure", value: 0, sourceId: "project" })).toEqual({ key: "detail.required.paidClosure", args: { source: "Project phase" } });
    expect(reason({ kind: "ruleExactly", value: 240, ruleId: "new-years-eve" })).toEqual({
      key: "detail.required.ruleExactly",
      args: { label: "New Year's Eve: afternoon off", days: "½" },
    });
    expect(reason({ kind: "ruleAtMost", value: 0, ruleId: "unknown-rule" })).toEqual({ key: "detail.required.ruleAtMost", args: { label: "unknown-rule", days: "0" } });
    expect(reason({ kind: "override", value: 240 })).toEqual({ key: "detail.required.override", args: { days: "½" } });
  });
});

describe("detailActions", () => {
  it("offers every setting action on a free working day, but nothing to remove", () => {
    const actions = detailActions(at(6, 14), 240);
    const day = dayFromYmd(2027, 6, 14);
    expect(actions.full).toEqual({ day, take: 480 });
    expect(actions.morning).toEqual({ day, take: 240, part: "start" });
    expect(actions.afternoon).toEqual({ day, take: 240, part: "end" });
    expect(actions.remove).toBeUndefined();
    expect(actions.blocked).toBeUndefined();
  });

  it("offers removing and halving a planned full day, not setting it again", () => {
    const actions = detailActions(at(1, 7), 240);
    expect(actions.full).toBeUndefined();
    expect(actions.morning).toBeDefined();
    expect(actions.remove).toEqual({ day: dayFromYmd(2027, 1, 7), take: 0 });
  });

  it("offers no half day where the plan counts in whole days", () => {
    const actions = detailActions(at(6, 14), 480);
    expect(actions.full).toEqual({ day: dayFromYmd(2027, 6, 14), take: 480 });
    expect(actions.morning).toBeUndefined();
    expect(actions.afternoon).toBeUndefined();
    // A unit finer than ½ keeps the half days.
    expect(detailActions(at(6, 14), 120).morning).toBeDefined();
  });

  it("explains why a day without required work, with mandatory leave or with another plan's leave can't be set", () => {
    expect(detailActions(at(5, 27), 240)).toEqual({ blocked: "noRequired" });
    expect(detailActions(at(6, 19), 240)).toEqual({ blocked: "noRequired" });
    expect(detailActions(at(12, 27), 240)).toEqual({ blocked: "mandatory" });
    expect(detailActions(at(1, 4), 240)).toEqual({ blocked: "otherPlan" });
  });
});
