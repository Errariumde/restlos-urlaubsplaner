// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The Node process function the tests use; the project has no @types/node (no new packages).
// For tests only: src/ must not import Node modules (ESLint no-restricted-imports in eslint.config.js).
declare module "node:child_process" {
  export function spawnSync(command: string, args: readonly string[], options: { encoding: "utf8" }): { status: number | null; stdout: string; stderr: string };
}
