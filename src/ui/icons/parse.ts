// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Reads a Lucide SVG file into plain data that Icon.svelte renders as elements, so no markup string ever
// reaches the page ({@html} is not used). Anything that isn't a simple stroked shape fails loudly: the
// build and the tests stop instead of shipping it.

/** One shape of an icon: its tag and its geometry attributes. */
export interface IconElement {
  tag: "path" | "circle" | "rect" | "line" | "polyline";
  attrs: Record<string, string>;
}

export interface IconData {
  viewBox: string;
  elements: IconElement[];
}

/** The geometry each shape may carry. Colour and style come from Icon.svelte (currentColor). */
const GEOMETRY: Record<IconElement["tag"], ReadonlySet<string>> = {
  path: new Set(["d"]),
  circle: new Set(["cx", "cy", "r"]),
  rect: new Set(["x", "y", "width", "height", "rx", "ry"]),
  line: new Set(["x1", "y1", "x2", "y2"]),
  polyline: new Set(["points"]),
};

/** The root's attributes as Lucide writes them; the class is dropped, the others must have these values. */
const ROOT: Record<string, RegExp> = {
  class: /^[\w -]*$/,
  xmlns: /^http:\/\/www\.w3\.org\/2000\/svg$/,
  width: /^24$/,
  height: /^24$/,
  viewBox: /^\d+ \d+ \d+ \d+$/,
  fill: /^none$/,
  stroke: /^currentColor$/,
  "stroke-width": /^2$/,
  "stroke-linecap": /^round$/,
  "stroke-linejoin": /^round$/,
};

/** Numbers, or path data: commands, numbers, signs, dots, commas and spaces. */
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
const POINTS = /^[0-9.,\s-]+$/;

const ATTRIBUTE = /\s*([\w:-]+)="([^"]*)"/y;

function attributesOf(source: string, where: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let index = 0;
  while (index < source.length) {
    ATTRIBUTE.lastIndex = index;
    const match = ATTRIBUTE.exec(source);
    if (!match) {
      if (source.slice(index).trim() === "") break;
      throw new Error(`${where}: can't read the attributes "${source.slice(index).trim()}"`);
    }
    attrs[match[1]!] = match[2]!;
    index = ATTRIBUTE.lastIndex;
  }
  return attrs;
}

function isTag(tag: string): tag is IconElement["tag"] {
  return Object.hasOwn(GEOMETRY, tag);
}

function checkValue(tag: IconElement["tag"], name: string, value: string): void {
  const pattern = name === "d" ? PATH_DATA : name === "points" ? POINTS : NUMBER;
  if (!pattern.test(value)) throw new Error(`<${tag}>: the value of ${name} isn't geometry: "${value}"`);
}

/** Parses one icon file. Throws on any element other than the shapes in GEOMETRY and on any other attribute. */
export function parseIcon(text: string): IconData {
  const source = text.replace(/<!--[\s\S]*?-->/g, "").trim();
  const root = /^<svg\b([^>]*)>([\s\S]*)<\/svg>$/.exec(source);
  if (!root) throw new Error("The file isn't a single <svg> element.");
  const rootAttrs = attributesOf(root[1]!, "<svg>");
  for (const [name, value] of Object.entries(rootAttrs)) {
    const pattern = ROOT[name];
    if (!pattern) throw new Error(`<svg>: unexpected attribute ${name}`);
    if (!pattern.test(value)) throw new Error(`<svg>: unexpected value of ${name}: "${value}"`);
  }
  const viewBox = rootAttrs["viewBox"];
  if (viewBox === undefined) throw new Error("<svg>: no viewBox");

  const elements: IconElement[] = [];
  const body = root[2]!;
  const element = /\s*<([\w:-]+)\b([^<>]*?)\/>/y;
  let index = 0;
  while (body.slice(index).trim() !== "") {
    element.lastIndex = index;
    const match = element.exec(body);
    if (!match) {
      const tag = /<\/?([\w:-]+)/.exec(body.slice(index))?.[1] ?? body.slice(index).trim().slice(0, 20);
      throw new Error(`Only self-closing shapes are allowed, found <${tag}>`);
    }
    const tag = match[1]!;
    if (!isTag(tag)) throw new Error(`<${tag}> is not allowed in an icon`);
    const attrs = attributesOf(match[2]!, `<${tag}>`);
    for (const [name, value] of Object.entries(attrs)) {
      if (!GEOMETRY[tag].has(name)) throw new Error(`<${tag}>: attribute ${name} is not allowed`);
      checkValue(tag, name, value);
    }
    elements.push({ tag, attrs });
    index = element.lastIndex;
  }
  return { viewBox, elements };
}
