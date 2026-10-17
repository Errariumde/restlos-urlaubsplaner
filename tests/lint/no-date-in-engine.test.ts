// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

async function configFor(path: string): Promise<Linter.Config> {
  return (await new ESLint().calculateConfigForFile(path)) as Linter.Config;
}

describe("no Date in the engine", () => {
  it("reports the Date global in src/engine", async () => {
    const rule = (await configFor("src/engine/example.ts")).rules?.["no-restricted-globals"];
    expect(rule).toBeDefined();
    const messages = new Linter().verify("export const now = new Date();", [
      { rules: { "no-restricted-globals": rule! } },
    ]);
    expect(messages.map((m) => m.ruleId)).toEqual(["no-restricted-globals"]);
  });

  it("allows Date outside the engine", async () => {
    expect((await configFor("tests/example.test.ts")).rules?.["no-restricted-globals"]).toBeUndefined();
  });
});
