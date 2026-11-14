// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// docs/SPEC.md tracks what is still to be built: every `##` and `###` section says on its first line whether it
// is implemented, partly implemented, planned or not a requirement, so a reader knows which sections describe the
// app as it is. Run through `npm run check` (scripts/check-references.js).

import type { TextFile } from "./reference-rules.ts";

const SPEC = "docs/SPEC.md";

const STATUS = /^Status: (implemented|see the subsections|planned for version [1-3]|partly implemented; .+|not a requirement; moves to .+ in phase [2-6])\.$/;
const SUBSECTIONS = "Status: see the subsections.";
const FORMS =
  'write "Status: implemented.", "Status: see the subsections.", "Status: planned for version N." (1 to 3), "Status: partly implemented; <what is missing>." or "Status: not a requirement; moves to <destination> in phase N." (2 to 6)';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{2,3}) +\S/;

interface Line {
  text: string;
  /** Inside a fenced code block, or one of its fence lines. */
  fenced: boolean;
}

function lines(text: string): Line[] {
  let fence: string | undefined;
  return text.split("\n").map((line) => {
    const mark = FENCE.exec(line)?.[1];
    if (fence !== undefined) {
      if (mark !== undefined && mark[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = undefined;
      return { text: line, fenced: true };
    }
    if (mark !== undefined) {
      fence = mark;
      return { text: line, fenced: true };
    }
    return { text: line, fenced: false };
  });
}

/** One line per spec section without a valid status line: `docs/SPEC.md:line: what it is; what to do instead.` */
export function checkSpecStatus(files: readonly TextFile[]): string[] {
  const spec = files.find((file) => file.path === SPEC);
  if (spec === undefined) return [];
  const all = lines(spec.text);
  const level = (index: number): number => {
    const line = all[index];
    if (line === undefined || line.fenced) return 0;
    return HEADING.exec(line.text)?.[1]?.length ?? 0;
  };
  const errors: string[] = [];
  all.forEach((line, index) => {
    const depth = level(index);
    if (depth === 0) return;
    const where = `${SPEC}:${String(index + 1)}`;
    let next = index + 1;
    while (all[next] !== undefined && all[next]?.text.trim() === "") next++;
    const status = all[next];
    if (status === undefined || status.fenced || level(next) > 0 || !STATUS.test(status.text)) {
      errors.push(`${where}: a section without a status line; ${FORMS} as the first line under the heading.`);
      return;
    }
    // What the section holds up to its first subsection, and whether it has one.
    let end = next + 1;
    let intro = false;
    while (all[end] !== undefined && level(end) === 0) {
      if (all[end]?.text.trim() !== "") intro = true;
      end++;
    }
    const subsections = depth === 2 && level(end) === 3;
    if (status.text === SUBSECTIONS && !subsections) {
      errors.push(`${where}: "see the subsections" on a section without subsections; say the section's own status.`);
    } else if (subsections && !intro && status.text !== SUBSECTIONS) {
      errors.push(`${where}: a section without intro text whose status is not "see the subsections"; write "${SUBSECTIONS}" there.`);
    }
  });
  return errors;
}
