// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON_FILES } from "../../../src/ui/icons/names";
import { parseIcon } from "../../../src/ui/icons/parse";

// Vitest runs from the repository root.
const ICON_DIRECTORY = "src/ui/icons/";

const svg = (inner: string, root = 'viewBox="0 0 24 24" fill="none" stroke="currentColor"') =>
  `<!-- @license lucide-static v1.60.0 - ISC -->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  ${root}\n>\n${inner}\n</svg>\n`;

describe("parseIcon", () => {
  it("reads the view box and the shapes with their geometry", () => {
    const icon = parseIcon(svg('  <rect width="18" height="18" x="3" y="3" rx="2" />\n  <path d="M9 3v18" />'));
    expect(icon).toEqual({
      viewBox: "0 0 24 24",
      elements: [
        { tag: "rect", attrs: { width: "18", height: "18", x: "3", y: "3", rx: "2" } },
        { tag: "path", attrs: { d: "M9 3v18" } },
      ],
    });
  });

  it("accepts circles, lines and polylines", () => {
    const icon = parseIcon(svg('<circle cx="12" cy="12" r="1" /><line x1="1" y1="2" x2="3" y2="4" /><polyline points="1 2 3 4" />'));
    expect(icon.elements.map((element) => element.tag)).toEqual(["circle", "line", "polyline"]);
  });

  it("refuses any other element", () => {
    expect(() => parseIcon(svg('<script>alert(1)</script>'))).toThrow(/script/);
    expect(() => parseIcon(svg('<image href="x.png" />'))).toThrow(/image/);
    expect(() => parseIcon(svg('<g><path d="M0 0" /></g>'))).toThrow(/g/);
    expect(() => parseIcon(svg('<foreignObject />'))).toThrow(/foreignObject/);
  });

  it("refuses attributes that aren't geometry", () => {
    expect(() => parseIcon(svg('<path d="M0 0" onload="alert(1)" />'))).toThrow(/onload/);
    expect(() => parseIcon(svg('<path d="M0 0" fill="#f00" />'))).toThrow(/fill/);
    expect(() => parseIcon(svg('<path d="M0 0" style="x" />'))).toThrow(/style/);
  });

  it("refuses values that aren't numbers or path data", () => {
    expect(() => parseIcon(svg('<path d="url(#x)" />'))).toThrow(/d/);
    expect(() => parseIcon(svg('<rect width="javascript:1" />'))).toThrow(/width/);
  });

  it("refuses a root that colours the icon itself or has no view box", () => {
    expect(() => parseIcon(svg('<path d="M0 0" />', 'viewBox="0 0 24 24" fill="#000"'))).toThrow(/fill/);
    expect(() => parseIcon(svg('<path d="M0 0" />', 'fill="none"'))).toThrow(/viewBox/);
    expect(() => parseIcon('<path d="M0 0" />')).toThrow(/svg/);
  });
});

describe("the icon files", () => {
  it("are exactly the listed Lucide files", () => {
    const files = readdirSync(ICON_DIRECTORY).filter((name) => name.endsWith(".svg"));
    expect(files.sort()).toEqual(Object.values(ICON_FILES).map((name) => `${name}.svg`).sort());
  });

  it.each(Object.values(ICON_FILES))("%s.svg holds only svg, path, circle, rect, line and polyline", (name) => {
    const text = readFileSync(`${ICON_DIRECTORY}${name}.svg`, "utf8");
    const icon = parseIcon(text);
    expect(icon.viewBox).toBe("0 0 24 24");
    expect(icon.elements.length).toBeGreaterThan(0);
  });
});
