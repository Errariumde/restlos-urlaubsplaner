// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Checks the UI message catalogs: same keys in de and en, every key used (or a holiday data key),
// every used key present, valid ICU syntax, no "#". The gallery's catalogs are checked the same way against
// src/gallery. Run through `npm run check`.
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

const readSources = (directory) => sourceFiles(directory).map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
const app = { de: readJson("src/ui/i18n/de.json"), en: readJson("src/ui/i18n/en.json") };

const errors = [
  // The app's catalogs against the app's code.
  ...checkCatalogs({ ...app, sources: readSources("src/ui"), dataKeys: [...dataKeys] }),
  // The gallery's own texts (dev only, not in the build) against the gallery's code, which may use the app's keys too.
  ...checkCatalogs({
    de: readJson("src/gallery/i18n/de.json"),
    en: readJson("src/gallery/i18n/en.json"),
    sources: readSources("src/gallery"),
    dataKeys: [],
    externalKeys: [...Object.keys(app.de), ...Object.keys(app.en)],
  }).map((error) => `gallery: ${error}`),
];

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${String(errors.length)} catalog error(s).`);
  process.exit(1);
}
console.log("Catalogs are consistent.");
