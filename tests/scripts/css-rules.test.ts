// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkCss } from "../../scripts/css-rules.ts";

const css = (text: string, path = "src/ui/x.css") => checkCss([{ path, text }]);

describe("checkCss", () => {
  it("flags literal colours outside the token file", () => {
    expect(css("a { color: #fff; background: oklch(50% 0 0) }")).toHaveLength(2);
    expect(css(":root { --r-text: oklch(20% 0 0) }", "src/ui/styles/tokens.css")).toEqual([]);
  });

  it("flags rgb, hsl, oklab and named colours, but not the allowed keywords", () => {
    expect(css("a { color: rgb(0 0 0); border-color: hsl(1 2% 3%); fill: oklab(1 0 0); background: red }")).toHaveLength(4);
    expect(css("a { color: white } b { color: black }")).toHaveLength(2);
    expect(css("a { color: currentColor; background: transparent; outline-color: Highlight; border-color: CanvasText }")).toEqual([]);
    expect(css(":root { --r-on-primary: white; --x: black }", "src/ui/styles/tokens.css")).toEqual([]);
  });

  it("flags physical properties and uppercase", () => {
    const errors = checkCss([
      { path: "src/ui/A.svelte", text: "<style>.a { margin-left: 1px; width: 2px; text-transform: uppercase; inset-inline-start: 0 }</style>" },
    ]);
    expect(errors).toHaveLength(3);
  });

  it("allows var() colours and logical properties", () => {
    expect(css(".a { color: var(--r-text); padding-inline: var(--space-2); inline-size: 100% }")).toEqual([]);
  });

  it("flags left, right, top, bottom and the physical shorthands", () => {
    expect(css(".a { left: 0; right: 0; top: 0; bottom: 0 }")).toHaveLength(4);
    expect(css(".a { padding-top: 0; border-right: 1px solid var(--r-border); inset-bottom: 0; border-top-left-radius: 2px }")).toHaveLength(4);
    expect(css(".a { inset-inline-start: 0; inset-block-end: 0; border-start-start-radius: 2px; border-block-end-color: red }")).toHaveLength(1);
  });

  it("flags physical sizes except inside @media print", () => {
    expect(css(".a { width: 1px; height: 1px; min-width: 1px; max-height: 1px }")).toHaveLength(4);
    expect(css("@media print { .a { width: 10cm; height: 5cm } }")).toEqual([]);
    expect(css("@media print { .a { width: 10cm } } .b { height: 1px }")).toHaveLength(1);
  });

  it("flags physical values of text-align and float", () => {
    expect(css(".a { text-align: left; float: right }")).toHaveLength(2);
    expect(css(".a { text-align: start; text-align: end; float: inline-start }")).toEqual([]);
  });

  it("does not mistake custom property names or selectors for properties", () => {
    expect(css(":root { --radius-control: 6px; --r-border: var(--x); --width: 1px }")).toEqual([]);
    expect(css(".left, .top:hover, .width-box { color: var(--r-text) }")).toEqual([]);
  });

  it("ignores comments and strings", () => {
    expect(css("/* color: #fff; margin-left: 0 */ .a::after { content: 'red left: 1px' }")).toEqual([]);
  });

  it("reports path and line", () => {
    const [error] = css(".a {\n  color: #fff;\n}");
    expect(error).toContain("src/ui/x.css:2");
  });

  it("only reads the style blocks of Svelte files", () => {
    const text = '<div style="left: 0">red</div>\n<style>\n  .a { color: #fff }\n</style>';
    const errors = checkCss([{ path: "src/ui/A.svelte", text }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("A.svelte:3");
  });
});
