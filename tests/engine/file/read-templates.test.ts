// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { readFile } from "../../../src/engine/file/read";
import { minimal } from "./helpers";

const read = (extra: Record<string, unknown>) => readFile(minimal(extra));
const codes = (result: ReturnType<typeof readFile>) => (result.ok ? result.report.map((e) => `${e.code}@${e.path}`) : [`refused:${result.refusal.code}`]);
const fileOf = (result: ReturnType<typeof readFile>) => {
  if (!result.ok) throw new Error("refused: " + result.refusal.code);
  return result.file;
};
const template = (extra: Record<string, unknown> = {}) => ({ id: "t1", name: { de: "Kalender", en: "Calendar" }, api: 1, typst: ">=0.13", typ: "#let x = 1", ...extra });
const png = (bytes: number) => ({ name: "logo.png", type: "image/png", data: "A".repeat((bytes / 3) * 4) });

describe("templates", () => {
  it("loads a template with two PNG images", () => {
    const images = [png(30), { ...png(30), name: "b.png" }];
    const result = read({ templates: [template({ images })] });
    expect(codes(result)).toEqual([]);
    expect(fileOf(result).templates).toEqual([template({ images })]);
  });
  it("accepts typ of 524288 bytes and rejects 524289", () => {
    expect(codes(read({ templates: [template({ typ: "a".repeat(524_288) })] }))).toEqual([]);
    const result = read({ templates: [template({ typ: "a".repeat(524_289) })] });
    expect(codes(result)).toEqual(["templateTooLarge@templates[0]"]);
    expect(fileOf(result).templates).toEqual([]);
  });
  it("counts typ in UTF-8 bytes", () => {
    expect(codes(read({ templates: [template({ typ: "ä".repeat(262_144) })] }))).toEqual([]);
    expect(codes(read({ templates: [template({ typ: "ä".repeat(262_145) })] }))).toEqual(["templateTooLarge@templates[0]"]);
    expect(codes(read({ templates: [template({ typ: "😀".repeat(131_072) })] }))).toEqual([]);
    expect(codes(read({ templates: [template({ typ: `${"😀".repeat(131_072)}a` })] }))).toEqual(["templateTooLarge@templates[0]"]);
  });
  it("counts an image's name and the Typst versions in characters (code points)", () => {
    expect(codes(read({ templates: [template({ typst: "😀".repeat(200), images: [{ ...png(30), name: "😀".repeat(200) }] })] }))).toEqual([]);
    expect(codes(read({ templates: [template({ images: [{ ...png(30), name: "😀".repeat(201) }] })] }))).toEqual(["invalidEntry@templates[0].images[0]"]);
    expect(codes(read({ templates: [template({ typst: "😀".repeat(201) })] }))).toEqual(["invalidEntry@templates[0].typst"]);
  });
  it("accepts an image of 1 MB and rejects 1 MB + 1 byte decoded", () => {
    expect(codes(read({ templates: [template({ images: [png(1_048_575)] })] }))).toEqual([]);
    const result = read({ templates: [template({ images: [{ name: "x.png", type: "image/png", data: "A".repeat(1_398_104) }] })] });
    expect(codes(result)).toEqual(["templateTooLarge@templates[0]"]);
  });
  it("rejects three images of 1 MB", () => {
    const image = (name: string) => ({ name, type: "image/png", data: "A".repeat(1_398_100) });
    const result = read({ templates: [template({ images: [image("a"), image("b"), image("c")] })] });
    expect(codes(result)).toEqual(["templateTooLarge@templates[0]"]);
  });
  it("counts padding when decoding the size", () => {
    expect(codes(read({ templates: [template({ images: [{ name: "x.png", type: "image/png", data: "QQ==" }] })] }))).toEqual([]);
  });
  it.each([
    ["an image of type image/gif", { name: "x.gif", type: "image/gif", data: "QQ==" }],
    ["data that is not Base64", { name: "x.png", type: "image/png", data: "not base64!" }],
    ["data of a wrong length", { name: "x.png", type: "image/png", data: "QQ=" }],
    ["data that is not a string", { name: "x.png", type: "image/png", data: 5 }],
    ["an image without a name", { type: "image/png", data: "QQ==" }],
  ])("drops the template for %s", (_name, image) => {
    const result = read({ templates: [template({ images: [image] }), template({ id: "t2" })] });
    expect(codes(result)).toEqual(["invalidEntry@templates[0].images[0]"]);
    expect(fileOf(result).templates.map((t) => t.id)).toEqual(["t2"]);
  });
  it.each([
    ["no id", { id: undefined }],
    ["no name", { name: undefined }],
    ["a fractional api", { api: 1.5 }],
    ["api 0", { api: 0 }],
    ["no typst", { typst: undefined }],
    ["no typ", { typ: undefined }],
    ["images not a list", { images: {} }],
  ])("drops a template with %s", (_name, extra) => {
    const result = read({ templates: [template(extra)] });
    expect(codes(result)).toHaveLength(1);
    expect(fileOf(result).templates).toEqual([]);
  });
  it("reports unknown fields", () => {
    expect(codes(read({ templates: [template({ colour: 1 })] }))).toEqual(["unknownField@templates[0].colour"]);
  });
  it("reports an unknown field of an image", () => {
    const images = [{ name: "x.png", type: "image/png", data: "QQ==", alt: "x" }];
    expect(codes(read({ templates: [template({ images })] }))).toEqual(["unknownField@templates[0].images[0].alt"]);
  });
  it("reports origin of a template in a rule set as unknown and drops it", () => {
    const result = read({ templates: [template({ origin: "set-1" })] });
    expect(codes(result)).toEqual(["unknownField@templates[0].origin"]);
    expect(fileOf(result).templates[0]).not.toHaveProperty("origin");
  });
  it("keeps the first of two templates with the same id", () => {
    const result = read({ templates: [template(), template({ typ: "other" })] });
    expect(codes(result)).toEqual(["duplicateId@templates[1].id"]);
    expect(fileOf(result).templates.map((t) => t.typ)).toEqual(["#let x = 1"]);
  });
  it("refuses 21 templates", () => {
    const templates = Array.from({ length: 21 }, (_, i) => template({ id: `t${String(i)}` }));
    expect(read({ templates })).toMatchObject({ ok: false, refusal: { code: "limitExceeded", path: "templates", data: { limit: "templates" } } });
  });
  it("refuses templates that are not a list", () => expect(read({ templates: "x" })).toMatchObject({ ok: false, refusal: { code: "invalidCore", path: "templates" } }));
});

