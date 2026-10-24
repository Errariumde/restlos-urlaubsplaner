// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Developer command: builds the temporary feasibility test pages (feasibility/README.md) into dist/feasibility/.
// Usage: npm run feasibility
/* global console, process, Buffer */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { assemblePage } from "./feasibility-pages.ts";

const ROOT = join(import.meta.dirname, "..");
const SOURCES = join(ROOT, "feasibility");
const OUTPUT = join(ROOT, "dist", "feasibility");

// The 1x1 PNG next to the CSP pages (the same bytes as PIXEL_BASE64 in feasibility/csp.js).
const PIXEL_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
function pixelPng() {
  return Buffer.from(PIXEL_BASE64, "base64");
}

// The gzip data block of csp.html (check C7): base64 of gzip of a fixed text, named gz.b64 in data-inline.
function gzipBlock() {
  return { "gz.b64": gzipSync(Buffer.from("restlos feasibility")).toString("base64") };
}

// One entry per page. Later tasks append to this list.
// - out: path below dist/feasibility/
// - source: the page's HTML file in feasibility/
// - variant: the policy ("standard" | "pro" | "pages")
// - generated: optional () => Record<name, text>; extra files a page can name in data-inline (not read from feasibility/)
/** @type {{ out: string, source: string, variant: "standard" | "pro" | "pages", generated?: () => Record<string, string> }[]} */
const PAGES = [
  { out: "storage/a/storage.html", source: "storage.html", variant: "standard" },
  { out: "storage/a/storage-copy.html", source: "storage.html", variant: "standard" },
  { out: "storage/b/storage.html", source: "storage.html", variant: "standard" },
  { out: "csp.html", source: "csp.html", variant: "standard", generated: gzipBlock },
  { out: "csp-pro.html", source: "csp.html", variant: "pro", generated: gzipBlock },
  { out: "pages/index.html", source: "csp.html", variant: "pages", generated: gzipBlock },
];

// Files that are not assembled pages, written as they are. Later tasks append to this list.
// - out: path below dist/feasibility/
// - content: () => text, bytes, or { from: name in feasibility/ }
/** @type {{ out: string, content: () => string | Uint8Array }[]} */
const EXTRA_FILES = [
  { out: "pixel.png", content: pixelPng },
  { out: "pages/pixel.png", content: pixelPng },
  {
    out: "pages/manifest.webmanifest",
    content: () => JSON.stringify({ name: "restlos feasibility", start_url: ".", display: "standalone" }, null, 2) + "\n",
  },
  { out: "pages/sw.js", content: () => readFileSync(join(SOURCES, "sw.js"), "utf8") },
];

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
    // "<!-- pages-only: X -->" in a source page becomes X in the pages variant and stays a comment elsewhere.
    let source = readFileSync(join(SOURCES, page.source), "utf8");
    if (page.variant === "pages") source = source.replace(/<!-- pages-only: ([\s\S]*?) -->/g, "$1");
    html = assemblePage(source, files, page.variant);
  } catch (error) {
    console.error(`${page.source}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const target = join(OUTPUT, page.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(target);
}

for (const extra of EXTRA_FILES) {
  const target = join(OUTPUT, extra.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, extra.content());
  console.log(target);
}
