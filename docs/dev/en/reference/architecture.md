<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Architecture

## Engine

All outputs (UI) read the same computed state; no output recalculates costs itself.

## Date arithmetic

The engine calculates only with calendar days as integer day numbers (days since a fixed reference date), never with JavaScript `Date` and the local time zone. This prevents shifts by one day around daylight saving time changes; a lint rule forbids `Date` in the engine module.

## Worker

The engine runs in a **classic** Web Worker started from a `blob:` URL. A module worker from a `blob:` URL doesn't start from `file://` in Chromium, and Vite's inline-worker wrapper falls back to a `data:` URL, which the CSP blocks. So the UI branch writes its own small wrapper. The worker keeps the model (see Sharing and validation, Loading). Data to and from the worker are strings, plain objects or ArrayBuffers, never Blobs (Safari, [WebKit bug 258443](https://bugs.webkit.org/show_bug.cgi?id=258443)). The worker inherits the page's CSP: no `eval`, no `fetch`.

Opening runs in a Web Worker, so the page stays responsive. **The model stays in the worker; the page receives only what it shows.** With the largest file within the limits, the model is 13.2 MB as JSON. Handing all of it to the page blocked the page for 69–152 ms per handover (median, all three tested browsers, reference machine, 2026-11-02), with single handovers up to 250 ms in the Firefox ESR. Handing over what one year of the calendar shows took 0.3–2 ms.

## Size budget

Standard HTML under 600 KB including the DE/EN catalogs.
