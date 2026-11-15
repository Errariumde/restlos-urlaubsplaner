<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Build and CI

The local dev shells and commands, and the GitHub Actions workflows that run the same commands. Tools run only through npm scripts, as the "npm usage" [hard rule](../../../../AGENTS.md#hard-rules) states. The settings that exist only on GitHub are in [GitHub settings](github-settings.md). The reasons are in [Build and CI choices](../explanation/build-and-ci-choices.md).

## Local setup

`flake.nix` defines two dev shells for x86_64-linux, aarch64-linux and aarch64-darwin. `flake.lock` pins nixpkgs and with it every tool of the shells.

- **`devShells.ci`** (`nix develop .#ci`): what `npm run check` needs, and the only shell CI uses. It holds Node.js 24, REUSE and, on Linux, Valgrind.
- **`devShells.default`** (`nix develop`, or direnv through `.envrc`): the packages of `devShells.ci`, plus:
  - Typst;
  - Python 3 with python-holidays, for the python-holidays reference;
  - Firefox ESR, for the manual check against the supported browser baseline;
  - the language servers typescript-language-server, svelte-language-server, tinymist, nixd and vscode-langservers-extracted;
  - git and ripgrep;
  - on Linux, bubblewrap and socat for the Claude Code sandbox.
- **Playwright browsers:** the default shell sets `PLAYWRIGHT_BROWSERS_PATH` to the browsers of nixpkgs' `playwright-driver`, and Playwright downloads none. The `@playwright/test` version follows the "Dependencies" [hard rule](../../../../AGENTS.md#hard-rules).
- **npm version:** `package.json` requires Node.js 24 or later and npm 11.10 or later under `engines`, and `.npmrc` sets `engine-strict`. The default shell's hook prints the `playwright-driver` version and warns when npm is older than 11.10, which ignores `min-release-age`.

| Command | Effect |
| --- | --- |
| `npm ci` | installs the packages from `package-lock.json` |
| `npm run check` | `npm run lint`, `npm run typecheck`, `npm test`, `npm run perf`, then the catalog, CSS, reference (citations and spec status) and docs style checks, then `reuse lint` |
| `npm run build` | writes the app as one HTML file ([single-file build](architecture.md#single-file-build)) |
| `npm run build:gallery` | writes the component gallery |
| `npm run gallery` | serves the component gallery from Vite's dev server |
| `npm run plan -- <file>` | prints what the engine reads and computes for a plan file or rule set |
| `npm run orca` | prints the steps of the screen reader check |
| `npm run orca -- <log>` | checks what Orca said, from its debug log |
| `npm run nixos-release` | the [NixOS release check](#nixos-release-check) |

The test commands, `npm run perf` and `npm run reference:python` are in [Test strategy](test-strategy.md). The README's "Development" section lists `nix develop`, `npm ci`, `npm run check` and `npm run build`.

## Workflows

Every job runs on `ubuntu-24.04`. Every workflow sets `permissions: contents: read`.

| Workflow | Trigger | Content |
| --- | --- | --- |
| `check` (`.github/workflows/check.yml`) | pushes to `main`, every pull request; no path filter | one job `check`: the [Nix action](#caching), then inside `nix develop .#ci` the NixOS release check, `npm ci --prefer-offline` and `npm run check`, then the app build with its size check and the gallery build. It also writes the runner's CPU and image and the perf counts to the run summary. |
| `seed-cache` (`.github/workflows/seed-cache.yml`) | pushes to `main` that change `flake.nix`, `flake.lock`, `package-lock.json`, `.npmrc`, `.github/actions/nix/**` or the workflow itself; weekly (`17 4 * * 1`); `workflow_dispatch` | job `release`: the NixOS release check. Job `seed`: fills the tarball, store and npm caches from upstream where a key is missing, and checks the store cache's signatures. |
| `dependency-review` (`.github/workflows/dependency-review.yml`) | as [Dependencies](dependencies.md#measures-against-supply-chain-attacks) states | GitHub's `dependency-review-action` reports new packages and known vulnerabilities |

| Workflow, job | `cache-mode` | `concurrency` | `timeout-minutes` |
| --- | --- | --- | --- |
| `check`, `check` | `read` | group per ref, `cancel-in-progress: true` | 30 |
| `seed-cache`, `release` | `read` | none | 10 |
| `seed-cache`, `seed` | `write` | group `seed-cache`, `cancel-in-progress: false` | 20 |
| `dependency-review`, `dependency-review` | `none` | group per ref, `cancel-in-progress: true` | 10 |

No workflow has a matrix or automatic retries.

## NixOS release check

`npm run nixos-release` (`scripts/nixos-release.js`, `scripts/nixos-release-status.ts`) reads the release branch from `nodes.nixpkgs.original.ref` in `flake.lock`.

- **Supported:** NixOS supports a YY.05 release until 31 December and a YY.11 release until 30 June of the next year.
- **Warning:** from the 1st of that last month, the check warns that the successor is due.
- **Failure:** from the 16th of that last month, the check fails. It also fails for a branch that is not `nixos-YY.05` or `nixos-YY.11`.
- **Where it runs:** in CI, in the `check` job and in the `release` job of `seed-cache`, not in `npm run check`. On GitHub Actions, warnings and failures are annotations on the run.

## Caching

- **Nix tarball:** the release tarball of the Nix version pinned in `.github/actions/nix/action.yml` is cached with the version as key. The version must be the one the pinned nixpkgs ships. Before it is extracted, the tarball is checked against the SHA-256 pinned in the same file.
- **Dev shell:** it comes from a `file://` binary cache kept in GitHub's cache, keyed on `flake.lock`, `flake.nix`, the Nix action and the `seed-cache` workflow.
  - `nix copy` keeps cache.nixos.org's signatures in it, so Nix checks every path against the `cache.nixos.org-1` key as on download. `seed` fails when a path lacks that signature, except the shell's own `-env` output and content-addressed paths.
  - Every reader rebuilds the shell's `-env` output.
  - `always-allow-substitutes` makes CI download the cheap wrappers that nixpkgs would otherwise build locally, so they too come signed.
  - cache.nixos.org is the fallback on a miss.
- **npm packages:** `~/.npm` is cached with the hash of `package-lock.json` and `.npmrc` as key. `check` restores it and runs `npm ci --prefer-offline`, which checks every package against the `integrity` in the lockfile. The registry is contacted only for packages missing from the restored cache.
- **Holiday sources:** CI fetches none. date-holidays comes through `npm ci`, and the python-holidays reference is checked in.
- **NixOS release branches:** within a release branch, Dependabot updates `flake.lock`. Once the next release branch exists, it opens a pull request that moves `flake.nix` to it. That pull request is only the notice: the move is made by hand on a branch of its own ([dependency update](../howto/dependency-update.md), step 8), and Dependabot's pull request is closed afterwards. The [NixOS release check](#nixos-release-check) sets the deadline.

## Workflow security

- **Actions:** workflows use only actions from GitHub itself (`actions/checkout`, `actions/cache`, `actions/dependency-review-action`) and the repository's own composite action `.github/actions/nix`. Each external action is pinned by full commit SHA, and Dependabot keeps the SHAs current. The [GitHub settings](github-settings.md#settings) enforce both.
- **Permissions:** `permissions: contents: read` is the default at workflow level, and no job asks for more.
- **Checkout:** `actions/checkout` runs with `persist-credentials: false`.
- **Not used:** `pull_request_target`, secrets and publishing to npm (`package.json` is `private`).
- **Cache writes:** only the `seed` job of `seed-cache` writes caches. It restores nothing, takes everything fresh from upstream and runs no tests, no npm scripts and no pull-request code: only the flake, the Nix action and `npm ci` without install scripts. Every other job reads caches or uses none, as `cache-mode` under [Workflows](#workflows) lists. GitHub enforces `cache-mode` with scoped tokens.
- **Nix:**
  - It is installed single-user (`--no-daemon`) from the hash-checked tarball.
  - `require-sigs`, `trusted-public-keys` and `accept-flake-config` stay at their defaults, so only `cache.nixos.org-1` is trusted. Neither `trusted=true` nor `--no-check-sigs` may be set.
  - The global flake registry is off; CI resolves nixpkgs only through `flake.lock`.
  - The installed version must equal the one the pinned nixpkgs ships. Otherwise the job fails and names the two values to update, `NIX_VERSION` and `NIX_TARBALL_SHA256`.
