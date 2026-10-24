// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Assembles the temporary feasibility test pages (feasibility/README.md): inlines the scripts a page names,
// computes their CSP hashes and inserts the policy as a meta tag. Pure: reading and writing files is
// scripts/feasibility.js. The sources are ours, so a page is parsed with regular expressions, not an HTML parser.
import { createHash } from "node:crypto";

export type Variant = "standard" | "pro" | "pages";

/** The CSP source for a script's text: SHA-256 over the text the browser sees (CRLF and lone CR become LF). */
export function cspHash(scriptText: string): string {
  const seen = scriptText.replace(/\r\n?/g, "\n");
  return `'sha256-${createHash("sha256").update(seen).digest("base64")}'`;
}

/** The content of the policy's meta tag (docs/SPEC.md, Content Security Policy); the hashes are `cspHash` values. */
export function policy(variant: Variant, hashes: readonly string[]): string {
  const sources = [...hashes];
  if (variant === "pro") sources.push("'wasm-unsafe-eval'");
  const scriptSrc = sources.length === 0 ? "'none'" : sources.join(" ");
  const worker = variant === "pages" ? "worker-src 'self' blob:" : "worker-src blob:";
  const directives = [
    "default-src 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    worker,
  ];
  if (variant === "pages") directives.push("manifest-src 'self'");
  return directives.join("; ");
}

const CHARSET = /<meta charset="utf-8">/i;
const POLICY_TAG = /http-equiv\s*=\s*["']?Content-Security-Policy/i;
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const EXECUTABLE_TYPES = new Set(["", "module", "text/javascript"]);

const attribute = (attributes: string, name: string): string | undefined =>
  new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, "i").exec(attributes)?.[1];

/**
 * Turns a source page into the page the browser opens: every `<script … data-inline="a.js b.js">` gets the named
 * files' contents (joined by a newline) as its text, executable scripts are hashed (not data blocks, not scripts
 * marked `data-no-hash`), and the policy's meta tag goes directly after `<meta charset="utf-8">`.
 */
export function assemblePage(source: string, files: ReadonlyMap<string, string>, variant: Variant): string {
  if (!CHARSET.test(source)) throw new Error('The page has no <meta charset="utf-8">; the policy goes right after it.');
  if (POLICY_TAG.test(source)) throw new Error("The page already has a Content-Security-Policy meta tag.");

  const hashes: string[] = [];
  const withScripts = source.replace(SCRIPT, (_whole, attributes: string, text: string) => {
    const names = attribute(attributes, "data-inline");
    let content = text;
    if (names !== undefined) {
      const parts = names.split(/\s+/).filter((name) => name !== "");
      content = parts
        .map((name) => {
          const file = files.get(name);
          if (file === undefined) throw new Error(`The page names the file "${name}", which is not among the files.`);
          if (/<\/script/i.test(file)) throw new Error(`The file "${name}" contains "</script", which would end the element early.`);
          return file;
        })
        .join("\n");
    }
    const type = (attribute(attributes, "type") ?? "").trim().toLowerCase();
    if (EXECUTABLE_TYPES.has(type) && !/(?:^|\s)data-no-hash(?=[\s=]|$)/i.test(attributes)) hashes.push(cspHash(content));
    const kept = attributes.replace(/\s+data-inline\s*=\s*"[^"]*"/i, "");
    return `<script${kept}>${content}</script>`;
  });

  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy(variant, hashes)}">`;
  return withScripts.replace(CHARSET, (charset) => charset + tag);
}
