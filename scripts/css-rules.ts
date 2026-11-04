// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The CSS rules of the UI (D1, D2, D14): colours only as tokens, logical properties only, no uppercase text.
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

interface Block {
  /** Text of one stylesheet (a .css file or a `<style>` block). */
  text: string;
  /** Number of lines before the block. */
  lineOffset: number;
}

/** Blanks out comments and string contents, keeping every other character (and all newlines) in place. */
function blank(text: string): string {
  const keepNewlines = (match: string) => match.replace(/[^\n]/g, " ");
  return text
    .replace(/\/\*[\s\S]*?\*\//g, keepNewlines)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (match) => match[0]! + keepNewlines(match.slice(1, -1)) + match[0]!)
    .replace(/url\([^)]*\)/gi, (match) => keepNewlines(match));
}

function blocksOf(file: CssFile): Block[] {
  if (!file.path.endsWith(".svelte")) return [{ text: file.text, lineOffset: 0 }];
  const blocks: Block[] = [];
  for (const match of file.text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = match.index + match[0].indexOf(">") + 1;
    blocks.push({ text: match[1]!, lineOffset: file.text.slice(0, start).split("\n").length - 1 });
  }
  return blocks;
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
    const line = text.slice(0, at).split("\n").length + block.lineOffset;
    const where = `${path}:${String(line)}`;
    const isCustom = name.startsWith("--");
    const report = (message: string) => errors.push(`${where}: ${message}`);

    if (!isTokenFile) {
      const literal = COLOR_FUNCTION.exec(value)?.[0] ?? HEX_COLOR.exec(value)?.[0];
      if (literal) report(`literal colour "${literal}" in "${name}"; use a token from tokens.css`);
      else if (!NO_COLOR_WORDS.test(name)) {
        const named = value.toLowerCase().match(/[a-z]+/g)?.find((word) => NAMED_COLORS.has(word));
        if (named) report(`named colour "${named}" in "${name}"; use a token from tokens.css`);
      }
    }
    if (isCustom) continue;

    if (PHYSICAL_BARE.test(name) || PHYSICAL_SIDE.test(name)) report(`physical property "${name}"; use the logical one`);
    else if (PHYSICAL_SIZE.test(name)) {
      if (!print.some(([from, to]) => at >= from && at < to)) report(`physical property "${name}"; use inline-size/block-size (allowed only in @media print)`);
    } else if (name === "text-align" && /^(?:left|right)$/i.test(value)) report(`physical value "text-align: ${value}"; use start/end`);
    else if (name === "float" && /^(?:left|right)$/i.test(value)) report(`physical value "float: ${value}"; use inline-start/inline-end`);
    else if (name === "clear" && /^(?:left|right)$/i.test(value)) report(`physical value "clear: ${value}"; use inline-start/inline-end`);
    else if (name === "text-transform" && /\buppercase\b/i.test(value)) report("text-transform: uppercase is not allowed");
  }
  return errors;
}

/** Checks CSS files and the `<style>` blocks of Svelte files. Returns one line per error. */
export function checkCss(files: readonly CssFile[]): string[] {
  const errors: string[] = [];
  for (const file of files) {
    const isTokenFile = file.path.replaceAll("\\", "/").endsWith("styles/tokens.css");
    for (const block of blocksOf(file)) errors.push(...declarationErrors(block, file.path, isTokenFile));
  }
  return errors;
}
