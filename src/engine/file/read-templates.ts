// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { LIMITS, textLength, utf8Length } from "./limits";
import { isId } from "./read-contract";
import { Refused, Report, at, checkKeys, child, isPrototypeKey, isRecord } from "./report";
import { readText } from "./text";
import type { Template, TemplateImage, Theme } from "./types";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const MAX_THEME_DEPTH = 32;

/** Decoded size of Base64 text, or undefined when it is not valid Base64. */
function decodedSize(data: string): number | undefined {
  if (data.length % 4 !== 0 || !BASE64.test(data)) return undefined;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function readImage(value: unknown, path: string, report: Report): { image: TemplateImage; bytes: number } | undefined {
  if (!isRecord(value)) return undefined;
  const { name, type, data } = value;
  if (typeof name !== "string" || name.length === 0 || textLength(name) > LIMITS.shortText) return undefined;
  const imageType = IMAGE_TYPES.find((candidate) => candidate === type);
  if (imageType === undefined || typeof data !== "string") return undefined;
  const bytes = decodedSize(data);
  if (bytes === undefined) return undefined;
  checkKeys(value, ["name", "type", "data"], path, report);
  return { image: { name, type: imageType, data }, bytes };
}

function readTemplate(value: unknown, path: string, kind: "plan" | "ruleSet", ids: ReadonlySet<string>, report: Report): Template | undefined {
  const fail = (field?: string): undefined => {
    report.add("invalidEntry", field === undefined ? path : child(path, field));
    return undefined;
  };
  if (!isRecord(value)) return fail();
  const id = value["id"];
  if (!isId(id)) return fail("id");
  if (ids.has(id)) {
    report.add("duplicateId", child(path, "id"));
    return undefined;
  }
  const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report);
  if (name === undefined) return undefined;
  const { api, typst, typ } = value;
  const origin = kind === "plan" ? value["origin"] : undefined;
  if (typeof api !== "number" || !Number.isSafeInteger(api) || api < 1) return fail("api");
  if (typeof typst !== "string" || typst.length === 0 || textLength(typst) > LIMITS.shortText) return fail("typst");
  if (typeof typ !== "string") return fail("typ");
  if (origin !== undefined && !isId(origin)) return fail("origin");
  if (utf8Length(typ) > LIMITS.typBytes) {
    report.add("templateTooLarge", path, { limit: "typBytes" });
    return undefined;
  }

  let images: TemplateImage[] | undefined;
  const imagesValue = value["images"];
  if (imagesValue !== undefined) {
    if (!Array.isArray(imagesValue)) return fail("images");
    images = [];
    let total = 0;
    for (let i = 0; i < imagesValue.length; i++) {
      const read = readImage(imagesValue[i], at(child(path, "images"), i), report);
      if (!read) {
        report.add("invalidEntry", at(child(path, "images"), i));
        return undefined;
      }
      total += read.bytes;
      if (read.bytes > LIMITS.imageBytes || total > LIMITS.templateImageBytes) {
        report.add("templateTooLarge", path, { limit: read.bytes > LIMITS.imageBytes ? "imageBytes" : "templateImageBytes" });
        return undefined;
      }
      images.push(read.image);
    }
  }
  // Rule sets have no `origin`; there it counts as an unknown field.
  checkKeys(value, ["id", "name", "api", "typst", "typ", "images", ...(kind === "plan" ? ["origin"] : [])], path, report);
  return { id, name, api, typst, typ, ...(images ? { images } : {}), ...(origin !== undefined ? { origin } : {}) };
}

/**
 * Reads `templates`. A missing list reads as empty; anything but a list, or more than 20 templates, is refused.
 * A template that is invalid or over its limits is dropped with a report entry.
 */
export function readTemplates(value: unknown, path: string, kind: "plan" | "ruleSet", report: Report, positions: Map<string, number> = new Map()): Template[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Refused({ code: "invalidCore", path });
  if (value.length > LIMITS.templates) throw new Refused({ code: "limitExceeded", path, data: { limit: "templates" } });
  const templates: Template[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const template = readTemplate(value[i], at(path, i), kind, ids, report);
    if (!template) continue;
    ids.add(template.id);
    positions.set(at(path, templates.length), i);
    templates.push(template);
  }
  return templates;
}

/**
 * True when the value nests at most `MAX_THEME_DEPTH` levels (the theme itself is level 1) and no object in
 * it has a prototype key. Iterative, so depth costs no stack.
 */
function isSafeTheme(root: unknown): boolean {
  let level: unknown[] = [root];
  for (let depth = 1; level.length > 0; depth++) {
    const next: unknown[] = [];
    for (const item of level) {
      if (typeof item !== "object" || item === null) continue;
      if (depth > MAX_THEME_DEPTH) return false;
      if (Array.isArray(item)) {
        for (const entry of item as unknown[]) next.push(entry);
        continue;
      }
      for (const [key, entry] of Object.entries(item as Record<string, unknown>)) {
        if (isPrototypeKey(key)) return false;
        next.push(entry);
      }
    }
    level = next;
  }
  return true;
}

/**
 * Reads `theme`: `null` or an object that is stored unchanged. Anything else, also an object nested too
 * deeply or holding a prototype key anywhere, is reported and read as `null`.
 */
export function readTheme(value: unknown, path: string, report: Report): Theme {
  if (value === undefined || value === null) return null;
  if (!isRecord(value) || !isSafeTheme(value)) {
    report.add("invalidEntry", path);
    return null;
  }
  return value;
}
