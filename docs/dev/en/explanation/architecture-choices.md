<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Architecture choices

Recommendation: **Svelte 5** (5.57.2 from 6 October 2026) and **TypeScript**, built with **Vite** and [vite-plugin-singlefile](https://cdn.jsdelivr.net/npm/vite-plugin-singlefile@2.3.3/README.md), which inlines JavaScript and CSS into one HTML file; tested with **Vitest**. The calendar engine is a pure TypeScript module without DOM and without runtime dependencies and can be verified in isolation.
