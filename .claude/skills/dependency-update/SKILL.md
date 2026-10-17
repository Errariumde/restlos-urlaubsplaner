---
name: dependency-update
description: Update npm dependencies and the Nix dev shell (flake.lock) of restlos safely with respect to supply-chain risk. Use when handling Dependabot PRs, npm audit findings or when asked to update packages or nixpkgs.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dependency update

1. Never add new packages without explicit approval. Only packages listed in `docs/SPEC.md` ("Dependencies and supply chain") are allowed.
2. Keep `.npmrc` unchanged (`ignore-scripts=true`, `min-release-age=14`, `save-exact=true`). Run tools via npm scripts, never `npx` (without a TTY it installs missing packages without asking, bypassing the lockfile).
3. Update one group at a time (build, test, runtime). Prefer minor/patch; for majors read the changelog and summarize breaking changes first.
4. `@playwright/test` must equal the `playwright-driver` version of the Nix dev shell; Dependabot ignores it for that reason. Update it only together with `flake.lock` (step 8).
5. After updating, inspect the lockfile diff:
   - new transitive packages → list them and ask;
   - packages with install scripts (`hasInstallScript`) → report.
6. Run `npm ci && npm run check && npm run build`; compare the size of `dist/*.html` with the previous build and report significant changes.
7. Security fixes may bypass the 14-day delay only after explicit approval.
8. Nix dev shell (manual; Dependabot has no Nix support): run `nix flake update` occasionally, e.g. after a nixpkgs point release or when moving to a new release branch (also change the branch in `flake.nix`). Then:
   - enter the new shell and note the `playwright-driver` version it prints; set `@playwright/test` to exactly that version;
   - check that npm is still >= 11.10 (the shell warns otherwise);
   - run `npm ci && npm run check && npm run build`;
   - commit `flake.lock` together with the `package.json`/`package-lock.json` change.
