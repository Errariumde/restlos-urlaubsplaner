// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Developer command: builds the temporary feasibility test pages (feasibility/README.md) into dist/feasibility/.
// Usage: npm run feasibility
/* global console, process */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assemblePage } from "./feasibility-pages.ts";

const ROOT = join(import.meta.dirname, "..");
const SOURCES = join(ROOT, "feasibility");
const OUTPUT = join(ROOT, "dist", "feasibility");

// One entry per page. Later tasks append to this list.
// - out: path below dist/feasibility/
// - source: the page's HTML file in feasibility/
// - variant: the policy ("standard" | "pro" | "pages")
// - generated: optional () => Record<name, text>; extra files a page can name in data-inline (not read from feasibility/)
/** @type {{ out: string, source: string, variant: "standard" | "pro" | "pages", generated?: () => Record<string, string> }[]} */
const PAGES = [];

// Every .js and .json file in feasibility/ can be named in a page's data-inline.
const sourceFiles = new Map();
for (const name of readdirSync(SOURCES)) {
  if (name.endsWith(".js") || name.endsWith(".json")) sourceFiles.set(name, readFileSync(join(SOURCES, name), "utf8"));
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });
for (const page of PAGES) {
  const files = new Map(sourceFiles);
  for (const [name, text] of Object.entries(page.generated?.() ?? {})) files.set(name, text);
  let html;
  try {
    html = assemblePage(readFileSync(join(SOURCES, page.source), "utf8"), files, page.variant);
  } catch (error) {
    console.error(`${page.source}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const target = join(OUTPUT, page.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(target);
}
