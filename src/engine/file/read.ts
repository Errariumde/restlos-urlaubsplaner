// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { LIMITS, textLength, utf8Length } from "./limits";
import { computationWindow, periodBounds } from "../counting/plan";
import { suggestParts } from "../counting/suggest";
import type { LeaveDay } from "../counting/types";
import { dayRuleWarningsMemo } from "../counting/warnings";
import { expandSources, planInput } from "./model";
import { readPlanDraft } from "./read-plan";
import { readPlanRef } from "./read-sources";
import { readContract } from "./read-contract";
import { readSources } from "./read-sources";
import { readTemplates, readTheme } from "./read-templates";
import { Refused, Report, checkKeys, isRecord, type ReadResult } from "./report";
import type { PlanFile, RuleSetFile } from "./types";

const RULE_SET_KEYS = ["schema", "kind", "id", "revision", "contract", "sources", "templates", "theme"];
const PLAN_KEYS = [...RULE_SET_KEYS, "ruleSet", "plan"];

function checkSchema(value: unknown): void {
  if (typeof value !== "string") throw new Refused({ code: "unknownSchema", path: "schema" });
  const match = /^restlos\/([1-9]\d*)$/.exec(value);
  if (!match) throw new Refused({ code: "unknownSchema", path: "schema" });
  if (match[1] !== "1") throw new Refused({ code: "newerSchema", path: "schema" });
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

  const id = json["id"];
  if (typeof id !== "string" || id.length === 0 || textLength(id) > LIMITS.shortText) throw new Refused({ code: "invalidCore", path: "id" });
  const revision = json["revision"];
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Refused({ code: "invalidCore", path: "revision" });

  const report = new Report();
  // Rules and source entries with the same match and validity are checked for warnings once.
  const warnings = dayRuleWarningsMemo();
  checkKeys(json, kind === "plan" ? PLAN_KEYS : RULE_SET_KEYS, "", report);
  const contract = readContract(json["contract"], "contract", kind, report, warnings);
  const sources = readSources(json["sources"], "sources", kind, report, warnings);
  const templates = readTemplates(json["templates"], "templates", kind, report);
  const theme = readTheme(json["theme"], "theme", report);
  if (kind === "ruleSet") {
    const file: RuleSetFile = { kind: "ruleSet", id, revision, contract, sources, templates, theme };
    return { ok: true, file, report: report.entries };
  }

  let ruleSet: PlanFile["ruleSet"];
  if (json["ruleSet"] !== undefined) ruleSet = readPlanRef(json["ruleSet"], "ruleSet", report);
  const { plan, drafted } = readPlanDraft(json["plan"], "plan", contract, report);
  const draft: PlanFile = { kind: "plan", id, revision, ...(ruleSet ? { ruleSet } : {}), contract, sources, templates, theme, plan };

  // The sources are expanded once over the computation window; more days than the limit are refused.
  const window = computationWindow(plan.range);
  if (expandSources(sources, window.from, window.to) === null) {
    throw new Refused({ code: "limitExceeded", path: "sources", data: { limit: "sourceDays" } });
  }
  if (drafted.size === 0) return { ok: true, file: draft, report: report.entries };

  // Partial leave without a `part`: one computation answers all days inside the period.
  // A day outside the period keeps the drafted "end" (suggestions are only defined inside it) and is reported all the same.
  const bounds = periodBounds(plan.range);
  const inside = (entry: LeaveDay): boolean => entry.day >= bounds.from && entry.day <= bounds.to;
  const requests = plan.days.filter((entry) => drafted.has(entry) && inside(entry));
  const suggestions = suggestParts(
    planInput(draft),
    requests.map((entry) => ({ day: entry.day, take: entry.take })),
  );
  const replaced = new Map<LeaveDay, LeaveDay>();
  requests.forEach((entry, index) => {
    const part = suggestions[index] ?? "end";
    replaced.set(entry, { day: entry.day, take: entry.take, part });
    report.add("partSuggested", drafted.get(entry) ?? "plan.days", { part });
  });
  for (const [entry, path] of drafted) {
    if (!inside(entry)) report.add("partSuggested", path, { part: "end" });
  }
  const days = plan.days.map((entry) => replaced.get(entry) ?? entry);
  return { ok: true, file: { ...draft, plan: { ...plan, days } }, report: report.entries };
}

/** Reads a plan file or rule set from untrusted text. Never throws: every problem is a report entry or a refusal. */
export function readFile(text: string): ReadResult {
  try {
    return readEnvelope(text);
  } catch (error) {
    if (error instanceof Refused) return { ok: false, refusal: error.refusal };
    // Reading must not throw whatever the input; an unexpected error is a core problem of the file.
    return { ok: false, refusal: { code: "invalidCore" } };
  }
}
