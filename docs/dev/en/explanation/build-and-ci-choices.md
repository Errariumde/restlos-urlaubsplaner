<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Build and CI choices

Everything runs locally with one command. GitHub Actions only runs the same commands, as rarely as possible, with a cache for all downloads and minimal permissions. The facts are in [Build and CI](../reference/build-and-ci.md) and [GitHub settings](../reference/github-settings.md).

## Why

- **One command, locally:** neither the npm registry nor any other server is hit again on every run, and the project stays buildable without GitHub.
- **GitHub Free, public repository:** standard runners are free ([GitHub docs](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)), and GitHub Pages is available ([GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Free doesn't mean unlimited, so runs are still kept sparse.
- **`check` without a path filter:** a required check whose workflow a path filter skipped stays pending and blocks the merge.
- **One Node version:** the app runs in the browser, and Node is only for building.
- **Cancelled outdated runs, short timeouts and no automatic retries:** they avoid pointless runs, so runs stay sparse.
- **One cache writer:** cache poisoning was the route of the TanStack attack. Signatures and the pinned tarball hash detect altered content, not a poisoned cache entry. Restoring an entry can write any file the runner can write, before Nix or the hash check looks at it. Only the single writer and GitHub's cache scopes keep such entries out.
- **A warm cache needs no upstream:** checked on GitHub's runners on 2026-10-24, the Nix setup with a warm cache needed none of cache.nixos.org, releases.nixos.org and github.com. The checkout and the actions still came from GitHub.
- **Fork pull requests after approval:** the approval protects the runners and the caches.
- **Read-only workflow permissions:** least privilege. A workflow requests more only where it needs it.
- **No `pull_request_target`:** for public repositories, GitHub blocks it by default from 2 November 2026 ([workflow execution protections](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)).
- **The ruleset for `main`:** every change goes through `check`. A pull request needs 0 approvals, since a sole maintainer can't approve their own.
- **The ruleset for `v*` tags:** it protects release tags before publication. Published releases are immutable anyway.
- **Rulesets after the first push:** created before it, the pull request rule would block that push.
- **The settings written down:** the repository, or a fork with the same protection, can be set up again without guessing.
- **The NixOS release check:** the successor of a NixOS release comes out about a month before support ends. Failing from the 16th of the last month makes the project move while the old release is still supported.
- **The release check outside `npm run check`:** an old commit checked locally doesn't fail because of today's date. The weekly `seed-cache` run checks the release even without pushes, so a failed scheduled run reports an outdated release.

## Rejected alternatives

- **A path filter on `check`:** the required check would stay pending on pull requests the filter skips.
- **A matrix over several Node versions:** the app runs in the browser, and Node is only for building.
- **Automatic retries:** runs are kept sparse.
- **`pull_request_target`:** GitHub blocks it by default for public repositories.
- **Caches written by every workflow:** only a single writer keeps poisoned entries out.
