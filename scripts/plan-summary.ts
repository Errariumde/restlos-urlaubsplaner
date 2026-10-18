// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { computePlan } from "../src/engine/counting/plan";
import type { Problem } from "../src/engine/counting/plan";
import type { StretchPoint } from "../src/engine/counting/stretches";
import { isoFromDay } from "../src/engine/days";
import { planInput } from "../src/engine/file/model";
import type { ReadResult, ReportData } from "../src/engine/file/report";
import { textFor } from "../src/engine/file/text";
import type { FileContract, PlanFile, RuleSetFile, Text } from "../src/engine/file/types";
import { UNITS_PER_DAY, formatAmount, formatWeight, type Units } from "../src/engine/weight";

/** An amount of days as a mixed number: "10 1/2", "3/32", "30". */
function mixed(units: Units): string {
  const whole = Math.floor(units / UNITS_PER_DAY);
  const rest = formatAmount(units - whole * UNITS_PER_DAY);
  if (rest === "0") return String(whole);
  return whole === 0 ? rest : `${String(whole)} ${rest}`;
}

/** The first day of a stretch: the ISO day, plus "@" and the fraction of the day unless it starts with the day. */
function startOf(at: StretchPoint): string {
  const iso = isoFromDay(at.day);
  return at.offset === 0 ? iso : `${iso}@${formatWeight(at.offset)}`;
}

/** The end of a stretch (exclusive in the engine): the last ISO day, with "@" and the fraction if it ends within that day. */
function endOf(at: StretchPoint): string {
  const iso = isoFromDay(at.day);
  return at.offset === UNITS_PER_DAY ? iso : `${iso}@${formatWeight(at.offset)}`;
}

function data(values: ReportData | undefined): string {
  if (values === undefined) return "";
  return ` (${Object.entries(values).map(([key, value]) => `${key}=${String(value)}`).join(", ")})`;
}

function problem(item: Problem): string {
  const ids = "ruleIds" in item ? item.ruleIds : "sourceIds" in item ? item.sourceIds : [];
  return `  ${item.code} ${isoFromDay(item.day)}${ids.length > 0 ? ` (${ids.join(", ")})` : ""}`;
}

function name(file: RuleSetFile | PlanFile): string {
  return file.contract.name === undefined ? file.id : textFor(file.contract.name, "en");
}

function rules(contract: FileContract): string[] {
  return contract.rules.map((rule) => {
    const [effect, value] =
      rule.requiredAtMost !== undefined
        ? ["requiredAtMost", rule.requiredAtMost]
        : rule.requiredExactly !== undefined
          ? ["requiredExactly", rule.requiredExactly]
          : ["mandatory", rule.mandatory];
    const label: Text | undefined = rule.label;
    return `  ${rule.id}: ${effect} ${formatWeight(value)}${label === undefined ? "" : ` — ${textFor(label, "en")}`}`;
  });
}

/** What the engine computes for a file, as plain English text (no trailing newline). */
export function formatSummary(result: ReadResult): string {
  if (!result.ok) {
    const { code, path, data: values } = result.refusal;
    return `Refused: ${code}${path === undefined ? "" : ` at ${path}`}${data(values)}`;
  }
  const { file, report } = result;
  const reportLines = report.map((entry) => `${entry.code} at ${entry.path}${data(entry.data)}`);
  const reportText = reportLines.length === 0 ? "Report: none" : reportLines.length === 1 ? `Report: ${reportLines[0] ?? ""}` : ["Report:", ...reportLines.map((line) => `  ${line}`)].join("\n");

  if (file.kind === "ruleSet") {
    return [`${name(file)} — rule set, revision ${String(file.revision)}`, reportText, "Rules:", ...rules(file.contract)].join("\n");
  }

  const { range } = file.plan;
  const pad = (month: number): string => String(month).padStart(2, "0");
  const period = `${String(range.from.year)}-${pad(range.from.month)} to ${String(range.to.year)}-${pad(range.to.month)}`;
  const plan = computePlan(planInput(file));
  const { totals } = plan;
  const lines = [
    `${name(file)} — plan ${period}, revision ${String(file.revision)}`,
    reportText,
    `Allowance ${mixed(totals.allowance)}, planned ${mixed(totals.planned)}, remaining ${totals.remaining < 0 ? "-" : ""}${mixed(Math.abs(totals.remaining))}`,
    ...totals.byYear.map((entry) => `${String(entry.year)}: ${mixed(entry.planned)}`),
  ];
  const stretches = plan.stretches.filter((stretch) => stretch.listed);
  lines.push(stretches.length === 0 ? "Stretches: none" : "Stretches:");
  for (const stretch of stretches) {
    lines.push(`  ${startOf(stretch.start)} – ${endOf(stretch.end)}: ${mixed(stretch.daysOff)} days off, cost ${mixed(stretch.cost)}`);
  }
  lines.push(plan.problems.length === 0 ? "Problems: none" : "Problems:", ...plan.problems.map(problem));
  return lines.join("\n");
}
