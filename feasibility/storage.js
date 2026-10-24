// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T1 (feasibility/README.md): storage and files from file://. Follows results.js in the same inline script.
// Every storage API is touched inside a probe, so a throwing API is recorded and never stops the other checks.
/* global document, navigator, location, window, self, localStorage, indexedDB, crypto, isSecureContext, BroadcastChannel, Blob, URL, setTimeout, DataTransferItem, record, observe, observeText, probe */

const KEY_PREFIX = "feasibility:";
const PATH = location.pathname;
const now = () => new Date().toISOString();
const errorText = (error) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
const list = (items) => (items.length === 0 ? "(none)" : items.join("; "));
const byId = (id) => document.getElementById(id);

// ---- localStorage and IndexedDB helpers (all of them may throw) ----

function lsEntries(prefix) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(prefix)) entries.push([key, localStorage.getItem(key)]);
  }
  return entries;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("feasibility", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("markers");
      request.result.createObjectStore("handles");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("indexedDB.open was blocked"));
  });
}

/** work(store) starts requests and returns a function that reads their results; resolves after the transaction completed. */
async function idbTx(storeName, mode, work) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const finish = work(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(finish());
      tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    });
  } finally {
    db.close();
  }
}

const idbPut = (storeName, key, value) =>
  idbTx(storeName, "readwrite", (store) => {
    store.put(value, key);
    return () => undefined;
  });

const idbGet = (storeName, key) =>
  idbTx(storeName, "readonly", (store) => {
    const request = store.get(key);
    return () => request.result;
  });

const idbDelete = (storeName, key) =>
  idbTx(storeName, "readwrite", (store) => {
    store.delete(key);
    return () => undefined;
  });

const idbEntries = (storeName) =>
  idbTx(storeName, "readonly", (store) => {
    const keys = store.getAllKeys();
    const values = store.getAll();
    return () => keys.result.map((key, i) => [key, values.result[i]]);
  });

const describeEntries = (entries) => list(entries.map(([key, value]) => `${key} = ${String(value).slice(0, 40)}`));

// ---- S1: environment ----

function s1() {
  const lines = [];
  const check = (name, fn) => {
    try {
      lines.push(`${name}: ${fn()}`);
    } catch (error) {
      lines.push(`${name}: throws ${errorText(error)}`);
    }
  };
  check("location.origin", () => JSON.stringify(location.origin));
  check("self.origin", () => JSON.stringify(self.origin));
  check("isSecureContext", () => String(isSecureContext));
  check("localStorage", () => {
    if (typeof localStorage === "undefined") return "missing";
    localStorage.getItem("feasibility:s1");
    return "exists, read ok";
  });
  check("indexedDB", () => (typeof indexedDB === "undefined" ? "missing" : `exists (${typeof indexedDB.open})`));
  check("navigator.storage", () => (navigator.storage === undefined ? "missing" : "exists"));
  check("navigator.locks", () => (navigator.locks === undefined ? "missing" : "exists"));
  check("crypto.subtle", () => (typeof crypto === "undefined" ? "crypto missing" : crypto.subtle === undefined ? "missing" : "exists"));
  return { result: "recorded", details: lines.join("; ") };
}

async function s1Digest() {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([1, 2, 3])));
  return { result: "works", details: `SHA-256 of [1,2,3] starts with ${bytes[0].toString(16)}${bytes[1].toString(16)}` };
}

// ---- S2 and S3: markers and persistence ----

// One connection opened at load and used for the pagehide and crash writes, as the app would write over a connection it holds.
let keptDb = null;

async function openKeptDb() {
  keptDb = await openDb();
  return { result: "open", details: "IndexedDB connection kept for the pagehide and crash writes" };
}

