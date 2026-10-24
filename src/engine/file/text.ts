// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { textLength } from "./limits";
import { child, isPrototypeKey, isRecord, type Report } from "./report";
import type { Text } from "./types";

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;

/**
 * A plain string or a map from language code to string; every string at most `maxLength` code points.
 * Every problem is reported, a key of the map at that key; `dropped` is the path of what is not loaded
 * when the text is invalid. A missing text is `missingValue`.
 */
export function readText(value: unknown, path: string, maxLength: number, report: Report, dropped: string): Text | undefined {
  if (value === undefined) {
    report.error("missingValue", path, dropped);
    return undefined;
  }
  if (typeof value === "string") {
    if (textLength(value) <= maxLength) return value;
    report.error("textTooLong", path, dropped, { limit: maxLength });
    return undefined;
  }
  const keys = isRecord(value) ? Object.keys(value) : [];
  if (!isRecord(value) || keys.length === 0) {
    report.error("invalidValue", path, dropped);
    return undefined;
  }
  const entries: [string, string][] = [];
  for (const key of keys) {
    const item = value[key];
    if (!LANGUAGE.test(key) || isPrototypeKey(key) || typeof item !== "string") report.error("invalidValue", child(path, key), dropped);
    else if (textLength(item) > maxLength) report.error("textTooLong", child(path, key), dropped, { limit: maxLength });
    else entries.push([key, item]);
  }
  return entries.length === keys.length ? Object.fromEntries(entries) : undefined;
}

/** The language, else "en", else the first entry; a plain string as it is. */
export function textFor(text: Text, language: string): string {
  if (typeof text === "string") return text;
  return text[language] ?? text["en"] ?? Object.values(text)[0] ?? "";
}
