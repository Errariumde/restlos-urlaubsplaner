// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { Catalog } from "./locale.ts";

// Pseudo-locales make layout problems visible without a real translation: "long" accents the letters and
// pads every message by 40 % (German texts are about that much longer than English ones), "rtl" forces
// right-to-left text. Both leave the ICU syntax of the messages intact.

const ACCENTED: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "ü", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Ü", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

const PADDING = "·";
const RTL_START = "‮";
const RTL_END = "‬";
const BRANCH_TYPES = new Set(["plural", "select", "selectordinal"]);

interface Scan {
  out: string;
  next: number;
}

/** Accents the literal text and copies arguments, selectors and quoted parts as they are. Stops at the `}` that closes a branch. */
function scanText(source: string, start: number, inBranch: boolean): Scan {
  let out = "";
  let i = start;
  while (i < source.length) {
    const c = source[i]!;
    if (c === "}" && inBranch) break;
    if (c === "'") {
      const following = source[i + 1];
      if (following === "{" || following === "}") {
        // A quoted section runs to the next single apostrophe; '' inside it is an apostrophe.
        let j = i + 1;
        while (j < source.length && !(source[j] === "'" && source[j + 1] !== "'")) j += source[j] === "'" ? 2 : 1;
        out += source.slice(i, j + 1);
        i = j + 1;
      } else {
        out += c;
        i++;
      }
    } else if (c === "{") {
      const argument = scanArgument(source, i);
      out += argument.out;
      i = argument.next;
    } else {
      out += ACCENTED[c] ?? c;
      i++;
    }
  }
  return { out, next: i };
}

/** Reads from the characters up to the next of `stops`, copying them. */
function copyUntil(source: string, start: number, stops: string): Scan {
  let i = start;
  while (i < source.length && !stops.includes(source[i]!)) i++;
  return { out: source.slice(start, i), next: i };
}

/** An argument `{name}`, `{name, type, style}` or `{name, plural, one {…} other {…}}`; `start` is at the `{`. */
function scanArgument(source: string, start: number): Scan {
  const name = copyUntil(source, start + 1, ",}");
  let out = "{" + name.out;
  let i = name.next;
  if (source[i] !== ",") return { out: out + (source[i] ?? ""), next: i + 1 };
  const type = copyUntil(source, i + 1, ",}");
  out += "," + type.out;
  i = type.next;
  if (source[i] !== ",") return { out: out + (source[i] ?? ""), next: i + 1 };
  if (!BRANCH_TYPES.has(type.out.trim())) {
    const style = copyUntil(source, i + 1, "}");
    return { out: out + "," + style.out + (source[style.next] ?? ""), next: style.next + 1 };
  }
  out += ",";
  i++;
  while (i < source.length) {
    const selector = copyUntil(source, i, "{}");
    out += selector.out;
    i = selector.next;
    if (source[i] !== "{") return { out: out + (source[i] ?? ""), next: i + 1 }; // the closing brace
    const branch = scanText(source, i + 1, true);
    out += "{" + branch.out + (source[branch.next] ?? "");
    i = branch.next + 1;
  }
  return { out, next: i };
}

function longMessage(message: string): string {
  const padding = Math.ceil(message.length * 0.4);
  return scanText(message, 0, false).out + PADDING.repeat(padding);
}

/** The English catalog as a pseudo-locale: "long" (accented and 40 % longer) or "rtl" (right to left). `meta.*` keys stay as they are, except `meta.dir` for "rtl". */
export function pseudoCatalog(en: Catalog, kind: "long" | "rtl"): Catalog {
  const out: Catalog = {};
  for (const [key, message] of Object.entries(en)) {
    if (key.startsWith("meta.")) out[key] = message;
    else out[key] = kind === "long" ? longMessage(message) : RTL_START + message + RTL_END;
  }
  if (kind === "rtl") out["meta.dir"] = "rtl";
  return out;
}
