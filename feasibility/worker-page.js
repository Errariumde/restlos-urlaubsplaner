// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T3 (feasibility/README.md): a worker from file://, and handing the model over to the page. Follows results.js in
// the same inline script. At load: W1, W2 and the setup (the model goes to the worker, not measured), then the row
// "done". The button "Run W3 and W4" measures the handovers and the parse times; each press is one numbered run.
// Clocks: every interval is measured with performance.now() on one side. "Until usable", "in the handler" and the
// ping gaps use the page's clock; the worker's own durations (its preparation, W4 in the worker) use the worker's
// clock and arrive as durations. No time of one thread is subtracted from a time of the other.
/* global document, navigator, performance, setTimeout, clearTimeout, Blob, URL, Worker, MessageChannel, TextEncoder, TextDecoder, crossOriginIsolated, record, observeText, probe */

const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const errorText = (error) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
const setStatus = (text) => {
  byId("status").textContent = text;
};

const WARM_UPS = 1;
const RUNS = 10;
const SETTLE_MS = 200; // idle time before each handover and each parse, outside what is measured
const TAIL_MS = 100; // the ping loop runs on until this long after the model is usable
const START_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 60_000;
const DAYS_SHOWN = 366; // what one year of the calendar shows (W3 d)

// ---- numbers ----

const ms = (value) => `${value.toFixed(1)} ms`;
const inOrder = (list) => `${list.map((value) => value.toFixed(1)).join(", ")} ms`;
function median(list) {
  const sorted = [...list].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const summary = (list) => `median ${ms(median(list))}, max ${ms(Math.max(...list))}`;

function timeoutError(text) {
  const error = new Error(text);
  error.name = "TimeoutError";
  return error;
}
const isTimeout = (error) => error instanceof Error && error.name === "TimeoutError";

// ---- violations on the page ----

const violations = [];
document.addEventListener("securitypolicyviolation", (event) => {
  const where = event.sourceFile ? ` at ${event.sourceFile}:${event.lineNumber}` : "";
  const sample = event.sample ? ` sample "${event.sample}"` : "";
  violations.push(`${event.effectiveDirective || event.violatedDirective} blocked "${event.blockedURI}"${where}${sample} (${event.disposition})`);
  showViolations();
});
function showViolations() {
  record("violations", `${violations.length} violation(s) on the page, in order`, violations.map((text, i) => `${i + 1}. ${text}`).join(" | "));
}
const pageViolations = (from) => (violations.length === from ? "page violations: none" : `page violations: ${violations.slice(from).join("; ")}`);

// ---- the MessageChannel ping loop (Firefox has no Long Tasks API) ----

// Each tick posts the next one, so a gap between two ticks is the time the page's event loop was busy elsewhere.
const ping = { port: null, generation: 0, on: false, lastTick: 0, maxGap: 0, ticks: 0, until: Infinity, reached: null };

function setUpPing() {
  const channel = new MessageChannel();
  channel.port1.onmessage = (event) => {
    if (event.data !== ping.generation) return; // a tick of an earlier loop
    const tick = performance.now();
    ping.maxGap = Math.max(ping.maxGap, tick - ping.lastTick);
    ping.lastTick = tick;
    ping.ticks += 1;
    if (tick >= ping.until && ping.reached !== null) {
      ping.on = false;
      ping.reached();
      return;
    }
    if (ping.on) channel.port2.postMessage(ping.generation);
  };
  ping.port = channel.port2;
}

function startPing() {
  ping.generation += 1;
  ping.on = true;
  ping.maxGap = 0;
  ping.ticks = 0;
  ping.until = Infinity;
  ping.reached = null;
  ping.lastTick = performance.now();
  ping.port.postMessage(ping.generation);
}

function stopPing() {
  ping.on = false;
  ping.generation += 1;
}

/** Lets the loop run until its first tick at or after `until` (which closes every gap before it), then stops it. */
function stopPingAt(until) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stopPing();
      resolve({ maxGap: ping.maxGap, ticks: ping.ticks, stalled: true });
    }, until - performance.now() + 10_000);
    ping.until = until;
    ping.reached = () => {
      clearTimeout(timer);
      ping.reached = null;
      resolve({ maxGap: ping.maxGap, ticks: ping.ticks, stalled: false });
    };
  });
}

// ---- workers ----

