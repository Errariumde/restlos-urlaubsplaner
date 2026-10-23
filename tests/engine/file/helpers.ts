// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

export const FULL_TIME_WEEK = {
  from: "2020-01-01",
  required: { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" },
};

export const MINIMAL_CONTRACT = {
  region: { country: "DE" },
  week: [FULL_TIME_WEEK],
  rules: [] as unknown[],
};

/** JSON text of a smallest valid rule set; top-level keys in `overrides` replace or add to it. */
export function minimal(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema: "restlos/1",
    kind: "ruleSet",
    id: "test-rule-set",
    revision: 1,
    contract: MINIMAL_CONTRACT,
    sources: [],
    templates: [],
    theme: null,
    ...overrides,
  });
}

export const BAVARIA_CONTRACT = { ...MINIMAL_CONTRACT, region: { country: "DE", state: "BY" } };

/** JSON text of a smallest valid plan file in Bavaria (2027); `plan` keys replace those of the plan, `overrides` the top-level keys. */
export function planFile(plan: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema: "restlos/1",
    kind: "plan",
    id: "test-plan",
    revision: 1,
    contract: BAVARIA_CONTRACT,
    sources: [],
    templates: [],
    theme: null,
    plan: { range: { from: "2027-01", to: "2027-12" }, allowance: "30", days: [], overrides: [], notes: [], ...plan },
    ...overrides,
  });
}

/** A report entry of a core value: an Error that drops the whole file. */
export const core = (code: "missingValue" | "invalidValue", path: string) => ({ code, path, dropped: "" });

/** The result of a file refused with `invalidCore` and exactly `report`. */
export const refusedWith = (...report: readonly object[]) => ({ ok: false, refusal: { code: "invalidCore" }, report });