describe("theme", () => {
  it.each([[null], [{}], [{ "accent-1": "#336699" }], [{ a: { b: [1, 2, { c: null }] } }]])("keeps %j unchanged", (theme) => {
    const result = read({ theme });
    expect(codes(result)).toEqual([]);
    expect(fileOf(result).theme).toEqual(theme);
  });
  it("reads a missing theme as null without a report entry", () => {
    const result = readFile(JSON.stringify({ schema: "restlos/1", kind: "ruleSet", id: "x", revision: 1, contract: { region: { country: "DE" }, week: [{ from: "2020-01-01", required: { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" } }], rules: [] } }));
    expect(codes(result)).toEqual([]);
    expect(fileOf(result).theme).toBeNull();
  });
  const nested = (levels: number): unknown => {
    let value: unknown = {};
    for (let i = 1; i < levels; i++) value = { a: value };
    return value;
  };
  it("keeps an object nested 32 levels deep", () => expect(codes(read({ theme: nested(32) }))).toEqual([]));
  it.each([
    ['{"colors":{"__proto__":{"polluted":true}}}'],
    ['{"constructor":{"prototype":{"polluted":true}}}'],
    ['{"a":[1,{"b":{"prototype":2}}]}'],
  ])("replaces %s, which holds a prototype key, by null", (json) => {
    const result = readFile(minimal({ theme: JSON.parse(json) as unknown }));
    expect(codes(result)).toEqual(["invalidEntry@theme"]);
    expect(fileOf(result).theme).toBeNull();
  });
  it.each([["an array", []], ["a string", "dark"], ["a number", 3], ["an object nested 33 levels deep", nested(33)]])("replaces %s by null", (_name, theme) => {
    const result = read({ theme });
    expect(codes(result)).toEqual(["invalidEntry@theme"]);
    expect(fileOf(result).theme).toBeNull();
  });
});
