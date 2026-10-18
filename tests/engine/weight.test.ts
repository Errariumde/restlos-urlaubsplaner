// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatAmount, formatWeight, parseAmount, parseWeight, WeightError } from "../../src/engine/weight";

// lib has no DOM; performance exists in Node and in Firefox.
declare const performance: { now(): number };

const code = (s: string) => {
  try {
    parseWeight(s);
    return "ok";
  } catch (e) {
    return (e as WeightError).code;
  }
};

describe("parseWeight", () => {
  it.each([
    ["1", 480], ["0", 0], ["1/2", 240], ["0.5", 240], ["3/32", 45], ["0.03125", 15], ["2/4", 240],
    ["1.0", 480], ["0.50000000000", 240], ["1/480", 1], ["0.3", 144], ["480/480", 480],
  ])("parses %j as %i units", (s, units) => expect(parseWeight(s)).toBe(units));

  it.each(["", " 1", "1 ", "0,5", "-1/2", "-0.5", "1/0", "1/", "/2", ".5", "1.", "1e0", "½", "1/2/3", "0x1", "+1",
    "1\n", "1".repeat(30) + "/2", "1/" + "1".repeat(30)])(
    "rejects %j as syntax", (s) => expect(code(s)).toBe("syntax"));
  it.each(["2", "3/2", "1.5", "1.000000001", "00002", "1" + "0".repeat(30)])(
    "rejects %j as range", (s) => expect(code(s)).toBe("range"));
  it.each(["1/7", "0.33", "0.333", "1/960", "0.001", "0." + "1".repeat(40)])(
    "rejects %j as inexact", (s) => expect(code(s)).toBe("inexact"));

  it("accepts leading zeros and carries name and input on errors", () => {
    expect(parseWeight("0001/0002")).toBe(240);
    const e = (() => { try { parseWeight("0,5"); } catch (x) { return x as WeightError; } })();
    expect(e).toBeInstanceOf(WeightError);
    expect(e?.name).toBe("WeightError");
    expect(e?.input).toBe("0,5");
    expect(e?.message).toContain("0,5");
  });

  it("accepts 12-digit fraction terms and rejects 13 digits as syntax", () => {
    expect(parseWeight("999999999999/999999999999")).toBe(480);
    expect(code("9999999999999/9999999999999")).toBe("syntax");
  });

  it("handles very long input in linear time", () => {
    const n = 1_000_000;
    for (const [input, expected] of [
      ["0." + "0".repeat(n) + "1", "inexact"],
      ["0." + "0".repeat(n), "ok"],
      ["0".repeat(n) + "1", "ok"],
      ["1".repeat(n) + "/2", "syntax"],
    ] as const) {
      const start = performance.now();
      expect(code(input)).toBe(expected);
      expect(performance.now() - start).toBeLessThan(1000);
    }
  });

  it("gives an integer in 0..480 or a WeightError for any string", () => {
    const digitish = fc.stringMatching(/^[0-9./]{0,40}$/);
    const check = (s: string) => {
      try {
        const units = parseWeight(s);
        return Number.isInteger(units) && units >= 0 && units <= 480;
      } catch (e) {
        return e instanceof WeightError && ["syntax", "range", "inexact"].includes(e.code);
      }
    };
    fc.assert(fc.property(fc.string(), check));
    fc.assert(fc.property(digitish, check));
  });

  it("parses k/32 as k * 15 units", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 32 }), (k) => parseWeight(`${k}/32`) === k * 15));
  });
});

describe("formatWeight", () => {
  it.each([
    [0, "0"], [480, "1"], [240, "1/2"], [45, "3/32"], [15, "1/32"], [1, "1/480"], [144, "3/10"], [160, "1/3"],
  ])("writes %i units as %j", (units, text) => expect(formatWeight(units)).toBe(text));
  it("round-trips every multiple of 1/480 day", () => {
    for (let units = 0; units <= 480; units++) expect(parseWeight(formatWeight(units))).toBe(units);
  });
  it.each([-1, 481, 1.5, Number.NaN])(
    "rejects %j", (units) => expect(() => formatWeight(units)).toThrow(RangeError));
});

describe("parseAmount", () => {
  it.each([["33", 15_840], ["0", 0], ["12.5", 6000], ["25/2", 6000], ["1/480", 1]])("reads %j", (text, units) =>
    expect(parseAmount(text)).toBe(units));
  it.each(["-1", "1,5", "", "1e3", "99999999999999999999", "10001"])("rejects %j", (text) =>
    expect(() => parseAmount(text)).toThrow(WeightError));
  it("writes amounts as fractions and round-trips", () => {
    expect(formatAmount(15_840)).toBe("33");
    expect(formatAmount(6000)).toBe("25/2");
    for (const units of [0, 1, 239, 240, 481, 15_840, 4_800_000]) expect(parseAmount(formatAmount(units))).toBe(units);
  });
});
