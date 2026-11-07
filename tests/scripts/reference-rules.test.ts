// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkReferences } from "../../scripts/reference-rules";

describe("checkReferences", () => {
  it("reports a link into docs/superpowers, a ruling and the final review file, each with its line", () => {
    const text = "ok\n// see docs/superpowers/specs/x.md\n// (Ruling Q)\n// final-review.md, Minor 1\n";
    expect(checkReferences([{ path: "src/a.ts", text }])).toEqual([
      expect.stringMatching(/^src\/a\.ts:2: /),
      expect.stringMatching(/^src\/a\.ts:3: /),
      expect.stringMatching(/^src\/a\.ts:4: /),
    ]);
  });

  it("finds a relative link and a numbered ruling", () => {
    const text = "[results](superpowers/specs/x.md#results)\nas ruling R21 says\n";
    expect(checkReferences([{ path: "docs/SPEC.md", text }])).toHaveLength(2);
  });

  it("lets the rule name the folder itself, and leaves other folders and words alone", () => {
    const text = "`docs/superpowers/` counts as outside the repository.\nignores: [\".superpowers/\"]\nThe ruling was clear.\n";
    expect(checkReferences([{ path: "AGENTS.md", text }])).toEqual([]);
  });

  it("skips docs/superpowers itself and done issues, but checks open ones", () => {
    const ruling = "(Ruling Q)\n";
    expect(
      checkReferences([
        { path: "docs/superpowers/plans/p.md", text: ruling },
        { path: "issues/0001-x.md", text: `---\nstatus: done\n---\n${ruling}` },
        { path: "issues/0002-y.md", text: `---\nstatus: open\n---\n${ruling}` },
        { path: "tests/scripts/reference-rules.test.ts", text: ruling },
      ]),
    ).toEqual([expect.stringMatching(/^issues\/0002-y\.md:4: /)]);
  });

  it("says what to do instead", () => {
    const [error] = checkReferences([{ path: "a.md", text: "docs/superpowers/plans/p.md" }]);
    expect(error).toContain("docs/SPEC.md");
  });
});
