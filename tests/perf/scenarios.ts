// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Scenarios of the performance gate (npm run perf, scripts/perf.js). A scenario is one engine step on one
// input shape that grows with n: the gate builds its input natively at 8 × and 16 × its base size, then counts
// the instructions of `run` under Cachegrind, and fails when twice the input costs more than 2.2 × the work or
// more than 5 % over tests/perf/baseline.json. AGENTS.md (Hard rules, Performance): engine code that processes
// input of variable size gets a scenario here in the same commit.

import { readFile } from "../../src/engine/file/read";
import { earlyEasterRangesOffWeekday, entriesPlan, takeEntries } from "../engine/file/shapes";

export interface Scenario {
  readonly name: string; // "<engine step>:<input shape>", e.g. "read:earlyEasterRanges"
  readonly base: number; // runs at 8 × base and 16 × base
  readonly input: (n: number) => string; // built natively before Valgrind, handed over as a file
  readonly run: (input: string) => void; // the measured work
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: "read:earlyEasterRanges",
    base: 1000,
    input: (n) => entriesPlan(takeEntries(earlyEasterRangesOffWeekday, n)),
    run: (text) => {
      readFile(text);
    },
  },
];
