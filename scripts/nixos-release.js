// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The NixOS release check (scripts/nixos-release-status.ts): reads the release branch from flake.lock and fails when the
// project is overdue to move to the next release. Run by CI (check and seed-cache), not by npm run check, so that
// an old commit checked locally doesn't fail because of today's date.
// Usage: npm run nixos-release
/* global console, process */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseStatus } from "./nixos-release-status.ts";

const lock = JSON.parse(readFileSync(join(import.meta.dirname, "..", "flake.lock"), "utf8"));
const ref = lock?.nodes?.nixpkgs?.original?.ref ?? "(none)";
const status = releaseStatus(ref, new Date().toISOString().slice(0, 10));

// On GitHub Actions, warnings and failures also become annotations on the run.
const actions = process.env.GITHUB_ACTIONS === "true";
const warn = (text) => console.log(actions ? `::warning title=NixOS release::${text}` : `WARN ${text}`);
const fail = (text) => {
  console.log(actions ? `::error title=NixOS release::${text}` : `FAIL ${text}`);
  process.exitCode = 1;
};

switch (status.kind) {
  case "supported":
    console.log(`nixos-release: NixOS ${status.release} is supported until ${status.endOfSupport}.`);
    break;
  case "successorDue":
    warn(
      `nixos-release: NixOS ${status.successor} is due; ${status.release} is supported until ${status.endOfSupport}. ` +
        `Move flake.nix to nixos-${status.successor}.`,
    );
    break;
  case "overdue":
    fail(
      `nixos-release: the project moves to NixOS ${status.successor} by ${status.endOfSupport.slice(0, 8)}16; ` +
        `${status.release} is supported only until ${status.endOfSupport}. Move flake.nix to nixos-${status.successor} and run nix flake update.`,
    );
    break;
  case "notARelease":
    fail(`nixos-release: flake.lock follows "${status.ref}", which is not a NixOS release branch (nixos-YY.05 or nixos-YY.11).`);
    break;
}
