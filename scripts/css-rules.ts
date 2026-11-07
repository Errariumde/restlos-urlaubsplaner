// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The CSS rules of the UI (docs/SPEC.md, "Controls, icons and fonts" and "Multilingual support"): colours only
// as tokens, logical properties only, no uppercase text, and rem for what follows the text size.
// Checks declarations, not substrings. Run through `npm run check` (scripts/check-css.js).

export interface CssFile {
  path: string;
  text: string;
}

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

// CSS named colours. `transparent`, `currentColor` and the system colours (CanvasText, Highlight, …) are not listed: they are allowed.
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse " +
    "chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
    "darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
    "greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral " +
    "lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple " +
    "mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite " +
    "navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink " +
    "plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue " +
    "slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

// Properties whose values are words, not colours (`font-family: Tan Pearl`, `content: "red"`).
const NO_COLOR_WORDS = /^(?:font|font-family|content|quotes|grid|grid-area|grid-template-areas|animation|animation-name|transition|transition-property|will-change|counter-reset|counter-increment|view-transition-name|anchor-name|position-anchor|container|container-name|src)$/;

const PHYSICAL_SIDE = /^(?:margin|padding|border|inset|scroll-margin|scroll-padding)-(?:left|right|top|bottom)(?:-|$)/;
const PHYSICAL_BARE = /^(?:left|right|top|bottom)$/;
const PHYSICAL_SIZE = /^(?:min-|max-)?(?:width|height)$/;
const BOX_SIZE = /^(?:min-|max-)?(?:inline-size|block-size)$/;
const PX = /(?<![\w.-])(\d*\.?\d+)px\b/g;
/** The largest size in px for a box: lines, marks and patterns that must not grow with the text. */
const MAX_PX_BOX = 16;
const SIZE_RULE =
  "text sizes, boxes that hold text and breakpoints use rem, so they follow the browser's text size (1rem is 16px by default); px only for borders, shadows, patterns and marks up to 16px";

interface Block {
  /** Text of one stylesheet (a .css file, a `<style>` block, or an inline style wrapped in a rule). */
  text: string;
  /** Number of lines before the block. */
  lineOffset: number;
}

/** Blanks out comments, string contents and url() arguments, keeping every other character (and all newlines) in place. */
function blank(text: string): string {
  const keepNewlines = (match: string) => match.replace(/[^\n]/g, " ");
  // Known limit: comments are stripped before strings, so a "/*" inside a string starts a comment.
  return text
    .replace(/\/\*[\s\S]*?\*\//g, keepNewlines)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (match) => match[0]! + keepNewlines(match.slice(1, -1)) + match[0]!)
    .replace(/url\([^)]*\)/gi, (match) => keepNewlines(match));
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length - 1;
}

/** The first literal colour in a value, or undefined. */
function literalColor(value: string, checkNamed: boolean): string | undefined {
  const literal = COLOR_FUNCTION.exec(value)?.[0] ?? HEX_COLOR.exec(value)?.[0];
  if (literal) return literal;
  if (!checkNamed) return undefined;
  // Custom property names and function names are not colour words (`var(--space-tan)`, `tan(45deg)`).
  const words = value
    .replace(/var\(\s*--[\w-]*/gi, "var(")
    .replace(/[a-z-]+\(/gi, "(")
    .toLowerCase();
  for (const match of words.matchAll(/(?<![\w-])[a-z]+(?![\w-])/g)) if (NAMED_COLORS.has(match[0])) return match[0];
  return undefined;
}

/** Style blocks of a Svelte file must hold only `@layer components { … }` blocks. */
function layerErrors(block: Block, path: string): string[] {
  const text = blank(block.text);
  let depth = 0;
  let prelude = "";
  let preludeStart = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (depth === 0) {
      if (char === "{") {
        if (!/^@layer\s+components$/i.test(prelude.trim())) return [`${path}:${String(lineOf(text, preludeStart) + 1 + block.lineOffset)}: style rules must be inside @layer components { … }`];
        prelude = "";
        depth = 1;
      } else if (char === ";" || char === "}") {
        return [`${path}:${String(lineOf(text, preludeStart) + 1 + block.lineOffset)}: style rules must be inside @layer components { … }`];
      } else {
        if (prelude.trim() === "" && !/\s/.test(char)) preludeStart = index;
        prelude += char;
      }
    } else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) prelude = "";
    }
  }
  return prelude.trim() === "" ? [] : [`${path}:${String(lineOf(text, preludeStart) + 1 + block.lineOffset)}: style rules must be inside @layer components { … }`];
}

/** Index ranges covered by `@media print { … }`. */
function printRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of text.matchAll(/@media\b[^{;]*\bprint\b[^{;]*\{/gi)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < text.length && depth > 0) {
      if (text[index] === "{") depth++;
      else if (text[index] === "}") depth--;
      index++;
    }
    ranges.push([match.index, index]);
  }
  return ranges;
}

