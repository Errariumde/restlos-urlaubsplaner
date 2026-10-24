// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The one Node crypto function the feasibility page builder uses; the project has no @types/node (no new packages).
// For scripts and tests only: src/ must not import Node modules (ESLint no-restricted-imports in eslint.config.js).
declare module "node:crypto" {
  export function createHash(algorithm: "sha256"): {
    update(data: string): { digest(encoding: "base64" | "hex"): string };
  };
}
