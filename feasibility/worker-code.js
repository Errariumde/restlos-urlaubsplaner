// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T3 (feasibility/README.md): the worker. worker.html embeds this file as a text/plain data block, and worker-page.js
// starts it from a blob: URL as a classic and as a module worker; it has no import/export, so it runs as both.
// It answers one request at a time: a W2 probe, the setup (the model as UTF-8 bytes, kept with positions as a Map),
// a W3 handover and the W4 parse timing. Every reply carries the request's seq.
// Clock: the durations measured here use this worker's performance.now() and travel as durations; the page never
// subtracts them from its own times.
/* global self, performance, setTimeout, Blob, URL, fetch, importScripts, WebAssembly, TextDecoder, TextEncoder */

const errorText = (error) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Violations reported inside the worker (where a browser dispatches them to the worker's global scope).
const violations = [];
self.addEventListener("securitypolicyviolation", (event) => {
  const sample = event.sample ? ` sample "${event.sample}"` : "";
  violations.push(`${event.effectiveDirective || event.violatedDirective} blocked "${event.blockedURI}"${sample} (${event.disposition})`);
});

let model = null; // { read, plan } with read.positions as a Map, after "load"
let modelText = null; // the JSON text the model was parsed from (the page's data block), for W4

// ---- W2 ----

const PROBES = {
  eval: () => eval("1 + 1"),
  "new-function": () => new Function("return 1 + 1")(),
  "fetch-blob": async () => {
    const url = URL.createObjectURL(new Blob(["x"], { type: "text/plain" }));
    try {
      const response = await fetch(url);
      return `status ${response.status}, ${(await response.text()).length} characters`;
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  "importScripts-blob": () => {
    const url = URL.createObjectURL(new Blob(["self.importedScriptRan = true;"], { type: "text/javascript" }));
    try {
      importScripts(url);
      return `importScripts returned; the imported script ran: ${self.importedScriptRan === true}`;
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  "wasm-compile": async () => {
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    return `compiled, ${WebAssembly.Module.exports(module).length} exports`;
  },
};

/** Runs one probe and waits 200 ms for late violation events; returns what happened and the violations meanwhile. */
async function runProbe(name) {
  const from = violations.length;
  let outcome = "";
  let error = null;
  try {
    outcome = String(await PROBES[name]());
  } catch (thrown) {
    error = errorText(thrown);
  }
  await sleep(200);
  return { name, outcome, error, seen: violations.slice(from) };
}

// ---- setup, W3, W4 ----

/** The first 366 day results as 8 Int32 values each: what one year of the calendar shows. */
function calendarInts() {
  const ints = new Int32Array(366 * 8);
  model.plan.days.slice(0, 366).forEach((day, i) => {
    const at = i * 8;
    ints[at] = day.day;
    ints[at + 1] = day.required.value;
    ints[at + 2] = day.evaluation.cost;
    ints[at + 3] = day.evaluation.ownCost;
    ints[at + 4] = day.evaluation.mandatoryCost;
    ints[at + 5] = day.evaluation.remaining;
    ints[at + 6] = (day.inPeriod ? 1 : 0) | (day.closure ? 2 : 0) | (day.evaluation.whole ? 4 : 0) | (day.facts.holidays.length > 0 ? 8 : 0);
    // ints[at + 7] stays 0 (padding)
  });
  return ints;
}

/** The message of a W3 handover and its transfer list; prepareMs is the worker's work before postMessage. */
function handover(how) {
  const started = performance.now();
  if (how === "a") return { message: { model }, transfer: [], prepareMs: 0 }; // the structured clone happens inside postMessage
  if (how === "d") {
    const days = calendarInts();
    return { message: { days }, transfer: [days.buffer], prepareMs: performance.now() - started };
  }
  const text = JSON.stringify({ read: { ...model.read, positions: [...model.read.positions] }, plan: model.plan });
  if (how === "b") return { message: { text }, transfer: [], prepareMs: performance.now() - started };
  const bytes = new TextEncoder().encode(text);
  return { message: { bytes: bytes.buffer }, transfer: [bytes.buffer], prepareMs: performance.now() - started };
}

async function answer(request) {
  if (request.type === "probe") return { type: "probed", ...(await runProbe(request.name)) };
  if (request.type === "load") {
    const bytes = request.bytes.byteLength;
    const t0 = performance.now();
    modelText = new TextDecoder().decode(request.bytes);
    const t1 = performance.now();
    const parsed = JSON.parse(modelText);
    const t2 = performance.now();
    parsed.read.positions = new Map(parsed.read.positions);
    const t3 = performance.now();
    model = parsed;
    const firstDay = model.plan.days[0]?.day;
    return { type: "loaded", bytes, positions: model.read.positions.size, days: model.plan.days.length, firstDay, decodeMs: t1 - t0, parseMs: t2 - t1, mapMs: t3 - t2 };
  }
  if (request.type === "parse") {
    const times = [];
    let days = 0;
    for (let i = 0; i < request.runs; i++) {
      await sleep(200); // as between the page's parses
      const t0 = performance.now();
      days = JSON.parse(modelText).plan.days.length;
      times.push(performance.now() - t0);
    }
    return { type: "parsed", times, days };
  }
  throw new Error(`unknown request type "${request.type}"`);
}

self.onmessage = async (event) => {
  const request = event.data;
  try {
    if (request.type === "send") {
      const { message, transfer, prepareMs } = handover(request.how);
      self.postMessage({ type: "model", seq: request.seq, how: request.how, prepareMs, ...message }, transfer);
      return;
    }
    self.postMessage({ seq: request.seq, ...(await answer(request)) });
  } catch (error) {
    self.postMessage({ type: "error", seq: request.seq, error: errorText(error) });
  }
};

self.postMessage({ type: "hello", origin: self.origin, secure: self.isSecureContext, href: self.location.href });
