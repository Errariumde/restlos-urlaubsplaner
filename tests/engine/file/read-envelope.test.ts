// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readFile } from "../../../src/engine/file/read";
import { SEVERITY } from "../../../src/engine/file/severity";
import { BAVARIA_CONTRACT, MINIMAL_CONTRACT, core, minimal, planFile, refusedWith } from "./helpers";

const rules = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `r${String(i)}`, match: { type: "fixed", month: 1, day: 1 }, requiredAtMost: "0" }));
/** A plan file without `id`, `contract.week` and `plan.allowance`; `contract` keys are added to its contract. */
const withoutCore = (contract: Record<string, unknown> = {}) =>
  planFile({ allowance: undefined }, { id: undefined, contract: { ...BAVARIA_CONTRACT, week: undefined, ...contract } });

describe("readFile: a refused file lists every Error", () => {
  it("lists every missing core value at once", () =>
    expect(readFile(withoutCore())).toEqual(
      refusedWith(core("missingValue", "id"), core("missingValue", "contract.week"), core("missingValue", "plan.allowance")),
    ));
  it("lists the Errors of the other parts too, but no Warnings (Review Focus 3)", () =>
    expect(readFile(withoutCore({ minUnit: "x", rules: [{ id: "r1", requiredAtMost: "1/2" }] }))).toEqual(
      refusedWith(
        core("missingValue", "id"),
        core("missingValue", "contract.week"),
        { code: "missingValue", path: "contract.rules[0].match", dropped: "contract.rules[0]" },
        core("missingValue", "plan.allowance"),
      ),
    ));
  it("refuses a plan file without a state in a country with regions", () =>
    expect(readFile(planFile({}, { contract: { ...BAVARIA_CONTRACT, region: { country: "DE" } } }))).toEqual(
      refusedWith(core("missingValue", "contract.region.state")),
    ));
  it.each([
    ["notJson", "{"],
    ["tooLarge", " ".repeat(10_485_761)],
    ["newerSchema", minimal({ schema: "restlos/2" })],
    ["unknownKind", minimal({ kind: "x" })],
    ["kindMismatch", minimal({ plan: {} })],
    ["limitExceeded", minimal({ contract: { ...MINIMAL_CONTRACT, rules: rules(1001) } })],
    ["limitExceeded", minimal({ id: undefined, contract: { ...MINIMAL_CONTRACT, rules: rules(1001) } })],
  ])("still stops at once with %s", (code, text) => {
    const result = readFile(text);
    expect(result).toMatchObject({ ok: false, refusal: { code } });
    expect(!result.ok && result.report).toEqual([]);
  });
});

describe("readFile envelope", () => {
  it("reads a minimal rule set with an empty report", () => {
    const result = readFile(minimal());
    expect(result).toMatchObject({ ok: true, report: [] });
    if (result.ok) expect(result.file).toMatchObject({ kind: "ruleSet", revision: 1, contract: { minUnit: 240, references: {} } });
  });
  it("ignores a leading byte-order mark (Review Focus 1)", () => expect(readFile("﻿" + minimal()).ok).toBe(true));
  it.each([
    ["notJson", "{"],
    ["tooLarge", " ".repeat(10_485_761)],
    ["unknownSchema", minimal({ schema: "urlaubsplaner/1" })],
    ["newerSchema", minimal({ schema: "restlos/2" })],
    ["unknownKind", minimal({ kind: "calendar" })],
    ["settingsNotSupported", minimal({ kind: "settings" })],
    ["kindMismatch", minimal({ plan: {} })],
    ["kindMismatch", minimal({ ruleSet: { id: "x", name: "x", revision: 1 } })],
  ])("refuses with %s", (code, text) => expect(readFile(text)).toMatchObject({ ok: false, refusal: { code } }));
  it.each([
    ["an empty id", minimal({ id: "" }), core("invalidValue", "id")],
    ["an id over 200 characters", minimal({ id: "x".repeat(201) }), core("invalidValue", "id")],
    ["revision 0", minimal({ revision: 0 }), core("invalidValue", "revision")],
    ["revision 1e300", minimal({ revision: 1e300 }), core("invalidValue", "revision")],
    ["no revision", minimal({ revision: undefined }), core("missingValue", "revision")],
    ["no contract", minimal({ contract: undefined }), core("missingValue", "contract")],
    ["a contract that isn't an object", minimal({ contract: [] }), core("invalidValue", "contract")],
  ])("refuses %s with invalidCore and its report entry", (_name, text, entry) => expect(readFile(text)).toEqual(refusedWith(entry)));
  it("reports unknown fields and drops them", () =>
    expect(readFile(minimal({ savedAt: "2026-10-17T14:02:00Z" }))).toMatchObject({ ok: true, report: [{ code: "unknownField", path: "savedAt" }] }));
  it("reports the old work hours and time zone as unknown fields (0005)", () =>
    expect(readFile(minimal({ contract: { ...MINIMAL_CONTRACT, timeZone: "Europe/Berlin", workHours: { am: "08:00-12:00" } } })))
      .toMatchObject({ ok: true, report: [{ code: "unknownField", path: "contract.timeZone" }, { code: "unknownField", path: "contract.workHours" }] }));
  // The catch-all of readFile answers invalidCore with an empty report; a fuzz input must never reach it. A real
  // invalidCore holds an Error that drops the whole file, and no Warning or Info (Review Focus 3).
  const notCaughtAll = (text: string) => {
    const result = readFile(text);
    if (result.ok || result.refusal.code !== "invalidCore") return;
    expect(result.report.some((entry) => entry.dropped === "")).toBe(true);
    expect(result.report.filter((entry) => SEVERITY[entry.code] !== "error")).toEqual([]);
  };
  it("never throws, whatever the JSON", () => fc.assert(fc.property(fc.json(), notCaughtAll)));
  it("never throws for JSON shaped like a file", () =>
    fc.assert(fc.property(fc.jsonValue(), (value) => { notCaughtAll(minimal({ contract: value })); })));
  it("never throws for a contract with random parts", () =>
    fc.assert(fc.property(fc.jsonValue(), fc.jsonValue(), fc.jsonValue(), (region, rules, references) => {
      notCaughtAll(minimal({ contract: { ...MINIMAL_CONTRACT, region, rules, references } }));
      notCaughtAll(minimal({ contract: { ...MINIMAL_CONTRACT, rules: [{ id: "x", requiredAtMost: "0", match: rules }], references } }));
    })));
});
