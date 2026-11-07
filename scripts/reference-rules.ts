// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The text of the repository stands on its own (AGENTS.md, "Text in the repository"): nothing points into
// docs/superpowers/, which only the maintainer may delete, nor to rulings or review files that were never part
// of the repository.

export interface TextFile {
  path: string;
  text: string;
}

interface Forbidden {
  pattern: RegExp;
  what: string;
  instead: string;
}

const FORBIDDEN: readonly Forbidden[] = [
  {
    // A path into the folder, also relative from docs/; naming the folder itself, as the rule does, is fine.
    pattern: /superpowers\/[A-Za-z0-9]/,
    what: "a link into the docs/superpowers folder, which may disappear at any time",
    instead: "point to docs/SPEC.md or another file in the repository, or copy what is needed into the text",
  },
  {
    pattern: /\b[Rr]uling [A-Z]{1,2}[0-9]*\b/,
    what: "a ruling, which is not written down in the repository",
    instead: "state the rule itself, or move it into docs/SPEC.md",
  },
  {
    pattern: /final-review\.md/,
    what: "the final review file, which is not in the repository",
    instead: "drop the pointer and keep what it says",
  },
];

/** docs/superpowers/ itself, done issues, which stay as they were written, and this check's own test. */
function exempt({ path, text }: TextFile): boolean {
  if (path.startsWith("docs/superpowers/") || path === "tests/scripts/reference-rules.test.ts") return true;
  return path.startsWith("issues/") && /^status: done$/m.test(text);
}

/** One line per forbidden reference: `path:line: what it is; what to do instead`. */
export function checkReferences(files: readonly TextFile[]): string[] {
  const errors: string[] = [];
  for (const file of files) {
    if (exempt(file)) continue;
    file.text.split("\n").forEach((line, index) => {
      for (const { pattern, what, instead } of FORBIDDEN) {
        if (pattern.test(line)) errors.push(`${file.path}:${String(index + 1)}: ${what}; ${instead}.`);
      }
    });
  }
  return errors;
}
