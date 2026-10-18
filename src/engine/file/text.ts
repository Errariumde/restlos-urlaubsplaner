// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { textLength } from "./limits";
import { isRecord, type Report } from "./report";
import type { Text } from "./types";

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;

/** A plain string or a map from language code to string; every string at most `maxLength` code points. */
export function readText(value: unknown, path: string, maxLength: number, report: Report): Text | undefined {
  if (typeof value === "string") {
    if (textLength(value) <= maxLength) return value;
    report.add("textTooLong", path, { limit: maxLength });
    return undefined;
  }
  if (!isRecord(value)) {
    report.add("invalidEntry", path);
    return undefined;
  }
  const keys = Object.keys(value);
  if (keys.length === 0 || !keys.every((key) => LANGUAGE.test(key))) {
    report.add("invalidEntry", path);
    return undefined;
  }
  const entries: [string, string][] = [];
  for (const key of keys) {
    const item = value[key];
    if (typeof item !== "string") {
      report.add("invalidEntry", path);
      return undefined;
    }
    if (textLength(item) > maxLength) {
      report.add("textTooLong", path, { limit: maxLength, language: key });
      return undefined;
    }
    entries.push([key, item]);
  }
  return Object.fromEntries(entries);
}

/** The language, else "en", else the first entry; a plain string as it is. */
export function textFor(text: Text, language: string): string {
  if (typeof text === "string") return text;
  return text[language] ?? text["en"] ?? Object.values(text)[0] ?? "";
}
