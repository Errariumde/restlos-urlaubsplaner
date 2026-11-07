// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scriptHashes } from "../../scripts/build/html";
import { EXAMPLE_BLOCK_ID, EXAMPLE_FILE, embedExample } from "../../scripts/build/vite-restlos";

const PAGE = `<html><head><meta charset="utf-8"></head><body><div id="app"></div><script type="module">a()</script></body></html>`;

/** The text of the data block, as the page reads it with `textContent`. */
function blockText(html: string): string {
  const match = new RegExp(`<script type="application/json" id="${EXAMPLE_BLOCK_ID}">([\\s\\S]*?)</script>`).exec(html);
  if (!match?.[1]) throw new Error("no data block");
  return match[1];
}

describe("the example data block", () => {
  it("carries the example plan file, compact and unchanged in content", () => {
    const text = readFileSync(EXAMPLE_FILE, "utf8");
    const html = embedExample(PAGE, text);
    expect(html.indexOf(`id="${EXAMPLE_BLOCK_ID}"`)).toBeLessThan(html.indexOf("</body>"));
    expect(JSON.parse(blockText(html))).toEqual(JSON.parse(text));
    expect(blockText(html)).not.toContain("\n");
  });

  it("can't end its script element or open a comment", () => {
    const value = { name: "</script><script>alert(1)</script><!-- x", other: "</SCRIPT >" };
    const html = embedExample(PAGE, JSON.stringify(value));
    const text = blockText(html);
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual(value);
    // Still exactly two script elements: the module and the data block.
    expect(html.match(/<script\b/g)).toHaveLength(2);
  });

  it("gets no CSP hash, only executable scripts do", () => {
    expect(scriptHashes(embedExample(PAGE, "{}"))).toEqual(scriptHashes(PAGE));
  });

  it("fails on a text that isn't JSON", () => {
    expect(() => embedExample(PAGE, "{")).toThrow(SyntaxError);
  });
});
