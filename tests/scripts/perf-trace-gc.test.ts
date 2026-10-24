// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The performance gate (scripts/perf.js) fails a run that collected garbage, and it learns of a collection only
// from V8's --trace-gc report on the child's stdout. If Node moved that report elsewhere, the gate would no longer
// notice a collection; this test fails first.
describe("V8's --trace-gc, which the performance gate reads", () => {
  it("reports a garbage collection on stdout", () => {
    const run = spawnSync("node", ["--trace-gc", "--max-semi-space-size=1", "-e", "let a = []; for (let i = 0; i < 1e6; i++) a.push({ i });"], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/Scavenge|Mark-Compact|Mark-Sweep/);
  });
});
