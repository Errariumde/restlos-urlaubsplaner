// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { pseudoCatalog } from "../../../src/ui/i18n/pseudo";

const base = { "meta.dir": "ltr", "meta.lang": "en" };

describe("pseudoCatalog", () => {
  it("pads and accents the long pseudo-locale but keeps placeholders", () => {
    const out = pseudoCatalog(
      { a: "{count, plural, one {{days} day} other {{days} days}} left", ...base },
      "long",
    );
    expect(out["a"]).toContain("{days}");
    expect(out["a"]).toContain("{count, plural, one {");
    expect(out["a"]!.length).toBeGreaterThan(40 * 1.4 - 1);
    expect(() => new IntlMessageFormat(out["a"]!, "en")).not.toThrow();
    expect(new IntlMessageFormat(out["a"]!, "en").format({ count: 2, days: "2" })).toMatch(/^2 [^a-z]*/);
  });

  it("accents letters in text but not in argument names, types or selectors", () => {
    const out = pseudoCatalog({ a: "Save {name, select, other {file}} now", ...base }, "long");
    expect(out["a"]).toContain("{name, select, other {");
    expect(out["a"]).not.toContain("Save");
    expect(out["a"]).not.toContain("file");
  });

  it("keeps quoted braces and the meta keys", () => {
    const out = pseudoCatalog({ a: "Use '{' here", ...base }, "long");
    expect(out["a"]).toContain("'{'");
    expect(out["meta.dir"]).toBe("ltr");
    expect(out["meta.lang"]).toBe("en");
    expect(() => new IntlMessageFormat(out["a"]!, "en")).not.toThrow();
  });

  it("marks the rtl pseudo-locale as rtl", () => {
    const out = pseudoCatalog({ a: "Hello {name}", ...base }, "rtl");
    expect(out["meta.dir"]).toBe("rtl");
    expect(out["a"]).toBe("‮Hello {name}‬");
  });
});
