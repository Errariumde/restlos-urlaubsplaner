// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Checks the UI message catalogs: same keys in de and en, every key used (or a holiday data key),
// every used key present, valid ICU syntax, no "#". Run through `npm run check`.
/* global console, process, URL */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCatalogs } from "./catalog-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|svelte)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function collectDataKeys(value, keys) {
  if (Array.isArray(value)) {
    for (const item of value) collectDataKeys(item, keys);
  } else if (value !== null && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      if ((name === "nameKey" || name === "explanationKey") && typeof item === "string") keys.add(item);
      else collectDataKeys(item, keys);
    }
  }
}

const dataKeys = new Set();
const holidayDirectory = "src/data/holidays";
for (const entry of readdirSync(join(root, holidayDirectory))) {
  if (entry.endsWith(".json")) collectDataKeys(readJson(join(holidayDirectory, entry)), dataKeys);
}

const errors = checkCatalogs({
  de: readJson("src/ui/i18n/de.json"),
  en: readJson("src/ui/i18n/en.json"),
  sources: sourceFiles("src/ui").map((path) => ({ path, text: readFileSync(join(root, path), "utf8") })),
  dataKeys: [...dataKeys],
});

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${String(errors.length)} catalog error(s).`);
  process.exit(1);
}
console.log("Catalogs are consistent.");
