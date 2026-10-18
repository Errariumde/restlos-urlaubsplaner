// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readFile } from "../../../src/engine/file/read";
import { MINIMAL_CONTRACT, minimal } from "./helpers";

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
    ["invalidCore", minimal({ id: "" })],
    ["invalidCore", minimal({ revision: 0 })],
    ["invalidCore", minimal({ revision: 1e300 })],
  ])("refuses with %s", (code, text) => expect(readFile(text)).toMatchObject({ ok: false, refusal: { code } }));
  it("reports unknown fields and drops them", () =>
    expect(readFile(minimal({ savedAt: "2026-10-17T14:02:00Z" }))).toMatchObject({ ok: true, report: [{ code: "unknownField", path: "savedAt" }] }));
  it("reports the old work hours and time zone as unknown fields (0005)", () =>
    expect(readFile(minimal({ contract: { ...MINIMAL_CONTRACT, timeZone: "Europe/Berlin", workHours: { am: "08:00-12:00" } } })))
      .toMatchObject({ ok: true, report: [{ code: "unknownField", path: "contract.timeZone" }, { code: "unknownField", path: "contract.workHours" }] }));
  it("never throws, whatever the JSON", () => fc.assert(fc.property(fc.json(), (text) => { readFile(text); })));
  it("never throws for JSON shaped like a file", () =>
    fc.assert(fc.property(fc.jsonValue(), (value) => { readFile(minimal({ contract: value, sources: value, id: value, revision: value })); })));
});
