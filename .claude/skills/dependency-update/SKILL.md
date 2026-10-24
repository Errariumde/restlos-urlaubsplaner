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
8. Nix dev shell. Dependabot opens a pull request for `flake.lock` once a month, within nixpkgs' release branch. On that pull request (or after `nix flake update` by hand):
   - enter the new shell and note the `playwright-driver` version it prints; set `@playwright/test` to exactly that version;
   - check that npm is still >= 11.10 (the shell warns otherwise);
   - run `npm ci && npm run check && npm run build`;
   - commit `flake.lock` together with the `package.json`/`package-lock.json` change.
   - After a Node or Valgrind update, `npm run perf` fails with "otherEnvironment". Run `npm run perf -- --update`, review the changed counts in the diff, and get the maintainer's approval in the commit message.
   - If CI's "Check the Nix version against flake.lock" step fails, the new nixpkgs ships another Nix. Set `NIX_VERSION` in `.github/actions/nix/action.yml` to that version (`nix eval --raw --inputs-from . nixpkgs#nix.version`) and `NIX_TARBALL_SHA256` to its x86_64-linux tarball hash, taken from two sources that must agree: the `hash=` of the `Linux.x86_64` case in `https://releases.nixos.org/nix/nix-<version>/install` and `https://releases.nixos.org/nix/nix-<version>/nix-<version>-x86_64-linux.tar.xz.sha256`.
   - Moving to the next release branch is done by hand. Once the next branch exists, Dependabot announces it with a pull request that changes the branch in `flake.nix` (usually on 1 December or 1 June), and `npm run nixos-release` warns from the 1st of that month. Don't merge Dependabot's pull request: on a branch of its own, change the branch in `flake.nix` (e.g. `nixos-26.05` → `nixos-26.11`), run `nix flake update`, and handle the result as above; once that is merged, close Dependabot's pull request if it hasn't closed itself. CI fails from the 16th of that month.
