// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/** The design's "Limits" table. */
export const LIMITS = {
  fileBytes: 10_485_760,
  rules: 1000,
  sources: 50,
  templates: 20,
  weekEntries: 100,
  references: 100,
  planDays: 2000,
  overrides: 2000,
  notes: 2000,
  entriesPerSource: 2000,
  exceptPerEntry: 400,
  sourceDays: 50_000,
  periodMonths: 36,
  typBytes: 524_288,
  imageBytes: 1_048_576,
  templateImageBytes: 2_097_152,
  shortText: 200,
  longText: 2000,
} as const;

/** Length of the UTF-8 encoding; no TextEncoder, which the project's lib types lack. A lone surrogate counts as U+FFFD (3 bytes). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Length in code points. */
export function textLength(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) i++;
    length++;
  }
  return length;
}
