// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { suggestPart, suggestParts } from "../../../src/engine/counting/suggest";
import type { Part, PlanInput } from "../../../src/engine/counting/types";
import { BAVARIA, baseInput, CHRISTMAS_EVE_RULES, d, FULL, HALF, fixed } from "./helpers";

const suggest = (iso: string, take = HALF, changes: Partial<PlanInput> = {}) => suggestPart(baseInput(changes), d(iso), take);

describe("suggestPart", () => {
  it.each([
    ["2027-05-10", "start"], // Sunday before, Tuesday after
    ["2027-05-14", "end"], // Thursday before, Saturday after
    ["2027-05-07", null], // Ascension before, Saturday after
    ["2027-05-12", null], // working days on both sides
  ] as [string, Part | null][])("on %s suggests %j", (iso, expected) => expect(suggest(iso)).toBe(expected));
  it("suggests the end when the leave covers all work either way", () =>
    expect(suggest("2027-12-24", HALF, { contract: { ...BAVARIA, rules: CHRISTMAS_EVE_RULES } })).toBe("end"));
  it("suggests the side that frees the whole day", () =>
    expect(suggest("2027-12-24", HALF, { contract: { ...BAVARIA, rules: [{ id: "closes-at-noon", match: fixed(12, 24), mandatory: HALF }] } })).toBe(
      "start",
    ));
  it("ignores own leave already on that day", () => expect(suggest("2027-05-10", HALF, { leave: [{ day: d("2027-05-10"), take: FULL }] })).toBe("start"));
  it("suggests the end for a full day", () => expect(suggest("2027-05-12", FULL)).toBe("end"));
  it("sees free days before the period", () =>
    expect(suggest("2027-02-01", HALF, { period: { from: { year: 2027, month: 2 }, to: { year: 2027, month: 12 } } })).toBe("start"));
  it("returns null at the last supported day without throwing", () =>
    expect(suggest("9999-12-31", HALF, { period: { from: { year: 9999, month: 1 }, to: { year: 9999, month: 12 } } })).toBeNull());
  it.each([[1], [479]])("suggests the start on a Monday after a Sunday for take %i", (take) => expect(suggest("2027-05-10", take)).toBe("start"));
  it.each([
    ["2028-01-03", HALF],
    ["2027-05-12", 0],
    ["2027-05-12", 481],
  ] as [string, number][])("rejects %s with %i", (iso, take) => expect(() => suggest(iso, take)).toThrow(RangeError));
});

describe("suggestParts", () => {
  const cases: [string, number][] = [
    ["2027-05-10", HALF],
    ["2027-05-14", HALF],
    ["2027-05-07", HALF],
    ["2027-05-12", HALF],
    ["2027-05-12", FULL],
    ["2027-05-10", 1],
  ];
  it("gives the same answers as suggestPart per request", () => {
    const input = baseInput();
    expect(suggestParts(input, cases.map(([iso, take]) => ({ day: d(iso), take })))).toEqual(cases.map(([iso, take]) => suggestPart(input, d(iso), take)));
  });
  it("gives the same answers with own leave on the requested days", () => {
    const input = baseInput({ leave: [{ day: d("2027-05-10"), take: FULL }] });
    expect(suggestParts(input, [{ day: d("2027-05-10"), take: HALF }])).toEqual(["start"]);
  });
  it("answers each request without the leave of any requested day", () => {
    // Monday and Tuesday after a free Sunday; both already have leave in the input.
    const input = baseInput({ leave: [{ day: d("2027-05-10"), take: FULL }, { day: d("2027-05-11"), take: FULL }] });
    const requests = [{ day: d("2027-05-10"), take: HALF }, { day: d("2027-05-11"), take: HALF }];
    // Without the leave of both days: Monday joins the free Sunday ("start"), Tuesday has working days on both sides.
    expect(suggestParts(input, requests)).toEqual(["start", null]);
    // suggestPart keeps the other day's leave, which counts as free time: Monday has free time on both sides.
    expect(suggestPart(input, d("2027-05-10"), HALF)).toBeNull();
    expect(suggestPart(input, d("2027-05-11"), HALF)).toBe("start");
  });
  it("answers an empty list with an empty list", () => expect(suggestParts(baseInput(), [])).toEqual([]));
  it("rejects a day outside the period", () => expect(() => suggestParts(baseInput(), [{ day: d("2028-01-03"), take: HALF }])).toThrow(RangeError));
});