function putKept(storeName, key, value) {
  if (keptDb === null) return idbPut(storeName, key, value);
  const db = keptDb;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

async function s3FoundLocalStorage() {
  const own = localStorage.getItem(`${KEY_PREFIX}marker:${PATH}`);
  const other = lsEntries(`${KEY_PREFIX}pagehide:`).concat(lsEntries(`${KEY_PREFIX}crash:`));
  return { result: own === null ? "no previous marker" : "previous marker found", details: `own marker before this load: ${own}; pagehide and crash values: ${describeEntries(other)}` };
}

async function s3FoundIndexedDb() {
  const own = await idbGet("markers", PATH);
  const entries = (await idbEntries("markers")).filter(([key]) => key.startsWith(`${KEY_PREFIX}pagehide:`) || key.startsWith(`${KEY_PREFIX}crash:`));
  return { result: own === undefined ? "no previous marker" : "previous marker found", details: `own marker before this load: ${own}; pagehide and crash values: ${describeEntries(entries)}` };
}

// The marker value names the load that wrote it, so a later page can tell which of the loads (plain, ?query, #hash) it shares storage with.
const markerValue = () => `${now()} load ${JSON.stringify(location.search + location.hash)}`;

async function writeMarkerLocalStorage() {
  const value = markerValue();
  localStorage.setItem(`${KEY_PREFIX}marker:${PATH}`, value);
  return { result: "written", details: `${PATH} = ${value}` };
}

async function writeMarkerIndexedDb() {
  const value = markerValue();
  await putKept("markers", PATH, value);
  return { result: "written", details: `${PATH} = ${value}` };
}

async function s2SeenLocalStorage() {
  const prefix = `${KEY_PREFIX}marker:`;
  const entries = lsEntries(prefix).map(([key, value]) => `${key.slice(prefix.length)} = ${value}`);
  return { result: `${entries.length} marker(s)`, details: list(entries) };
}

async function s2SeenIndexedDb() {
  const entries = (await idbEntries("markers")).filter(([key]) => !key.startsWith(KEY_PREFIX)).map(([key, value]) => `${key} = ${value}`);
  return { result: `${entries.length} marker(s)`, details: list(entries) };
}

async function scanMarkers() {
  record("S2-location", "recorded", `href: ${location.href}; pathname: ${PATH}; search: ${JSON.stringify(location.search)}; hash: ${JSON.stringify(location.hash)}`);
  await probe("S2-seen-localStorage", s2SeenLocalStorage);
  await probe("S2-seen-indexedDB", s2SeenIndexedDb);
}

async function writeCrashValue() {
  const time = now();
  const key = `${KEY_PREFIX}crash:${PATH}`;
  await probe("S3-crash-write-localStorage", async () => {
    localStorage.setItem(key, time);
    return { result: "written", details: `${key} = ${time}` };
  });
  await probe("S3-crash-write-indexedDB", async () => {
    await putKept("markers", key, time);
    return { result: "written", details: `${key} = ${time} (transaction completed${keptDb === null ? ", new connection" : ", kept connection"})` };
  });
}

function writePageHide() {
  const time = now();
  const key = `${KEY_PREFIX}pagehide:${PATH}`;
  try {
    localStorage.setItem(key, time);
  } catch {
    // nothing can be recorded while the page is going away
  }
  try {
    // starts the transaction on the connection opened at load; nothing is awaited in pagehide
    putKept("markers", key, time).catch(() => undefined);
  } catch {
    // same
  }
}

// ---- S4: capacity ----

const BIG_SIZE = 10485760;

async function capacityLocalStorage() {
  const key = `${KEY_PREFIX}big`;
  const text = "x".repeat(BIG_SIZE);
  try {
    localStorage.setItem(key, text);
    const back = localStorage.getItem(key);
    return { result: "fits", details: `${BIG_SIZE} characters written, read back ${back === null ? "null" : back.length} characters` };
  } finally {
    localStorage.removeItem(key);
  }
}

async function capacityIndexedDb() {
  const key = `${KEY_PREFIX}big`;
  const text = "x".repeat(BIG_SIZE);
  try {
    await idbPut("markers", key, text);
    const back = await idbGet("markers", key);
    return { result: "fits", details: `${BIG_SIZE} characters written, read back ${typeof back === "string" ? back.length : String(back)} characters` };
  } finally {
    await idbDelete("markers", key).catch(() => undefined);
  }
}

async function capacity() {
  await probe("S4-localStorage", capacityLocalStorage);
  await probe("S4-indexedDB", capacityIndexedDb);
  await probe("S4-estimate", async () => {
    const estimate = await navigator.storage.estimate();
    return { result: "recorded", details: `usage ${estimate.usage}, quota ${estimate.quota}` };
  });
  await probe("S4-persisted", async () => ({ result: String(await navigator.storage.persisted()), details: "navigator.storage.persisted()" }));
}

async function persist() {
  await probe("S4-persist", async () => {
    const granted = await navigator.storage.persist();
    return { result: String(granted), details: `navigator.storage.persist() at ${now()}; also answer S4-prompt` };
  });
}

// ---- S5: between tabs ----

const heardBroadcast = [];
const heardStorage = [];
let channel = null;
let releaseLock = null;

function setUpBroadcast() {
  channel = new BroadcastChannel("feasibility");
  channel.onmessage = (event) => {
    const data = event.data;
    heardBroadcast.push(`${data && data.path} (${data && data.type}) at ${now()}`);
    record("S5-broadcast", `heard ${heardBroadcast.length}`, list(heardBroadcast));
    if (data && data.type === "hello") channel.postMessage({ type: "reply", path: PATH });
  };
  channel.postMessage({ type: "hello", path: PATH });
  return { result: "listening", details: `announced ${PATH} at ${now()}` };
}

function setUpStorageEvent() {
  window.addEventListener("storage", (event) => {
    let writer = "";
    if (event.key !== null && event.key.startsWith(`${KEY_PREFIX}marker:`)) writer = event.key.slice(`${KEY_PREFIX}marker:`.length);
    else if (event.key === `${KEY_PREFIX}ping` && event.newValue !== null) writer = String(JSON.parse(event.newValue).path);
    heardStorage.push(`key ${event.key}, changed by ${writer === "" ? "?" : writer}, url ${event.url} at ${now()}`);
    record("S5-storage", `heard ${heardStorage.length}`, list(heardStorage));
  });
  return { result: "listening", details: "storage event listener installed" };
}

const lockHistory = [];
let tryCount = 0;
let queryCount = 0;

async function holdLock() {
  if (releaseLock !== null) return;
  lockHistory.push(`requested at ${now()}`);
  record("S5-lock-hold", "requested", list(lockHistory));
  try {
    await navigator.locks.request("feasibility-plan", () => {
      lockHistory.push(`held at ${now()}`);
      record("S5-lock-hold", "held", list(lockHistory));
      return new Promise((resolve) => {
        releaseLock = resolve;
      });
    });
    lockHistory.push(`released at ${now()}`);
    record("S5-lock-hold", "released", list(lockHistory));
  } catch (error) {
    record("S5-lock-hold", "error", `${errorText(error)}; ${list(lockHistory)}`);
  }
}

async function tryLock() {
  const id = `S5-lock-try-${++tryCount}`;
  await probe(id, async () => {
    const got = await navigator.locks.request("feasibility-plan", { ifAvailable: true }, (lock) => lock !== null);
    return { result: got ? "got the lock" : "not available", details: `ifAvailable at ${now()}` };
  });
}

async function queryLocks() {
  await probe(`S5-lock-query-${++queryCount}`, async () => {
    const state = await navigator.locks.query();
    const text = (items) => JSON.stringify(items.map((item) => ({ name: item.name, mode: item.mode, clientId: item.clientId })));
    return { result: `held ${state.held.length}, pending ${state.pending.length}`, details: `held ${text(state.held)}; pending ${text(state.pending)} at ${now()}` };
  });
}

// ---- S7: files in Chromium ----

let currentHandle = null;
let handleFromKept = false;
const hasPicker = () => typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function";
const NOT_AVAILABLE = { result: "not available", details: "showOpenFilePicker / showSaveFilePicker are missing in this browser" };

const handleInfo = async (handle) => {
  const file = await handle.getFile();
  return `${handle.kind} ${JSON.stringify(handle.name)}, ${file.size} bytes`;
};

function s7Availability() {
  return {
    result: hasPicker() ? "available" : "not available",
    details: `showOpenFilePicker: ${typeof window.showOpenFilePicker}; showSaveFilePicker: ${typeof window.showSaveFilePicker}; DataTransferItem.getAsFileSystemHandle: ${typeof DataTransferItem.prototype.getAsFileSystemHandle}`,
  };
}

async function openFile() {
  if (!hasPicker()) return NOT_AVAILABLE;
  const [handle] = await window.showOpenFilePicker();
  currentHandle = handle;
  handleFromKept = false;
  const info = await handleInfo(handle);
  const permission = await handle.queryPermission({ mode: "readwrite" });
  let kept = "kept in IndexedDB (handles/kept)";
  try {
    await idbPut("handles", "kept", handle);
  } catch (error) {
    kept = `could not keep the handle: ${errorText(error)}`;
  }
  return { result: "opened", details: `${info}; queryPermission readwrite: ${permission}; ${kept}` };
}

async function writeBack() {
  if (!hasPicker()) return NOT_AVAILABLE;
  if (currentHandle === null) return { result: "no handle", details: "open a file, use the kept handle or save a file first" };
  const before = await currentHandle.queryPermission({ mode: "readwrite" });
  const writable = await currentHandle.createWritable();
  const text = `restlos feasibility ${now()}\n`;
  await writable.write(text);
  await writable.close();
  return { result: "written", details: `${JSON.stringify(currentHandle.name)}, ${text.length} characters; queryPermission readwrite before createWritable: ${before}` };
}

async function saveFile() {
  if (!hasPicker()) return NOT_AVAILABLE;
  const handle = await window.showSaveFilePicker({ suggestedName: "Beispiel.rev3.urlaub.json" });
  currentHandle = handle;
  handleFromKept = false;
  const writable = await handle.createWritable();
  const text = `restlos feasibility ${now()}\n`;
  await writable.write(text);
  await writable.close();
  return { result: "saved", details: `chosen name ${JSON.stringify(handle.name)}, ${text.length} characters written` };
}

async function keptHandleQuery() {
  if (!hasPicker()) return NOT_AVAILABLE;
  const handle = await idbGet("handles", "kept");
  if (handle === undefined) return { result: "no kept handle", details: "open a file with showOpenFilePicker first" };
  currentHandle = handle;
  handleFromKept = true;
  const permission = await handle.queryPermission({ mode: "readwrite" });
  return { result: `queryPermission: ${permission}`, details: `${JSON.stringify(handle.name)} read back from IndexedDB at ${now()}` };
}

async function keptHandleUse() {
  if (!hasPicker()) return NOT_AVAILABLE;
  const handle = await idbGet("handles", "kept");
  if (handle === undefined) return { result: "no kept handle", details: "open a file with showOpenFilePicker first" };
  currentHandle = handle;
  handleFromKept = true;
  const query = await handle.queryPermission({ mode: "readwrite" });
  const request = await handle.requestPermission({ mode: "readwrite" });
  return { result: `requestPermission: ${request}`, details: `${await handleInfo(handle)}; queryPermission before: ${query}; also answer S7-every-visit-kept; then click "Write back" (row S7-writeback-kept)` };
}

// ---- S8: reading, dropping, downloading ----

async function describeFiles(files) {
  const lines = [];
  for (const file of files) {
    let read;
    try {
      read = `read ${(await file.text()).length} characters`;
    } catch (error) {
      read = `read failed ${errorText(error)}`;
    }
    lines.push(`${JSON.stringify(file.name)}, ${file.size} bytes, type ${JSON.stringify(file.type)}, ${read}`);
  }
  return list(lines);
}

function download() {
  const blob = new Blob([JSON.stringify({ kind: "feasibility" })], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Beispiel.rev3.urlaub.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { result: "clicked", details: `suggested name Beispiel.rev3.urlaub.json at ${now()}; enter the name the file got in S8-name-default or S8-name-ask` };
}

function setUpDrop() {
  const zone = byId("drop");
  // A file dropped anywhere else must not navigate away from the page and its results.
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => event.preventDefault());
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    const transfer = event.dataTransfer;
    if (transfer === null) return;
    const files = Array.from(transfer.files);
    // getAsFileSystemHandle must be called during the event; the promises are awaited afterwards.
    const handles = Array.from(transfer.items)
      .filter((item) => item.kind === "file")
      .map((item) => (typeof item.getAsFileSystemHandle === "function" ? item.getAsFileSystemHandle() : null));
    void probe("S8-drop", async () => ({ result: `${files.length} file(s)`, details: await describeFiles(files) }));
    void probe("S7-drop", async () => {
      if (typeof DataTransferItem.prototype.getAsFileSystemHandle !== "function") {
        return { result: "not available", details: "DataTransferItem.getAsFileSystemHandle is missing in this browser" };
      }
      const results = await Promise.all(handles);
      const text = results.map((handle) => (handle === null ? "null" : `${handle.kind} ${JSON.stringify(handle.name)}`));
      if (results[0] !== null && results[0] !== undefined) {
        currentHandle = results[0];
        handleFromKept = false;
      }
      return { result: "recorded", details: `getAsFileSystemHandle: ${list(text)}` };
    });
  });
  return { result: "ready", details: "drop zone installed" };
}

