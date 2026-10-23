// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Scenarios of the performance gate (npm run perf, scripts/perf.js). A scenario is one engine step on one
// input shape that grows with n: the gate builds its input natively at 8 × and 16 × its base size, then counts
// the instructions of `run` under Cachegrind, and fails when twice the input costs more than 2.2 × the work or
// more than 5 % over tests/perf/baseline.json. AGENTS.md (Hard rules, Performance): engine code that processes
// input of variable size gets a scenario here in the same commit.

import { computePlan } from "../../src/engine/counting/plan";
import { checkRules } from "../../src/engine/file/check";
import { planInput } from "../../src/engine/file/model";
import { readFile } from "../../src/engine/file/read";
import type { AnyFile } from "../../src/engine/file/types";
import { writeFile } from "../../src/engine/file/write";
import {
  calendarRangesOffWeekday,
  earlyEasterRangesOffWeekday,
  easterRangesJustOutOfReach,
  entriesPlan,
  limitsPlan,
  takeEntries,
} from "../engine/file/shapes";

export interface Scenario {
  readonly name: string; // "<engine step>:<input shape>", e.g. "read:earlyEasterRanges"
  readonly base: number; // runs at 8 × base and 16 × base
  readonly input: (n: number) => string; // built natively before Valgrind, handed over as a file
  readonly run: (input: string) => void; // the measured work
}

/** The model JSON of reading `text`: what the check and the writer take. Throws if the text is refused. */
function modelJson(text: string): string {
  const read = readFile(text);
  if (!read.ok) throw new Error("perf scenario input is refused");
  return JSON.stringify(read.file);
}

const earlyEaster = (n: number): string => entriesPlan(takeEntries(earlyEasterRangesOffWeekday, n));
const calendarRanges = (n: number): string => entriesPlan(takeEntries(calendarRangesOffWeekday, n));

export const SCENARIOS: readonly Scenario[] = [
  {
    name: "read:earlyEasterRanges",
    base: 1000,
    input: earlyEaster,
    run: (text) => {
      readFile(text);
    },
  },
  {
    name: "read:easterRangesJustOutOfReach",
    base: 1000,
    input: (n) => entriesPlan(takeEntries(easterRangesJustOutOfReach, n)),
    run: (text) => {
      readFile(text);
    },
  },
  {
    name: "read:calendarRangesOffWeekday",
    base: 1000,
    input: calendarRanges,
    run: (text) => {
      readFile(text);
    },
  },
  {
    name: "readAndCompute:limitsPlan",
    base: 125,
    input: limitsPlan,
    run: (text) => {
      const read = readFile(text);
      if (read.ok && read.file.kind === "plan") computePlan(planInput(read.file));
    },
  },
  {
    name: "check:earlyEasterRanges",
    base: 1000,
    input: (n) => modelJson(earlyEaster(n)),
    run: (text) => {
      checkRules(JSON.parse(text) as AnyFile, new Map());
    },
  },
  {
    name: "check:calendarRangesOffWeekday",
    base: 1000,
    input: (n) => modelJson(calendarRanges(n)),
    run: (text) => {
      checkRules(JSON.parse(text) as AnyFile, new Map());
    },
  },
  {
    name: "write:limitsPlan",
    base: 125,
    input: (n) => modelJson(limitsPlan(n)),
    run: (text) => {
      writeFile(JSON.parse(text) as AnyFile);
    },
  },
];
