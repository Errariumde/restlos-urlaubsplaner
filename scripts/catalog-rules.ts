// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { IntlMessageFormat } from "intl-messageformat";
import type { Catalog } from "../src/ui/i18n/locale.ts";

export interface CatalogCheckInput {
  de: Catalog;
  en: Catalog;
  /** Source files (path and text) searched for `t("key")` calls. */
  sources: readonly { path: string; text: string }[];
  /** Keys that the holiday data refers to; they are not in the source code. */
  dataKeys: readonly string[];
  /**
   * Keys of another catalog that the sources may use too: the gallery's catalog is checked on its own, and
   * the gallery also shows the app's texts. A key may not be in both catalogs.
   */
  externalKeys?: readonly string[];
}

// A call `t("key")` or `i18n.t("key")` with a literal key. Keys are lowercase-start, dot-separated words.
const KEY_USE = /\bt\(\s*["']([A-Za-z][\w.-]*)["']/g;

/** Checks the two catalogs against each other and against the code. Returns one line per error. */
export function checkCatalogs(input: CatalogCheckInput): string[] {
  const errors: string[] = [];
  const { de, en } = input;
  const keys = [...new Set([...Object.keys(de), ...Object.keys(en)])].sort();

  const usedIn = new Map<string, string>();
  for (const source of input.sources) {
    for (const match of source.text.matchAll(KEY_USE)) {
      const key = match[1]!;
      if (!usedIn.has(key)) usedIn.set(key, source.path);
    }
  }
  const dataKeys = new Set(input.dataKeys);
  const externalKeys = new Set(input.externalKeys ?? []);

  for (const key of keys) {
    if (!(key in en)) errors.push(`${key}: only in de`);
    if (!(key in de)) errors.push(`${key}: only in en`);
    if (!key.startsWith("meta.") && !usedIn.has(key) && !dataKeys.has(key)) errors.push(`${key}: never used`);
    if (externalKeys.has(key)) errors.push(`${key}: also in the other catalog`);
    for (const [language, catalog] of [["de", de], ["en", en]] as const) {
      const message = catalog[key];
      if (message === undefined) continue;
      try {
        new IntlMessageFormat(message, language);
      } catch (error) {
        errors.push(`${key}: invalid ICU message in ${language} (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      if (message.includes("#")) errors.push(`${key}: uses # in ${language}; pass the formatted number as an argument`);
    }
  }
  for (const [key, path] of usedIn) {
    if (!(key in de) && !(key in en) && !externalKeys.has(key)) errors.push(`${key}: used in ${path} but missing`);
  }
  return errors;
}
