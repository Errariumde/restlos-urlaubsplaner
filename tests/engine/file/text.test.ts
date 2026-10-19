// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { Report } from "../../../src/engine/file/report";
import { readText, textFor } from "../../../src/engine/file/text";

const read = (value: unknown) => {
  const report = new Report();
  return { text: readText(value, "contract.name", 200, report), report: report.entries };
};

describe("readText", () => {
  it.each(["Heiligabend", { de: "Heiligabend", en: "Christmas Eve" }, { fr: "Réveillon" }])("accepts %j", (value) =>
    expect(read(value)).toEqual({ text: value, report: [] }));
  it.each([{}, { DE: "x" }, { de: 1 }, 3])("reports invalidEntry for %j", (value) =>
    expect(read(value)).toEqual({ text: undefined, report: [{ code: "invalidEntry", path: "contract.name" }] }));
  it.each(["__proto__", "constructor", "prototype"])("treats a language map with the key %s like one with a bad language code", (key) =>
    expect(read(JSON.parse(`{"de":"x","${key}":"y"}`))).toEqual({ text: undefined, report: [{ code: "invalidEntry", path: "contract.name" }] }));
  it("reports textTooLong above the limit", () =>
    expect(read("x".repeat(201))).toMatchObject({ text: undefined, report: [{ code: "textTooLong", path: "contract.name" }] }));
  it("counts code points, not UTF-16 units (Review Focus 4)", () => {
    expect(read("😀".repeat(200)).report).toEqual([]);
    expect(read("😀".repeat(201))).toEqual({ text: undefined, report: [{ code: "textTooLong", path: "contract.name", data: { limit: 200 } }] });
  });
  it("checks the length of every language", () =>
    expect(read({ de: "x", en: "y".repeat(201) })).toMatchObject({ report: [{ code: "textTooLong", path: "contract.name", data: { language: "en" } }] }));
});

describe("textFor", () => {
  it("picks the language, else English, else the first entry", () => {
    expect(textFor({ de: "A", en: "B" }, "de")).toBe("A");
    expect(textFor({ de: "A", en: "B" }, "fr")).toBe("B");
    expect(textFor({ de: "A" }, "fr")).toBe("A");
    expect(textFor("x", "en")).toBe("x");
  });
});
