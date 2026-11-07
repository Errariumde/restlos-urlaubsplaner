// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// String helpers for the built HTML file: the Content Security Policy with the hashes of its inline scripts
// (docs/SPEC.md, "Content Security Policy") and JSON data blocks.
import { createHash } from "node:crypto";

/** The `type` values that make a `<script>` executable: none, empty, `module` or a JavaScript MIME type. */
const EXECUTABLE_TYPE = /^(|module|(text|application)\/(x-)?(java|ecma)script)$/i;

// The HTML parser also ends a script at `</script foo>` and `</script/>`, but not at `</script-x>`.
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script(?:[\t\n\f\r /][^>]*)?>/gi;
const TYPE_ATTRIBUTE = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** `'sha256-…'` for each executable inline `<script>`, in document order, over its LF-normalized text. */
export function scriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const [, attributes = "", text = ""] of html.matchAll(SCRIPT)) {
    const type = TYPE_ATTRIBUTE.exec(attributes);
    if (type && !EXECUTABLE_TYPE.test((type[1] ?? type[2] ?? type[3] ?? "").trim())) continue;
    // The HTML parser turns CR LF and lone CR into LF before the browser hashes the script text.
    const normalized = text.replace(/\r\n?/g, "\n");
    hashes.push(`'sha256-${createHash("sha256").update(normalized, "utf8").digest("base64")}'`);
  }
  return hashes;
}

const META_CHARSET = /<meta\s+charset\s*=\s*["']?utf-8["']?\s*\/?>/i;

/** Inserts the policy as `<meta http-equiv="Content-Security-Policy">` right after `<meta charset="utf-8">`. */
export function insertCsp(html: string, policy: string): string {
  const charset = META_CHARSET.exec(html);
  if (!charset) throw new Error('The HTML has no <meta charset="utf-8"> to put the Content Security Policy after.');
  if (policy.includes('"')) throw new Error("A Content Security Policy can't contain a double quote.");
  const end = charset.index + charset[0].length;
  return `${html.slice(0, end)}<meta http-equiv="Content-Security-Policy" content="${policy}">${html.slice(end)}`;
}

/** The standard policy of the app, in the order docs/SPEC.md lists the directives. */
export function standardPolicy(hashes: readonly string[]): string {
  return [
    "default-src 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `script-src ${hashes.join(" ")}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "worker-src blob:",
  ].join("; ");
}

/**
 * Inserts `<script type="application/json" id="…">` with the JSON text before `</body>`. Every `<` becomes
 * `\u003c`, which JSON reads back as the same character, so the text can't close the tag or open a comment.
 */
export function insertDataBlock(html: string, id: string, json: string): string {
  if (!/^[A-Za-z][\w-]*$/.test(id)) throw new Error(`Invalid data block id: ${id}`);
  const end = html.lastIndexOf("</body>");
  if (end < 0) throw new Error("The HTML has no </body> to put the data block before.");
  const block = `<script type="application/json" id="${id}">${json.replaceAll("<", "\\u003c")}</script>`;
  return `${html.slice(0, end)}${block}${html.slice(end)}`;
}

/** The number of bytes of the text in UTF-8. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
