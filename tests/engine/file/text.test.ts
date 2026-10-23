// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { Report } from "../../../src/engine/file/report";
import { readText, textFor } from "../../../src/engine/file/text";

const read = (value: unknown) => {
  const report = new Report();
  return { text: readText(value, "contract.name", 200, report, "contract.name"), report: report.entries };
};

describe("readText", () => {
  it.each(["Heiligabend", { de: "Heiligabend", en: "Christmas Eve" }, { fr: "Réveillon" }])("accepts %j", (value) =>
    expect(read(value)).toEqual({ text: value, report: [] }));
  it("reports the key of a language map as deep as it looked, with the dropped part passed in", () => {
    const at = (value: unknown) => {
      const report = new Report();
      readText(value, "x", 200, report, "holder");
      return report.entries;
    };
    expect(at({ de: 5 })).toEqual([{ code: "invalidValue", path: "x.de", dropped: "holder" }]);
    expect(at({ EN: "a" })).toEqual([{ code: "invalidValue", path: "x.EN", dropped: "holder" }]);
    expect(at({})).toEqual([{ code: "invalidValue", path: "x", dropped: "holder" }]);
  });
  it.each([
    [{}, "contract.name"],
    [{ DE: "x" }, "contract.name.DE"],
    [{ de: 1 }, "contract.name.de"],
    [3, "contract.name"],
  ])("reports invalidValue for %j at %s", (value, path) =>
    expect(read(value)).toEqual({ text: undefined, report: [{ code: "invalidValue", path, dropped: "contract.name" }] }));
  it("reports a missing text as missingValue", () =>
    expect(read(undefined)).toEqual({ text: undefined, report: [{ code: "missingValue", path: "contract.name", dropped: "contract.name" }] }));
  it("reports every invalid key of a language map", () =>
    expect(read({ de: 1, en: "x", FR: "y" }).report).toEqual([
      { code: "invalidValue", path: "contract.name.de", dropped: "contract.name" },
      { code: "invalidValue", path: "contract.name.FR", dropped: "contract.name" },
    ]));
  it.each(["__proto__", "constructor", "prototype"])("treats a language map with the key %s like one with a bad language code", (key) =>
    expect(read(JSON.parse(`{"de":"x","${key}":"y"}`))).toEqual({ text: undefined, report: [{ code: "invalidValue", path: `contract.name.${key}`, dropped: "contract.name" }] }));
  it("reports textTooLong above the limit", () =>
    expect(read("x".repeat(201))).toMatchObject({ text: undefined, report: [{ code: "textTooLong", path: "contract.name" }] }));
  it("counts code points, not UTF-16 units (Review Focus 4)", () => {
    expect(read("😀".repeat(200)).report).toEqual([]);
    expect(read("😀".repeat(201))).toEqual({ text: undefined, report: [{ code: "textTooLong", path: "contract.name", dropped: "contract.name", data: { limit: 200 } }] });
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
