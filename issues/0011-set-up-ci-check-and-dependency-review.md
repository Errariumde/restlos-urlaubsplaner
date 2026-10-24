---
status: in-progress
priority: 1
area: build, CI
branch: ci
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Set up CI: the `check` workflow and Dependency Review

## Problem

There are no GitHub workflows yet; `npm run check` runs only locally. Without a `check` workflow, the ruleset "pull request and green `check` required" for `main` (spec, "Repository settings on GitHub") can't be switched on, and Dependabot's GitHub Actions ecosystem has no workflows to check. The maintainer decided on 2026-10-18 that the CI branch comes next, after `file-format` and before the version-1 feasibility tests.

## Context

- `docs/SPEC.md`, "Build and CI (GitHub Free and local)": workflows, caching, workflow security.
- `docs/superpowers/specs/2026-10-24-ci-design.md`: the design of 2026-10-24, which replaced setup-node, apt and pip with the Nix dev shell.
- `docs/superpowers/specs/2026-10-17-holiday-engine-design.md`: CI was left out of the engine branches.

## Acceptance criteria

- `.github/workflows/check.yml`: on push to `main` and on pull requests, always the full check (no path filter); inside `nix develop .#ci`: the NixOS release check, `npm ci`, lint, type check, Vitest, the performance gate and the REUSE check. Build and size check are added later with the UI build.
- `devShells.ci` in `flake.nix` holds what `check` needs (Node.js 24, Valgrind, REUSE), so CI uses the same tools as the dev shell.
- Nix is installed single-user from a release tarball checked against a SHA-256 pinned in `.github/actions/nix/action.yml`; its version equals the one the pinned nixpkgs ships, and CI fails with the update steps when they differ.
- `.github/workflows/seed-cache.yml` is the only workflow that writes caches (Nix tarball, `file://` store cache with cache.nixos.org's signatures, npm cache); every other workflow sets `cache-mode: read` or `none`.
- `npm run nixos-release` warns from the 1st and fails from the 16th of the last month of the pinned release's support, and for a branch that isn't a release branch.
- Dependency Review (`actions/dependency-review-action`) on pull requests that change the lockfile.
- Dependabot updates `flake.lock` monthly (`package-ecosystem: nix`).
- Workflow security as in the spec:
  - only actions from GitHub itself, each pinned by full commit SHA, plus the local composite action;
  - `permissions: contents: read` at workflow level;
  - `actions/checkout` with `persist-credentials: false`;
  - no `pull_request_target`, no secrets;
  - `concurrency` with `cancel-in-progress`, short `timeout-minutes`, no retries.
- CI fails, not skips, when Valgrind is missing: `npm run perf` skips only when `CI` is not set (implemented on `file-format`, `scripts/perf.js`); GitHub Actions sets `CI`.
- The experiments of the design (E1–E5, P, T) passed on real runners before the branch is finished.

## Notes

- The maintainer checks the looked-up action SHAs once and switches on the ruleset in the repository settings after the branch is merged.
- `templates`, `e2e` and `release` come with the branches that add templates, the UI and the first release.
- Decisions of 2026-10-24 (maintainer): the Nix dev shell instead of setup-node, apt and pip; the signature-checked `file://` store cache; Nix follows nixpkgs; Dependabot for `flake.lock`; the NixOS release check with failure from the 16th; `check` always in full. Details and reasons: the design doc.
- Performance gate in CI: the original proposal (Valgrind from Ubuntu, merge-base comparison) became a decision rule in the design: if the runner's counts are within ±1 % of the checked-in baseline, CI compares with it; otherwise with the merge base, scaled by the ratio of the two baselines, plus 5 %.
