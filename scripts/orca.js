// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Developer command: the screen reader check with Orca (scripts/orca-speech.ts).
// Usage: npm run orca            prints the procedure
//        npm run orca -- <log>   checks what Orca said, from its debug log
/* global console, process */
import { readFileSync } from "node:fs";
import { checkSpeech, formatCheck, procedure, readLog, speechOk } from "./orca-speech.ts";

const path = process.argv[2];
if (path === undefined) {
  console.log(procedure());
  process.exit(0);
}
let log;
try {
  log = readFileSync(path, "utf8");
} catch (error) {
  console.error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const check = checkSpeech(readLog(log));
console.log(formatCheck(check));
process.exit(speechOk(check) ? 0 : 1);
