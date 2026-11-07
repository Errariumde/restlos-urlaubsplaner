// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

const BROWSER_ONLY = "The engine and the app run in the browser; Node modules are for scripts and tests only.";
const NODE_MODULES = ["fs", "path", "os", "child_process", "http", "https", "net"];

export default defineConfig(
  { ignores: ["coverage/", "dist/", "dist-gallery/", "playwright-report/", "test-results/", ".direnv/", ".superpowers/"] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  svelte.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // Both programs: the engine, scripts and tests (tsconfig.json) and the UI, e2e tests and build
        // configs with the DOM types (tsconfig.ui.json).
        project: ["./tsconfig.json", "./tsconfig.ui.json"],
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: tseslint.parser, svelteConfig } },
    // TypeScript checks undefined names (typescript-eslint turns the rule off for .ts files the same way).
    rules: { "no-undef": "off" },
  },
  {
    // Svelte state modules (runes in plain TypeScript files).
    files: ["**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser, svelteConfig } },
  },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine counts calendar days as integer day numbers (docs/SPEC.md, Date arithmetic)." },
      ],
    },
  },
  {
    files: ["src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: NODE_MODULES.map((name) => ({ name, message: BROWSER_ONLY })),
          patterns: [{ group: ["node:*", ...NODE_MODULES.map((name) => `${name}/*`)], message: BROWSER_ONLY }],
        },
      ],
    },
  },
);