// ---- wiring ----

function onClick(id, handler) {
  byId(id).addEventListener("click", () => {
    void handler();
  });
}

function wireButtons() {
  // Real loads of this file: with a query, plain, and (in a new tab, from the plain page) with a hash.
  byId("link-query").href = `${PATH}?query=1`;
  byId("link-plain").href = PATH;
  byId("link-hash").href = `${PATH}#hash`;
  onClick("rescan", scanMarkers);
  onClick("crash-write", writeCrashValue);
  onClick("capacity", capacity);
  onClick("persist", persist);
  onClick("broadcast-ping", () => probe("S5-broadcast-ping", async () => {
    if (channel === null) throw new Error("the BroadcastChannel is not set up");
    channel.postMessage({ type: "ping", path: PATH });
    return { result: "sent", details: `ping from ${PATH} at ${now()}` };
  }));
  onClick("storage-ping", () => probe("S5-storage-ping", async () => {
    localStorage.setItem(`${KEY_PREFIX}ping`, JSON.stringify({ path: PATH, time: now() }));
    return { result: "written", details: `${KEY_PREFIX}ping from ${PATH} at ${now()}` };
  }));
  onClick("lock-hold", holdLock);
  onClick("lock-release", () => {
    if (releaseLock === null) {
      record("S5-lock-release", "nothing to release", "this tab does not hold the lock");
      return;
    }
    releaseLock(); // holdLock records the release time in S5-lock-hold
    releaseLock = null;
  });
  onClick("lock-try", tryLock);
  onClick("lock-query", queryLocks);
  onClick("file-open", () => probe("S7-open", openFile));
  onClick("file-write", () => probe(handleFromKept ? "S7-writeback-kept" : "S7-writeback", writeBack));
  onClick("file-save", () => probe("S7-save", saveFile));
  onClick("file-kept", () => probe("S7-kept-use", keptHandleUse));
  onClick("download", () => probe("S8-download", async () => download()));
  byId("file-input").addEventListener("change", (event) => {
    const files = Array.from(event.target.files);
    void probe("S8-input", async () => ({ result: `${files.length} file(s)`, details: await describeFiles(files) }));
  });
  window.addEventListener("pagehide", writePageHide);
}

