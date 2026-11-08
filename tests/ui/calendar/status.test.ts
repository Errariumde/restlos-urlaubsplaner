// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days.ts";
import { announced, statusText } from "../../../src/ui/calendar/status.ts";
import type { Catalog, Locale } from "../../../src/ui/i18n/locale.ts";
import type { PlanState } from "../../../src/ui/worker/protocol.ts";
import { Session } from "../../../src/ui/worker/session.ts";

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

const example = readFileSync("examples/plans/beispiel-gmbh-2027.urlaub.json", "utf8");
const friday = dayFromYmd(2027, 1, 15);

describe("statusText", () => {
  const session = new Session();
  const opened = session.open(example, true) as PlanState;
  const planned = session.apply([{ day: friday, take: 480 }]);

  it("says what one changed day has now, and what is left", () => {
    expect(statusText({ kind: "day", day: friday }, planned, i18n("de"))).toBe("15. Jan.: ganzer Tag Urlaub. 7 Tage übrig.");
    expect(statusText({ kind: "day", day: friday }, planned, i18n("en"))).toBe("15 Jan: leave full. 7 days left.");
    expect(statusText({ kind: "day", day: friday }, opened, i18n("de"))).toBe("15. Jan.: kein Urlaub. 8 Tage übrig.");
  });

  it("says no leave on a removed day that the result doesn't cover, far outside the plan period", () => {
    // Leave on 3 January 2029, more than a year after the period, is a problem with a remove button; removing it
    // is reported for that day.
    const far = dayFromYmd(2029, 1, 3);
    const outside = new Session();
    outside.open(example, true);
    outside.apply([{ day: far, take: 480 }]);
    const removed = outside.apply([{ day: far, take: 0 }]);
    expect(statusText({ kind: "day", day: far }, removed, i18n("de"))).toBe("3. Jan.: kein Urlaub. 8 Tage übrig.");
    expect(statusText({ kind: "day", day: far }, removed, i18n("en"))).toBe("3 Jan: no leave. 8 days left.");
  });

  it("counts several changed days", () => {
    expect(statusText({ kind: "days", count: 5 }, planned, i18n("de"))).toBe("5 Tage geändert. 7 Tage übrig.");
    expect(statusText({ kind: "days", count: 5 }, planned, i18n("en"))).toBe("5 days changed. 7 days left.");
  });

  it("names undo and redo", () => {
    expect(statusText({ kind: "undo" }, opened, i18n("de"))).toBe("Rückgängig. 8 Tage übrig.");
    expect(statusText({ kind: "redo" }, planned, i18n("en"))).toBe("Redone. 7 days left.");
  });

  it("ends with how far the allowance is exceeded, and with half a day in the singular", () => {
    const over = { ...planned, result: { ...planned.result, totals: { ...planned.result.totals, remaining: -840 } } } as PlanState;
    expect(statusText({ kind: "days", count: 2 }, over, i18n("de"))).toBe("2 Tage geändert. 1¾ Tage über dem Kontingent.");
    expect(statusText({ kind: "days", count: 2 }, over, i18n("en"))).toBe("2 days changed. 1¾ days over the allowance.");
    const half = { ...planned, result: { ...planned.result, totals: { ...planned.result.totals, remaining: 240 } } } as PlanState;
    expect(statusText({ kind: "undo" }, half, i18n("de"))).toBe("Rückgängig. ½ Tag übrig.");
  });

  it("says why H did nothing in a plan without half days", () => {
    expect(statusText({ kind: "noHalfDays" }, planned, i18n("de"))).toBe("In diesem Plan gibt es keine halben Tage.");
  });

  it("says nothing without a plan", () => {
    expect(statusText({ kind: "undo" }, undefined, i18n("en"))).toBe("");
  });
});

describe("announced", () => {
  it("makes the same words a new text every second time", () => {
    expect(announced("Undone.", 1)).toBe("Undone.\u00a0");
    expect(announced("Undone.", 2)).toBe("Undone.");
    expect(announced("Undone.", 3)).not.toBe(announced("Undone.", 4));
  });
});
