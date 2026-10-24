// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Shared by every feasibility page (feasibility/README.md); the build concatenates it before the page's own script.
// Collects one row per check in a table and offers "Copy results" as Markdown for the chat.
// A plain script (no import/export): a page can't load modules from file:// under its policy.
/* global document, navigator, location, window */

const resultRows = new Map(); // id -> { result, details, row }
let resultTable = null;

function ensureTable() {
  if (resultTable !== null) return resultTable;
  const section = document.createElement("section");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copy results";
  button.addEventListener("click", () => {
    copyText(resultsMarkdown());
  });
  resultTable = document.createElement("table");
  resultTable.border = "1";
  const head = resultTable.createTHead().insertRow();
  for (const title of ["Id", "Result", "Details"]) {
    const cell = document.createElement("th");
    cell.textContent = title;
    head.appendChild(cell);
  }
  resultTable.createTBody();
  section.append(button, resultTable);
  document.body.appendChild(section);
  return resultTable;
}

function rowFor(id) {
  const existing = resultRows.get(id);
  if (existing !== undefined) return existing;
  const row = ensureTable().tBodies[0].insertRow();
  for (let i = 0; i < 3; i++) row.insertCell();
  row.cells[0].textContent = id;
  const entry = { result: "", details: "", row };
  resultRows.set(id, entry);
  return entry;
}

/** One table row; a second call with the same id replaces it. result: "pass", "fail", "blocked", "allowed", "error" or text. */
function record(id, result, details) {
  const entry = rowFor(id);
  entry.result = String(result);
  entry.details = details === undefined ? "" : String(details);
  entry.row.cells[1].textContent = entry.result;
  entry.row.cells[2].textContent = entry.details;
}

/** A row with Yes/No buttons for what only a person sees (a dialog, a prompt). */
function observe(id, question) {
  const entry = rowFor(id);
  entry.row.cells[1].textContent = "";
  entry.row.cells[2].textContent = question;
  for (const answer of ["Yes", "No"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = answer;
    button.addEventListener("click", () => {
      entry.row.cells[2].textContent = "";
      record(id, answer, question);
    });
    entry.row.cells[1].appendChild(button);
  }
}

/** A row with a text field (for example, the name a download got); the answer is recorded on Enter or when the field loses focus. */
function observeText(id, question) {
  const entry = rowFor(id);
  entry.row.cells[2].textContent = question + " ";
  const input = document.createElement("input");
  input.type = "text";
  const save = () => {
    record(id, input.value, question);
    entry.row.cells[2].textContent = question;
  };
  input.addEventListener("change", save);
  entry.row.cells[1].appendChild(input);
}

/** Runs fn (sync or async) and records its returned { result, details }; a thrown error is recorded as "error". */
async function probe(id, fn) {
  try {
    const outcome = await fn();
    record(id, outcome.result, outcome.details);
  } catch (error) {
    const name = error instanceof Error ? error.name : "thrown";
    const message = error instanceof Error ? error.message : String(error);
    record(id, "error", `${name}: ${message}`);
  }
}

const escapeCell = (text) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function resultsMarkdown() {
  const file = decodeURIComponent(location.pathname + location.search + location.hash);
  const lines = [
    `## ${file}`,
    "",
    `User agent: ${navigator.userAgent}`,
    `Date: ${new Date().toLocaleString()}`,
    "",
    "| Id | Result | Details |",
    "| --- | --- | --- |",
  ];
  for (const [id, entry] of resultRows) {
    lines.push(`| ${escapeCell(id)} | ${escapeCell(entry.result)} | ${escapeCell(entry.details)} |`);
  }
  return lines.join("\n");
}

function copyText(text) {
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    let copied;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    if (copied) area.remove(); // otherwise the text stays selected for a manual copy
  };
  if (navigator.clipboard === undefined || typeof navigator.clipboard.writeText !== "function") {
    fallback();
    return;
  }
  navigator.clipboard.writeText(text).catch(fallback);
}

window.record = record;
window.observe = observe;
window.observeText = observeText;
window.probe = probe;
