// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { LIMITS, utf8Length } from "./limits";
import { computationWindow, periodBounds } from "../counting/plan";
import { suggestParts } from "../counting/suggest";
import type { LeaveDay, Part } from "../counting/types";
import { expandSources, planInput } from "./model";
import { readPlanDraft } from "./read-plan";
import { readPlanRef } from "./read-sources";
import { parseId, parseRevision, readContract } from "./read-contract";
import { readSources } from "./read-sources";
import { readTemplates, readTheme } from "./read-templates";
import { Refused, Report, checkKeys, isRecord, readRequired, type ReadResult } from "./report";
import { SEVERITY } from "./severity";
import type { PlanFile, RuleSetFile } from "./types";

const RULE_SET_KEYS = ["schema", "kind", "id", "revision", "contract", "sources", "templates", "theme"];
const PLAN_KEYS = [...RULE_SET_KEYS, "ruleSet", "plan"];

function checkSchema(value: unknown): void {
  if (typeof value !== "string") throw new Refused({ code: "unknownSchema", path: "schema" });
  const match = /^restlos\/([1-9]\d*)$/.exec(value);
  if (!match) throw new Refused({ code: "unknownSchema", path: "schema" });
  if (match[1] !== "1") throw new Refused({ code: "newerSchema", path: "schema" });
}

/**
 * The refusal of a file whose own parts are missing or invalid: every Error reading found, in reading order.
 * Warnings and Infos are left out, because they describe values as loaded.
 */
function refuseCore(report: Report): ReadResult {
  return { ok: false, refusal: { code: "invalidCore" }, report: report.entries.filter((entry) => SEVERITY[entry.code] === "error") };
}

function readEnvelope(text: string): ReadResult {
  if (utf8Length(text) > LIMITS.fileBytes) throw new Refused({ code: "tooLarge" });
  let json: unknown;
  try {
    json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Refused({ code: "notJson" });
  }
  if (!isRecord(json)) throw new Refused({ code: "unknownSchema", path: "schema" });
  checkSchema(json["schema"]);

  const kind = json["kind"];
  if (kind === "settings") throw new Refused({ code: "settingsNotSupported", path: "kind" });
  if (kind !== "ruleSet" && kind !== "plan") throw new Refused({ code: "unknownKind", path: "kind" });
  if (kind === "ruleSet") {
    for (const key of ["plan", "ruleSet"]) {
      if (key in json) throw new Refused({ code: "kindMismatch", path: key });
    }
  }

  // From here on every problem is reported and reading goes on; only a limit still stops it.
  const report = new Report();
  const positions = new Map<string, number>();
  const id = readRequired(json, "id", parseId, "", report, "");
  const revision = readRequired(json, "revision", parseRevision, "", report, "");
  checkKeys(json, kind === "plan" ? PLAN_KEYS : RULE_SET_KEYS, "", report);
  const { contract, minUnit } = readContract(json["contract"], "contract", kind, report, positions);
  const sources = readSources(json["sources"], "sources", kind, report, positions);
  const templates = readTemplates(json["templates"], "templates", kind, report, positions);
  const theme = readTheme(json["theme"], "theme", report);
  // A file is refused when a core value is undefined; each such value has an Error with `dropped: ""`.
  if (kind === "ruleSet") {
    if (id === undefined || revision === undefined || contract === undefined) return refuseCore(report);
    const file: RuleSetFile = { kind: "ruleSet", id, revision, contract, sources, templates, theme };
    return { ok: true, file, report: report.entries, positions };
  }

  let ruleSet: PlanFile["ruleSet"];
  if (json["ruleSet"] !== undefined) ruleSet = readPlanRef(json["ruleSet"], "ruleSet", report, "ruleSet");
  const read = readPlanDraft(json["plan"], "plan", minUnit, report, positions);
  // A refused file gets no check of the source days and no part suggestions: both need the loaded file.
  if (id === undefined || revision === undefined || contract === undefined || read === undefined) return refuseCore(report);
  const { plan, drafted } = read;
  const draft: PlanFile = { kind: "plan", id, revision, ...(ruleSet ? { ruleSet } : {}), contract, sources, templates, theme, plan };

  // The sources are expanded once over the computation window; more days than the limit are refused.
  const window = computationWindow(plan.range);
  if (expandSources(sources, window.from, window.to) === null) {
    throw new Refused({ code: "limitExceeded", path: "sources", data: { limit: "sourceDays" } });
  }
  if (drafted.size === 0) return { ok: true, file: draft, report: report.entries, positions };

  // Partial leave without a `part`: one computation answers all days inside the period.
  // A day outside the period keeps the drafted "end" (suggestions are only defined inside it) and is reported all the same.
  const bounds = periodBounds(plan.range);
  const inside = (entry: LeaveDay): boolean => entry.day >= bounds.from && entry.day <= bounds.to;
  const requests = [...drafted.keys()].filter(inside);
  const suggestions = suggestParts(
    planInput(draft),
    requests.map((entry) => ({ day: entry.day, take: entry.take })),
  );
  const suggested = new Map<LeaveDay, Part>(requests.map((entry, index) => [entry, suggestions[index] ?? "end"]));
  const replaced = new Map<LeaveDay, LeaveDay>();
  // `drafted` is in file order, and so are the report entries.
  for (const [entry, path] of drafted) {
    const part = suggested.get(entry) ?? "end";
    if (inside(entry)) replaced.set(entry, { day: entry.day, take: entry.take, part });
    report.notice("partSuggested", path, { part });
  }
  const days = plan.days.map((entry) => replaced.get(entry) ?? entry);
  return { ok: true, file: { ...draft, plan: { ...plan, days } }, report: report.entries, positions };
}

/**
 * Reads a plan file or rule set from untrusted text. Never throws: every problem is a report entry or a
 * refusal. A stop gives its refusal with an empty report.
 */
export function readFile(text: string): ReadResult {
  try {
    return readEnvelope(text);
  } catch (error) {
    if (error instanceof Refused) return { ok: false, refusal: error.refusal, report: [] };
    // Reading must not throw whatever the input; an unexpected error is a core problem of the file.
    return { ok: false, refusal: { code: "invalidCore" }, report: [] };
  }
}
