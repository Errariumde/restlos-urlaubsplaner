// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The child of the performance gate (scripts/perf.js), run under Cachegrind.
// Usage: perf-run.js                      (only startup and imports: the count the gate subtracts)
//        perf-run.js <name> <inputPath>   (runs scenario <name> on the text of <inputPath>)
/* global process */
import { readFileSync } from "node:fs";
import { SCENARIOS } from "../tests/perf/scenarios.ts";

const [name, inputPath] = process.argv.slice(2);
if (name !== undefined) {
  const scenario = SCENARIOS.find((candidate) => candidate.name === name);
  if (scenario === undefined || inputPath === undefined) {
    process.stderr.write(`perf-run: unknown scenario ${name} or no input file\n`);
    process.exit(1);
  }
  scenario.run(readFileSync(inputPath, "utf8"));
}
