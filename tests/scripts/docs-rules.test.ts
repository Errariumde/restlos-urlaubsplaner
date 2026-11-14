// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkDocs } from "../../scripts/docs-rules";

const EN_HOWTO = "docs/user/en/howto/plan-a-bridge-day.md";
const EN_TUTORIAL = "docs/user/en/tutorials/first-plan.md";
const EN_REFERENCE = "docs/user/en/reference/plan-file.md";
const DE_HOWTO = "docs/user/de/howto/brueckentag-planen.md";
const DE_REFERENCE = "docs/user/de/reference/plandatei.md";
const NBSP = " ";

/** The errors for one file whose text is the given lines. */
function check(path: string, ...lines: string[]): string[] {
  return checkDocs([{ path, text: `${lines.join("\n")}\n` }]);
}

/** The errors expected for the given path and lines, matched by their prefix. */
function at(path: string, ...lines: number[]): unknown[] {
  return lines.map((line): unknown => expect.stringMatching(new RegExp(`^${path.replace(/[.]/g, "\\.")}:${String(line)}: `)));
}

describe("checkDocs", () => {
  it("passes a clean page", () => {
    expect(check(EN_HOWTO, "# Plan a bridge day", "", "Open the plan and select the day.")).toEqual([]);
  });

  describe("path shape", () => {
    it("reports a page outside the quadrants", () => {
      expect(check("docs/dev/en/notes.md", "Text.")).toEqual(at("docs/dev/en/notes.md", 1));
    });

    it("passes a decision record and every quadrant", () => {
      const paths = [
        "docs/dev/en/explanation/decisions/0001-documentation-model.md",
        "docs/user/de/tutorials/erster-plan.md",
        "docs/user/en/howto/x.md",
        "docs/dev/en/reference/file-format.md",
        "docs/dev/en/explanation/counting-model.md",
      ];
      expect(checkDocs(paths.map((path) => ({ path, text: "Text.\n" })))).toEqual([]);
    });

    it("reports upper case, a missing language and a folder below decisions", () => {
      const paths = ["docs/user/en/howto/Plan.md", "docs/user/howto/plan.md", "docs/dev/en/explanation/decisions/old/0001-x.md"];
      expect(checkDocs(paths.map((path) => ({ path, text: "Text.\n" })))).toHaveLength(3);
    });

    it("ignores files outside docs/user and docs/dev, and files that are not Markdown", () => {
      const just = "It is just one click.\n";
      expect(
        checkDocs([
          { path: "docs/SPEC.md", text: just },
          { path: "docs/superpowers/plans/p.md", text: just },
          { path: "README.md", text: just },
          { path: "docs/user/en/howto/screenshot.png", text: just },
        ]),
      ).toEqual([]);
    });
  });

  describe("English", () => {
    it("reports Latin abbreviations", () => {
      expect(check(EN_HOWTO, "Fine.", "Pick a day, e.g. a Friday.", "That is, i.e. the plan.", "Holidays, weekends etc.")).toEqual(at(EN_HOWTO, 2, 3, 4));
    });

    it("reports words that belittle a step", () => {
      expect(check(EN_HOWTO, "Fine.", "Simply open the plan.", "It is easily done.", "Just click.", "It merely counts.", "Obviously.", "It is straightforward.")).toEqual(
        at(EN_HOWTO, 2, 3, 4, 5, 6, 7),
      );
    });

    it("reports words about time", () => {
      expect(check(EN_HOWTO, "Fine.", "It currently counts.", "Coming soon.", "At the moment it counts.", "Now open it.", "It will be counted.")).toEqual(
        at(EN_HOWTO, 2, 3, 4, 5, 6),
      );
    });

    it("reports an exclamation mark, but not an image", () => {
      expect(check(EN_HOWTO, "Fine.", "Done!", "![The plan](plan.png)")).toEqual(at(EN_HOWTO, 2));
    });

    it("reports we and our outside tutorials", () => {
      expect(check(EN_HOWTO, "Fine.", "We open the plan.", "Then we save it.", "Open our plan.")).toEqual(at(EN_HOWTO, 2, 3, 4));
      expect(check(EN_TUTORIAL, "We open the plan.", "Open our plan.")).toEqual([]);
    });

    it("reports you and your only under reference", () => {
      expect(check(EN_REFERENCE, "Fine.", "You can set it.", "It holds your plan.")).toEqual(at(EN_REFERENCE, 2, 3));
      expect(check(EN_HOWTO, "You can set it.", "Open your plan.")).toEqual([]);
    });

    it("leaves words that only contain a forbidden one alone", () => {
      expect(check(EN_HOWTO, "Adjust the known weekend of the youth hostel; justify it.")).toEqual([]);
    });
  });

  describe("German", () => {
    it("reports an exclamation mark", () => {
      expect(check(DE_HOWTO, "Gut.", "Fertig!")).toEqual(at(DE_HOWTO, 2));
    });

    it("reports du, dich, dir and dein only under reference", () => {
      expect(check(DE_REFERENCE, "Gut.", "Du kannst es setzen.", "Es gilt für dich.", "Es zeigt dir den Plan.", "Deine Datei.", "Dein Plan.")).toEqual(
        at(DE_REFERENCE, 2, 3, 4, 5, 6),
      );
      expect(check(DE_HOWTO, "Du öffnest deinen Plan.")).toEqual([]);
    });

    it("reports filler words", () => {
      expect(check(DE_HOWTO, "Gut.", "Öffne einfach den Plan.", "Das ist eben so.", "Das ist halt so.", "Das zählt natürlich.", "Das ist offensichtlich.")).toEqual(
        at(DE_HOWTO, 2, 3, 4, 5, 6),
      );
    });

    it("reports wir", () => {
      expect(check(DE_HOWTO, "Gut.", "Wir öffnen den Plan.", "Dann speichern wir.")).toEqual(at(DE_HOWTO, 2, 3));
    });

    it("reports gender marks", () => {
      expect(check(DE_HOWTO, "Gut.", "Für Nutzer*innen.", "Für Nutzer:innen.", "Für Nutzer_innen.", "Für NutzerInnen.")).toEqual(at(DE_HOWTO, 2, 3, 4, 5));
    });

    it("lets z. B. and d. h. pass only with a non-breaking space", () => {
      expect(check(DE_HOWTO, `Ein Tag, z.${NBSP}B. ein Freitag, d.${NBSP}h. ein Brückentag.`)).toEqual([]);
      expect(check(DE_HOWTO, "Gut.", "Ein Tag, z. B. ein Freitag.", "Ein Tag, z.B. ein Freitag.", "Das heißt, d. h. hier.", "Das heißt, d.h. hier.")).toEqual(
        at(DE_HOWTO, 2, 3, 4, 5),
      );
    });

    it("leaves English rules out of German pages", () => {
      expect(check(DE_HOWTO, "Just e.g. we now.")).toEqual([]);
    });
  });

  it("reports a line that starts with Recommendation: under reference", () => {
    expect(check(EN_REFERENCE, "Fine.", "Recommendation: keep one plan per year.")).toEqual(at(EN_REFERENCE, 2));
    expect(check(EN_HOWTO, "Recommendation: keep one plan per year.")).toEqual([]);
  });

  describe("skipped text", () => {
    it("skips fenced code blocks, code spans and the SPDX comment", () => {
      // The header of a Markdown page, which REUSE must not read as this file's own.
      // REUSE-IgnoreStart
      const lines = [
        "<!--",
        "SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors",
        "SPDX-License-Identifier: CC-BY-4.0",
        // REUSE-IgnoreEnd
        "-->",
        "<!-- Just a comment! -->",
        "Run `npm run check, which just works!`.",
        "```sh",
        "# we just run it now!",
        "```",
        "~~~",
        "You simply e.g. now!",
        "~~~",
      ];
      expect(check(EN_REFERENCE, ...lines)).toEqual([]);
    });

    it("skips link targets, but not link texts", () => {
      expect(check(EN_HOWTO, "See [the plan](../reference/just-now.md).", "See [just this](plan.md).")).toEqual(at(EN_HOWTO, 2));
    });

    it("counts skipped lines toward the line number", () => {
      expect(check(EN_HOWTO, "# Title", "", "```", "we just run it", "```", "", "It just works.")).toEqual(at(EN_HOWTO, 7));
    });

    it("checks the text around a code span or comment on the same line", () => {
      expect(check(EN_HOWTO, "Fine.", "Run `x`, it just works.", "<!-- note --> Simply open it.")).toEqual(at(EN_HOWTO, 2, 3));
    });
  });

  it("says what it found and what to do instead", () => {
    const [error] = check(EN_HOWTO, "Just click.");
    expect(error).toMatch(/^docs\/user\/en\/howto\/plan-a-bridge-day\.md:1: .+; .+\.$/);
  });
});
