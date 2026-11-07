// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { restlos, restlosGallery } from "./scripts/build/vite-restlos.ts";

// Mode "gallery" builds the component gallery (dev only) from gallery.html into dist-gallery/, under the
// app's CSP but without its file name and size limit. It is inlined into one file too: the tests open it
// from file://, where Chromium refuses module scripts loaded from separate files (origin "null").
export default defineConfig(({ mode }) => {
  const gallery = mode === "gallery";
  return {
    plugins: [svelte(), viteSingleFile(), ...(gallery ? restlosGallery() : restlos())],
    build: {
      target: "firefox153",
      // Everything is inlined, so the modulepreload polyfill (which calls fetch) has nothing to do.
      modulePreload: { polyfill: false },
      outDir: gallery ? "dist-gallery" : "dist",
      rolldownOptions: { input: gallery ? "gallery.html" : "index.html" },
    },
  };
});
