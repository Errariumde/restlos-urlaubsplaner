// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Pins the Required columns of docs/file-format.md and docs/day-rules-format.md against the reader: every
// required key, removed, gives `missingValue` at that key with the outcome the docs give (the file refused, or
// the part that holds it dropped); every optional key, removed, gives no report entry.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRules } from "../../../src/engine/file/check";
import { readFile } from "../../../src/engine/file/read";
import type { ReportEntry } from "../../../src/engine/file/report";
import { FULL_PLAN, without } from "./full";
import { core, refusedWith } from "./helpers";

/** The minimal plan file of the docs; read from the example, so the example itself is pinned. */
const MINIMAL_PLAN = JSON.parse(readFileSync("examples/minimal/minimal.urlaub.json", "utf8")) as Record<string, unknown>;

/** The report of `file`, which must load. */
function reportOf(file: Record<string, unknown>): readonly ReportEntry[] {
  const result = readFile(JSON.stringify(file));
  if (!result.ok) throw new Error(`refused: ${result.refusal.code} ${JSON.stringify(result.report)}`);
  return result.report;
}

const missing = (path: string, dropped: string, data?: Record<string, readonly string[]>) => ({
  code: "missingValue",
  path,
  dropped,
  ...(data ? { data } : {}),
});

// Where things are in FULL_PLAN.
const RULE = "contract.rules[0]";
const BASIS = "contract.references.basis";
const HOLIDAY_ENTRY = "sources[0].entries[0]";
const CLOSURE_ENTRY = "sources[1].entries[0]";
const OTHER_PLAN = "sources[2]";
const OTHER_PLAN_ENTRY = "sources[2].entries[0]";
const TEMPLATE = "templates[0]";
const SOURCES = FULL_PLAN["sources"] as readonly Readonly<Record<string, unknown>>[];

/** The follow-on of a dropped `basis`: the rule's citation of it is dropped, the rule is kept. */
const CITATION_DROPPED = {
  code: "unknownReference",
  path: `${RULE}.references[0]`,
  dropped: `${RULE}.references[0]`,
  data: { reference: "basis" },
};

/** [what is dropped, the key removed, the whole report]. */
type Drop = readonly [string, string, readonly object[]];
/** Each of `keys`, removed, gives only `missingValue` at itself and drops `dropped`. */
const drops = (dropped: string, ...keys: readonly string[]): Drop[] => keys.map((key) => [dropped, key, [missing(key, dropped)]]);

const DROPS: readonly Drop[] = [
  // A day rule.
  ...drops(RULE, `${RULE}.id`, `${RULE}.match`, `${RULE}.match.type`, `${RULE}.match.month`, `${RULE}.match.day`),
  [RULE, `${RULE}.requiredAtMost`, [missing(RULE, RULE, { oneOf: ["requiredAtMost", "requiredExactly", "mandatory"] })]],
  // The range of the mandatory source's entry.
  ...drops(CLOSURE_ENTRY, `${CLOSURE_ENTRY}.match.from`, `${CLOSURE_ENTRY}.match.from.type`),
  [CLOSURE_ENTRY, `${CLOSURE_ENTRY}.match.to`, [missing(`${CLOSURE_ENTRY}.match`, CLOSURE_ENTRY, { oneOf: ["to", "days"] })]],
  // A reference, with the follow-on at the rule that cites it.
  ...["title", "version", "url", "checked"].map((key): Drop => [BASIS, `${BASIS}.${key}`, [missing(`${BASIS}.${key}`, BASIS), CITATION_DROPPED]]),
  // The plan reference `ruleSet`.
  ...drops("ruleSet", "ruleSet.id", "ruleSet.name", "ruleSet.revision"),
  // Every source, and the plan reference of the other-plan source.
  ...SOURCES.map((_, i) => `sources[${String(i)}]`).flatMap((source) =>
    drops(source, ...["id", "name", "type", "color"].map((key) => `${source}.${key}`)),
  ),
  ...drops(OTHER_PLAN, `${OTHER_PLAN}.plan`, `${OTHER_PLAN}.plan.id`, `${OTHER_PLAN}.plan.name`, `${OTHER_PLAN}.plan.revision`),
  // Source entries.
  [HOLIDAY_ENTRY, `${HOLIDAY_ENTRY}.date`, [missing(HOLIDAY_ENTRY, HOLIDAY_ENTRY, { oneOf: ["date", "match"] })]],
  ...drops(OTHER_PLAN_ENTRY, ...["date", "from", "to", "kind"].map((key) => `${OTHER_PLAN_ENTRY}.${key}`)),
  // A template and its image.
  ...drops(TEMPLATE, ...["id", "name", "api", "typst", "typ", "images[0].name", "images[0].type", "images[0].data"].map((key) => `${TEMPLATE}.${key}`)),
  // The plan's lists.
  ...drops("plan.days[0]", "plan.days[0].date", "plan.days[0].take"),
  ...drops("plan.overrides[0]", "plan.overrides[0].date", "plan.overrides[0].required"),
  ...drops("plan.notes[0]", "plan.notes[0].date", "plan.notes[0].text"),
];

