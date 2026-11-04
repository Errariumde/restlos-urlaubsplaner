// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { Locale } from "../ui/i18n/locale.ts";

/** The gallery's sections. Later tasks add the allowance panel and the month columns. */
export const SECTIONS = ["controls", "popover", "sheet", "toolbar", "day-cell", "day-detail", "allowance", "main-tiles"] as const;
export type SectionId = (typeof SECTIONS)[number];

export const LOCALES: readonly Locale[] = ["de", "en", "en-XA", "en-XB"];
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];

/** One section in one locale and mode: what a gallery frame, a test or a screenshot shows. */
export interface Combination {
  section: SectionId;
  locale: Locale;
  mode: Mode;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return values.find((candidate) => candidate === value);
}

/**
 * The combination from `?section=…&locale=…&mode=…`, or undefined unless all three name a known value: the
 * gallery then shows the overview of every combination.
 */
export function combinationFrom(search: string): Combination | undefined {
  // Read by hand: this module is also type-checked without the DOM types (tests/), where URLSearchParams is missing.
  const params = new Map<string, string>();
  for (const pair of search.replace(/^\?/, "").split("&")) {
    const [name = "", value = ""] = pair.split("=").map((part) => decodeURIComponent(part.replaceAll("+", " ")));
    if (name !== "" && !params.has(name)) params.set(name, value);
  }
  const section = oneOf(SECTIONS, params.get("section"));
  const locale = oneOf(LOCALES, params.get("locale"));
  const mode = oneOf(MODES, params.get("mode"));
  return section && locale && mode ? { section, locale, mode } : undefined;
}

/** The query string that shows `combination` alone. */
export function searchFor(combination: Combination): string {
  const { section, locale, mode } = combination;
  return `?section=${encodeURIComponent(section)}&locale=${encodeURIComponent(locale)}&mode=${encodeURIComponent(mode)}`;
}

/** Every combination, section by section. */
export function allCombinations(): Combination[] {
  return SECTIONS.flatMap((section) => MODES.flatMap((mode) => LOCALES.map((locale) => ({ section, locale, mode }))));
}
