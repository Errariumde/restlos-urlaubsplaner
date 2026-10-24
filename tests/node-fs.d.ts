// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The few Node file functions the tests use; the project has no @types/node (no new packages).
// For tests only: src/ must not import Node modules (ESLint no-restricted-imports in eslint.config.js).
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string): string[];
}
