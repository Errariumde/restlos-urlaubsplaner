// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { IntlMessageFormat } from "intl-messageformat";
import de from "./de.json";
import en from "./en.json";
import { localeForLanguage, type Catalog, type Locale } from "./locale.ts";

export type { Locale } from "./locale.ts";

/**
 * The app ships German and English only. The pseudo-locales (and the gallery's own texts) are added by the
 * gallery with `registerCatalog`, so they stay out of the app's bundle.
 */
const catalogs: Partial<Record<Locale, Catalog>> = { de, en };

/** Formatters are built once per locale and key. A plain cache, not reactive state. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const formatters = new Map<string, IntlMessageFormat>();

/** The catalog of `locale`; a locale nobody registered falls back to English. */
function catalogFor(locale: Locale): Catalog {
  return catalogs[locale] ?? en;
}

/**
 * Adds `catalog` to the messages of `locale` (a new locale, or more keys for an existing one). Call it
 * before the first text renders: the locale's cached formatters are dropped, but nothing re-renders.
 */
export function registerCatalog(locale: Locale, catalog: Catalog): void {
  catalogs[locale] = { ...catalogs[locale], ...catalog };
  for (const cacheKey of formatters.keys()) {
    if (cacheKey.startsWith(`${locale}\u0000`)) formatters.delete(cacheKey);
  }
}

function formatterFor(locale: Locale, key: string): IntlMessageFormat | undefined {
  const cacheKey = `${locale}\u0000${key}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    const message = catalogFor(locale)[key];
    if (message === undefined) return undefined;
    // The pseudo-locales are English: their plural rules are English too.
    formatter = new IntlMessageFormat(message, locale === "de" ? "de" : "en");
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

class I18n {
  /** German when the browser's language is German, else English. */
  locale = $state<Locale>(localeForLanguage(typeof navigator === "undefined" ? "" : navigator.language));

  get dir(): "ltr" | "rtl" {
    return catalogFor(this.locale)["meta.dir"] === "rtl" ? "rtl" : "ltr";
  }

  get lang(): string {
    return catalogFor(this.locale)["meta.lang"] ?? "en";
  }

  /** The message for `key` in the current locale. A missing key returns the key itself, so the gap shows on screen. */
  t(key: string, args?: Record<string, string | number>): string {
    const formatter = formatterFor(this.locale, key);
    return formatter ? String(formatter.format(args)) : key;
  }
}

export const i18n = new I18n();
