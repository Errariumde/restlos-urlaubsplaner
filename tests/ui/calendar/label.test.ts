// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import type { DayResult } from "../../../src/engine/counting/plan.ts";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { cellLabel } from "../../../src/ui/calendar/label.ts";
import type { Catalog, Locale } from "../../../src/ui/i18n/locale.ts";
import type { PlanMeta } from "../../../src/ui/worker/protocol.ts";

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

const meta = { weekend: ["sat", "sun"] } as unknown as PlanMeta;

interface Options {
  day: number;
  required?: number;
  holiday?: string;
  sources?: unknown[];
  leave?: unknown[];
  cost?: number;
}

function result({ day, required = 480, holiday, sources = [], leave = [], cost = 0 }: Options): DayResult {
  return {
    day,
    inPeriod: true,
    facts: { day, holidays: holiday ? [{ day, ruleId: "r", nameKey: holiday, substitute: false }] : [], sources },
    required: { value: required },
    leave,
    evaluation: { cost, ownCost: leave.some((p) => (p as { kind: string }).kind === "own") ? cost : 0 },
  } as unknown as DayResult;
}

const friday = dayFromYmd(2027, 5, 7);
const own = { kind: "own", take: 480, part: "end" };

describe("cellLabel", () => {
  const planned = result({ day: friday, leave: [own], cost: 480 });

  it("reads a planned working day in English", () => {
    expect(cellLabel(planned, meta, i18n("en"))).toBe("Friday, 7 May 2027, working day, leave full, costs 1");
  });

  it("reads a planned working day in German", () => {
    expect(cellLabel(planned, meta, i18n("de"))).toBe("Freitag, 7. Mai 2027, Arbeitstag, Urlaub ganz, kostet 1");
  });

  it("leaves out the cost when nothing is taken", () => {
    expect(cellLabel(result({ day: friday }), meta, i18n("en"))).toBe("Friday, 7 May 2027, working day, no leave");
  });

  it("names a holiday", () => {
    const label = cellLabel(result({ day: dayFromYmd(2027, 12, 25), required: 0, holiday: "holiday.christmas-day" }), meta, i18n("en"));
    expect(label).toBe("Saturday, 25 December 2027, holiday Christmas Day, no leave");
  });

  it("recognises weekends and half required days", () => {
    expect(cellLabel(result({ day: friday + 1, required: 0 }), meta, i18n("en"))).toContain(", weekend, ");
    expect(cellLabel(result({ day: friday, required: 240 }), meta, i18n("en"))).toContain(", half working day, ");
  });

  it("tells half, mandatory and other-plan leave apart", () => {
    const half = result({ day: friday, leave: [{ kind: "own", take: 240, part: "end" }], cost: 240 });
    expect(cellLabel(half, meta, i18n("en"))).toContain(", leave half, afternoon, costs ½");
    expect(cellLabel(half, meta, i18n("de"))).toContain(", Urlaub halb, nachmittags, kostet ½");
    const morning = result({ day: friday, leave: [{ kind: "own", take: 240, part: "start" }], cost: 240 });
    expect(cellLabel(morning, meta, i18n("en"))).toContain(", leave half, morning, costs ½");
    expect(cellLabel(morning, meta, i18n("de"))).toContain(", Urlaub halb, vormittags, kostet ½");
    expect(cellLabel(result({ day: friday, leave: [{ kind: "mandatory", take: 480, part: "end" }], cost: 480 }), meta, i18n("en"))).toContain(", mandatory leave, ");
    expect(cellLabel(result({ day: friday, leave: [{ kind: "otherPlan", from: 0, to: 480 }] }), meta, i18n("en"))).toContain(", leave in another plan");
  });

  it("decides the kind from the required work first", () => {
    const saturday = friday + 1;
    expect(cellLabel(result({ day: saturday, required: 480 }), meta, i18n("en"))).toBe("Saturday, 8 May 2027, working day, no leave");
    const eve = dayFromYmd(2027, 12, 24);
    expect(cellLabel(result({ day: eve, required: 240, holiday: "holiday.christmas-day" }), meta, i18n("en"))).toBe(
      "Friday, 24 December 2027, half working day, Christmas Day, no leave",
    );
    expect(cellLabel(result({ day: eve, required: 240, holiday: "holiday.christmas-day" }), meta, i18n("de"))).toContain(", halber Arbeitstag, 1. Weihnachtstag,");
    // A holiday that a rule also makes free stays a holiday; a holiday that is worked is a working day.
    const sunday = dayFromYmd(2027, 5, 9);
    expect(cellLabel(result({ day: sunday, required: 0, holiday: "holiday.christmas-day" }), meta, i18n("en"))).toContain(", holiday Christmas Day, ");
    expect(cellLabel(result({ day: friday, required: 480, holiday: "holiday.christmas-day" }), meta, i18n("en"))).toContain(", working day, ");
  });

  it("calls a day without work that is neither weekend nor holiday a day off", () => {
    expect(cellLabel(result({ day: friday, required: 0 }), meta, i18n("en"))).toBe("Friday, 7 May 2027, day off, no leave");
    expect(cellLabel(result({ day: friday, required: 0 }), meta, i18n("de"))).toContain(", arbeitsfrei, ");
  });

  it("reports own leave when mandatory leave is there too, and not full without own leave", () => {
    const both = result({ day: friday, leave: [{ kind: "mandatory", take: 240, part: "start" }, own], cost: 480 });
    expect(cellLabel(both, meta, i18n("en"))).toContain(", leave full, ");
    const zero = result({ day: friday, leave: [{ kind: "own", take: 0, part: "end" }] });
    expect(cellLabel(zero, meta, i18n("en"))).toContain(", no leave");
  });

  it("adds nothing for an empty source list", () => {
    expect(cellLabel(planned, meta, i18n("en"), [])).toBe("Friday, 7 May 2027, working day, leave full, costs 1");
  });

  it("appends the source names", () => {
    const label = cellLabel(planned, meta, i18n("en"), ["School holidays", "Team trip"]);
    expect(label).toBe("Friday, 7 May 2027, working day, leave full, costs 1, calendars School holidays and Team trip");
    expect(cellLabel(planned, meta, i18n("de"), ["A", "B", "C"])).toBe("Freitag, 7. Mai 2027, Arbeitstag, Urlaub ganz, kostet 1, Kalender A, B und C");
  });
});

