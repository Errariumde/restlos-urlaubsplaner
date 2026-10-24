// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T2 and T2b (feasibility/README.md): CSP via <meta>, keyboard shortcuts, dropped files, the Pages policy.
// Follows results.js in the same inline script. Every check runs inside a probe, one after the other, so a violation
// that arrives shortly after an action can be attributed to it.
/* global document, navigator, location, window, getComputedStyle, Blob, URL, URLSearchParams, Image, FontFace, WebAssembly, DecompressionStream, TextDecoder, XMLHttpRequest, fetch, Worker, setTimeout, clearTimeout, atob, isSecureContext, Node, Element, record, observe, probe */

const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (error) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
const PIXEL_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const pixelBytes = () => Uint8Array.from(atob(PIXEL_BASE64), (char) => char.charCodeAt(0));

// ---- violations ----

// Filled by csp-early.js since the start of parsing. If that script was blocked, collect from here on.
const violations = window.cspViolations ?? [];
if (window.cspViolations === undefined) {
  document.addEventListener("securitypolicyviolation", (event) => {
    violations.push({
      effectiveDirective: event.effectiveDirective,
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      disposition: event.disposition,
      sample: event.sample,
    });
    showViolations();
  });
}
const directiveOf = (v) => v.effectiveDirective || v.violatedDirective.split(" ")[0];
const describeViolation = (v) => {
  const where = v.sourceFile ? ` at ${v.sourceFile}:${v.lineNumber}` : "";
  const sample = v.sample ? ` sample "${v.sample}"` : "";
  return `${directiveOf(v)} blocked "${v.blockedURI}"${where}${sample} (${v.disposition})`;
};
const describeAll = (seen) => (seen.length === 0 ? "no violation" : seen.map(describeViolation).join("; "));
const hasDirective = (seen, name) => seen.some((v) => directiveOf(v) === name);

function showViolations() {
  const text = violations.length === 0 ? "" : violations.map((v, i) => `${i + 1}. ${describeViolation(v)}`).join(" | ");
  record("violations", `${violations.length} violation(s), in order`, text);
}

/**
 * Runs action, waits for late violation events and returns what happened and which violations came meanwhile.
 * An action that neither returns nor throws within timeoutMs counts as failed, so one hanging check never stops the
 * others.
 */
async function watch(action, settleMs = 200, timeoutMs = 5000) {
  const from = violations.length;
  let outcome;
  let error = null;
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: no result within ${timeoutMs / 1000} s`)), timeoutMs);
  });
  try {
    outcome = await Promise.race([action(), timeout]);
  } catch (thrown) {
    error = thrown;
  } finally {
    clearTimeout(timer);
  }
  await sleep(settleMs);
  return { outcome, error, seen: violations.slice(from) };
}

/** allowed when the action worked; blocked when it failed and the directive reported a violation; otherwise failed-other. */
function verdict(directive, w, okText) {
  const violated = hasDirective(w.seen, directive);
  if (w.error === null) {
    return { result: "allowed", details: `${okText}; ${directive} violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  }
  return {
    result: violated ? "blocked" : "failed-other",
    details: `${directive} violation: ${violated ? "yes" : "no"}; ${errorText(w.error)}; ${describeAll(w.seen)}`,
  };
}

// ---- C1 inline scripts ----

function onLoaded(fn) {
  if (document.readyState === "complete") fn();
  else window.addEventListener("load", fn);
}

async function c1() {
  record("C1-main-script", "pass", "the hashed inline module script ran");
  await new Promise((resolve) => onLoaded(resolve));
  await sleep(300); // the attribute handler runs when the image fails to decode
  const scriptViolations = violations.filter((v) => directiveOf(v).startsWith("script-src"));
  const flag = (name) => (window[name] === true ? "allowed" : "blocked");
  record("C1-unhashed-script", flag("unhashedScriptRan"), `flag ${window.unhashedScriptRan === true ? "set" : "unset"}; ${describeAll(scriptViolations)}`);
  record("C1-attribute-handler", flag("attributeHandlerRan"), `flag ${window.attributeHandlerRan === true ? "set" : "unset"}; ${describeAll(scriptViolations)}`);
}

// ---- C2 eval ----

