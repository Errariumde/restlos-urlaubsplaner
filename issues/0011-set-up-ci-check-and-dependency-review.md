---
status: next
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
- `docs/superpowers/specs/2026-10-17-holiday-engine-design.md`: CI was left out of the engine branches.
- `.github/dependabot.yml` already watches `npm` and `github-actions`.

## Acceptance criteria

- `.github/workflows/check.yml`: on push to `main` and on pull requests, only for changes to code, data, lockfile or workflows (path filter); `npm ci`, lint, type check, Vitest and the REUSE check. Build and size check are added later with the UI build.
- Dependency Review (`actions/dependency-review-action`) on pull requests that change the lockfile.
- Workflow security as in the spec:
  - only actions from GitHub itself, each pinned by full commit SHA;
  - `permissions: contents: read` at workflow level;
  - `actions/checkout` with `persist-credentials: false`;
  - no `pull_request_target`, no secrets;
  - `concurrency` with `cancel-in-progress`, short `timeout-minutes`, no retries.
- Caching as in the spec:
  - the npm cache with `actions/cache/restore` and `actions/cache/save`, keyed on the hash of `package-lock.json`, saved only on `main`;
  - `reuse` installed with `pip install --require-hashes -r` from a checked-in, hash-pinned requirements file, with its pip cache keyed on that file.
- The Node.js version in CI matches the dev shell (Node 24, npm ≥ 11.10); `.npmrc` (`ignore-scripts`, `min-release-age`) applies unchanged.

## Notes

- The maintainer checks the looked-up action SHAs once and switches on the ruleset in the repository settings after the branch is merged.
- `templates`, `e2e` and `release` come with the branches that add templates, the UI and the first release.
- Timing tests: the two 10 MiB "at the limits" tests in `tests/engine/file/read-plan.test.ts` assert `readFile` under 1,000 ms. On an i7-8650U they take 600–730 ms, so a slower runner may fail them. Most of the time is the base cost of reading 85,000–100,000 entries. If they flake, see issue 0015 for the options; don't loosen the bound silently.
