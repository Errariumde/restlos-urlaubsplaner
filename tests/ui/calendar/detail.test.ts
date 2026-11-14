// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { amountText, dayDetail, fixedText, partText, reasonText, switchText, type FixedSegment, type Reason, type SwitchSegment } from "../../../src/ui/calendar/detail.ts";
import { leaveSwitch, type PartName } from "../../../src/ui/calendar/leave-switch.ts";
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

describe("the leave bar's names", () => {
  const de = i18n("de").t;
  const en = i18n("en").t;
  const part = (index: number, count: number): PartName => ({ kind: "part", index, count });
  const MORNING: PartName = { kind: "half", half: "morning" };
  const AFTERNOON: PartName = { kind: "half", half: "afternoon" };

  it("names the halves and the whole day by name, smaller parts by their place in the day", () => {
    expect([partText(MORNING, de), partText(AFTERNOON, de), partText({ kind: "day" }, de)]).toEqual(["vormittags", "nachmittags", "Ganzer Tag"]);
    expect([partText(MORNING, en), partText(AFTERNOON, en), partText({ kind: "day" }, en)]).toEqual(["Morning", "Afternoon", "Full day"]);
    expect(partText(part(4, 16), de)).toBe("4. Sechzehntel");
    expect(partText(part(4, 16), en)).toBe("4th sixteenth");
    expect(partText(part(2, 4), de)).toBe("2. Viertel");
    expect(partText(part(2, 4), en)).toBe("2nd quarter");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32].map((index) => partText(part(index, 32), en))).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "32nd"].map((ordinal) => `${ordinal} thirty-second`),
    );
  });

  it("has a name for every number of parts a bar can have", () => {
    const counts = [3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32];
    expect(counts.map((count) => partText(part(1, count), de))).toEqual(
      ["Drittel", "Viertel", "Fünftel", "Sechstel", "Achtel", "Zehntel", "Zwölftel", "Fünfzehntel", "Sechzehntel", "Zwanzigstel", "Vierundzwanzigstel", "Dreißigstel", "Zweiunddreißigstel"].map(
        (share) => `1. ${share}`,
      ),
    );
    expect(counts.map((count) => partText(part(1, count), en))).toEqual(
      ["third", "quarter", "fifth", "sixth", "eighth", "tenth", "twelfth", "fifteenth", "sixteenth", "twentieth", "twenty-fourth", "thirtieth", "thirty-second"].map(
        (share) => `1st ${share}`,
      ),
    );
  });

  it("names a fixed block by where it lies and what it is", () => {
    // 24 December: work in the morning, the afternoon free.
    const free = detailOf(12, 24).leave?.segments.find((segment): segment is FixedSegment => segment.kind === "free");
    expect(free && [fixedText(free, de), fixedText(free, en)]).toEqual(["nachmittags: frei", "Afternoon: off"]);
    // A range of smaller parts names their share once.
    expect(fixedText({ kind: "free", from: 360, to: 480, first: part(13, 16), last: part(16, 16) }, de)).toBe("13. bis 16. Sechzehntel: frei");
    expect(fixedText({ kind: "free", from: 360, to: 480, first: part(13, 16), last: part(16, 16) }, en)).toBe("13th to 16th sixteenth: off");
    expect(fixedText({ kind: "mandatory", from: 0, to: 360, first: part(1, 4), last: part(3, 4) }, de)).toBe("1. bis 3. Viertel: Pflichturlaub");
    expect(fixedText({ kind: "mandatory", from: 0, to: 360, first: part(1, 4), last: part(3, 4) }, en)).toBe("1st to 3rd quarter: mandatory leave");
    expect(fixedText({ kind: "free", from: 160, to: 480, first: part(2, 3), last: part(3, 3) }, de)).toBe("2. bis 3. Drittel: frei");
    expect(fixedText({ kind: "otherPlan", from: 300, to: 345, first: part(21, 32), last: part(23, 32) }, en)).toBe("21st to 23rd thirty-second: from another plan");
    expect(fixedText({ kind: "mandatory", from: 240, to: 480, first: AFTERNOON, last: AFTERNOON }, de)).toBe("nachmittags: Pflichturlaub");
    expect(fixedText({ kind: "otherPlan", from: 120, to: 240, first: part(2, 4), last: part(2, 4) }, en)).toBe("2nd quarter: from another plan");
    // A block over the whole day is the whole day, not its first to its last part.
    expect(fixedText({ kind: "otherPlan", from: 0, to: 480, first: MORNING, last: AFTERNOON }, de)).toBe("Ganzer Tag: aus anderem Plan");
    expect(fixedText({ kind: "mandatory", from: 0, to: 480, first: part(1, 16), last: part(16, 16) }, en)).toBe("Full day: mandatory leave");
    // Time without work from inside a part to the end of the day is not the whole day: from the morning to the afternoon.
    expect(fixedText({ kind: "free", from: 100, to: 480, first: MORNING, last: AFTERNOON }, en)).toBe("Morning to afternoon: off");
    expect(fixedText({ kind: "free", from: 100, to: 480, first: MORNING, last: AFTERNOON }, de)).toBe("vormittags bis nachmittags: frei");
  });

  it("names a switch by its part, and one over time without work like the fixed block it stands for", () => {
    // A ¾ day with own leave lying only on its free last quarter (from a file): two afternoon switches.
    const day = {
      ...at(6, 14),
      required: { ...at(6, 14).required, value: 360, freePart: "end" as const },
      leave: [{ kind: "own" as const, take: 120, part: "end" as const }],
    };
    const switches = leaveSwitch(day, 240).segments.filter((segment): segment is SwitchSegment => segment.kind === "switch");
    expect(switches.map((segment) => switchText(segment, en))).toEqual(["Morning", "Afternoon", "Afternoon: off"]);
    expect(switches.map((segment) => switchText(segment, de))).toEqual(["vormittags", "nachmittags", "nachmittags: frei"]);
    // Free time at the start: the work lies at the end of the day.
    const morningOff = { ...day, required: { ...day.required, value: 240, freePart: "start" as const }, leave: [{ kind: "own" as const, take: 240, part: "start" as const }] };
    const named = leaveSwitch(morningOff, 240).segments.flatMap((segment) => (segment.kind === "switch" ? [switchText(segment, en)] : []));
    expect(named).toEqual(["Morning: off", "Afternoon"]);
    // The switch says itself whether it stands over time without work.
    const afternoon: SwitchSegment = { kind: "switch", from: 240, to: 480, name: AFTERNOON, pressed: "true", fills: [], onFree: true };
    expect(switchText(afternoon, de)).toBe("nachmittags: frei");
    expect(switchText({ ...afternoon, onFree: false }, de)).toBe("nachmittags");
    expect(switchText({ ...afternoon, name: part(13, 16), onFree: true }, en)).toBe("13th sixteenth: off");
  });
});
