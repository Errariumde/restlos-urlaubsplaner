// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Every docs path, anchor and docs/SPEC.md section that the repository cites must exist, so that a reader can
// follow it. Existence is checked against the listed files only, without access to the file system.

import { exempt as exemptFromReferences, type TextFile } from "./reference-rules.ts";

const SPEC = "docs/SPEC.md";

/** The anchor GitHub gives a heading; duplicate headings, which get a number appended, are not handled. */
export function githubSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

/** Every line outside fenced code blocks, with its index. */
function proseLines(text: string): { line: string; index: number }[] {
  const lines: { line: string; index: number }[] = [];
  let fenced = false;
  text.split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) lines.push({ line, index });
  });
  return lines;
}

function headings(text: string, levels: string): string[] {
  const pattern = new RegExp(`^#{${levels}} +(.+?)\\s*$`);
  return proseLines(text).flatMap(({ line }) => {
    const match = pattern.exec(line);
    return match?.[1] === undefined ? [] : [match[1]];
  });
}

/** The names a citation of docs/SPEC.md may use: `##`/`###` headings, in full and cut, and bold run-in labels. */
export function specSectionNames(specText: string): Set<string> {
  const names = new Set<string>();
  for (const heading of headings(specText, "2,3")) {
    names.add(heading);
    const cuts = [heading.indexOf(": "), heading.indexOf(" (")].filter((at) => at > 0);
    if (cuts.length > 0) names.add(heading.slice(0, Math.min(...cuts)));
  }
  let previous = "";
  for (const { line } of proseLines(specText)) {
    // A bold label starts a paragraph or a list item, not a line inside a wrapped paragraph.
    const match = /^\s*(?:[-*+]\s+|\d+\.\s+)?\*\*([^*]+)\*\*/.exec(line);
    const listItem = /^\s*(?:[-*+]|\d+\.)\s/.test(line);
    if (match?.[1] !== undefined && (listItem || previous.trim() === "")) names.add(match[1].replace(/:$/, ""));
    previous = line;
  }
  return names;
}

