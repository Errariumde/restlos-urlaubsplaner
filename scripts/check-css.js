// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Checks the UI styles: colours only as tokens, logical properties only, no uppercase text.
// Scans src/ui/**/*.css and the <style> blocks of src/ui/**/*.svelte. Run through `npm run check`.
/* global console, process, URL */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCss } from "./css-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

function styleFiles(directory) {
  const files = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...styleFiles(path));
    else if (/\.(css|svelte)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const errors = checkCss(styleFiles("src/ui").map((path) => ({ path, text: readFileSync(join(root, path), "utf8") })));

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${String(errors.length)} CSS error(s).`);
  process.exit(1);
}
console.log("Styles follow the CSS rules.");
