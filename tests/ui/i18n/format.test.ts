// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { dayFromYmd } from "../../../src/engine/days";
import { dayCount, formatDate, formatDays } from "../../../src/ui/i18n/format";

describe("formatDays", () => {
  it("formats day amounts with ½", () => {
    expect(formatDays(720, "de")).toBe("1½");
    expect(formatDays(240, "en")).toBe("½");
    expect(formatDays(-1200, "de")).toBe("−2½");
    expect(formatDays(14400, "en")).toBe("30");
    expect(formatDays(0, "de")).toBe("0");
  });

  it("falls back to up to two decimals for other fractions", () => {
    expect(formatDays(160, "en")).toBe("0.33");
    expect(formatDays(160, "de")).toBe("0,33");
    expect(formatDays(-160, "en")).toBe("−0.33");
  });

  it("formats the pseudo-locales like English", () => {
    expect(formatDays(720, "en-XA")).toBe("1½");
    expect(formatDays(160, "en-XB")).toBe("0.33");
  });
});

describe("dayCount", () => {
  it("is the number of days for plural selection", () => {
    expect(dayCount(480)).toBe(1);
    expect(dayCount(720)).toBe(1.5);
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
