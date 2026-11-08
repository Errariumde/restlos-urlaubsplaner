// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/** The UI languages. "en-XA" (long, accented) and "en-XB" (right to left) are pseudo-locales for testing the layout. */
export type Locale = "de" | "en" | "en-XA" | "en-XB";

/** A message catalog: message key to ICU MessageFormat text. */
export type Catalog = Record<string, string>;

/** The UI language for a browser language tag (`navigator.language`): German for "de…", else English. */
export function localeForLanguage(language: string): Locale {
  return /^de(?:-|$)/i.test(language) ? "de" : "en";
}

/** The language a file's texts are read in for a UI locale; the pseudo-locales read the English texts. */
export function textLanguage(locale: Locale): string {
  return locale === "de" ? "de" : "en";
}