/** Starts a worker and waits for its first message ("hello"); the time is the page's, from new Worker to that message. */
function startWorker(url, kind) {
  return new Promise((resolve) => {
    const started = performance.now();
    let worker;
    try {
      worker = kind === "module" ? new Worker(url, { type: "module" }) : new Worker(url);
    } catch (error) {
      resolve({ ok: false, result: "not started", why: `the constructor threw ${errorText(error)}` });
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, result: "timeout", why: `no message and no error event within ${START_TIMEOUT_MS / 1000} s` });
    }, START_TIMEOUT_MS);
    worker.onmessage = (event) => {
      const arrived = performance.now();
      clearTimeout(timer);
      resolve({ ok: true, worker, ms: arrived - started, hello: event.data });
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, result: "not started", why: `error event: ${event.message || "(no message)"}` });
    };
  });
}

let nextSeq = 0;
let strays = 0;

/**
 * One request at a time to `worker`. The reply is handled in the worker's message handler, whose first statement
 * takes the time; `receive(data, timing)` runs inside that handler, so decoding and parsing count as the handler's.
 */
function connect(worker, kind) {
  let waiting = null;
  worker.onmessage = (event) => {
    const entered = performance.now();
    const sinceTick = entered - ping.lastTick;
    const data = event.data; // Chromium deserializes a structured clone here, on the first read of event.data
    if (waiting === null || data === null || typeof data !== "object" || data.seq !== waiting.seq) {
      strays += 1;
      record("stray-replies", String(strays), `replies from the ${kind} worker that no request was waiting for (a request that timed out); last: type ${String(data?.type)}, seq ${String(data?.seq)}`);
      return;
    }
    const current = waiting;
    waiting = null;
    clearTimeout(current.timer);
    if (data.type === "error") {
      current.reject(new Error(`the worker reported ${data.error}`));
      return;
    }
    try {
      current.resolve(current.receive(data, { sent: current.sent, entered, sinceTick }));
    } catch (error) {
      current.reject(error);
    }
  };
  worker.onerror = (event) => {
    if (waiting === null) return;
    const current = waiting;
    waiting = null;
    clearTimeout(current.timer);
    current.reject(new Error(`error event from the worker: ${event.message || "(no message)"}`));
  };
  return (message, { transfer = [], timeoutMs = REQUEST_TIMEOUT_MS, receive = (data) => data } = {}) =>
    new Promise((resolve, reject) => {
      nextSeq += 1;
      const seq = nextSeq;
      const timer = setTimeout(() => {
        if (waiting !== null && waiting.seq === seq) waiting = null;
        reject(timeoutError(`no reply to "${message.type}" within ${timeoutMs / 1000} s`));
      }, timeoutMs);
      waiting = { seq, resolve, reject, receive, timer, sent: 0 };
      waiting.sent = performance.now();
      worker.postMessage({ ...message, seq }, transfer);
    });
}

// ---- W1 ----

async function w1(url, kind) {
  const id = `W1-${kind}`;
  record(id, "running", "");
  const from = violations.length;
  const first = await startWorker(url, kind);
  if (!first.ok) {
    await sleep(200); // late violation events
    record(id, first.result, `${first.why}; ${pageViolations(from)}`);
    return null;
  }
  const more = [];
  const failed = [];
  for (let i = 0; i < 5; i++) {
    const again = await startWorker(url, kind);
    if (again.ok) {
      more.push(again.ms);
      again.worker.terminate();
    } else failed.push(again.why);
  }
  const hello = first.hello ?? {};
  const moreText = more.length === 0 ? "none started" : `${summary(more)}, in order ${inOrder(more)}`;
  record(
    id,
    "started",
    `first start ${ms(first.ms)} from new Worker to its first message (page clock); 5 more starts, each terminated after its first message: ${moreText}${failed.length > 0 ? `; failed: ${failed.join("; ")}` : ""}; in the worker: origin ${String(hello.origin)}, isSecureContext ${String(hello.secure)}, location ${String(hello.href)}; ${pageViolations(from)}`,
  );
  return first.worker;
}

// ---- W2 ----

const W2_PROBES = {
  classic: ["eval", "new-function", "fetch-blob", "importScripts-blob", "wasm-compile"],
  module: ["eval", "new-function", "fetch-blob", "wasm-compile"], // a module worker has no importScripts
};

/** allowed when the action worked; blocked when it failed and a violation was reported; otherwise failed-other. */
function w2Verdict(reply, pageSeen) {
  const violated = reply.seen.length > 0 || pageSeen.length > 0;
  const where = `violations in the worker: ${reply.seen.length === 0 ? "none" : reply.seen.join("; ")}; on the page: ${pageSeen.length === 0 ? "none" : pageSeen.join("; ")}`;
  if (reply.error === null) return { result: "allowed", details: `${reply.outcome}; ${where}` };
  return { result: violated ? "blocked" : "failed-other", details: `${reply.error}; ${where}` };
}

