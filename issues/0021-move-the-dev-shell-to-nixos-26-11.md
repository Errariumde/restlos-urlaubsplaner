---
status: open
priority: 2
area: build (Nix)
branch:
created: 2026-10-24
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Move the dev shell to nixos-26.11

## Problem

`flake.nix` follows `nixos-26.05`, which NixOS supports until 2026-12-31. Its successor 26.11 is due at the end of November 2026 (branch-off planned for 2026-11-16, release for 2026-11-23, nixpkgs#567567). Once `nixos-26.11` exists, Dependabot opens a pull request that moves `flake.nix` to it, probably with its monthly run on 2026-12-01. The maintainer decided (2026-10-24) to take that pull request only as the notice and to make the move by hand. CI warns from 2026-12-01 and fails from 2026-12-16 (`npm run nixos-release`, design decision 7 in `docs/superpowers/specs/2026-10-24-ci-design.md`).

## Context

- `flake.nix`: `inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05"`.
- `.claude/skills/dependency-update/SKILL.md`, step 8: the update procedure.

## Acceptance criteria

- `flake.nix` follows `nixos-26.11`, and `flake.lock` is updated, on a branch of its own (not by merging Dependabot's pull request).
- Dependabot's pull request for `nixos-26.11` is closed once the move is merged (Dependabot may close it itself).
- `@playwright/test` equals the new `playwright-driver` version.
- The Nix version and tarball hash in `.github/actions/nix/action.yml` follow the new nixpkgs.
- If Node or Valgrind changed, `tests/perf/baseline.json` is updated with the maintainer's approval.
- `npm run check` and `npm run nixos-release` pass.

## Notes

- After this, the same move comes every six months: 27.05 is due at the end of May 2027, and CI fails for 26.11 from 2027-06-16.
