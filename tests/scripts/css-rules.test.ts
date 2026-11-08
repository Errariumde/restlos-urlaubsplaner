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
      { path: "src/ui/A.svelte", text: "<style>@layer components { .a { margin-left: 1px; width: 2px; text-transform: uppercase; inset-inline-start: 0 } }</style>" },
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
    const text = '<div class="x">red</div>\n<style>\n  @layer components {\n    .a { color: #fff }\n  }\n</style>';
    const errors = checkCss([{ path: "src/ui/A.svelte", text }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("A.svelte:4");
  });

  it("catches physical keywords with !important", () => {
    expect(css(".a { text-align: left !important; float: right!important; clear: left !important }")).toHaveLength(3);
  });

  it("does not read colours out of url() references", () => {
    expect(css('.a { fill: url(#fff); background: url("x.svg#red") }')).toEqual([]);
  });

  it("allows width in a nested @media print", () => {
    expect(css("@media print { @media (min-resolution: 1dppx) { .a { width: 10cm } } .b { height: 1cm } }")).toEqual([]);
  });

  it("does not mistake words inside var() names or function names for colours", () => {
    expect(css(".a { margin-inline: var(--space-tan); padding-inline: calc(tan(45deg) * 1px); color: var(--red); outline-color: var(--red, var(--r-focus)) }")).toEqual([]);
    expect(css(".a { color: var(--x, red) }")).toHaveLength(1);
  });

  it("checks inline styles and style directives in Svelte markup", () => {
    const file = (text: string) => checkCss([{ path: "src/ui/A.svelte", text }]);
    expect(file('<div style="margin-left:0">x</div>')).toHaveLength(1);
    expect(file('<div style="color: #fff; inline-size: 1px">x</div>')).toHaveLength(1);
    expect(file('<div style:margin-left="1px">x</div>')).toHaveLength(1);
    expect(file("<div style:left={x}>x</div>")).toHaveLength(1);
    expect(file('<div style:color="red">x</div>')).toHaveLength(1);
    expect(file('<div style:margin-inline-start={x} style:color="var(--r-text)" style:--gap="1px">x</div>')).toEqual([]);
  });

  it("checks colour attributes in Svelte markup", () => {
    const file = (text: string) => checkCss([{ path: "src/ui/A.svelte", text }]);
    expect(file('<svg><path fill="#fff" stroke="red" /></svg>')).toHaveLength(2);
    expect(file('<svg><stop stop-color="rgb(0 0 0)" /></svg>')).toHaveLength(1);
    expect(file('<svg><path fill="currentColor" stroke="none" /><rect fill="transparent" /></svg>')).toEqual([]);
    expect(file('<svg><path fill="url(#grad)" /></svg>')).toEqual([]);
  });

  it("flags font sizes in px and names rem as the fix", () => {
    const errors = css(".a { font-size: 10px } .b { font-size: 0.625rem } .c { font-size: calc(1em + 2px) }");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("rem");
  });

  it("flags breakpoints in px in @container and @media", () => {
    expect(css("@container calendar (inline-size >= 520px) { .a { gap: 0 } }")).toHaveLength(1);
    expect(css("@media (min-width: 40em) and (max-width: 800px) { .a { gap: 0 } }")).toHaveLength(1);
    expect(css("@container calendar (inline-size >= 32.5rem) { .a { gap: 0 } } @media (pointer: coarse) { .b { gap: 0 } }")).toEqual([]);
  });

  it("flags box sizes over 16 px, but not smaller marks, lines and other properties", () => {
    expect(css(".a { inline-size: 18px } .b { max-inline-size: min(900px, 100%) } .c { min-block-size: 40px }")).toHaveLength(3);
    expect(css(".a { inline-size: 15px; block-size: 5px; border: 1px solid; box-shadow: 0 4px 16px; inset-block-end: 10px }")).toEqual([]);
    expect(css(".a { inline-size: 1.125rem; block-size: calc(100% - 2px) }")).toEqual([]);
  });

  it("requires repeating gradients to interpolate in srgb, and names the reason", () => {
    const errors = css(".a { background: repeating-linear-gradient(135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px) }");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("in srgb");
    expect(errors[0]).toContain("Firefox");
    expect(css(".a { background: repeating-radial-gradient(circle, var(--x) 0 2px, transparent 2px 4px) } .b { --p: repeating-conic-gradient(var(--x) 0 10deg, transparent 10deg 20deg) }")).toHaveLength(2);
  });

  it("checks each gradient of a layered background, with in srgb before or after the angle", () => {
    expect(css(".a { background: repeating-linear-gradient(in srgb 45deg, var(--x) 0 4px, transparent 4px 5px), repeating-linear-gradient(135deg in srgb, var(--x) 0 4px, transparent 4px 5px), var(--y) }")).toEqual([]);
    expect(css(".a {\n  background:\n    repeating-linear-gradient(in srgb 45deg, var(--x) 0 4px, transparent 4px 5px),\n    repeating-linear-gradient(135deg, var(--x) 0 4px, transparent 4px 5px);\n}")).toHaveLength(1);
    expect(css(".a { background: repeating-linear-gradient(in oklab 90deg, var(--x) 0 3px, transparent 3px 6px) }")).toHaveLength(1);
    expect(css(".a { background: linear-gradient(135deg, var(--x) 50%, transparent 50%) }")).toEqual([]);
  });

  it("requires Svelte style blocks to be inside @layer components", () => {
    const file = (text: string) => checkCss([{ path: "src/ui/A.svelte", text }]);
    expect(file("<style>.a { color: var(--r-text) }</style>")).toHaveLength(1);
    expect(file("<style>@layer other { .a { color: var(--r-text) } }</style>")).toHaveLength(1);
    expect(file("<style>@layer components { .a { color: var(--r-text) } } .b { color: var(--r-text) }</style>")).toHaveLength(1);
    expect(file("<style>@layer components { .a { color: var(--r-text) } }</style>")).toEqual([]);
    expect(file("<style></style>")).toEqual([]);
  });
});
