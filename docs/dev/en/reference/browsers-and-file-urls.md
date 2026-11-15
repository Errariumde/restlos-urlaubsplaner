<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Browsers and file URLs

## Supported browsers

- **Firefox:** the current Firefox ESR and the current Firefox.
- **Chrome, Edge and Safari (macOS, iOS):** the two newest versions.

The current Firefox ESR is the baseline for browser features, as the "Browsers" [hard rule](../../../../AGENTS.md#hard-rules) says. `build.target` in `vite.config.ts` is `firefox153` and must name the current ESR. The browsers the end-to-end tests run in are in [Test strategy](test-strategy.md). The browser versions tested from `file://` are in the [feasibility tests](../../../feasibility.md).

## Opened from disk

The app must not `fetch()` a local file. The holiday data and the images, which are the SVG icons, are part of the built page ([Single-file build](architecture.md#single-file-build)).