/** Resolves a relative link target against a folder, as GitHub does; `null` when it leaves the repository. */
function resolve(folder: string, target: string): string | null {
  const parts = target.startsWith("/") ? [] : folder.split("/").filter(Boolean);
  for (const part of target.split("/")) {
    if (part === "..") {
      if (parts.pop() === undefined) return null;
    } else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

/** The line number of each character offset. */
function lineFinder(text: string): (offset: number) => number {
  const starts = [0];
  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) starts.push(at + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((starts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

/** A link target as GitHub reads it, with percent escapes such as `%C3%BC` decoded. */
function decode(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

/**
 * What the reference check skips, including this check's own test; the changelog, which records the past; and
 * this file, whose allowlist names pages before they exist.
 */
function exempt(file: TextFile): boolean {
  return exemptFromReferences(file) || file.path === "CHANGELOG.md" || file.path === "scripts/citation-rules.ts";
}

const ROOT_PATH = /(?<![\w/.:-])docs\/[A-Za-z0-9_./-]*[A-Za-z0-9_/-]/g;
const ANCHOR = /^#([\p{L}\p{N}_-]+)/u;
const LINK = /\]\(([^)\s]+)/g;
const SECTIONS = /SPEC\.md`?(?:,\s*|\s*\(\s*|\s+)((?:"[^"\n]+"(?:,\s*)?)+)/g;

/** Whether a citation ending at `end` is marked as a planned page, also after a closing backtick or link parenthesis. */
function planned(text: string, end: number): boolean {
  return [" (new)", "` (new)", ") (new)"].some((marker) => text.startsWith(marker, end));
}

/** One line per citation that does not resolve: `path:line: what it is; what to do instead`. */
export function checkCitations(files: readonly TextFile[]): string[] {
  const texts = new Map(files.map((file) => [file.path, file.text]));
  const folders = new Set<string>();
  for (const { path } of files) {
    for (let at = path.indexOf("/"); at !== -1; at = path.indexOf("/", at + 1)) folders.add(path.slice(0, at));
  }
  const slugs = new Map<string, Set<string>>();
  const slugsOf = (path: string): Set<string> => {
    let found = slugs.get(path);
    if (found === undefined) {
      found = new Set(headings(texts.get(path) ?? "", "1,6").map(githubSlug));
      slugs.set(path, found);
    }
    return found;
  };
  const sections = specSectionNames(texts.get(SPEC) ?? "");

  /** What is wrong with a cited path and optional anchor, or `null` when it resolves. */
  const problem = (path: string, anchor: string | undefined): string | null => {
    const target = path.replace(/\/$/, "");
    if (!texts.has(target) && !folders.has(target)) return `the path ${target} does not exist; correct it, or mark a planned page with (new)`;
    if (anchor !== undefined && target.endsWith(".md") && !slugsOf(target).has(anchor))
      return `${target} has no heading with the anchor #${anchor}; cite an existing heading`;
    return null;
  };

  const errors = new Set<string>();
  for (const file of files) {
    if (exempt(file)) continue;
    const { path, text } = file;
    const lineOf = lineFinder(text);
    const report = (offset: number, what: string): void => {
      errors.add(`${path}:${String(lineOf(offset))}: ${what}.`);
    };

    for (const match of text.matchAll(ROOT_PATH)) {
      const end = match.index + match[0].length;
      // A folder, a pattern such as docs/file-*.md or docs/howto/<name>.md, or a planned page.
      if (match[0].endsWith("/") || /[<>*…]/.test(text.charAt(end)) || planned(text, end)) continue;
      const what = problem(match[0], ANCHOR.exec(text.slice(end))?.[1]);
      if (what !== null) report(match.index, what);
    }

    if (path.endsWith(".md")) {
      const folder = path.split("/").slice(0, -1).join("/");
      for (const match of text.matchAll(LINK)) {
        const link = match[1] ?? "";
        if (/^(https?|mailto):/.test(link) || planned(text, match.index + match[0].length)) continue;
        const hash = link.indexOf("#");
        const target = hash === -1 ? link : link.slice(0, hash);
        const anchor = hash === -1 ? undefined : decode(link.slice(hash + 1));
        if (target === "") {
          if (anchor !== undefined && !slugsOf(path).has(anchor)) report(match.index, `${path} has no heading with the anchor #${anchor}; cite an existing heading`);
          continue;
        }
        if (!target.includes("/") && !target.includes(".")) continue; // a help topic ID
        const resolved = resolve(folder, decode(target));
        const what = resolved === null ? `the link ${link} leaves the repository; correct it` : problem(resolved, anchor);
        if (what !== null) report(match.index, what);
      }
    }

    for (const match of text.matchAll(SECTIONS)) {
      const list = match[1] ?? "";
      const start = match.index + match[0].length - list.length;
      for (const name of list.matchAll(/"([^"]+)"/g)) {
        const section = name[1] ?? "";
        if (!sections.has(section)) report(start + name.index, `${SPEC} has no section "${section}"; cite an existing heading or move the section first`);
      }
    }
  }
  return [...errors];
}

/** Where docs and code must not cite the spec yet; the rest of the repository follows as its sections move. */
export const SPEC_CITATION_SCOPE: readonly string[] = ["docs/user/", "docs/dev/"];

/** Scoped files that may still cite the spec, each with the step that removes it. */
export const SPEC_CITATION_ALLOWLIST: Readonly<Record<string, string>> = {
  "docs/dev/en/howto/dependency-update.md": 'removed in phase 2, when "Dependencies and supply chain" moves',
  "docs/dev/en/howto/holiday-data.md": 'removed in phase 2, when "Holiday sources and work week" moves',
  "docs/dev/en/howto/docs.md": "removed when docs/SPEC.md is deleted",
};

const SPEC_CITATION = /SPEC\.md|\bSPEC\b/;

/** One line per line of a scoped file that cites the spec: `path:line: what it is; what to do instead`. */
export function checkSpecCitations(files: readonly TextFile[]): string[] {
  const errors: string[] = [];
  for (const { path, text } of files) {
    if (!SPEC_CITATION_SCOPE.some((scope) => path.startsWith(scope)) || path in SPEC_CITATION_ALLOWLIST) continue;
    text.split("\n").forEach((line, index) => {
      if (SPEC_CITATION.test(line))
        errors.push(
          `${path}:${String(index + 1)}: a citation of the spec, which docs and code never cite; cite the reference page, or move the section into docs/dev/en/reference/ first.`,
        );
    });
  }
  return errors;
}
