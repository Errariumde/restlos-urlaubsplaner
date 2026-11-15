<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# GitHub settings

Settings that exist only on GitHub are listed here, so the repository (or a fork with the same protection) can be set up again without guessing. They are set once by hand; labels as of October 2026.

## Settings

| Settings → | Setting | Reason |
| --- | --- | --- |
| General → Features | Issues on; Wikis, Projects and Discussions off; pull requests open to everyone | no channel for general questions (see `SUPPORT.md`); contributions are welcome |
| General → Pull requests | squash merging only; delete head branches automatically | linear history on `main` |
| General → Releases | release immutability on | the tag and the files of a published release can't be changed or deleted, and GitHub adds a signed release attestation ([immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)) |
| Actions → General | allow only actions created by GitHub; require actions to be pinned to a full-length commit SHA | enforces the rules under "Workflow security" |
| Actions → General | approval for fork pull request workflows: all external contributors | protects runners and caches |
| Actions → General | workflow permissions read-only; GitHub Actions may not create or approve pull requests | least privilege; workflows request more only where needed |
| Advanced Security | private vulnerability reporting | reporting path of `SECURITY.md` |
| Advanced Security | dependency graph, Dependabot alerts with malware alerts, Dependabot security updates | known vulnerabilities and malicious packages are reported; version updates come from `dependabot.yml` |
| Advanced Security | secret scanning with push protection | the project has no secrets; catches tokens committed by mistake |
| Advanced Security | code scanning: CodeQL default setup (JavaScript/TypeScript, GitHub Actions) | finds for example script injection in workflows; runs on pushes, pull requests and weekly, free for public repositories; a deliberate exception to "as rarely as possible" |
| Rules → Rulesets | branch `main`: pull request required (0 approvals, since a sole maintainer can't approve their own), status check `check`, linear history, no force push, no deletion, no bypass | every change goes through `check` |
| Rules → Rulesets | tags `v*`: no update, no deletion | protects release tags before publication; published releases are immutable anyway |
| Moderation | "Interaction limits" for new accounts only if needed; no stale bot, issues are closed by hand | hobby project without commitments |

Nothing needs to be set for GitHub's workflow execution protections: the default rule for public repositories blocks `pull_request_target`, which the project doesn't use.

## Setup order

**Order when setting up:** create the repository empty (without README, license or `.gitignore`), push `main`, then create the rulesets; otherwise the pull request rule blocks the first push. The status check `check` is added to the ruleset once the workflow exists and has run once. After enabling SHA pinning, check that the runs managed by GitHub (Dependabot, CodeQL default setup) still start.
