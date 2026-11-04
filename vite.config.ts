// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { restlos } from "./scripts/build/vite-restlos.ts";

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), viteSingleFile(), restlos()],
  build: {
    target: "firefox153",
    // The gallery (mode "gallery") is a separate build; until it has its own page it builds the app.
    outDir: mode === "gallery" ? "dist-gallery" : "dist",
    rolldownOptions: { input: "index.html" },
  },
}));