const c2 = (id, run) =>
  probe(id, async () => {
    const w = await watch(run);
    const violated = hasDirective(w.seen, "script-src");
    if (w.error === null) return { result: "allowed", details: `returned ${String(w.outcome)}; ${describeAll(w.seen)}` };
    return { result: violated ? "blocked" : "failed-other", details: `${errorText(w.error)}; script-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  });

// ---- C3 requests ----

const fetchOf = (url) => async () => {
  const response = await fetch(url);
  return `status ${response.status}, ${(await response.text()).length} characters`;
};

const xhrOf = (url) => () =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.onload = () => resolve(`status ${request.status}, ${request.responseText.length} characters`);
    request.onerror = () => reject(new Error("XMLHttpRequest error event"));
    request.onabort = () => reject(new Error("XMLHttpRequest abort event"));
    request.ontimeout = () => reject(new Error("XMLHttpRequest timeout event"));
    request.open("GET", url);
    request.send();
  });

async function c3() {
  const blobUrl = URL.createObjectURL(new Blob(["x"], { type: "text/plain" }));
  const targets = [
    ["self", location.href],
    ["blob", blobUrl],
    ["data", "data:text/plain,x"],
  ];
  for (const [name, url] of targets) {
    await probe(`C3-fetch-${name}`, async () => verdict("connect-src", await watch(fetchOf(url)), "request worked"));
    await probe(`C3-xhr-${name}`, async () => verdict("connect-src", await watch(xhrOf(url)), "request worked"));
  }
  URL.revokeObjectURL(blobUrl);
}

// ---- C4 images, font, styles ----

const loadImage = (src) => () =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(`loaded ${image.naturalWidth}x${image.naturalHeight}`);
    image.onerror = () => reject(new Error("image error event"));
    image.src = src;
  });

async function c4() {
  const blobUrl = URL.createObjectURL(new Blob([pixelBytes()], { type: "image/png" }));
  await probe("C4-img-data", async () => verdict("img-src", await watch(loadImage(`data:image/png;base64,${PIXEL_BASE64}`)), "image decoded"));
  await probe("C4-img-blob", async () => verdict("img-src", await watch(loadImage(blobUrl)), "image decoded"));
  await probe("C4-img-file", async () => verdict("img-src", await watch(loadImage("pixel.png")), "image decoded"));
  URL.revokeObjectURL(blobUrl);
  await probe("C4-font", async () => {
    const w = await watch(async () => {
      const face = new FontFace("probe", "url(data:font/woff2;base64,AAAA)");
      try {
        await face.load();
        return "font loaded";
      } catch (error) {
        return `load() rejected: ${errorText(error)} (expected: the bytes are not a font)`;
      }
    });
    const violated = hasDirective(w.seen, "font-src");
    if (w.error !== null) return { result: "failed-other", details: `FontFace failed: ${errorText(w.error)}; ${describeAll(w.seen)}` };
    return { result: violated ? "blocked" : "allowed", details: `font-src violation: ${violated ? "yes" : "no"}; ${String(w.outcome)}; ${describeAll(w.seen)}` };
  });
  await probe("C4-style-element", async () => {
    const color = getComputedStyle(byId("styled")).color;
    return { result: color === "rgb(1, 2, 3)" ? "allowed" : "blocked", details: `computed color ${color}` };
  });
  await probe("C4-style-attribute", async () => {
    const color = getComputedStyle(byId("styled-attr")).color;
    return { result: color === "rgb(4, 5, 6)" ? "allowed" : "blocked", details: `computed color ${color}` };
  });
}

// ---- C5 embedding, base, form ----

const embedProbe = (id, tag, attribute) =>
  probe(id, async () => {
    const w = await watch(() => {
      const element = document.createElement(tag);
      element.setAttribute(attribute, "data:text/plain,x");
      document.body.appendChild(element);
      return element;
    }, 400);
    if (w.outcome) w.outcome.remove();
    const violated = hasDirective(w.seen, "object-src");
    return { result: violated ? "blocked" : "allowed", details: `object-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  });

async function c5() {
  await embedProbe("C5-object", "object", "data");
  await embedProbe("C5-embed", "embed", "src");
  await probe("C5-base", async () => {
    const before = document.baseURI;
    const w = await watch(() => {
      const base = document.createElement("base");
      base.href = "https://example.invalid/";
      document.head.appendChild(base);
      const after = document.baseURI;
      base.remove();
      return after;
    });
    const unchanged = w.outcome === before;
    const violated = hasDirective(w.seen, "base-uri");
    return {
      result: unchanged ? "blocked" : "allowed",
      details: `baseURI before ${before}, after ${String(w.outcome)} (${unchanged ? "unchanged" : "CHANGED"}); base-uri violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}`,
    };
  });
}

// The form probe submits a GET form to this page itself with this field: a load that has it in its query arrived
// through the form, so form-action did not block it. (A data: URL target would measure the browser's block of
// top-level data: navigations instead of form-action.)
const FORM_FIELD = "form-probe";
const arrivedByForm = () => new URLSearchParams(location.search).get(FORM_FIELD) === "1";

/** The form probe may leave the page, so it has its own button, placed below the results table (README: after "Copy results"). */
function addFormProbe() {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = "C5 form (last)";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Run the form probe last (may leave the page)";
  button.addEventListener("click", async () => {
    button.disabled = true;
    record("C5-form", "started", `if this page reloads with ?${FORM_FIELD}=1, the form was submitted: see the row C5-form-arrived there`);
    const form = document.createElement("form");
    form.action = location.pathname;
    form.method = "get";
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = FORM_FIELD;
    field.value = "1";
    form.appendChild(field);
    document.body.appendChild(form);
    const w = await watch(() => form.requestSubmit(), 600);
    const violated = hasDirective(w.seen, "form-action");
    record(
      "C5-form",
      w.error !== null ? "failed-other" : violated ? "blocked" : "allowed",
      `target ${form.action}; form-action violation: ${violated ? "yes" : "no"}; ${w.error === null ? "requestSubmit() returned" : errorText(w.error)}; ${describeAll(w.seen)}${violated ? "" : `; if the page reloads with ?${FORM_FIELD}=1, see C5-form-arrived there`}`,
    );
  });
  section.append(heading, button);
  document.body.appendChild(section);
}

// ---- C6 workers ----

function workerProbe(id, makeWorker, waitMs) {
  return probe(id, async () => {
    const w = await watch(
      () =>
        new Promise((resolve) => {
          let worker;
          try {
            worker = makeWorker();
          } catch (error) {
            resolve(`constructor threw ${errorText(error)}`);
            return;
          }
          worker.onmessage = (event) => resolve(`message ${JSON.stringify(event.data)}`);
          worker.onerror = (event) => resolve(`error event: ${event.message || "(no message)"}`);
          setTimeout(() => resolve("no message and no error within the wait"), waitMs);
        }),
      100,
    );
    const text = String(w.outcome);
    const violated = hasDirective(w.seen, "worker-src");
    const started = text.startsWith("message");
    return { result: started && !violated ? "allowed" : "blocked", details: `${text}; worker-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  });
}

async function c6() {
  const blobUrl = URL.createObjectURL(new Blob(["postMessage('pong')"], { type: "text/javascript" }));
  await workerProbe("C6-blob-worker", () => new Worker(blobUrl), 2000);
  URL.revokeObjectURL(blobUrl);
  await workerProbe("C6-data-worker", () => new Worker("data:text/javascript,postMessage(1)"), 1000);
}

// ---- C7 WebAssembly and gzip, C8 data block ----

async function c7() {
  await probe("C7-wasm-compile", async () => {
    const w = await watch(async () => {
      const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      return `compiled, ${WebAssembly.Module.exports(module).length} exports`;
    });
    const violated = hasDirective(w.seen, "script-src");
    if (w.error === null) return { result: "allowed", details: `${String(w.outcome)}; script-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
    return { result: "blocked", details: `${errorText(w.error)}; script-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  });
  await probe("C7-gzip", async () => {
    const binary = atob(byId("gz").textContent.trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const all = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(all);
    return { result: text === "restlos feasibility" ? "pass" : "fail", details: `${bytes.length} gzip bytes unpacked to "${text}"` };
  });
}

const c8 = () =>
  probe("C8-json-block", async () => {
    const data = JSON.parse(byId("data").textContent);
    return { result: data.ok === true ? "pass" : "fail", details: `parsed ${JSON.stringify(data)}` };
  });

// ---- K1, K2, K3 keys ----

let k3Started = false;
const keyCounts = new Map(); // row prefix -> presses so far
const answerRows = new Set(); // observe rows already created

function offerRow(id, question) {
  if (answerRows.has(id)) return;
  answerRows.add(id);
  observe(id, question);
}

function userActivation() {
  const activation = navigator.userActivation;
  return activation === undefined ? "navigator.userActivation not available" : `userActivation isActive ${activation.isActive}, hasBeenActive ${activation.hasBeenActive}`;
}

function onKey(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  const letter = key === "s" || event.code === "KeyS" ? "s" : key === "o" || event.code === "KeyO" ? "o" : null;
  if (letter === null) return;
  const prefix = k3Started ? `K3-received-ctrl-${letter}` : letter === "s" ? "K1-received" : "K2-received";
  const count = (keyCounts.get(prefix) ?? 0) + 1;
  keyCounts.set(prefix, count);
  event.preventDefault();
  const activationBefore = userActivation();
  let clicked = "";
  if (letter === "o") {
    try {
      byId("hidden-file").click();
      clicked = "; input.click() returned without throwing";
    } catch (error) {
      clicked = `; input.click() threw ${errorText(error)}`;
    }
    clicked += `; userActivation after click(): ${userActivation()}`;
  }
  record(
    `${prefix}-${count}`,
    "received",
    `key "${event.key}" code ${event.code} ctrl ${event.ctrlKey} meta ${event.metaKey} shift ${event.shiftKey} alt ${event.altKey} repeat ${event.repeat}; cancelable ${event.cancelable}; preventDefault() called, defaultPrevented ${event.defaultPrevented}; userActivation before click(): ${activationBefore}${clicked}`,
  );
  if (k3Started) return; // the K3 rows were offered when K3 started
  if (letter === "s") offerRow("K1-dialog", "Did the browser's own save dialog appear?");
  else {
    offerRow("K2-picker", "Did a file picker appear?");
    offerRow("K2-browser-open", "Did the browser's own open dialog appear?");
  }
}

function startK3() {
  if (k3Started) return;
  k3Started = true;
  record("K3-start", "started", `${new Date().toISOString()}: from now on the key rows are K3-received-*; no such row after pressing a key means the page got no key event`);
  offerRow("K3-dialog", "Did the browser's own save dialog appear (Ctrl+S)?");
  offerRow("K3-picker", "Did a file picker appear (Ctrl+O)?");
  offerRow("K3-browser-open", "Did the browser's own open dialog appear (Ctrl+O)?");
}

function wireKeys() {
  window.addEventListener("keydown", onKey);
  byId("k3-start").addEventListener("click", startK3);
  const input = byId("hidden-file");
  let picks = 0;
  let cancels = 0;
  input.addEventListener("change", () => {
    picks += 1;
    record(`K2-picked-${picks}`, "picked", Array.from(input.files, (file) => `${file.name} (${file.size} bytes)`).join("; ") || "(no file)");
    input.value = "";
  });
  input.addEventListener("cancel", () => {
    cancels += 1;
    record(`K2-cancel-${cancels}`, "cancelled", "the file picker was closed without a choice");
  });
}

// ---- K4 drop ----

function wireDrop() {
  const zone = byId("drop-zone");
  const caught = [];
  record("K4", "waiting", "drop a file outside the zone; if this page navigates away instead, the listener failed");
  document.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? [], (file) => `${file.name} (${file.size} bytes)`);
    const inside = event.target instanceof Node && zone.contains(event.target);
    const entry = `${inside ? "inside the zone" : "outside the zone"}, target ${event.target instanceof Element ? event.target.tagName : "?"}, files: ${files.join("; ") || "(none)"}`;
    caught.push(entry);
    record(`K4-drop-${caught.length}`, "caught", entry);
    record("K4", `caught ${caught.length} drop(s)`, "the page stayed; see the K4-drop rows");
  });
}

// ---- P1 Pages policy (http: only) ----

const manifestFetches = []; // times the service worker reported serving manifest.webmanifest
const manifestFetchDetails = () =>
  manifestFetches.length === 0
    ? "the service worker did not report serving manifest.webmanifest (only a load served through the service worker can report it; Firefox desktop does not fetch manifests)"
    : manifestFetches.map((time, i) => `${i + 1}. ${time}`).join("; ");

// Must be wired at the start of main: the manifest is requested while the page loads, long before p1() runs.
function wireManifestMessages() {
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type !== "manifest-fetched") return;
    manifestFetches.push(`${event.data.time} ${event.data.url}`);
    record("P1-manifest-fetched", `${manifestFetches.length} request(s)`, manifestFetchDetails());
  });
  navigator.serviceWorker?.startMessages();
}

async function p1() {
  record("P1-context", location.protocol, `origin ${location.origin}, isSecureContext ${isSecureContext}, serviceWorker ${"serviceWorker" in navigator ? "present" : "missing"}`);
  observe("P1-offline", "Did the page load with the server stopped?");
  await probe("P1-controller", async () => {
    const controller = navigator.serviceWorker?.controller;
    return { result: controller ? "controlled" : "not controlled", details: controller ? `controller script ${controller.scriptURL}` : "this load was not served through a service worker (expected on the first load)" };
  });
  await probe("P1-service-worker", async () => {
    const w = await watch(
      async () => {
        const registration = await navigator.serviceWorker.register("sw.js");
        const ready = await Promise.race([navigator.serviceWorker.ready, sleep(10000).then(() => null)]);
        if (ready === null) throw new Error("timeout: navigator.serviceWorker.ready did not resolve within 10 s");
        return `scope ${registration.scope}`;
      },
      200,
      15000,
    );
    const violated = hasDirective(w.seen, "worker-src");
    if (w.error === null) return { result: "allowed", details: `${String(w.outcome)}; worker-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
    return { result: violated ? "blocked" : "failed-other", details: `${errorText(w.error)}; worker-src violation: ${violated ? "yes" : "no"}; ${describeAll(w.seen)}` };
  });
  await sleep(1500);
  await probe("P1-manifest", async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const seen = violations.filter((v) => directiveOf(v) === "manifest-src");
    return {
      result: seen.length === 0 ? "no violation" : "violation",
      details: `link element ${link ? `present (${link.getAttribute("href")})` : "ABSENT"}; manifest-src violations: ${seen.length}; ${describeAll(seen)}; no violation does not prove the manifest was fetched: Firefox desktop does not fetch manifests at all, and P1-manifest-fetched (only on a load served through the service worker) and P1-manifest-devtools show whether the browser requested it`,
    };
  });
  record("P1-manifest-fetched", manifestFetches.length === 0 ? "not seen" : `${manifestFetches.length} request(s)`, manifestFetchDetails());
  observe("P1-manifest-devtools", "Chromium only: DevTools, Application, Manifest (opening it forces the fetch). Does it show the name \"restlos feasibility\" (Yes) or an error / nothing (No)? Firefox desktop does not fetch manifests: answer No.");
  await probe("P1-controller-after", async () => {
    const controller = navigator.serviceWorker?.controller;
    return { result: controller ? "controlled" : "not controlled", details: "after registration; reload once and see P1-controller to confirm the cache serves the page" };
  });
}

// ---- main ----

async function main() {
  window.onCspViolation = showViolations;
  showViolations();
  if (arrivedByForm()) {
    record("C5-form-arrived", "allowed", `the form navigated (this load's query is ${JSON.stringify(location.search)}); form-action did not block it`);
  }
  if (location.protocol === "http:") wireManifestMessages();
  addFormProbe();
  wireKeys();
  wireDrop();
  await c1();
  await c2Probes();
  await c3();
  await c4();
  await c5();
  await c6();
  await c7();
  await c8();
  if (location.protocol === "http:") await p1();
  showViolations();
  record("done", "done", `all checks finished at ${new Date().toISOString()}; later rows come only from your actions`);
}

async function c2Probes() {
  await c2("C2-eval", () => eval("1 + 1"));
  await c2("C2-new-function", () => new Function("return 1 + 1")());
}

main().catch((error) => {
  record("main-error", "error", `${errorText(error)}; the checks after the failing one did not run`);
  record("done", "done", `the automatic checks ended at ${new Date().toISOString()} with the error in main-error`);
});
