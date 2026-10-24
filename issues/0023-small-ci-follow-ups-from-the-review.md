---
status: open
priority: 3
area: build (CI), tests (performance gate)
branch:
created: 2026-10-24
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Small CI follow-ups from the review of branch `ci`

## Problem

The review of branch `ci` (2026-10-24, before the first runs) found minor issues that were left for later. None of them affects what CI checks today; each makes a message less precise, or a rare case harder to diagnose.

## Context

- `.github/workflows/seed-cache.yml`, step "Check the store cache's signatures": it exempts the shell's own `-env` output by matching the name `nix-shell-env`. A `name` on `devShells.ci` would break that; comparing with the target of `$RUNNER_TEMP/ci-profile` (`readlink -f`) wouldn't. It also reports unsigned paths only as annotations; the job summary could list them too.
- `.github/actions/nix/check-version.sh` and `.claude/skills/dependency-update/SKILL.md` (step 8) say "Update `NIX_VERSION`", but `action.yml` sets the version in its `version=` line and derives `NIX_VERSION` from it.
- `scripts/perf.js`: the comment calls `--predictable` "single-threaded". In V8 13.6 it implies only single-threaded garbage collection, which is why `--liftoff-only` is needed as well. `tests/scripts/perf-trace-gc.test.ts` runs `node` from `PATH`; `process.execPath` would pin the binary the gate uses.
- GitHub disables scheduled workflows in a public repository after 60 days without activity. The weekly `seed-cache` run, and with it the weekly NixOS release check, then stops without notice in a quiet period; `check` still runs the release check on every pull request.
- Found by the second review: an `actions/cache` update arrives as two Dependabot pull requests, one per directory in `.github/dependabot.yml` (`/` and `/.github/actions/nix`), unless the `actions` group sets `group-by: dependency-name` (GitHub changelog 2026-02-24); merge them together so the pins don't differ. The tarball cache key holds the version but not the pinned hash, and the npm key doesn't cover `seed-cache.yml`, so a change there isn't seeded afresh until the next key change. The weekly seed runs right at the cache's 7-day eviction age, so after a quiet week `check` may run once without a cache (it still passes through upstream).
- Nix fetches the nixpkgs source in the seed run through GitHub's API without a token. Runners share IP addresses, so the unauthenticated limit (60 requests per hour) can occasionally return 403. If it happens, `access-tokens = github.com=…` with the read-only `GITHUB_TOKEN` in the seed job is the usual remedy, at the cost of the "no token" principle.

## Acceptance criteria

- [ ] The signature check identifies the `-env` output by path, not by name, and lists unsigned paths in the job summary.
- [ ] The version message and the skill name the `version=` line in `action.yml`.
- [ ] The `scripts/perf.js` comment is accurate; the trace-gc test uses `process.execPath`.
- [ ] The SPEC's release-check paragraph mentions the 60-day rule, or the maintainer decides to accept it silently.
- [ ] A 403 from GitHub in the seed run is either handled or documented as the known cause.
- [ ] `actions/cache` updates come as one pull request, or the procedure says to merge both together.
- [ ] The tarball key includes the pinned hash, and the npm key covers what changes the npm cache's content; or the maintainer accepts the gap.

## Notes

- Found by the two independent reviews of branch `ci` on 2026-10-24; their other minor findings were fixed on the branch or ended with the removed experiments.
