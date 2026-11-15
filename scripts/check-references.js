// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Checks that the repository's text stands on its own (AGENTS.md, "Text in the repository"): no links into
// docs/superpowers/, no rulings, no review files from outside; and that every cited docs path, Markdown link
// target, anchor and docs/SPEC.md section exists; that docs/user/ and docs/dev/ do not cite docs/SPEC.md; and
// that every docs/SPEC.md section has a status line.
// Scans every tracked or new, not ignored, text file.
// Run through `npm run check`.
/* global console, process, URL */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCitations, checkSpecCitations } from "./citation-rules.ts";
import { checkReferences } from "./reference-rules.ts";
import { checkSpecStatus } from "./spec-status-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
const files = [];
for (const path of new Set(listed.split("\0").filter(Boolean))) {
  const full = join(root, path);
  if (!existsSync(full)) continue; // deleted in the working tree
  const bytes = readFileSync(full);
  if (bytes.includes(0)) continue; // binary, such as the screenshot baselines
  files.push({ path, text: bytes.toString("utf8") });
}

const errors = [...checkReferences(files), ...checkCitations(files), ...checkSpecCitations(files), ...checkSpecStatus(files)];
if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${String(errors.length)} reference(s) to fix.`);
  process.exit(1);
}
console.log("The text stands on its own.");
