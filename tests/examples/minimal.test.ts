// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { readExample, readText } from "./helpers";

/** Paths are relative to the repository root, where `npm test` runs. */
const PLAN = "examples/minimal/minimal.urlaub.json";
const RULE_SET = "examples/minimal/minimal.regeln.json";
const DOCS = "docs/file-format.md";

/** The bodies of the ```json blocks in the section of `markdown` under `heading`, up to the next "## " heading. */
function jsonBlocks(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) throw new Error(`${DOCS} has no section "${heading}"`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const section = lines.slice(start + 1, next < 0 ? lines.length : next).join("\n");
  return [...section.matchAll(/^```json\n([\s\S]*?)\n```$/gm)].map((match) => match[1] ?? "");
}

/** The text of the file at `path`, which must end with one line break, without it. */
function withoutFinalNewline(path: string): string {
  const text = readText(path);
  expect(text.endsWith("\n") && !text.endsWith("\n\n"), path).toBe(true);
  return text.slice(0, -1);
}

describe("minimal examples", () => {
  it.each([
    [PLAN, "plan"],
    [RULE_SET, "ruleSet"],
  ])("reads %s with an empty report and no hints", (path, kind) => {
    // Not written back byte for byte: the writer adds the empty lists and `theme`.
    expect(readExample(path).kind).toBe(kind);
  });

  it("the docs show the minimal examples as they are", () => {
    expect(jsonBlocks(readText(DOCS), "## Minimal examples")).toEqual([withoutFinalNewline(PLAN), withoutFinalNewline(RULE_SET)]);
  });
});
