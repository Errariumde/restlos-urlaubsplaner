// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const BROWSER_ONLY = "The engine and the app run in the browser; Node modules are for scripts and tests only.";
const NODE_MODULES = ["fs", "path", "os", "child_process", "http", "https", "net"];

export default defineConfig(
  { ignores: ["coverage/", "dist/", ".direnv/", ".superpowers/"] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
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
