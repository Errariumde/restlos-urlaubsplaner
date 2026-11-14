// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import {
  SPEC_CITATION_ALLOWLIST,
  SPEC_CITATION_SCOPE,
  checkCitations,
  checkSpecCitations,
  githubSlug,
  specSectionNames,
} from "../../scripts/citation-rules";

const spec = {
  path: "docs/SPEC.md",
  text: "# T\n\n## Build and CI (GitHub Free and local)\n\n### Day cell: what is shown how\n\n**Detail view:** text\n\n```\n## Project status\n```\n",
};
const fmt = { path: "docs/file-format.md", text: "# Format\n\n## Sharing and validation\n" };

describe("githubSlug", () => {
  it("lowercases, drops punctuation and turns spaces into hyphens", () => {
    expect(githubSlug("Build and CI (GitHub Free and local)")).toBe("build-and-ci-github-free-and-local");
    expect(githubSlug("Füße & Hände")).toBe("füße--hände");
  });
});

describe("specSectionNames", () => {
  it("holds headings in full and cut, and bold labels without the colon, but no heading from a code block", () => {
    const names = specSectionNames(spec.text);
    expect(names).toContain("Build and CI (GitHub Free and local)");
    expect(names).toContain("Build and CI");
    expect(names).toContain("Day cell: what is shown how");
    expect(names).toContain("Day cell");
    expect(names).toContain("Detail view");
    expect(names).not.toContain("Project status");
    expect(names).not.toContain("T");
  });
});

describe("checkCitations", () => {
  it("accepts existing paths, also with sentence punctuation after them", () =>
    expect(checkCitations([spec, fmt, { path: "a.md", text: "See `docs/file-format.md`. And (docs/SPEC.md),\n" }])).toEqual([]));

  it("reports a missing docs path with its line", () =>
    expect(checkCitations([spec, { path: "src/a.ts", text: "x\n// docs/gone.md\n" }])).toEqual([
      expect.stringMatching(/^src\/a\.ts:2: .*docs\/gone\.md/),
    ]));

  it("ignores URLs, folder paths, patterns and paths marked (new)", () =>
    expect(
      checkCitations([
        spec,
        {
          path: "a.md",
          text: "https://docs.github.com/en/pages https://example.com/docs/a.md docs/user/ docs/dev/en/howto/<name>.md docs/dev/en/reference/glossary.md (new)\n",
        },
      ]),
    ).toEqual([]));

  it("ignores a path match that a pattern character follows", () =>
    expect(checkCitations([spec, { path: "a.md", text: "docs/file-*.md and docs/howto/install… and docs/x<y> and docs/a>b\n" }])).toEqual([]));

  it("counts (new) after a closing backtick or a link's closing parenthesis", () => {
    const planned = "`docs/dev/en/reference/glossary.md` (new) [g](docs/dev/en/reference/glossary.md) (new)\n";
    expect(checkCitations([spec, { path: "a.md", text: planned }])).toEqual([]);
    const unmarked = "`docs/dev/en/reference/glossary.md` x\n[g](docs/dev/en/reference/glossary.md) x\n";
    expect(checkCitations([spec, { path: "a.md", text: unmarked }])).toEqual([
      expect.stringMatching(/^a\.md:1: /),
      expect.stringMatching(/^a\.md:2: /),
    ]);
  });

  it("resolves quoted spec section names in full, cut at ': ' or ' (', and bold labels", () =>
    expect(
      checkCitations([
        spec,
        {
          path: "src/a.ts",
          text: '// docs/SPEC.md, "Build and CI"\n// `docs/SPEC.md`, "Day cell", "Detail view"\n// docs/SPEC.md ("Build and CI (GitHub Free and local)")\n',
        },
      ]),
    ).toEqual([]));

  it("reports a section name that does not exist, and a heading inside a code block does not count", () =>
    expect(
      checkCitations([spec, { path: "src/a.ts", text: '// docs/SPEC.md, "Main screen"\n// docs/SPEC.md, "Project status"\n' }]),
    ).toHaveLength(2));

  it("does not take a test file's path property for a citation", () =>
    expect(checkCitations([spec, { path: "tests/a.test.ts", text: '{ path: "docs/SPEC.md", text }\n' }])).toEqual([]));

  it("checks anchors against GitHub slugs", () => {
    expect(checkCitations([spec, fmt, { path: "a.md", text: "[s](docs/file-format.md#sharing-and-validation)\n" }])).toEqual([]);
    expect(checkCitations([spec, fmt, { path: "a.md", text: "[s](docs/file-format.md#sharing)\n" }])).toHaveLength(1);
  });

  it("checks an anchor in the same file", () => {
    expect(checkCitations([spec, { path: "docs/file-format.md", text: "## Sharing\n[s](#sharing)\n" }])).toEqual([]);
    expect(checkCitations([spec, { path: "docs/file-format.md", text: "## Sharing\n[s](#gone)\n" }])).toEqual([
      expect.stringMatching(/^docs\/file-format\.md:2: /),
    ]);
  });

  it("resolves relative Markdown links from the file's folder and skips topic-ID links", () => {
    const files = [spec, fmt, { path: "docs/dev/en/howto/x.md", text: "[f](../../../file-format.md) [t](day-rules) [u](https://a.b/c)\n" }];
    expect(checkCitations(files)).toEqual([]);
    expect(checkCitations([spec, { path: "docs/dev/x.md", text: "[f](../gone.md)\n" }])).toEqual([
      expect.stringMatching(/^docs\/dev\/x\.md:1: .*docs\/gone\.md/),
    ]);
  });

  it("skips docs/superpowers, CHANGELOG.md, done issues, its own test and its own source", () =>
    expect(
      checkCitations([
        spec,
        { path: "docs/superpowers/plans/p.md", text: "docs/gone.md\n" },
        { path: "CHANGELOG.md", text: "docs/gone.md\n" },
        { path: "issues/0001-x.md", text: "---\nstatus: done\n---\ndocs/gone.md\n" },
        { path: "tests/scripts/citation-rules.test.ts", text: "docs/gone.md\n" },
        { path: "scripts/citation-rules.ts", text: '"docs/gone.md": "x"\n' },
      ]),
    ).toEqual([]));

  it("treats a path as existing when it is a file or a folder of listed files", () =>
    expect(
      checkCitations([spec, { path: "a.md", text: "docs/SPEC.md and docs/superpowers\n" }, { path: "docs/superpowers/x.md", text: "" }]),
    ).toEqual([]));

  it("says what to do instead", () => {
    const [path] = checkCitations([spec, { path: "a.ts", text: "docs/gone.md\n" }]);
    expect(path).toBe("a.ts:1: the path docs/gone.md does not exist; correct it, or mark a planned page with (new).");
    const [section] = checkCitations([spec, { path: "a.ts", text: 'docs/SPEC.md, "X"\n' }]);
    expect(section).toBe('a.ts:1: docs/SPEC.md has no section "X"; cite an existing heading or move the section first.');
  });
});

