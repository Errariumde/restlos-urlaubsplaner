// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { LIMITS, textLength, utf8Length } from "./limits";
import { readContract } from "./read-contract";
import { readSources } from "./read-sources";
import { readTemplates, readTheme } from "./read-templates";
import { Refused, Report, checkKeys, isRecord, type ReadResult } from "./report";
import type { RuleSetFile } from "./types";

const RULE_SET_KEYS = ["schema", "kind", "id", "revision", "contract", "sources", "templates", "theme"];

function checkSchema(value: unknown): void {
  if (typeof value !== "string") throw new Refused({ code: "unknownSchema", path: "schema" });
  const match = /^restlos\/([1-9]\d*)$/.exec(value);
  if (!match) throw new Refused({ code: "unknownSchema", path: "schema" });
  if (match[1] !== "1") throw new Refused({ code: "newerSchema", path: "schema" });
}

function readEnvelope(text: string): ReadResult {
  if (utf8Length(text) > LIMITS.fileBytes) throw new Refused({ code: "tooLarge" });
  let json: unknown;
  try {
    json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Refused({ code: "notJson" });
  }
  if (!isRecord(json)) throw new Refused({ code: "unknownSchema", path: "schema" });
  checkSchema(json["schema"]);

  const kind = json["kind"];
  if (kind === "settings") throw new Refused({ code: "settingsNotSupported", path: "kind" });
  // "plan" is added with the plan section; until then it counts as unknown.
  if (kind !== "ruleSet") throw new Refused({ code: "unknownKind", path: "kind" });
  for (const key of ["plan", "ruleSet"]) {
    if (key in json) throw new Refused({ code: "kindMismatch", path: key });
  }

  const id = json["id"];
  if (typeof id !== "string" || id.length === 0 || textLength(id) > LIMITS.shortText) throw new Refused({ code: "invalidCore", path: "id" });
  const revision = json["revision"];
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Refused({ code: "invalidCore", path: "revision" });

  const report = new Report();
  checkKeys(json, RULE_SET_KEYS, "", report);
  const contract = readContract(json["contract"], "contract", "ruleSet", report);
  const sources = readSources(json["sources"], "sources", "ruleSet", report);
  const templates = readTemplates(json["templates"], "templates", report);
  const theme = readTheme(json["theme"], "theme", report);
  const file: RuleSetFile = { kind: "ruleSet", id, revision, contract, sources, templates, theme };
  return { ok: true, file, report: report.entries };
}

/** Reads a plan file or rule set from untrusted text. Never throws: every problem is a report entry or a refusal. */
export function readFile(text: string): ReadResult {
  try {
    return readEnvelope(text);
  } catch (error) {
    if (error instanceof Refused) return { ok: false, refusal: error.refusal };
    // Reading must not throw whatever the input; an unexpected error is a core problem of the file.
    return { ok: false, refusal: { code: "invalidCore" } };
  }
}