/** Every optional key of FULL_PLAN; removed, each gives an empty report except where `NOTICES` says. */
const OPTIONAL: readonly string[] = [
  "ruleSet",
  "sources",
  "templates",
  "theme",
  ...["name", "description", "references", "region.options", "minUnit", "rules"].map((key) => `contract.${key}`),
  ...["origin", "label", "validFrom", "validUntil", "part", "note", "references"].map((key) => `${RULE}.${key}`),
  // Each source's `origin`, `visible` and `entries`, where it has them.
  ...SOURCES.flatMap((source, i) =>
    ["origin", "visible", "entries"].filter((key) => key in source).map((key) => `sources[${String(i)}].${key}`),
  ),
  ...["name", "required", "part"].map((key) => `${HOLIDAY_ENTRY}.${key}`),
  ...["validFrom", "validUntil", "except", "name", "take", "part"].map((key) => `${CLOSURE_ENTRY}.${key}`),
  `${OTHER_PLAN_ENTRY}.name`,
  `${TEMPLATE}.origin`,
  `${TEMPLATE}.images`,
  "plan.days",
  "plan.overrides",
  "plan.notes",
  "plan.days[1].part",
  "plan.overrides[0].part",
];

/** The report entries that removing an optional key gives, where it gives any. */
const NOTICES: Readonly<Record<string, readonly object[]>> = {
  "contract.references": [CITATION_DROPPED],
  // Monday 5 July 2027 after a free Sunday: the neighbouring days suggest the start.
  "plan.days[1].part": [{ code: "partSuggested", path: "plan.days[1]", data: { part: "start" } }],
};

describe("required and optional keys", () => {
  it("reads the full file with an empty report", () => {
    const result = readFile(JSON.stringify(FULL_PLAN));
    if (!result.ok) throw new Error(`refused: ${result.refusal.code} ${JSON.stringify(result.report)}`);
    expect(result.report).toEqual([]);
    expect(checkRules(result.file, result.positions)).toEqual([]);
  });

  it.each([
    "id",
    "revision",
    "contract",
    "contract.region",
    "contract.region.country",
    "contract.region.state",
    "contract.week",
    "contract.week[0].from",
    "contract.week[0].required",
    ...["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => `contract.week[0].required.${day}`),
    "plan",
    "plan.range",
    "plan.range.from",
    "plan.range.to",
    "plan.allowance",
  ])("refuses the minimal plan file without %s", (path) => {
    expect(readFile(JSON.stringify(without(MINIMAL_PLAN, path)))).toEqual(refusedWith(core("missingValue", path)));
  });

  it.each(DROPS)("drops %s from the full file without %s", (_dropped, key, report) => {
    expect(reportOf(without(FULL_PLAN, key))).toEqual(report);
  });

  it.each(OPTIONAL)("reads the full file without the optional %s", (key) => {
    expect(reportOf(without(FULL_PLAN, key))).toEqual(NOTICES[key] ?? []);
  });
});
