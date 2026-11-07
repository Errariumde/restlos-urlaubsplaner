// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { insertCsp, insertDataBlock, scriptHashes, standardPolicy, utf8Length } from "../../scripts/build/html";

const sha256Base64 = (text: string): string => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

describe("build HTML helpers", () => {
  it("hashes executable inline scripts only", () => {
    const html = `<script>a()\r\n</script><script type="application/json">{}</script><script type="module">b()</script>`;
    expect(scriptHashes(html)).toEqual([sha256Base64("a()\n"), sha256Base64("b()")]);
  });

  it("reads only the type attribute itself, not data-type", () => {
    const html = `<script data-type="application/json">c()</script><script data-x="1" type="application/json">{}</script>`;
    expect(scriptHashes(html)).toEqual([sha256Base64("c()")]);
  });

  it.each(["</script>", "</SCRIPT>", "</script >", "</script foo>", "</script\t\n bar>", "</script/>"])(
    "ends a script at the end tag %j, as the HTML parser does",
    (end) => {
      expect(scriptHashes(`<script>a()${end}<script>b()</script>`)).toEqual([sha256Base64("a()"), sha256Base64("b()")]);
    },
  );

  it("doesn't end a script at a tag that only starts like the end tag", () => {
    expect(scriptHashes("<script>a()</script-x>b()</script>")).toEqual([sha256Base64("a()</script-x>b()")]);
  });

  it("puts the policy right after meta charset", () => {
    const out = insertCsp(`<head><meta charset="utf-8"><title>x</title>`, "default-src 'none'");
    expect(out).toMatch(/^<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'">/);
  });

  it("writes the standard policy in the spec's order", () => {
    expect(standardPolicy(["'sha256-A'"])).toBe(
      "default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'sha256-A'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:",
    );
  });

  it("escapes < in data blocks", () => {
    expect(insertDataBlock("<body></body>", "x", `{"a":"</script>"}`)).toContain(`{"a":"\\u003c/script>"}`);
  });

  it("counts UTF-8 bytes", () => {
    expect(utf8Length("aä€😀")).toBe(1 + 2 + 3 + 4);
  });
});
