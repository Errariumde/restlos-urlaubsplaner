<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Architecture choices

restlos is written in Svelte 5 and TypeScript, built with Vite and vite-plugin-singlefile into one HTML file, and tested with Vitest. The calendar engine is a pure TypeScript module without DOM and without runtime dependencies. It runs in a classic Web Worker started from a `blob:` URL, keeps the model there and hands the page only what it shows. The facts are in [Architecture](../reference/architecture.md) and [Test strategy](../reference/test-strategy.md).

## Why

- **One HTML file:** vite-plugin-singlefile inlines JavaScript and CSS into the page, so the app is a single file that opens from disk.
- **A pure engine:** without DOM and without dependencies it can be verified in isolation, in Node, with Vitest.
- **Integer day numbers:** calendar days never pass through JavaScript `Date` and the local time zone. That prevents shifts by one day around daylight saving time changes.
- **A worker:** opening a file and computing the plan run off the page's thread, so the page stays responsive.
- **A classic worker from a `blob:` URL:** of the worker kinds tried, only this one starts from `file://` in Firefox and Chromium under the page's Content Security Policy ([Web Worker from `file://`](../../../feasibility.md#web-worker-from-file)).
- **The model stays in the worker:** with the largest file within the limits, the model is about 13.2 MB as JSON. Measured on 2026-11-02 on the reference machine, handing all of it to the page blocked the page for 69–152 ms per handover. These are medians in all three tested browsers; single handovers reached 250 ms in the Firefox ESR. Handing over what one year of the calendar shows took 0.3–2 ms.
- **No Blobs in messages:** Safari can't pass a Blob between page and worker ([WebKit bug 258443](https://bugs.webkit.org/show_bug.cgi?id=258443)). Strings, plain objects and ArrayBuffers pass in every browser.
- **Instruction counts for performance:** they depend only on the code and its input, where wall-clock times depend on the machine. A run that collects garbage fails, because when a collection runs depends on where the repository is checked out.
- **One baseline for CI and local runs:** on GitHub's runners the counts agreed with the local ones within 0.5 %, on AMD and Intel CPUs alike (measured 2026-10-24).

## Rejected alternatives

- **A module worker from a `blob:` URL:** it doesn't start from `file://` in Chromium.
- **Vite's inline worker:** its wrapper falls back to a `data:` URL, which the Content Security Policy blocks. restlos builds its own small wrapper instead.
- **Handing the whole model to the page:** every handover would block the page for 69–152 ms, against 0.3–2 ms for what one year shows.
- **Blobs between page and worker:** they fail in Safari.
