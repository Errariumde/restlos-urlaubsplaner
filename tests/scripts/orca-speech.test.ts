// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkSpeech, formatCheck, procedure, readLog, resultKind, speechOk, STEPS } from "../../scripts/orca-speech.ts";

/** A line of Orca 50's debug log that it spoke, with the voice it used or without one. */
const said = (text: string, voice = true): string =>
  `20:15:12.044079 - SPEECH OUTPUT: '${text}'${voice ? " {'established': False, 'family': {'name': 'sabrina', 'lang': 'de'}}" : ""}`;

/** The lines Orca logs when Firefox sends it a text change: on arrival (twice, as Orca does) and when it queues it. */
const sent = (text: string): string[] => [
  `20:15:12.0 - CLIPBOARD PRESENTER: Possible change event object:text-changed:insert:system for [section (0x7cda20631f80)]  in Firefox (Gecko 153.5.0) (0, 21, ${text})`,
  `20:15:12.0 - EVENT MANAGER: object:text-changed:insert:system for [section (0x7cda20631b40)]  in Firefox (Gecko 153.5.0) (0, 21, ${text})`,
  `20:15:12.0 - EVENT MANAGER: Queueing object:text-changed:insert:system for [section (0x7cda20633b00)]  in Firefox (Gecko 153.5.0) (0, 21, ${text})`,
  `20:15:12.0 - EVENT MANAGER: object:text-changed:insert:system for [section (0x7cda20805fc0)]  in Firefox (Gecko 153.5.0) (0, 21, ${text}) has priority level: 4`,
];

/** The results of the steps in English, as the hint line says them with the example: every second ends in a no-break space. */
const RESULTS = [
  "15 Jan: leave full. 7 days left. ",
  "15 Jan: leave half, afternoon. 7½ days left.",
  "15 Jan: no leave. 8 days left. ",
  "Undone. 7½ days left.",
  "Redone. 8 days left. ",
  "15 Jan: leave full. 7 days left.",
  "Undone. 8 days left. ",
];

const log = (lines: readonly string[]): string => ["20:15:12.031646 - EVENT_MANAGER: Ignoring object:text-changed:insert:system", ...lines, ""].join("\n");

/** A run in which the app gives Orca each result and Orca says those `spoken` lets through. */
function run(spoken: (index: number) => boolean = () => true): string {
  return log(RESULTS.flatMap((text, index) => [said("Control_L", false), ...sent(text), ...(spoken(index) ? [said(text)] : [])]));
}

describe("readLog", () => {
  it("takes what Orca said, with white space as single spaces, and keeps an apostrophe", () => {
    const { spoken } = readLog(log([said("Week 2 Zeilenkopf Friday, 15 January 2027, working day, no leave."), said("space", false), said("New Year's Day")]));
    expect(spoken).toEqual(["Week 2 Zeilenkopf Friday, 15 January 2027, working day, no leave.", "space", "New Year's Day"]);
  });

  it("takes each result Firefox sent Orca once, also two with the same words", () => {
    const { delivered } = readLog(log([...sent(RESULTS[0]!), ...sent("15 Jan: leave full. 7 days left."), ...sent("Week 2")]));
    expect(delivered).toEqual(["15 Jan: leave full. 7 days left.", "15 Jan: leave full. 7 days left."]);
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
  it("passes when the app gave Orca every result in order and Orca said them", () => {
    const check = checkSpeech(readLog(run()));
    expect(check.delivered).toHaveLength(7);
    expect(check.dropped).toEqual([]);
    expect(speechOk(check)).toBe(true);
    expect(formatCheck(check)).toContain("The app gave Orca all 7 results, in order.");
  });

  it("lists results Orca dropped itself apart, and passes while most were said", () => {
    const check = checkSpeech(readLog(run((index) => index !== 3 && index !== 4)));
    expect(check.dropped).toEqual(["Undone. 7½ days left.", "Redone. 8 days left."]);
    expect(speechOk(check)).toBe(true);
    expect(formatCheck(check)).toContain("Dropped by Orca's own filters (issue 0046");
  });

  it("fails when fewer than half were said", () => {
    const check = checkSpeech(readLog(run((index) => index === 0)));
    expect(speechOk(check)).toBe(false);
    expect(formatCheck(check)).toContain("Fewer than half were said");
  });

  it("fails when the app didn't give Orca a result", () => {
    const missing = log(RESULTS.flatMap((text, index) => (index === 4 ? [said("Control_L", false)] : [...sent(text), said(text)])));
    const check = checkSpeech(readLog(missing));
    expect(check.mismatch).toBe("The app was to give Orca the results day, day, day, undo, redo, day, undo; it gave day, day, day, undo, day, undo.");
    expect(speechOk(check)).toBe(false);
  });

  it("finds a text said twice in a row, but not a key pressed twice", () => {
    const twice = log([said("Control_L", false), said("Control_L", false), ...RESULTS.flatMap((text, index) => [...sent(text), said(text), ...(index === 0 ? [said(text)] : [])])]);
    const check = checkSpeech(readLog(twice));
    expect(check.repeated).toEqual(["15 Jan: leave full. 7 days left."]);
    expect(speechOk(check)).toBe(false);
  });

  it("notes a very long text, such as a whole row, without failing on it", () => {
    const row = Array.from({ length: 7 }, (_, day) => `Day ${String(day + 11)} January 2027, working day, no leave`).join(" ");
    const check = checkSpeech(readLog(`${run()}${said(row)}\n`));
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
