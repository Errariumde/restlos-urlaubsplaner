// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { amountText, dayDetail, reasonText, type Reason } from "../../../src/ui/calendar/detail.ts";
import type { Catalog, Locale } from "../../../src/ui/i18n/locale.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const state = new Session().open(example, true) as PlanState;
const first = state.result.days[0]!.day;

function at(month: number, day: number, year = 2027): DayResult {
  const result = state.result.days[dayFromYmd(year, month, day) - first];
  if (!result) throw new Error("No such day");
  return result;
}

const detailOf = (month: number, day: number, locale: Locale = "en") => dayDetail(at(month, day), state.meta, state.result.problems, locale);

const catalogs: Record<"de" | "en", Catalog> = {
  de: JSON.parse(readFileSync("src/ui/i18n/de.json", "utf8")) as Catalog,
  en: JSON.parse(readFileSync("src/ui/i18n/en.json", "utf8")) as Catalog,
};

function i18n(locale: "de" | "en"): { t: (key: string, args?: Record<string, string | number>) => string; locale: Locale } {
  return {
    locale,
    t: (key, args) => {
      const message = catalogs[locale][key];
      return message === undefined ? key : String(new IntlMessageFormat(message, locale).format(args));
    },
  };
}

const reasonsIn = (month: number, day: number, locale: "de" | "en"): string[] =>
  detailOf(month, day, locale).reasons.map((reason) => reasonText(reason, i18n(locale)));

describe("dayDetail: the required work", () => {
  it("draws a working day as one block of work", () => {
    expect(detailOf(6, 14).required).toEqual({ value: 480, blocks: [{ from: 0, to: 480, work: true }], off: "weekend" });
  });

  it("draws a day without work as free time with the pattern of its kind", () => {
    expect(detailOf(6, 19).required).toEqual({ value: 0, blocks: [{ from: 0, to: 480, work: false }], off: "weekend" });
    expect(detailOf(5, 27).required.off).toBe("holiday");
  });

  it("draws 24 December as work in the morning and free time in the afternoon", () => {
    expect(detailOf(12, 24).required).toEqual({
      value: 240,
      blocks: [
        { from: 0, to: 240, work: true },
        { from: 240, to: 480, work: false },
      ],
      off: "halfRequired",
      where: "morning",
    });
  });
});

describe("dayDetail: the leave part", () => {
  it("has the leave bar, the cost and the work left on a working day", () => {
    const { leave, noLeave } = detailOf(6, 14);
    expect(noLeave).toBeUndefined();
    expect(leave?.amount).toBe(0);
    expect(leave?.cost).toBe(0);
    expect(leave?.remaining).toBe(480);
    expect(leave?.segments).toHaveLength(2);
    expect(detailOf(1, 7).leave).toMatchObject({ amount: 480, cost: 480, remaining: 0 });
  });

  it("drops it on a day without work and without leave", () => {
    expect(detailOf(6, 19)).toMatchObject({ noLeave: "notNeeded" });
    expect(detailOf(6, 19).leave).toBeUndefined();
  });

  it("keeps it for mandatory leave and another plan's leave", () => {
    expect(detailOf(12, 27).leave).toMatchObject({ amount: 480, cost: 480, remaining: 0 });
    expect(detailOf(1, 4).leave).toMatchObject({ amount: 480, cost: 0, remaining: 0 });
  });

  it("says that a day outside the plan period without leave is outside it", () => {
    const outside = state.result.days.find((day) => !day.inPeriod && day.leave.length === 0)!;
    const detail = dayDetail(outside, state.meta, [], "en");
    expect(detail.noLeave).toBe("outsidePeriod");
    expect(detail.leave).toBeUndefined();
  });
});

describe("dayDetail: calendars", () => {
  it("lists each calendar of the day with its entries and where it lies in the day", () => {
    expect(detailOf(9, 6).calendars.map(({ source, entries, spans }) => [source.id, entries, spans])).toEqual([
      ["project", ["Release 3"], [{ from: 0, to: 480 }]],
    ]);
    expect(detailOf(1, 4).calendars.map(({ source, spans }) => [source.id, spans])).toEqual([["previous-year", [{ from: 0, to: 480 }]]]);
    expect(detailOf(6, 14).calendars).toEqual([]);
  });

  it("draws the free time of a half day from a holiday calendar, and names its entry", () => {
    const day = at(6, 14);
    const rosenmontag = { type: "holiday", day: day.day, sourceId: "project", required: 240, part: "end", name: { de: "Rosenmontag", en: "Shrove Monday" } };
    const layer = { kind: "holidaySource", value: 240, sourceId: "project", part: "end" };
    const halved = {
      ...day,
      facts: { ...day.facts, sources: [rosenmontag] },
      required: { ...day.required, value: 240, freePart: "end", decidedBy: layer, layers: [day.required.layers[0], layer] },
    } as DayResult;
    const detail = dayDetail(halved, state.meta, [], "de");
    expect(detail.calendars.map(({ entries, spans }) => [entries, spans])).toEqual([[["Rosenmontag"], [{ from: 240, to: 480 }]]]);
    expect(detail.reasons.map((reason) => reasonText(reason, i18n("de")))).toEqual(["Normaler Montag: 1\u00a0Tag", "Rosenmontag (Feiertagskalender): ½\u00a0Tag"]);
  });
});

