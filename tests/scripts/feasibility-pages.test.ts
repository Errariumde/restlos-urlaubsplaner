// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { assemblePage, cspHash, policy } from "../../scripts/feasibility-pages";

const page = (body: string): string => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`;

describe("cspHash", () => {
  it("hashes the text the browser sees, with CRLF turned into LF", () => {
    expect(cspHash("a\nb")).toBe("'sha256-fhj3NzEbLcOy8mndeDlrA1HxT7Zu+oefdoyyMYGIPHg='");
    expect(cspHash("a\r\nb")).toBe(cspHash("a\nb"));
    expect(cspHash("a\rb")).toBe(cspHash("a\nb"));
  });
});

describe("policy", () => {
  it("writes the standard policy with the hashes", () => {
    expect(policy("standard", ["'sha256-x'"])).toBe(
      "default-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'sha256-x'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:",
    );
  });
  it("adds 'wasm-unsafe-eval' for pro and the self sources for pages", () => {
    expect(policy("pro", ["'sha256-x'"])).toContain("script-src 'sha256-x' 'wasm-unsafe-eval';");
    expect(policy("pages", ["'sha256-x'"])).toMatch(/worker-src 'self' blob:; manifest-src 'self'$/);
  });
  it("keeps script-src valid when there are no hashes", () => {
    expect(policy("standard", [])).toContain("script-src 'none';");
    expect(policy("pro", [])).toContain("script-src 'wasm-unsafe-eval';");
  });
});

describe("assemblePage", () => {
  const files = new Map([["a.js", "console.log(1);"], ["b.js", "console.log(2);"], ["d.json", "{\"x\":1}"]]);

  it("inlines the named files and puts the policy right after the charset", () => {
    const html = assemblePage(page('<script type="module" data-inline="a.js b.js"></script>'), files, "standard");
    expect(html).toContain('<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="');
    expect(html).toContain('<script type="module">console.log(1);\nconsole.log(2);</script>');
    expect(html).toContain(cspHash("console.log(1);\nconsole.log(2);"));
    expect(html).not.toContain("data-inline");
  });
  it("leaves data blocks and data-no-hash scripts out of the hashes", () => {
    const html = assemblePage(
      page('<script type="application/json" data-inline="d.json"></script><script data-no-hash>window.x = 1;</script>'),
      files,
      "standard",
    );
    expect(html).toContain('<script type="application/json">{"x":1}</script>');
    expect(html).toContain("script-src 'none';"); // no executable script was hashed
    expect(html).not.toContain(cspHash('{"x":1}'));
    expect(html).not.toContain(cspHash("window.x = 1;"));
  });
  it("hashes a script written directly in the page", () => {
    expect(assemblePage(page("<script>window.y = 2;</script>"), files, "standard")).toContain(cspHash("window.y = 2;"));
  });
  it("refuses what would give a broken or misleading page", () => {
    expect(() => assemblePage("<html><head></head></html>", files, "standard")).toThrow(/charset/);
    expect(() => assemblePage(page('<script data-inline="missing.js"></script>'), files, "standard")).toThrow(/missing\.js/);
    const closing = new Map([["c.js", "x = '</SCRIPT>';"]]);
    expect(() => assemblePage(page('<script data-inline="c.js"></script>'), closing, "standard")).toThrow(/<\/script/i);
    const twice = page('<meta http-equiv="Content-Security-Policy" content="x">');
    expect(() => assemblePage(twice, files, "standard")).toThrow(/Content-Security-Policy/);
  });
});
