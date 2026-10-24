// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The two calendar files of the Thunderbird feasibility test T4 (feasibility/README.md): one fictional plan
// exported twice, the second time after some edits. Restlos has no iCal code yet (issue 0010), so this is only
// a fixture writer. Pure: writing the files is scripts/feasibility.js.
import { createHash } from "node:crypto";
import { dayFromIso, isoFromDay } from "../src/engine/days";
import { utf8Length } from "../src/engine/file/limits";

/** The fictional plan's random `id`. */
export const PLAN_ID = "6f1c2b9e-4a7d-4e2b-9c3a-1d5e8f7a2b40";

export type IcsEvent = {
  kind: "leave" | "holiday";
  date: string;
  take: "1" | "1/2";
  part?: "start" | "end";
  rule?: string;
  summary: string;
};

const HOLIDAY: IcsEvent = { kind: "holiday", date: "2027-05-06", take: "1", rule: "ascension", summary: "Christi Himmelfahrt" };
const leave = (date: string): IcsEvent => ({ kind: "leave", date, take: "1", summary: "Urlaub" });
const morning = (date: string): IcsEvent => ({ kind: "leave", date, take: "1/2", part: "start", summary: "Urlaub (½, vormittags)" });
const afternoon = (date: string): IcsEvent => ({ kind: "leave", date, take: "1/2", part: "end", summary: "Urlaub (½, nachmittags)" });

export const PLAN_V1: readonly IcsEvent[] = [
  HOLIDAY,
  leave("2027-05-07"),
  leave("2027-08-02"),
  leave("2027-08-03"),
  leave("2027-08-04"),
  leave("2027-08-05"),
  leave("2027-08-06"),
  morning("2027-12-23"),
  afternoon("2027-12-31"),
];

// v2: 05-07 deleted, 08-02 turned into a half day, 08-06 moved to 08-09, 10-29 added.
export const PLAN_V2: readonly IcsEvent[] = [
  HOLIDAY,
  morning("2027-08-02"),
  leave("2027-08-03"),
  leave("2027-08-04"),
  leave("2027-08-05"),
  leave("2027-08-09"),
  leave("2027-10-29"),
  morning("2027-12-23"),
  afternoon("2027-12-31"),
];

/**
 * The event's UID: a hash of the plan's id and everything the exported event says, never its position in the file
 * (design decision 5), so an unchanged day keeps its UID and a changed day gets a new one. The summary is left
 * out: it follows from the other fields and the UI language. The final form is issue 0010's.
 */
export function eventUid(planId: string, event: IcsEvent): string {
  const input = JSON.stringify(["restlos-ics/feasibility", planId, event.kind, event.date, event.take, event.part ?? null, event.rule ?? null]);
  const h = createHash("sha256").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** A TEXT value (RFC 5545, 3.3.11). */
const escapeText = (text: string): string =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, "\\n");

const compact = (iso: string): string => iso.replaceAll("-", "");

function eventLines(event: IcsEvent, planId: string, dtstamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${eventUid(planId, event)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compact(event.date)}`,
    `DTEND;VALUE=DATE:${compact(isoFromDay(dayFromIso(event.date) + 1))}`, // exclusive: the next day
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.kind === "leave") {
    lines.push("TRANSP:OPAQUE", "X-MICROSOFT-CDO-BUSYSTATUS:OOF", `X-RESTLOS-TAKE:${event.take}`);
    if (event.part !== undefined) lines.push(`X-RESTLOS-PART:${event.part}`);
  } else {
    lines.push("TRANSP:TRANSPARENT");
  }
  lines.push(`X-RESTLOS-TYPE:${event.kind}`, "END:VEVENT");
  return lines;
}

/** The calendar text, CRLF after every line. Throws when a line exceeds 75 octets: folding is issue 0010's job. */
export function planIcs(events: readonly IcsEvent[], dtstamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//restlos//feasibility//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "NAME:restlos-test",
    "X-WR-CALNAME:restlos-test",
    ...events.flatMap((event) => eventLines(event, PLAN_ID, dtstamp)),
    "END:VCALENDAR",
  ];
  for (const line of lines) {
    if (utf8Length(line) > 75) throw new Error(`Line longer than 75 octets (folding is not implemented): ${line}`);
  }
  return lines.map((line) => `${line}\r\n`).join("");
}
