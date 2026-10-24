---
status: open
priority: 3
area: build (CI)
branch:
created: 2026-10-24
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Move the CI runners to ubuntu-26.04

## Problem

Every workflow runs on `ubuntu-24.04`, pinned on branch `ci` so that all jobs of the first CI runs use the same image while GitHub moves `ubuntu-latest` from 24.04 to 26.04 (gradually, 19 October to 19 November 2026). The pin has to be moved on by hand; GitHub announces no retirement date for 24.04 yet.

## Context

- `runs-on: ubuntu-24.04` in `.github/workflows/check.yml`, `seed-cache.yml` and `dependency-review.yml`.
- The perf gate's counts depend on the CPU and, through the kernel, possibly on the image; `check` writes the CPU model and the image (`$ImageOS $ImageVersion`) to its summary.
- Changes on 26.04: kernel 7.0, systemd 259, updated and removed preinstalled tools. CI uses only basic tools from the image (`bash`, coreutils, `sed`, `grep`, `awk`, `curl`, `xz`, `tar`, `sudo`, `lscpu`); everything else comes from the Nix dev shell.
- Source: [GitHub changelog, 2026-09-17](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration), [runner-images #14747](https://github.com/actions/runner-images/issues/14747).

## Acceptance criteria

- [ ] All workflows use `ubuntu-26.04`.
- [ ] `seed-cache` and `check` pass on it; the Nix install and `nix develop .#ci` behave as on 24.04.
- [ ] The perf gate's counts on 26.04 are within the gate's tolerance of `tests/perf/baseline.json`, or the difference is explained before anything else changes.
- [ ] The design doc (`docs/superpowers/specs/2026-10-24-ci-design.md`, decision 1) names the new image.

## Notes

- Found in the review of branch `ci` (2026-10-24). Worth doing together with issue 0021 if both fall into December.
