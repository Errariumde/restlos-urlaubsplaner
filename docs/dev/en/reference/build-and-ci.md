<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Build and CI

## Local setup

**Local (NixOS):** a Nix flake with a dev environment (Node.js LTS with npm ≥ 11.10, Typst, Python for the python-holidays reference, Playwright browsers, Firefox ESR for the manual test, Valgrind on Linux for the performance gate). `nix develop`, then `npm ci`, `npm run check`, `npm run build`. `npm run plan -- <file>` prints what the engine reads and computes for a plan file or rule set. `npm run orca` prints the steps of the screen reader check, and `npm run orca -- <log>` checks what Orca said. The flake lock file pins all tools; the README explains the commands for Nix beginners. CI uses a second, smaller shell, `devShells.ci` (`nix develop .#ci`), with only what `check` needs: Node.js, Valgrind and REUSE.

## Workflows

| Workflow | Trigger | Content |
| --- | --- | --- |
| `check` | push to `main`, pull requests; always the full check, without a path filter (a required check whose workflow a path filter skipped stays pending and blocks the merge) | inside `nix develop .#ci`: NixOS release check, `npm ci`, `npm run check` (lint, type check, Vitest, performance gate, the catalog, CSS, reference, citation, spec status and docs style checks, REUSE check); then, as separate steps, the app build with its size check and the gallery build |
| `seed-cache` | pushes to `main` that change `flake.nix`, `flake.lock`, `package-lock.json`, `.npmrc`, the Nix action or the workflow itself; weekly; by hand | the only workflow that writes caches: the Nix tarball, the Nix store cache and the npm cache, each fetched fresh from upstream; a separate read-only job runs the NixOS release check, so a failed weekly run reports an outdated release |
| Dependency Review | pull requests that change the lockfile | GitHub's own `dependency-review-action` reports new packages and known vulnerabilities |

## NixOS release check

**NixOS release check:** `npm run nixos-release` reads the release branch from `flake.lock`. NixOS supports a YY.05 release until 31 December and a YY.11 release until 30 June of the next year; its successor comes out about a month earlier. From the 1st of that last month CI warns that the successor is due; from the 16th, or for a branch that isn't a release branch, it fails, so the project moves while the old release is still supported.

## Caching

- **Nix:** the release tarball of the pinned Nix version (the one the pinned nixpkgs ships) is cached with the version as key and checked against a SHA-256 pinned in `.github/actions/nix/action.yml` before it is installed. The dev shell comes from a `file://` binary cache kept in GitHub's cache, keyed on `flake.lock`, `flake.nix`, the action and the `seed-cache` workflow. `nix copy` keeps cache.nixos.org's signatures in it, so Nix checks every path against the `cache.nixos.org-1` key as it would on download; the shell's own `-env` output is rebuilt. CI also downloads the cheap wrappers that nixpkgs would otherwise build locally (`always-allow-substitutes`), so they too come signed. cache.nixos.org is the fallback on a miss; with a warm cache, the Nix setup needs neither it, releases.nixos.org nor github.com (checked on GitHub's runners on 2026-10-24; the checkout and the actions still come from GitHub). Signatures and the pinned hash detect altered content, not a poisoned cache entry: restoring an entry can write any file the runner can write, before Nix or the hash check looks at it. Only the single writer and the cache scopes keep such entries out (see "Avoid cache poisoning").
- **npm packages:** `~/.npm` is cached with the hash of `package-lock.json` and `.npmrc` as key; `check` restores it and runs `npm ci --prefer-offline`, which checks every package against the `integrity` in the lockfile. Registry access only happens when the lockfile changes.
- **No fetching of external holiday sources in CI:** date-holidays comes from the npm cache, the python-holidays reference is checked in.
- **Dependabot:** Within a release branch Dependabot updates `flake.lock`; once the next release branch exists, it opens a pull request that moves `flake.nix` to it. That pull request is only the notice: the move is made by hand on a branch of its own (dependency update procedure, see also the NixOS release check), and Dependabot's pull request is closed afterwards.
- **No pointless runs:** `concurrency` with `cancel-in-progress` cancels outdated runs of the same branch; no matrix over several Node versions (the app runs in the browser, Node is only for building); short `timeout-minutes`; no automatic retries.

## Workflow security

- Only actions from GitHub itself (`actions/checkout`, `actions/cache`, `actions/dependency-review-action`), each pinned by **commit SHA**, plus the repository's own composite action `.github/actions/nix`; Dependabot keeps the SHAs current.
- `permissions: contents: read` as the default at workflow level.
- `actions/checkout` with `persist-credentials: false`.
- No `pull_request_target` (for public repositories GitHub blocks it by default from 2 November 2026, [workflow execution protections](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)), no secrets, nothing is published to npm.
- **Avoid cache poisoning** (the route of the TanStack attack): caches are written only by the `seed-cache` workflow, which restores nothing, takes everything fresh from upstream and runs no tests, no npm scripts and no pull-request code (only `main`'s flake, the Nix action and `npm ci` without install scripts). Every other workflow sets `cache-mode: read` (Dependency Review: `none`), which GitHub enforces with scoped tokens.
- **Nix:** installed single-user (`--no-daemon`) from the hash-checked tarball. `require-sigs` and `trusted-public-keys` stay at their defaults (only `cache.nixos.org-1`); never `trusted=true`, `--no-check-sigs` or `accept-flake-config`. The installed version must equal the one the pinned nixpkgs ships; otherwise the job fails and names the two values to update.
