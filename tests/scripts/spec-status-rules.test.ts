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
        "Status: partly implemented; issue 0043 (dismiss a time-off need for one day) is open, planned for version 1.",
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

  it("requires a partly implemented line to end with its version", () => {
    expect(check("## A", "Status: partly implemented; the help is not built.", "## B", "Status: partly implemented; the help is not built, planned for version 1.")).toEqual(
      at(1),
    );
    expect(
      check("## C", "Status: partly implemented; the export is not built, planned for version 1; the Pro HTML, planned for version 2."),
    ).toEqual([]);
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

  it("accepts a form of its own on a section with intro text", () => {
    expect(check("## Parent", "", "Status: implemented.", "", "Intro.", "", "### Child", "", "Status: implemented.")).toEqual([]);
    expect(check("## Parent", "", "Status: planned for version 2.", "", "Intro.", "", "### Child", "", "Status: implemented.")).toEqual([]);
  });

  it("reports see the subsections on a section with intro text", () => {
    expect(check("## Parent", "", "Status: see the subsections.", "", "Intro.", "", "### Child", "", "Status: implemented.")).toEqual(at(1));
  });

  it("accepts a moved section that keeps only its heading and the moved line", () => {
    expect(check("## Moved", "", "Status: moved to `docs/dev/en/reference/glossary.md`.", "", "## Next", "", "Status: implemented.")).toEqual([]);
    expect(check("### Leaf", "", "Status: moved to `docs/dev/en/reference/glossary.md`.")).toEqual([]);
  });

  it("accepts a moved section whose subsections keep their own lines", () => {
    expect(
      check(
        "## Moved",
        "",
        "Status: moved to `docs/dev/en/reference/security.md`.",
        "",
        "### Planned child",
        "",
        "Status: planned for version 2.",
        "",
        "Text.",
        "",
        "### Moved child",
        "",
        "Status: moved to `docs/dev/en/reference/security.md`.",
      ),
    ).toEqual([]);
  });

  it("reports a moved section that still has intro text", () => {
    expect(check("## Moved", "", "Status: moved to `docs/dev/en/reference/glossary.md`.", "", "Old text.", "", "### Child", "", "Status: implemented.")).toEqual(
      at(1),
    );
    expect(check("### Leaf", "", "Status: moved to `docs/dev/en/reference/glossary.md`.", "", "Old text.")).toEqual(at(1));
  });

  it("requires the moved path in backticks", () => {
    expect(check("## A", "Status: moved to docs/dev/en/reference/glossary.md.", "## B", "Status: moved to ``.", "## C", "Status: moved.")).toEqual(at(1, 3, 5));
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
