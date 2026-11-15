// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Checks the mechanical style rules of the pages under docs/user/ and docs/dev/: where a page lives, and the
// words and marks a page leaves out, by language and quadrant (scripts/docs-rules.ts).
// Scans every tracked or new, not ignored, file in those folders.
// Run through `npm run check`.
/* global console, process, URL */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDocs } from "./docs-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "docs/user/", "docs/dev/"], {
  cwd: root,
  encoding: "utf8",
});
const files = [];
for (const path of new Set(listed.split("\0").filter(Boolean))) {
  const full = join(root, path);
  if (!path.endsWith(".md") || !existsSync(full)) continue; // not a page, or deleted in the working tree
  files.push({ path, text: readFileSync(full, "utf8") });
}

const errors = checkDocs(files);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${String(errors.length)} style error(s) in the docs.`);
  process.exit(1);
}
console.log("The docs follow the style rules.");