describe("checkSpecCitations", () => {
  it("reports a citation of the spec in a scoped file, by path or by name", () => {
    expect(checkSpecCitations([{ path: "docs/dev/en/reference/a.md", text: "x\nsee docs/SPEC.md\n" }])).toEqual([
      "docs/dev/en/reference/a.md:2: a citation of the spec, which docs and code never cite; cite the reference page, or move the section into docs/dev/en/reference/ first.",
    ]);
    expect(checkSpecCitations([{ path: "docs/user/de/howto/b.md", text: "laut SPEC\n" }])).toHaveLength(1);
  });

  it("skips allowlisted files and files outside the scope", () => {
    expect(checkSpecCitations([{ path: "docs/dev/en/howto/docs.md", text: "docs/SPEC.md\n" }])).toEqual([]);
    expect(checkSpecCitations([{ path: "src/a.ts", text: "// docs/SPEC.md\n" }])).toEqual([]);
  });

  it("leaves other specs alone", () =>
    expect(checkSpecCitations([{ path: "docs/dev/en/reference/a.md", text: "the CommonMark spec\n" }])).toEqual([]));

  it("keeps the stage 1 scope and allowlist, each entry with the step that removes it", () => {
    expect(Object.keys(SPEC_CITATION_ALLOWLIST).sort()).toEqual([
      "docs/dev/en/howto/dependency-update.md",
      "docs/dev/en/howto/docs.md",
      "docs/dev/en/howto/holiday-data.md",
    ]);
    for (const reason of Object.values(SPEC_CITATION_ALLOWLIST)) expect(reason).toMatch(/^removed /);
    expect(SPEC_CITATION_SCOPE).toEqual(["docs/user/", "docs/dev/"]);
  });
});