async function w2(request, kind) {
  for (const name of W2_PROBES[kind]) {
    const id = `W2-${kind}-${name}`;
    record(id, "running", "");
    const from = violations.length;
    try {
      const reply = await request({ type: "probe", name }, { timeoutMs: 20_000 });
      await sleep(100); // violation events that reach the page late
      const { result, details } = w2Verdict(reply, violations.slice(from));
      record(id, result, details);
    } catch (error) {
      record(id, isTimeout(error) ? "timeout" : "error", `${errorText(error)}; ${pageViolations(from)}`);
    }
  }
}

// ---- setup (not measured) ----

async function setUpModel(request) {
  record("setup", "running", "");
  const t0 = performance.now();
  const text = byId("model").textContent;
  const t1 = performance.now();
  const bytes = new TextEncoder().encode(text);
  const t2 = performance.now();
  const length = bytes.byteLength;
  const reply = await request({ type: "load", bytes: bytes.buffer }, { transfer: [bytes.buffer] });
  const t3 = performance.now();
  const transferred = bytes.byteLength === 0 ? "yes (the page's buffer is detached)" : `NO, the page's buffer still has ${bytes.byteLength} bytes`;
  record(
    "setup",
    "ready",
    `not one of the checks: W3 starts from the model the worker keeps. Data block ${text.length} characters, read with textContent in ${ms(t1 - t0)}, encoded to ${length} UTF-8 bytes in ${ms(t2 - t1)} (page clock); transferred: ${transferred}; the worker got ${reply.bytes} bytes, decoded them in ${ms(reply.decodeMs)}, parsed in ${ms(reply.parseMs)} and turned positions into a Map in ${ms(reply.mapMs)} (worker clock); ${reply.positions} positions, ${reply.days} day results; ${ms(t3 - t2)} from posting to the reply (page clock)`,
  );
  return {
    text,
    model: `positions a Map of ${reply.positions}, ${reply.days} day results`,
    days: `an Int32Array of ${DAYS_SHOWN * 8} values, first day number ${reply.firstDay}`,
  };
}

// ---- W3 ----

const HOW = {
  a: "(a) the model object posted as is: structured clone, positions arrive as a Map (the worker clones inside postMessage, so its preparation is 0)",
  b: "(b) the model as JSON.stringify text, posted (the string is cloned); the page parses it and turns positions into a Map",
  c: "(c) the JSON text's UTF-8 bytes in a transferred ArrayBuffer; the page decodes them (TextDecoder), parses and turns positions into a Map",
  d: `(d) an Int32Array of 8 values for each of the first ${DAYS_SHOWN} day results, transferred: day number, required.value, evaluation.cost, ownCost, mandatoryCost, remaining, flags (1 inPeriod, 2 closure, 4 whole, 8 holiday), 0; the page uses it as it is`,
};

const describeModel = (model) => {
  const positions = model.read.positions;
  return `positions ${positions instanceof Map ? `a Map of ${positions.size}` : typeof positions}, ${model.plan.days.length} day results`;
};

// Each runs inside the page's message handler; `end` is when the model is usable on the page.
const RECEIVE = {
  a: (data, timing) => {
    const model = data.model;
    const end = performance.now();
    return { ...timing, end, prepareMs: data.prepareMs, check: describeModel(model) };
  },
  b: (data, timing) => {
    const model = JSON.parse(data.text);
    model.read.positions = new Map(model.read.positions);
    const end = performance.now();
    return { ...timing, end, prepareMs: data.prepareMs, check: describeModel(model) };
  },
  c: (data, timing) => {
    const model = JSON.parse(new TextDecoder().decode(data.bytes));
    model.read.positions = new Map(model.read.positions);
    const end = performance.now();
    return { ...timing, end, prepareMs: data.prepareMs, check: describeModel(model) };
  },
  d: (data, timing) => {
    const days = data.days;
    const end = performance.now();
    const kind = days instanceof Int32Array ? "an Int32Array" : typeof days;
    return { ...timing, end, prepareMs: data.prepareMs, check: `${kind} of ${days.length} values, first day number ${days[0]}` };
  },
};

