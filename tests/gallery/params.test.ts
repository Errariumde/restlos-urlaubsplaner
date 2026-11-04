// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { allCombinations, combinationFrom, searchFor } from "../../src/gallery/params";

describe("combinationFrom", () => {
  it("reads one section, locale and mode", () => {
    expect(combinationFrom("?section=controls&locale=en-XB&mode=dark")).toEqual({ section: "controls", locale: "en-XB", mode: "dark" });
  });

  it("is undefined (the overview) when a parameter is missing or unknown", () => {
    expect(combinationFrom("")).toBeUndefined();
    expect(combinationFrom("?section=controls&locale=de")).toBeUndefined();
    expect(combinationFrom("?section=nope&locale=de&mode=light")).toBeUndefined();
    expect(combinationFrom("?section=controls&locale=fr&mode=light")).toBeUndefined();
    expect(combinationFrom("?section=controls&locale=de&mode=auto")).toBeUndefined();
  });

  it("reads back what searchFor writes", () => {
    for (const combination of allCombinations()) expect(combinationFrom(searchFor(combination))).toEqual(combination);
  });
});

describe("allCombinations", () => {
  it("repeats every section for light and dark in de, en, en-XA and en-XB", () => {
    const controls = allCombinations().filter((combination) => combination.section === "controls");
    expect(controls.map(({ mode, locale }) => `${mode} ${locale}`)).toEqual([
      "light de", "light en", "light en-XA", "light en-XB", "dark de", "dark en", "dark en-XA", "dark en-XB",
    ]);
  });
});
