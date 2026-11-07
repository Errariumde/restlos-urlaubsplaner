// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { checkCatalogs } from "../../scripts/catalog-rules";

describe("checkCatalogs", () => {
  it("reports missing, unused, broken and # messages", () => {
    const errors = checkCatalogs({
      de: { "x.a": "A", "x.b": "#" },
      en: { "x.a": "A" },
      sources: [{ path: "a.svelte", text: `t("x.a") t("x.c")` }],
      dataKeys: [],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("x.b: only in de"),
        expect.stringContaining("x.c: used in a.svelte but missing"),
        expect.stringContaining("x.b: never used"),
        expect.stringContaining("x.b: uses #"),
      ]),
    );
  });

  it("reports messages that fail ICU parsing", () => {
    const errors = checkCatalogs({
      de: { "x.a": "{count, plural, one {Tag}" },
      en: { "x.a": "{count, plural, one {day}" },
      sources: [{ path: "a.ts", text: `i18n.t("x.a")` }],
      dataKeys: [],
    });
    expect(errors).toEqual([expect.stringContaining("x.a: invalid ICU message in de"), expect.stringContaining("x.a: invalid ICU message in en")]);
  });

  it("accepts meta keys, data keys and a clean catalog", () => {
    expect(
      checkCatalogs({
        de: { "meta.dir": "ltr", "x.a": "A", "holiday.a": "Ä" },
        en: { "meta.dir": "ltr", "x.a": "A", "holiday.a": "A" },
        sources: [{ path: "a.ts", text: `t("x.a")` }],
        dataKeys: ["holiday.a"],
      }),
    ).toEqual([]);
  });

  it("finds keys only when they are written as t(\"...\") literals", () => {
    const errors = checkCatalogs({
      de: { "x.a": "A" },
      en: { "x.a": "A" },
      sources: [{ path: "a.ts", text: `format("x.a")` }],
      dataKeys: [],
    });
    expect(errors).toEqual([expect.stringContaining("x.a: never used")]);
  });

  it("lets the sources use keys of another catalog (the gallery uses the app's texts)", () => {
    const input = {
      de: { "gallery.a": "A" },
      en: { "gallery.a": "A" },
      sources: [{ path: "g.svelte", text: `t("gallery.a") t("app.name") t("x.missing")` }],
      dataKeys: [],
    };
    expect(checkCatalogs({ ...input, externalKeys: ["app.name"] })).toEqual([expect.stringContaining("x.missing: used in g.svelte but missing")]);
  });

  it("reports a key that is also in the other catalog", () => {
    const errors = checkCatalogs({
      de: { "app.name": "A" },
      en: { "app.name": "A" },
      sources: [{ path: "g.svelte", text: `t("app.name")` }],
      dataKeys: [],
      externalKeys: ["app.name"],
    });
    expect(errors).toEqual([expect.stringContaining("app.name: also in the other catalog")]);
  });
});
