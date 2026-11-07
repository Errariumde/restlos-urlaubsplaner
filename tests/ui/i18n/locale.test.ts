// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { localeForLanguage } from "../../../src/ui/i18n/locale";

describe("localeForLanguage", () => {
  it("is German for German browser languages", () => {
    expect(localeForLanguage("de")).toBe("de");
    expect(localeForLanguage("de-DE")).toBe("de");
    expect(localeForLanguage("de-AT")).toBe("de");
    expect(localeForLanguage("DE-ch")).toBe("de");
  });

  it("is English for every other language", () => {
    expect(localeForLanguage("en-US")).toBe("en");
    expect(localeForLanguage("fr")).toBe("en");
    expect(localeForLanguage("dsb")).toBe("en");
    expect(localeForLanguage("")).toBe("en");
  });
});
