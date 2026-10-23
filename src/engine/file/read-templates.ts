// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { LIMITS, textLength, utf8Length } from "./limits";
import { parseId } from "./read-contract";
import { Refused, Report, at, checkKeys, child, isPrototypeKey, isRecord, readOptional, readRequired, type Parse } from "./report";
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

/** A string of 1 to 200 code points. */
const shortString: Parse<string> = (value) =>
  typeof value === "string" && value.length > 0 && textLength(value) <= LIMITS.shortText ? value : undefined;
const imageType: Parse<TemplateImage["type"]> = (value) => IMAGE_TYPES.find((candidate) => candidate === value);
const base64: Parse<{ data: string; bytes: number }> = (value) => {
  if (typeof value !== "string") return undefined;
  const bytes = decodedSize(value);
  return bytes === undefined ? undefined : { data: value, bytes };
};

/** One image of a template; every problem drops the template, `dropped`. */
function readImage(value: unknown, path: string, report: Report, dropped: string): { image: TemplateImage; bytes: number } | undefined {
  if (!isRecord(value)) {
    report.error("invalidValue", path, dropped);
    return undefined;
  }
  const name = readRequired(value, "name", shortString, path, report, dropped);
  const type = readRequired(value, "type", imageType, path, report, dropped);
  const data = readRequired(value, "data", base64, path, report, dropped);
  checkKeys(value, ["name", "type", "data"], path, report);
  if (name === undefined || type === undefined || data === undefined) return undefined;
  return { image: { name, type, data: data.data }, bytes: data.bytes };
}

/**
 * The images of a template. Every image is checked; the first size over a limit is reported once, as
 * `templateTooLarge` of the template.
 */
function readImages(value: unknown, path: string, report: Report, templatePath: string): TemplateImage[] | undefined {
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, templatePath);
    return undefined;
  }
  const images: TemplateImage[] = [];
  let total = 0;
  let tooLarge = false;
  for (let i = 0; i < value.length; i++) {
    const read = readImage(value[i], at(path, i), report, templatePath);
    if (!read) continue;
    total += read.bytes;
    if (!tooLarge && (read.bytes > LIMITS.imageBytes || total > LIMITS.templateImageBytes)) {
      report.error("templateTooLarge", templatePath, templatePath, { limit: read.bytes > LIMITS.imageBytes ? "imageBytes" : "templateImageBytes" });
      tooLarge = true;
    }
    images.push(read.image);
  }
  return images;
}

/**
 * Reads one template into `report`, the template's own scratch report: every key in the writer's order, then
 * the unknown fields. Returns undefined when the template is dropped. A duplicate `id` is read no further.
 */
function readTemplate(value: unknown, path: string, kind: "plan" | "ruleSet", ids: ReadonlySet<string>, report: Report): Template | undefined {
  if (!isRecord(value)) {
    report.error("invalidValue", path, path);
    return undefined;
  }
  const required = <T>(key: string, parse: Parse<T>): T | undefined => readRequired(value, key, parse, path, report, path);
  const id = required("id", parseId);
  if (id !== undefined && ids.has(id)) {
    report.error("duplicateId", child(path, "id"), path);
    return undefined;
  }
  const origin = kind === "plan" ? readOptional(value, "origin", parseId, path, report, path) : undefined;
  const name = readText(value["name"], child(path, "name"), LIMITS.shortText, report, path);
  const api = required("api", (item) => (typeof item === "number" && Number.isSafeInteger(item) && item >= 1 ? item : undefined));
  const typst = required("typst", shortString);
  const typ = required("typ", (item) => (typeof item === "string" ? item : undefined));
  if (typ !== undefined && utf8Length(typ) > LIMITS.typBytes) report.error("templateTooLarge", path, path, { limit: "typBytes" });
  const images = value["images"] === undefined ? undefined : readImages(value["images"], child(path, "images"), report, path);
  // Rule sets have no `origin`; there it counts as an unknown field.
  checkKeys(value, ["id", "name", "api", "typst", "typ", "images", ...(kind === "plan" ? ["origin"] : [])], path, report);
  if (report.drops(path) || id === undefined || name === undefined || api === undefined || typst === undefined || typ === undefined) return undefined;
  return { id, name, api, typst, typ, ...(images ? { images } : {}), ...(origin !== undefined ? { origin } : {}) };
}

/**
 * Reads `templates`. A missing list reads as empty. Anything but a list is dropped and reads as empty too; more
 * than 20 templates are refused. A template that is invalid or over its limits is dropped with a report entry.
 */
export function readTemplates(value: unknown, path: string, kind: "plan" | "ruleSet", report: Report, positions: Map<string, number> = new Map()): Template[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    report.error("invalidValue", path, path);
    return [];
  }
  if (value.length > LIMITS.templates) throw new Refused({ code: "limitExceeded", path, data: { limit: "templates" } });
  const templates: Template[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const scratch = new Report();
    const template = readTemplate(value[i], at(path, i), kind, ids, scratch);
    report.merge(scratch, template !== undefined);
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
    report.error("invalidValue", path, path);
    return null;
  }
  return value;
}
