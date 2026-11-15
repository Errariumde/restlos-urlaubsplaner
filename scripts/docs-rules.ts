// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The mechanical style rules of the pages under docs/user/ and docs/dev/: where a page lives, and the words and
// marks a page leaves out, by language and quadrant. Fenced code blocks, code spans, HTML comments (so the SPDX
// header) and link targets are not checked. Run through `npm run check` (scripts/check-docs.js).

import type { TextFile } from "./reference-rules.ts";

interface Rule {
  pattern: RegExp;
  what: string;
  instead: string;
  applies: (path: string) => boolean;
}

const PAGE_PATH = /^docs\/(user|dev)\/[a-z]{2}\/(tutorials|howto|reference|explanation(\/decisions)?)\/[a-z0-9][a-z0-9-]*\.md$/;

/** The language segment of a page path, such as `en` in `docs/user/en/howto/<name>.md`. */
function language(path: string): string | undefined {
  return path.split("/")[2];
}

const english = (path: string): boolean => language(path) === "en";
const german = (path: string): boolean => language(path) === "de";
const reference = (path: string): boolean => path.includes("/reference/");

const PATH_RULE: Rule = {
  pattern: PAGE_PATH,
  what: "a page outside the documentation's folders",
  instead:
    "move it to docs/<user|dev>/<language>/<tutorials|howto|reference|explanation>/, decision records to explanation/decisions/, named in lower case with hyphens",
  applies: () => true,
};

const LINE_RULES: readonly Rule[] = [
  {
    pattern: /\b(e\.g\.|i\.e\.|etc\.)/,
    what: "a Latin abbreviation",
    instead: "write \"for example\", \"that is\" or name the rest",
    applies: english,
  },
  {
    pattern: /\b(simply|easily|just|merely|obviously|straightforward)\b/i,
    what: "a word that calls a step easy",
    instead: "drop it; what is easy for one reader is not for another",
    applies: english,
  },
  {
    pattern: /\b(currently|soon|at the moment|now|will be)\b/i,
    what: "a word about time, which ages",
    instead: "describe what is, in the present tense",
    applies: english,
  },
  {
    // An image (`![`) and a GitHub alert (`> [!NOTE]`) are not exclamations.
    pattern: /(?<!\[)!(?!\[)/,
    what: "an exclamation mark",
    instead: "end the sentence with a full stop",
    applies: (path) => english(path) || german(path),
  },
  {
    pattern: /\b[Ww]e\b|\b[Oo]ur\b/,
    what: "\"we\" or \"our\" outside a tutorial",
    instead: "name who acts, or address the reader",
    applies: (path) => english(path) && !path.includes("/tutorials/"),
  },
  {
    pattern: /\b[Yy]ou(r)?\b/,
    what: "\"you\" or \"your\" in a reference page",
    instead: "describe the thing itself, not the reader",
    applies: (path) => english(path) && reference(path),
  },
  {
    pattern: /\b(du|dich|dir|dein(e|er|es|em|en)?)\b/i,
    what: "\"du\" or \"dein\" in a reference page",
    instead: "describe the thing itself, not the reader",
    applies: (path) => german(path) && reference(path),
  },
  {
    pattern: /^Recommendation:/,
    what: "a recommendation in a reference page",
    instead: "move the advice into a how-to guide or an explanation and link to it",
    applies: reference,
  },
  {
    pattern: /\b([Ee]infach|eben|halt|[Nn]atürlich|[Oo]ffensichtlich)\b/,
    what: "a filler word",
    instead: "drop it",
    applies: german,
  },
  {
    pattern: /\b[Ww]ir\b/,
    what: "\"wir\"",
    instead: "name who acts, or address the reader",
    applies: german,
  },
  {
    pattern: /\w[*:_]innen\b|\w+Innen\b/,
    what: "a gender mark",
    instead: "use a neutral word or name the role",
    applies: german,
  },
  {
    pattern: /\bz\. ?B\.|\bd\. ?h\./,
    what: "\"z. B.\" or \"d. h.\" without a non-breaking space",
    instead: "put a non-breaking space (U+00A0) between the letters",
    applies: german,
  },
];

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CODE_SPAN = /(`+)[^`]*?\1/g;

/** Spaces in place of the matched text, so positions and line starts stay as they were. */
function blank(text: string): string {
  return " ".repeat(text.length);
}

/**
 * The page's lines with the skipped text blanked out: fenced code blocks, HTML comments (also across lines), code
 * spans and link targets. The number of lines stays the same.
 */
function proseLines(text: string): string[] {
  let fence: string | undefined;
  let inComment = false;
  return text.split("\n").map((line) => {
    if (fence !== undefined) {
      const close = FENCE.exec(line);
      if (close?.[1] !== undefined && close[1][0] === fence[0] && close[1].length >= fence.length && line.trim() === close[1]) fence = undefined;
      return "";
    }
    if (!inComment) {
      const open = FENCE.exec(line);
      if (open?.[1] !== undefined) {
        fence = open[1];
        return "";
      }
    }
    let prose = "";
    let rest = line;
    while (rest.length > 0) {
      if (inComment) {
        const end = rest.indexOf("-->");
        if (end < 0) return prose + blank(rest);
        prose += blank(rest.slice(0, end + 3));
        rest = rest.slice(end + 3);
        inComment = false;
      } else {
        // Code spans first, so a comment start inside one, such as `<!--`, starts no comment.
        const spans = rest.replace(CODE_SPAN, blank);
        const start = spans.indexOf("<!--");
        if (start < 0) {
          prose += spans;
          break;
        }
        prose += spans.slice(0, start);
        rest = rest.slice(start);
        inComment = true;
      }
    }
    return prose.replace(/\]\([^)]*\)/g, (target) => `]${blank(target.slice(1))}`);
  });
}

/** One line per broken style rule in the pages under docs/user/ and docs/dev/: `path:line: what it is; what to do instead.` */
export function checkDocs(files: readonly TextFile[]): string[] {
  const errors: string[] = [];
  for (const { path, text } of files) {
    if (!(path.startsWith("docs/user/") || path.startsWith("docs/dev/")) || !path.endsWith(".md")) continue;
    if (PATH_RULE.applies(path) && !PATH_RULE.pattern.test(path)) errors.push(`${path}:1: ${PATH_RULE.what}; ${PATH_RULE.instead}.`);
    const rules = LINE_RULES.filter((rule) => rule.applies(path));
    proseLines(text).forEach((line, index) => {
      for (const { pattern, what, instead } of rules) {
        if (pattern.test(line)) errors.push(`${path}:${String(index + 1)}: ${what}; ${instead}.`);
      }
    });
  }
  return errors;
}