async function handoverOnce(request, how) {
  await sleep(SETTLE_MS);
  startPing();
  let received;
  try {
    received = await request({ type: "send", how }, { receive: RECEIVE[how] });
  } catch (error) {
    stopPing();
    throw error;
  }
  const loop = await stopPingAt(received.end + TAIL_MS);
  return {
    usable: received.end - received.sent,
    handler: received.end - received.entered,
    before: received.sinceTick,
    gap: loop.maxGap,
    ticks: loop.ticks,
    stalled: loop.stalled,
    prepare: received.prepareMs,
    check: received.check,
  };
}

async function w3(request, how, k, expected) {
  const id = (metric) => `W3${how}-${metric}-run${k}`;
  for (const metric of ["usable", "handler", "gap"]) record(id(metric), "running", HOW[how]);
  const runs = [];
  try {
    for (let i = 0; i < WARM_UPS + RUNS; i++) {
      setStatus(`run ${k}: W3 ${how}, ${i < WARM_UPS ? "warm-up" : `measured handover ${i - WARM_UPS + 1} of ${RUNS}`}`);
      runs.push(await handoverOnce(request, how));
    }
  } catch (error) {
    const result = isTimeout(error) ? "timeout" : "error";
    const text = `${errorText(error)}, after ${runs.length} of ${WARM_UPS + RUNS} handovers (the first is the warm-up); ${HOW[how]}`;
    for (const metric of ["usable", "handler", "gap"]) record(id(metric), result, text);
    return;
  }
  const measured = runs.slice(WARM_UPS);
  const pick = (key) => measured.map((run) => run[key]);
  const warmUp = (key) => runs.slice(0, WARM_UPS).map((run) => ms(run[key])).join(", ");
  const series = (key) => `${summary(pick(key))}; ${RUNS} handovers after ${WARM_UPS} warm-up (${warmUp(key)}), in order: ${inOrder(pick(key))}`;
  const checks = [...new Set(runs.map((run) => run.check))];
  const right = checks.length === 1 && checks[0] === expected;
  const received = right ? `every handover received ${expected}` : `WRONG DATA: expected ${expected}, received ${checks.join(" | ")}`;
  const resultOf = (key) => (right ? `median ${ms(median(pick(key)))}` : "wrong data");
  const ticks = pick("ticks");
  const stalled = pick("stalled").filter(Boolean).length;
  record(
    id("usable"),
    resultOf("usable"),
    `${series("usable")}; page clock, from just before postMessage of the request to the end of the page's decoding and parsing; includes the worker's preparation before posting (worker clock: ${summary(pick("prepare"))}); ${HOW[how]}; ${received}`,
  );
  record(
    id("handler"),
    resultOf("handler"),
    `${series("handler")}; page clock, in the page's message handler, from its first statement (before reading event.data) to the end of decoding and parsing. Not included: what the browser does before it calls the handler (Firefox deserializes event.data then); from the ping loop's last tick to the handler's first statement: ${summary(pick("before"))}`,
  );
  record(
    id("gap"),
    resultOf("gap"),
    `${series("gap")}; page clock, the longest gap between two ticks of a MessageChannel ping loop on the page, from the request until ${TAIL_MS} ms after usable: every task that kept the page busy, including deserializing event.data wherever the browser does it, the handler, and garbage collection in that window; ticks per handover: median ${median(ticks)}, min ${Math.min(...ticks)}${stalled > 0 ? `; the ping loop STALLED in ${stalled} handover(s)` : ""}`,
  );
}

// ---- W4 ----

async function w4(request, k, text) {
  const workerId = `W4-worker-run${k}`;
  const pageId = `W4-page-run${k}`;
  record(workerId, "running", "");
  record(pageId, "waiting", "");
  const describe = (times) => `${summary(times.slice(WARM_UPS))}; ${RUNS} parses after ${WARM_UPS} warm-up (${times.slice(0, WARM_UPS).map(ms).join(", ")}), in order: ${inOrder(times.slice(WARM_UPS))}`;
  setStatus(`run ${k}: W4 in the worker`);
  try {
    const reply = await request({ type: "parse", runs: WARM_UPS + RUNS }, { timeoutMs: 180_000 });
    record(
      workerId,
      `median ${ms(median(reply.times.slice(WARM_UPS)))}`,
      `${describe(reply.times)}; worker clock, JSON.parse of the model text in the worker (the data block's text, decoded from the setup bytes), ${SETTLE_MS} ms idle before each; ${reply.days} day results parsed`,
    );
  } catch (error) {
    record(workerId, isTimeout(error) ? "timeout" : "error", errorText(error));
  }
  try {
    const times = [];
    let days = 0;
    for (let i = 0; i < WARM_UPS + RUNS; i++) {
      setStatus(`run ${k}: W4 on the page, parse ${i + 1} of ${WARM_UPS + RUNS} (the page freezes during each)`);
      await sleep(SETTLE_MS);
      const t0 = performance.now();
      days = JSON.parse(text).plan.days.length;
      times.push(performance.now() - t0);
    }
    record(
      pageId,
      `median ${ms(median(times.slice(WARM_UPS)))}`,
      `${describe(times)}; page clock, JSON.parse of the embedded text on the page (how long the page would freeze without a worker), ${SETTLE_MS} ms idle before each; ${days} day results parsed`,
    );
  } catch (error) {
    record(pageId, "error", errorText(error));
  }
}

