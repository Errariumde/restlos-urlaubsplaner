// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The Vite plugins of the restlos build: the engine worker as a string module, the example plan as a data
// block, the Content Security Policy
// with the hashes of the inline scripts, the output file name and the size limit of the single HTML file
// (docs/SPEC.md).
import { build, type Logger, type Plugin, type ResolvedConfig } from "vite";
import { readFile } from "node:fs/promises";
import { insertCsp, insertDataBlock, scriptHashes, standardPolicy, utf8Length } from "./html.ts";

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

/** The module that gives the engine worker's code as a string. */
export const WORKER_MODULE = "virtual:restlos-worker";
const RESOLVED_WORKER_MODULE = `\0${WORKER_MODULE}`;
/** The worker's entry, relative to the project root. */
const WORKER_ENTRY = "src/ui/worker/engine-worker.ts";

/** What would end or confuse the inline `<script>` the worker's code lands in. */
const SCRIPT_BREAKER = /<(?:\/?script|!--)/i;

/**
 * `import source from "virtual:restlos-worker"`: the engine worker bundled into one classic script
 * (format iife, the page's build target), for `new Worker(URL.createObjectURL(new Blob([source])))`.
 * A module worker from a `blob:` URL doesn't start from `file://` in Chromium, and Vite's own inline
 * worker falls back to a `data:` URL, which the CSP blocks (docs/SPEC.md, "Worker").
 */
function engineWorker(): Plugin {
  let root: string | undefined;
  let mode: string | undefined;
  let target: ResolvedConfig["build"]["target"] = false;
  return {
    name: "restlos:engine-worker",
    configResolved(config) {
      root = config.root;
      mode = config.mode;
      target = config.build.target;
    },
    resolveId(id) {
      return id === WORKER_MODULE ? RESOLVED_WORKER_MODULE : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_WORKER_MODULE) return undefined;
      if (root === undefined) this.error("The engine worker is loaded before the config is resolved.");
      const output = await build({
        configFile: false,
        root,
        ...(mode === undefined ? {} : { mode }),
        logLevel: "warn",
        publicDir: false,
        build: {
          target,
          write: false,
          emptyOutDir: false,
          copyPublicDir: false,
          reportCompressedSize: false,
          lib: { entry: WORKER_ENTRY, formats: ["iife"], name: "restlosEngineWorker", fileName: () => "engine-worker.js" },
        },
      });
      const results = Array.isArray(output) ? output : [output];
      const chunks = results.flatMap((result) => ("output" in result ? result.output : [])).filter((file) => file.type === "chunk");
      const chunk = chunks[0];
      if (chunks.length !== 1 || !chunk) this.error(`Expected the engine worker as one chunk, found ${chunks.length}.`);
      if (SCRIPT_BREAKER.test(chunk.code)) this.error("The engine worker's code contains <script or <!--, which would break the page's inline script.");
      for (const moduleId of chunk.moduleIds) {
        if (!moduleId.startsWith("\0")) this.addWatchFile(moduleId);
      }
      return `export default ${JSON.stringify(chunk.code)};`;
    },
  };
}

/** The id of the data block with the built-in example plan; the start screen reads it. */
export const EXAMPLE_BLOCK_ID = "example-plan";
/** The built-in example plan, relative to the project root (docs/SPEC.md, "View example"). */
export const EXAMPLE_FILE = "examples/plans/beispiel-gmbh-2027.urlaub.json";

/**
 * The page with the example plan as the non-executed data block `<script type="application/json"
 * id="example-plan">`. The JSON is written compactly; `insertDataBlock` escapes every `<`, so the text can't
 * end the element. A text that isn't JSON fails the build.
 */
export function embedExample(html: string, text: string): string {
  return insertDataBlock(html, EXAMPLE_BLOCK_ID, JSON.stringify(JSON.parse(text)));
}

/**
 * Embeds the example plan in the page, in the build and on the dev server. It runs before
 * vite-plugin-singlefile inlines the scripts, and the CSP hashes skip the data block (it doesn't execute).
 */
function exampleData(): Plugin {
  let root: string | undefined;
  return {
    name: "restlos:example-data",
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml: {
      order: "post",
      async handler(html) {
        if (root === undefined) throw new Error("The page is transformed before the config is resolved.");
        return embedExample(html, await readFile(`${root}/${EXAMPLE_FILE}`, "utf8"));
      },
    },
  };
}

/** The restlos plugins, to be listed after `svelte()` and `viteSingleFile()`. */
export function restlos(): Plugin[] {
  return [engineWorker(), exampleData(), cspAndSize()];
}
