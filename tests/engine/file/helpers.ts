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
