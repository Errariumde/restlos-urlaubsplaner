// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days";
import { formatDate, formatDays, formatList, pluralCount } from "../../../src/ui/i18n/format";

describe("formatDays", () => {
  it("formats day amounts with ½", () => {
    expect(formatDays(720, "de")).toBe("1½");
    expect(formatDays(240, "en")).toBe("½");
    expect(formatDays(-1200, "de")).toBe("−2½");
    expect(formatDays(14400, "en")).toBe("30");
    expect(formatDays(0, "de")).toBe("0");
  });

  it("writes other fractions with their glyph where Unicode has one", () => {
    expect(formatDays(120, "en")).toBe("¼");
    expect(formatDays(360, "de")).toBe("¾");
    expect(formatDays(160, "en")).toBe("⅓");
    expect(formatDays(60, "en")).toBe("⅛");
    expect(formatDays(48, "en")).toBe("⅒");
    expect(formatDays(600, "de")).toBe("1¼");
    expect(formatDays(-160, "en")).toBe("−⅓");
  });

  it("writes a fraction without a glyph as numerator/denominator, apart from the whole days", () => {
    expect(formatDays(45, "en")).toBe("3/32");
    expect(formatDays(30, "de")).toBe("1/16");
    expect(formatDays(144, "en")).toBe("3/10");
    expect(formatDays(525, "en")).toBe("1\u00a03/32");
    expect(formatDays(-45, "de")).toBe("−3/32");
  });

  it("formats the pseudo-locales like English", () => {
    expect(formatDays(720, "en-XA")).toBe("1½");
    expect(formatDays(160, "en-XB")).toBe("⅓");
  });
});

describe("pluralCount", () => {
  it("selects the singular up to one day and the plural above, whatever the sign", () => {
    expect(pluralCount(0)).toBe(0);
    expect(pluralCount(240)).toBe(1);
    expect(pluralCount(480)).toBe(1);
    expect(pluralCount(720)).toBe(2);
    expect(pluralCount(-240)).toBe(1);
  });

  it("gives a fraction the singular in a message: ½ day, 1 day, 1½ days", () => {
    const en = new IntlMessageFormat("{count, plural, one {{days} day} other {{days} days}}", "en");
    const de = new IntlMessageFormat("{count, plural, one {{days} Tag} other {{days} Tage}}", "de");
    const text = (format: IntlMessageFormat, units: number, locale: "de" | "en") =>
      format.format({ count: pluralCount(units), days: formatDays(units, locale) });
    expect([240, 480, 720].map((units) => text(en, units, "en"))).toEqual(["½ day", "1 day", "1½ days"]);
    expect([240, 480, 720].map((units) => text(de, units, "de"))).toEqual(["½ Tag", "1 Tag", "1½ Tage"]);
  });
});

describe("formatDate", () => {
  it("formats a date in UTC regardless of the machine's zone", () => {
    expect(formatDate(dayFromYmd(2027, 5, 7), "en", "long")).toBe("Friday, 7 May 2027");
    expect(formatDate(dayFromYmd(2027, 5, 7), "de", "long")).toBe("Freitag, 7. Mai 2027");
  });

  it("has a short date, a weekday and a month style", () => {
    expect(formatDate(dayFromYmd(2027, 5, 7), "en", "short")).toBe("7 May 2027");
    expect(formatDate(dayFromYmd(2027, 5, 7), "de", "short")).toBe("7. Mai 2027");
    expect(formatDate(dayFromYmd(2027, 5, 7), "en", "weekday")).toBe("Fri");
    expect(formatDate(dayFromYmd(2027, 5, 7), "de", "weekday")).toBe("Fr");
    expect(formatDate(dayFromYmd(2027, 5, 7), "en", "month")).toBe("May");
    expect(formatDate(dayFromYmd(2027, 3, 7), "de", "month")).toBe("März");
  });

  it("has a short month and a short month with the year", () => {
    expect(formatDate(dayFromYmd(2027, 1, 1), "en", "monthShort")).toBe("Jan");
    expect(formatDate(dayFromYmd(2027, 5, 1), "de", "monthShort")).toBe("Mai");
    expect(formatDate(dayFromYmd(2027, 12, 1), "en", "monthYear")).toBe("Dec 2027");
    expect(formatDate(dayFromYmd(2027, 3, 1), "de", "monthYear")).toBe("März 2027");
  });

  it("has a long month with the year, for the month tiles", () => {
    expect(formatDate(dayFromYmd(2027, 2, 1), "en", "monthLongYear")).toBe("February 2027");
    expect(formatDate(dayFromYmd(2027, 12, 1), "de", "monthLongYear")).toBe("Dezember 2027");
  });

  it("has a day and month without the year, for the hint line", () => {
    expect(formatDate(dayFromYmd(2027, 6, 14), "en", "dayMonth")).toBe("14 Jun");
    expect(formatDate(dayFromYmd(2027, 6, 14), "de", "dayMonth")).toBe("14. Juni");
  });

  it("formats the pseudo-locales like English", () => {
    expect(formatDate(dayFromYmd(2027, 5, 7), "en-XA", "long")).toBe("Friday, 7 May 2027");
  });
});

describe("formatList", () => {
  it("joins items with the language's conjunction", () => {
    expect(formatList(["A", "B", "C"], "en")).toBe("A, B and C");
    expect(formatList(["A", "B", "C"], "de")).toBe("A, B und C");
    expect(formatList(["A"], "en-XA")).toBe("A");
  });
});
