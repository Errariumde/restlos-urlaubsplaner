// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { IntlMessageFormat } from "intl-messageformat";
import de from "./de.json";
import en from "./en.json";
import type { Catalog, Locale } from "./locale.ts";
import { pseudoCatalog } from "./pseudo.ts";

export type { Locale } from "./locale.ts";

const catalogs: Record<Locale, Catalog> = {
  de,
  en,
  "en-XA": pseudoCatalog(en, "long"),
  "en-XB": pseudoCatalog(en, "rtl"),
};

/** Formatters are built once per locale and key. A plain cache, not reactive state. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const formatters = new Map<string, IntlMessageFormat>();

function formatterFor(locale: Locale, key: string): IntlMessageFormat | undefined {
  const cacheKey = `${locale}\u0000${key}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    const message = catalogs[locale][key];
    if (message === undefined) return undefined;
    // The pseudo-locales are English: their plural rules are English too.
    formatter = new IntlMessageFormat(message, locale === "de" ? "de" : "en");
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

class I18n {
  locale = $state<Locale>("de");

  get dir(): "ltr" | "rtl" {
    return catalogs[this.locale]["meta.dir"] === "rtl" ? "rtl" : "ltr";
  }

  get lang(): string {
    return catalogs[this.locale]["meta.lang"] ?? "en";
  }

  /** The message for `key` in the current locale. A missing key returns the key itself, so the gap shows on screen. */
  t(key: string, args?: Record<string, string | number>): string {
    const formatter = formatterFor(this.locale, key);
    return formatter ? String(formatter.format(args)) : key;
  }
}

export const i18n = new I18n();
