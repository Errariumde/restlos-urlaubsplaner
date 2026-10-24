// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { PLAN_ID, PLAN_V1, PLAN_V2, eventUid, planIcs } from "../../scripts/feasibility-ics";
import { utf8Length } from "../../src/engine/file/limits";

const uids = (text: string): string[] => [...text.matchAll(/^UID:(.+)\r$/gm)].map((m) => m[1] ?? "");
const v1 = planIcs(PLAN_V1, "20261024T120000Z");
const v2 = planIcs(PLAN_V2, "20261101T120000Z");

describe("the feasibility .ics files", () => {
  it("give every event its own opaque UID", () => {
    for (const text of [v1, v2]) {
      expect(new Set(uids(text)).size).toBe(uids(text).length);
      expect(uids(text).every((uid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid))).toBe(true);
    }
    expect(uids(v1)).toHaveLength(9);
    expect(uids(v2)).toHaveLength(9);
  });
  it("keep the UID of an unchanged event and change it for a changed one", () => {
    const shared = uids(v1).filter((uid) => uids(v2).includes(uid));
    expect(shared).toHaveLength(6); // the holiday, 08-03 to 08-05, 12-23, 12-31
    const full = PLAN_V1.find((e) => e.date === "2027-08-02");
    const half = PLAN_V2.find((e) => e.date === "2027-08-02");
    if (full === undefined || half === undefined) throw new Error("fixture lost 2027-08-02");
    expect(eventUid(PLAN_ID, full)).not.toBe(eventUid(PLAN_ID, half));
  });
  it("write valid calendar lines", () => {
    for (const text of [v1, v2]) {
      expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
      expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
      expect(text.split("\r\n").every((line) => utf8Length(line) <= 75)).toBe(true);
      expect(text).not.toMatch(/[^\r]\n/);
      expect(text).toContain("METHOD:PUBLISH\r\n");
      expect(text).not.toContain("SEQUENCE");
    }
    expect(v1).toContain("DTSTART;VALUE=DATE:20270507\r\nDTEND;VALUE=DATE:20270508\r\n");
    expect(v2).not.toContain("DTSTART;VALUE=DATE:20270507"); // the deleted day (the holiday's DTEND is 20270507)
    expect(v2).toContain("X-RESTLOS-TAKE:1/2\r\nX-RESTLOS-PART:start\r\n");
    expect(v2).toContain("SUMMARY:Urlaub (½\\, vormittags)\r\n"); // the comma is escaped (RFC 5545, 3.3.11)
  });
});
