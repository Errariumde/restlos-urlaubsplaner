// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkSpeech, formatCheck, procedure, resultKind, speechOk, spokenTexts, STEPS } from "../../scripts/orca-speech.ts";

/** A line of Orca 50's debug log that it spoke, with the voice it used or without one. */
const said = (text: string, voice = true): string =>
  `20:15:12.044079 - SPEECH OUTPUT: '${text}'${voice ? " {'established': False, 'family': {'name': 'sabrina', 'lang': 'de'}}" : ""}`;

/** The results of the steps in English, as the hint line says them with the example. */
const RESULTS = [
  "15 Jan: leave full. 7 days left. ",
  "15 Jan: leave half, afternoon. 7½ days left.",
  "15 Jan: no leave. 8 days left. ",
  "Undone. 7½ days left.",
  "Redone. 8 days left. ",
  "15 Jan: leave full. 7 days left.",
  "Undone. 8 days left. ",
];

function log(lines: readonly string[]): string {
  return ["20:15:12.031646 - EVENT_MANAGER: Ignoring object:text-changed:insert:system", ...lines, ""].join("\n");
}

describe("spokenTexts", () => {
  it("takes the text of each speech line, with white space as single spaces", () => {
    const texts = spokenTexts(log([said("Week 2 Zeilenkopf Friday, 15 January 2027, working day, no leave."), said("space", false), said(RESULTS[0]!)]));
    expect(texts).toEqual(["Week 2 Zeilenkopf Friday, 15 January 2027, working day, no leave.", "space", "15 Jan: leave full. 7 days left."]);
  });

  it("keeps an apostrophe inside the text", () => {
    expect(spokenTexts(log([said("New Year's Day")]))).toEqual(["New Year's Day"]);
  });
});

describe("resultKind", () => {
  it("knows the hint line's results in both languages and nothing else", () => {
    expect(resultKind("15 Jan: leave full. 7 days left.")).toBe("day");
    expect(resultKind("15. Jan.: ganzer Tag Urlaub. 7 Tage übrig.")).toBe("day");
    expect(resultKind("Rückgängig. 7½ Tage übrig.")).toBe("undo");
    expect(resultKind("Redone. 1 day over the allowance.")).toBe("redo");
    expect(resultKind("Wiederholt. 2 Tage über dem Kontingent.")).toBe("redo");
    expect(resultKind("Friday, 15 January 2027, working day, leave full, costs 1.")).toBeUndefined();
  });
});

describe("checkSpeech", () => {
  const steps = (results: readonly string[]): string[] => ["Tab", "space", ...results.flatMap((result) => ["Control_L", result])];

  it("passes when every step's result was said once, in order", () => {
    const check = checkSpeech(spokenTexts(log(steps(RESULTS).map((text) => said(text)))));
    expect(check.results).toHaveLength(7);
    expect(check.mismatch).toBe("");
    expect(speechOk(check)).toBe(true);
    expect(formatCheck(check)).toContain("Every result was said, in order.");
  });

  it("says which results are missing when the hint line wasn't heard", () => {
    const check = checkSpeech(spokenTexts(log(["space", "h", "Delete", "Control_L", "Control_L"].map((text) => said(text)))));
    expect(check.mismatch).toBe("Expected the results day, day, day, undo, redo, day, undo; heard none.");
    // Two Ctrl presses in a row echo the same key: that isn't something said twice.
    expect(check.repeated).toEqual([]);
    expect(speechOk(check)).toBe(false);
  });

  it("finds a text said twice in a row", () => {
    const twice = [...RESULTS.slice(0, 1), ...RESULTS];
    const check = checkSpeech(spokenTexts(log(twice.map((text) => said(text)))));
    expect(check.repeated).toEqual(["15 Jan: leave full. 7 days left."]);
    expect(check.mismatch).toContain("heard day, day, day, day, undo");
    expect(speechOk(check)).toBe(false);
  });

  it("notes a very long text, such as a whole row, without failing on it", () => {
    const row = Array.from({ length: 7 }, (_, day) => `Day ${String(day + 11)} January 2027, working day, no leave`).join(" ");
    const check = checkSpeech(spokenTexts(log([...RESULTS, row].map((text) => said(text)))));
    expect(check.long).toEqual([row]);
    expect(speechOk(check)).toBe(true);
    expect(formatCheck(check)).toContain("Long texts (worth a look):");
  });
});

describe("procedure", () => {
  it("names every step's keys and the command that reads the log", () => {
    const text = procedure();
    for (const step of STEPS) expect(text).toContain(step.keys);
    expect(text).toContain("npm run orca -- /tmp/orca.log");
  });
});
