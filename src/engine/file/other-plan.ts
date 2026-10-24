// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { computePlan } from "../counting/plan";
import { LIMITS } from "./limits";
import { planInput } from "./model";
import { readFile } from "./read";
import type { Refusal, ReportEntry } from "./report";
import type { FileSource, OtherPlanRef, PlanFile } from "./types";

type OtherPlanEntries = Extract<FileSource, { type: "otherPlan" }>["entries"];

export type ImportNotice =
  | { readonly code: "differentPlan"; readonly previousId: string }
  | { readonly code: "olderRevision"; readonly previousRevision: number }
  | { readonly code: "outdatedCopyOfCurrent"; readonly copyRevision: number };
export type OtherPlanImport =
  | {
      readonly ok: true;
      readonly plan: OtherPlanRef;
      readonly entries: OtherPlanEntries;
      readonly notices: readonly ImportNotice[];
      readonly report: readonly ReportEntry[];
    }
  | { readonly ok: false; readonly refusal: Refusal | { readonly code: "notAPlan" } };

/**
 * The spans of working time `file` charged, computed with its own stored sources: one entry per span on
 * every day of its period with a cost above 0, by date and then by position.
 */
function chargedEntries(file: PlanFile): OtherPlanEntries[number][] {
  const entries: OtherPlanEntries[number][] = [];
  for (const day of computePlan(planInput(file)).days) {
    if (!day.inPeriod || day.evaluation.cost === 0) continue;
    for (const span of day.evaluation.charged) entries.push({ date: day.day, from: span.from, to: span.to, kind: span.kind });
  }
  return entries;
}

function noticesFor(file: PlanFile, current: { readonly id: string; readonly revision: number }, previous: OtherPlanRef | undefined): ImportNotice[] {
  const notices: ImportNotice[] = [];
  if (previous !== undefined) {
    if (previous.id !== file.id) notices.push({ code: "differentPlan", previousId: previous.id });
    else if (file.revision < previous.revision) notices.push({ code: "olderRevision", previousRevision: previous.revision });
  }
  for (const source of file.sources) {
    if (source.type === "otherPlan" && source.plan.id === current.id && source.plan.revision < current.revision) {
      notices.push({ code: "outdatedCopyOfCurrent", copyRevision: source.plan.revision });
    }
  }
  return notices;
}

/**
 * Imports a plan file from untrusted text as "Leave from another plan" for the plan `current`: the spans
 * it charged, its `id`, name and `revision`, and notices for "Update source" when `previous` is the plan
 * imported before. Never throws: a file that can't be read gives its refusal, a rule set `notAPlan`.
 */
export function importOtherPlan(text: string, current: { readonly id: string; readonly revision: number }, previous?: OtherPlanRef): OtherPlanImport {
  const read = readFile(text);
  if (!read.ok) return { ok: false, refusal: read.refusal };
  const file = read.file;
  if (file.kind !== "plan") return { ok: false, refusal: { code: "notAPlan" } };
  let entries: OtherPlanEntries[number][];
  try {
    entries = chargedEntries(file);
  } catch {
    // `readFile` only returns models the counting model accepts; like `readFile`, the import must not throw all the same.
    return { ok: false, refusal: { code: "invalidCore" } };
  }
  // The entries become one source of the current plan; more than a source may hold could not be read back.
  if (entries.length > LIMITS.entriesPerSource) return { ok: false, refusal: { code: "limitExceeded", data: { limit: "entriesPerSource" } } };
  return {
    ok: true,
    plan: { id: file.id, name: file.contract.name ?? file.id, revision: file.revision },
    entries,
    notices: noticesFor(file, current, previous),
    report: read.report,
  };
}
