// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The Vite plugins of the restlos build: the Content Security Policy with the hashes of the inline scripts,
// the output file name and the size limit of the single HTML file (docs/SPEC.md).
import type { Logger, Plugin } from "vite";
import { insertCsp, scriptHashes, standardPolicy, utf8Length } from "./html.ts";

/** The name of the built app. */
export const OUTPUT_FILE = "restlos-urlaubsplaner.html";
/** The largest HTML file the build accepts (600 KB). */
export const MAX_BYTES = 614_400;

/**
 * Runs after vite-plugin-singlefile has inlined the scripts and styles (both `enforce: "post"` with a
 * post-ordered `generateBundle`; this plugin must come after `viteSingleFile()` in the plugin list).
 */
function cspAndSize(): Plugin {
  let logger: Logger | undefined;
  let bytes: number | undefined;
  return {
    name: "restlos:csp-and-size",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      logger = config.logger;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const pages = Object.values(bundle).filter((file) => file.type === "asset" && file.fileName.endsWith(".html"));
        const page = pages[0];
        if (pages.length !== 1 || page?.type !== "asset") {
          this.error(`Expected exactly one HTML file, found ${pages.length}.`);
        }
        if (typeof page.source !== "string") this.error(`${page.fileName} is not text.`);
        if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(page.source)) {
          this.error(`${page.fileName} still loads a script or style file; the CSP must be added after inlining.`);
        }
        const html = insertCsp(page.source, standardPolicy(scriptHashes(page.source)));
        bytes = utf8Length(html);
        // Rolldown doesn't support renaming a bundle entry, so the page is emitted again under its new name.
        delete bundle[page.fileName];
        this.emitFile({ type: "asset", fileName: OUTPUT_FILE, source: html });
      },
    },
    closeBundle() {
      if (bytes === undefined) return;
      const kb = (bytes / 1024).toFixed(1);
      if (bytes > MAX_BYTES) this.error(`${OUTPUT_FILE} is ${kb} KB, over the limit of ${MAX_BYTES / 1024} KB.`);
      logger?.info(`${OUTPUT_FILE}: ${kb} KB of ${MAX_BYTES / 1024} KB`);
    },
  };
}

/** The restlos plugins, to be listed after `svelte()` and `viteSingleFile()`. */
export function restlos(): Plugin[] {
  return [cspAndSize()];
}
