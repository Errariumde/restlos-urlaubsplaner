// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkSpecStatus } from "../../scripts/spec-status-rules";

const SPEC = "docs/SPEC.md";

/** The errors for a docs/SPEC.md whose text is the given lines. */
function check(...lines: string[]): string[] {
  return checkSpecStatus([{ path: SPEC, text: `${lines.join("\n")}\n` }]);
}

/** The errors expected for the given lines of docs/SPEC.md, matched by their prefix. */
function at(...lines: number[]): unknown[] {
  return lines.map((line): unknown => expect.stringMatching(new RegExp(`^docs/SPEC\\.md:${String(line)}: .+; .+\\.$`)));
}

describe("checkSpecStatus", () => {
  it("passes a valid line in each of the five forms", () => {
    expect(
      check(
        "# Spec",
        "",
        "## Built",
        "",
        "Status: implemented.",
        "",
        "## Parent",
        "",
        "Status: see the subsections.",
        "",
        "### Later",
        "",
        "Status: planned for version 2.",
        "",
        "### Half",
        "Status: partly implemented; issue 0043 (dismiss a time-off need for one day) is open.",
        "",
        "## Moving",
        "",
        "Status: not a requirement; moves to docs/dev/en/explanation/ in phase 3.",
      ),
    ).toEqual([]);
  });

  it("reports a heading without a status line", () => {
    expect(check("## Built", "", "Status: implemented.", "", "## Missing", "", "Some text.")).toEqual(at(5));
  });

  it("reports a heading at the end of the file", () => {
    expect(check("## Missing")).toEqual(at(1));
  });

  it("reports a status line in a wrong form", () => {
    expect(
      check(
        "## A",
        "Status: done.",
        "## B",
        "Status: implemented",
        "## C",
        "Status: planned for version 4.",
        "## D",
        "Status: partly implemented.",
        "## E",
        "Status: not a requirement; moves to README in phase 1.",
        "## F",
        "status: implemented.",
      ),
    ).toEqual(at(1, 3, 5, 7, 9, 11));
  });

  it("reports a section whose first line is a code block", () => {
    expect(check("## Sketch", "", "```text", "Status: implemented.", "```")).toEqual(at(1));
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(check("## Notice", "", "Status: implemented.", "", "```markdown", "## Project status", "", "Text.", "```", "~~~", "### Inner", "~~~")).toEqual([]);
  });

  it("requires see the subsections on a section without intro text before its first subsection", () => {
    expect(check("## Parent", "", "Status: implemented.", "", "### Child", "", "Status: implemented.")).toEqual(at(1));
  });

  it("accepts any form on a section with intro text", () => {
    expect(check("## Parent", "", "Status: implemented.", "", "Intro.", "", "### Child", "", "Status: implemented.")).toEqual([]);
  });

  it("reports see the subsections on a section without subsections", () => {
    expect(check("## Alone", "", "Status: see the subsections.", "", "Text.", "", "## Next", "", "Status: implemented.")).toEqual(at(1));
    expect(check("### Leaf", "", "Status: see the subsections.")).toEqual(at(1));
  });

  it("looks only at docs/SPEC.md and passes when it is absent", () => {
    expect(checkSpecStatus([{ path: "docs/file-format.md", text: "## No status\n\nText.\n" }])).toEqual([]);
    expect(checkSpecStatus([])).toEqual([]);
  });
});