describe("a day of a holiday calendar", () => {
  const cityMeta = {
    weekend: ["sat", "sun"],
    sources: [{ id: "city", name: { de: "Stadtfeiertage", en: "City holidays" }, type: "holiday", color: { slot: "accent-1" }, visible: true }],
  } as unknown as PlanMeta;
  const tuesday = dayFromYmd(2027, 2, 9);
  const shrove = { de: "Faschingsdienstag", en: "Shrove Tuesday" };
  const entry = (required: number, name: unknown = shrove) => ({ type: "holiday", day: tuesday, sourceId: "city", required, ...(name ? { name } : {}) });

  it("is a holiday named after its entry", () => {
    const day = result({ day: tuesday, required: 0, sources: [entry(0)] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toBe("Tuesday, 9 February 2027, holiday Shrove Tuesday, no leave");
    expect(cellLabel(day, cityMeta, i18n("de"))).toBe("Dienstag, 9. Februar 2027, Feiertag Faschingsdienstag, kein Urlaub");
  });

  it("is named after its calendar when the entry has no name", () => {
    const day = result({ day: tuesday, required: 0, sources: [entry(0, null)] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toContain(", holiday City holidays, ");
  });

  it("is a half working day with the holiday's name when it frees part of the day", () => {
    const day = result({ day: tuesday, required: 240, sources: [entry(240)] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toContain(", half working day, Shrove Tuesday, ");
  });

  it("stays a working day when it is worked", () => {
    const day = result({ day: tuesday, required: 480, sources: [entry(0)] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toContain(", working day, ");
  });

  it("is no holiday when its entry keeps the full day", () => {
    const saturday = dayFromYmd(2027, 2, 13);
    const day = result({ day: saturday, required: 0, sources: [{ ...entry(480), day: saturday }] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toContain(", weekend, ");
  });

  it("gives way to a public holiday's name", () => {
    const day = result({ day: tuesday, required: 0, holiday: "holiday.christmas-day", sources: [entry(0)] });
    expect(cellLabel(day, cityMeta, i18n("en"))).toContain(", holiday Christmas Day, ");
  });
});
