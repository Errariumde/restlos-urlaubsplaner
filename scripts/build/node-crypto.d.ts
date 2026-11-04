// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The one Node crypto function the build helpers and their tests use; the project has no @types/node.
declare module "node:crypto" {
  interface Hash {
    update(data: string, encoding: "utf8"): Hash;
    digest(encoding: "base64"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
}