describe("dayDetail: reasons", () => {
  it("calls a day that nothing changes a normal working day", () => {
    expect(reasonsIn(6, 14, "de")).toEqual(["Normaler Arbeitstag"]);
    expect(reasonsIn(6, 14, "en")).toEqual(["Normal working day"]);
  });

  it("names the weekday of the work week, with free at zero", () => {
    expect(reasonsIn(6, 19, "de")).toEqual(["Normaler Samstag: frei"]);
    expect(reasonsIn(6, 19, "en")).toEqual(["Normal Saturday: off"]);
  });

  it("names a public holiday and a day rule with their values", () => {
    expect(reasonsIn(5, 27, "de")).toEqual(["Normaler Donnerstag: 1\u00a0Tag", "Fronleichnam (Feiertag): frei"]);
    expect(reasonsIn(12, 24, "de")).toEqual(["Normaler Freitag: 1\u00a0Tag", "Heiligabend: nachmittags frei (Tagesregel): höchstens ½\u00a0Tag"]);
    expect(reasonsIn(12, 24, "en")).toEqual(["Normal Friday: 1\u00a0day", "Christmas Eve: afternoon off (day rule): at most ½\u00a0day"]);
  });

  it("names mandatory leave and another plan's leave after the required work", () => {
    expect(reasonsIn(12, 27, "de")).toEqual(["Normaler Arbeitstag", "Betriebsruhe 27. bis 30. Dezember (Pflichturlaub): 1\u00a0Tag"]);
    expect(reasonsIn(1, 4, "de")).toEqual(["Normaler Arbeitstag", "Urlaub aus Urlaub 2026: zählt dort"]);
    expect(reasonsIn(1, 4, "en")).toEqual(["Normal working day", "Leave from Leave 2026: counts there"]);
  });

  it("words every kind of reason in both languages", () => {
    const reasons: Reason[] = [
      { kind: "paidClosure", source: "Werksferien" },
      { kind: "ruleExactly", label: "Arbeitssamstag", value: 480 },
      { kind: "ruleExactly", label: "Karfreitag", value: 0 },
      { kind: "ruleAtMost", label: "Silvester", value: 0 },
      { kind: "override", value: 240 },
      { kind: "override", value: 0 },
      { kind: "holidaySource", name: "Brückentag", value: 0 },
    ];
    expect(reasons.map((reason) => reasonText(reason, i18n("de")))).toEqual([
      "Werksferien (bezahlte Betriebsruhe): frei",
      "Arbeitssamstag (Tagesregel): genau 1\u00a0Tag",
      "Karfreitag (Tagesregel): frei",
      "Silvester (Tagesregel): frei",
      "Von Hand geändert: ½\u00a0Tag",
      "Von Hand geändert: frei",
      "Brückentag (Feiertagskalender): frei",
    ]);
    expect(reasons.map((reason) => reasonText(reason, i18n("en")))).toEqual([
      "Werksferien (paid closure): off",
      "Arbeitssamstag (day rule): exactly 1\u00a0day",
      "Karfreitag (day rule): off",
      "Silvester (day rule): off",
      "Changed by hand: ½\u00a0day",
      "Changed by hand: off",
      "Brückentag (holiday calendar): off",
    ]);
  });

  it("names a rule or calendar it can't find by its ID", () => {
    const day = at(6, 14);
    const layers = [day.required.layers[0], { kind: "ruleAtMost", value: 240, ruleId: "unknown-rule" }];
    const detail = dayDetail({ ...day, required: { ...day.required, layers } } as DayResult, state.meta, [], "en");
    expect(detail.reasons.map((reason) => reasonText(reason, i18n("en")))).toEqual(["Normal Monday: 1\u00a0day", "unknown-rule (day rule): at most ½\u00a0day"]);
  });
});

describe("dayDetail: problems", () => {
  it("keeps only the problems of its day", () => {
    const day = at(6, 14);
    const problems = [
      { code: "leaveWithoutRequiredWork", day: day.day - 1 },
      { code: "uncoveredNeed", day: day.day, sourceIds: ["kita"] },
      { code: "leaveTakenInOtherPlan", day: day.day, sourceIds: ["previous-year"] },
    ] as const;
    expect(dayDetail(day, state.meta, problems, "en").problems).toEqual(["uncoveredNeed", "leaveTakenInOtherPlan"]);
  });
});

describe("amountText", () => {
  it("gives a day amount with its unit, half a day in the singular", () => {
    expect(amountText(240, i18n("de"))).toBe("½\u00a0Tag");
    expect(amountText(480, i18n("de"))).toBe("1\u00a0Tag");
    expect(amountText(720, i18n("en"))).toBe("1½\u00a0days");
  });
});
