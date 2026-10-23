// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Developer command: prints what the engine computes for a plan file or rule set.
// Usage: npm run plan -- <file.urlaub.json | file.regeln.json>
/* global console, process */
import { readFileSync, statSync } from "node:fs";
import { LIMITS } from "../src/engine/file/limits.ts";
import { readFile } from "../src/engine/file/read.ts";
import { formatSummary } from "./plan-summary.ts";

const path = process.argv[2];
if (path === undefined) {
  console.error("Usage: npm run plan -- <file>");
  process.exit(1);
}
let result;
try {
  result =
    statSync(path).size > LIMITS.fileBytes
      ? { ok: false, refusal: { code: "tooLarge" }, report: [] } // the refusal readFile gives for a file above the limit
      : readFile(readFileSync(path, "utf8"));
} catch (error) {
  console.error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
console.log(formatSummary(result));
process.exit(result.ok ? 0 : 1);