// ---- the Run button ----

function wireRun(request, model) {
  const button = byId("run");
  let runs = 0;
  let hidden = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hidden = true;
  });
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    runs += 1;
    const k = runs;
    hidden = document.hidden;
    const started = performance.now();
    try {
      for (const how of ["a", "b", "c", "d"]) await w3(request, how, k, how === "d" ? model.days : model.model);
      await w4(request, k, model.text);
    } catch (error) {
      record(`run${k}-error`, "error", `${errorText(error)}; the checks after the failing one did not run`);
    }
    const visible = hidden ? "the tab was HIDDEN during the run, so its times don't count: run again with the tab in the foreground" : "the tab stayed visible";
    record(`done-run${k}`, "done", `run ${k} finished at ${now()} after ${((performance.now() - started) / 1000).toFixed(0)} s; ${visible}`);
    setStatus(`ready: run ${k} done; copy the results, or press Run again for another run`);
    button.disabled = false;
  });
  button.disabled = false;
}

// ---- main ----

async function main() {
  showViolations();
  record("W-threads", String(navigator.hardwareConcurrency), "navigator.hardwareConcurrency: the logical processors (threads) the browser reports");
  observeText("W-cpu", "CPU model (lscpu, 'Model name')");
  await probe("W-policy", () => {
    const content = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "";
    const variant = content === "" ? "no policy" : content.includes("'wasm-unsafe-eval'") ? "pro" : "standard";
    return { result: variant, details: content };
  });
  await probe("W-timer", () => {
    let smallest = Infinity;
    let last = performance.now();
    const until = last + 50;
    while (last < until) {
      const time = performance.now();
      if (time > last) {
        smallest = Math.min(smallest, time - last);
        last = time;
      }
    }
    return {
      result: `${smallest.toFixed(3)} ms`,
      details: `the smallest step of performance.now() on the page within 50 ms: the page's times are multiples of about this; crossOriginIsolated ${String(crossOriginIsolated)}`,
    };
  });
  setUpPing();

  const url = URL.createObjectURL(new Blob([byId("worker-code").textContent], { type: "text/javascript" }));
  const classic = await w1(url, "classic");
  const module = await w1(url, "module");
  const classicRequest = classic === null ? null : connect(classic, "classic");
  const moduleRequest = module === null ? null : connect(module, "module");
  if (classicRequest !== null) await w2(classicRequest, "classic");
  else record("W2-classic", "not run", "the classic worker did not start (W1-classic)");
  if (moduleRequest !== null) await w2(moduleRequest, "module");
  else record("W2-module", "not run", "the module worker did not start (W1-module)");

  // W3 and W4 use the classic worker, or the module worker if only that one started.
  const request = classicRequest ?? moduleRequest;
  if (classicRequest !== null && module !== null) module.terminate();
  let next = "W3 and W4 can't run: no worker started (W1)";
  if (request !== null) {
    setStatus("loading the model into the worker");
    try {
      const model = await setUpModel(request);
      wireRun(request, model);
      next = `press "Run W3 and W4" (${classicRequest !== null ? "classic" : "module"} worker)`;
      setStatus("ready");
    } catch (error) {
      record("setup", isTimeout(error) ? "timeout" : "error", `${errorText(error)}; W3 and W4 can't run`);
      next = "W3 and W4 can't run: the setup failed (row setup)";
    }
  }
  if (byId("run").disabled) setStatus(next);
  record("done", "done", `the automatic checks finished at ${now()}; ${next}`);
}

main().catch((error) => {
  record("main-error", "error", `${errorText(error)}; the checks after the failing one did not run`);
  record("done", "done", `the automatic checks ended at ${now()} with the error in main-error`);
  setStatus("error: see the row main-error");
});