async function main() {
  wireButtons();
  observe("S4-prompt", "Did a permission prompt appear?");
  observe("S7-every-visit-write", "After 'Write back' (the first time): was 'Allow on every visit' offered?");
  observe("S7-every-visit-kept", "After 'Use kept handle' (after a reload): was 'Allow on every visit' offered?");
  observeText("S8-name-default", "Firefox default download setting: what name did the downloaded file get?");
  observeText("S8-name-ask", "Firefox with 'Always ask where to save files': what name did the downloaded file get?");
  await probe("S1", s1);
  await probe("S1-crypto-digest", s1Digest);
  // Read what an earlier run left before this load overwrites its own marker.
  await probe("S3-found-localStorage", s3FoundLocalStorage);
  await probe("S3-found-indexedDB", s3FoundIndexedDb);
  await probe("S2-write-localStorage", writeMarkerLocalStorage);
  await probe("S3-db-open", openKeptDb);
  await probe("S2-write-indexedDB", writeMarkerIndexedDb);
  await scanMarkers();
  await probe("S5-broadcast", async () => setUpBroadcast());
  await probe("S5-storage", async () => setUpStorageEvent());
  await probe("S7-available", async () => s7Availability());
  await probe("S7-kept-on-load", keptHandleQuery);
  await probe("S8-drop-zone", async () => setUpDrop());
  record("done", "done", `the load checks finished at ${now()}; later rows come only from your actions`);
}

main().catch((error) => {
  record("main-error", "error", `${errorText(error)}; the checks after the failing one did not run`);
  record("done", "done", `the load checks ended at ${now()} with the error in main-error`);
});