function declarationErrors(block: Block, path: string, isTokenFile: boolean): string[] {
  const text = blank(block.text);
  const print = printRanges(text);
  const errors: string[] = [];
  // A declaration is `name: value` after `{`, `;` or the start, and ends at `;` or `}`. A selector like `a:hover {` ends at `{` and does not match.
  const declaration = /(?:^|[{;}])\s*([a-zA-Z-]+)\s*:\s*([^;{}]*)(?=[;}])/g;
  for (const match of text.matchAll(declaration)) {
    const name = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    const at = match.index + match[0].indexOf(match[1]!);
    const where = `${path}:${String(lineOf(text, at) + 1 + block.lineOffset)}`;
    const report = (message: string) => errors.push(`${where}: ${message}`);

    if (!isTokenFile) {
      const color = literalColor(value, !NO_COLOR_WORDS.test(name));
      if (color) report(`literal colour "${color}" in "${name}"; use a token from tokens.css`);
    }
    if (name.startsWith("--")) continue;

    if (PHYSICAL_BARE.test(name) || PHYSICAL_SIDE.test(name)) report(`physical property "${name}"; use the logical one`);
    else if (PHYSICAL_SIZE.test(name)) {
      if (!print.some(([from, to]) => at >= from && at < to)) report(`physical property "${name}"; use inline-size/block-size (allowed only in @media print)`);
    } else if ((name === "text-align" || name === "float" || name === "clear") && /^(?:left|right)\b/i.test(value)) report(`physical value "${name}: ${value}"; use start/end or inline-start/inline-end`);
    else if (name === "text-transform" && /\buppercase\b/i.test(value)) report("text-transform: uppercase is not allowed");

    if (print.some(([from, to]) => at >= from && at < to)) continue;
    if (name === "font-size" && value.match(PX)) report(`font size in px ("${value}"); ${SIZE_RULE}`);
    else if (BOX_SIZE.test(name)) {
      for (const px of value.matchAll(PX)) if (Number(px[1]) > MAX_PX_BOX) report(`box size ${px[0]} in "${name}"; ${SIZE_RULE}`);
    }
  }
  return errors;
}

/** Breakpoints in px in the conditions of `@container` and `@media`. */
function queryErrors(block: Block, path: string): string[] {
  const text = blank(block.text);
  const errors: string[] = [];
  for (const match of text.matchAll(/@(container|media)\b([^{;]*)\{/gi)) {
    if (match[2]!.match(PX)) errors.push(`${path}:${String(lineOf(text, match.index) + 1 + block.lineOffset)}: breakpoint in px in @${match[1]!}; ${SIZE_RULE}`);
  }
  return errors;
}

const COLOR_ATTRIBUTE = /(?<=\s)(?:fill|stroke|color|stop-color|flood-color)="([^"]*)"/g;
const STYLE_ATTRIBUTE = /(?<=\s)style="([^"]*)"/g;
const STYLE_DIRECTIVE = /(?<=\s)style:(-{0,2}\w[\w-]*)(?:\|important)?(?:=(?:"([^"]*)"|'([^']*)'|\{[^}]*\}))?/g;

/** Inline styles, `style:` directives and colour attributes in the markup of a Svelte file. */
function markupErrors(file: CssFile): string[] {
  const errors: string[] = [];
  const keepNewlines = (match: string) => match.replace(/[^\n]/g, " ");
  const markup = file.text
    .replace(/<!--[\s\S]*?-->/g, keepNewlines)
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, keepNewlines);
  for (const match of markup.matchAll(STYLE_ATTRIBUTE)) {
    const lineOffset = lineOf(markup, match.index);
    errors.push(...declarationErrors({ text: `a{${match[1]!}}`, lineOffset }, file.path, false));
  }
  for (const match of markup.matchAll(STYLE_DIRECTIVE)) {
    const value = match[2] ?? match[3] ?? "x";
    errors.push(...declarationErrors({ text: `a{${match[1]!}:${value}}`, lineOffset: lineOf(markup, match.index) }, file.path, false));
  }
  for (const match of markup.matchAll(COLOR_ATTRIBUTE)) {
    const color = literalColor(blank(match[1]!), true);
    if (color) errors.push(`${file.path}:${String(lineOf(markup, match.index) + 1)}: literal colour "${color}" in a colour attribute; use currentColor or a token`);
  }
  return errors;
}

function blocksOf(file: CssFile): Block[] {
  if (!file.path.endsWith(".svelte")) return [{ text: file.text, lineOffset: 0 }];
  const blocks: Block[] = [];
  for (const match of file.text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = match.index + match[0].indexOf(">") + 1;
    blocks.push({ text: match[1]!, lineOffset: lineOf(file.text, start) });
  }
  return blocks;
}

/** Checks CSS files and the `<style>` blocks and markup styles of Svelte files. Returns one line per error. */
export function checkCss(files: readonly CssFile[]): string[] {
  const errors: string[] = [];
  for (const file of files) {
    const isTokenFile = file.path.replaceAll("\\", "/").endsWith("styles/tokens.css");
    const isSvelte = file.path.endsWith(".svelte");
    for (const block of blocksOf(file)) {
      if (isSvelte) errors.push(...layerErrors(block, file.path));
      errors.push(...declarationErrors(block, file.path, isTokenFile));
      errors.push(...queryErrors(block, file.path));
    }
    if (isSvelte) errors.push(...markupErrors(file));
  }
  return errors;
}
