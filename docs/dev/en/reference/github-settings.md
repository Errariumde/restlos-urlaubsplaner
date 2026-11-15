<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# GitHub settings

The settings that exist only on GitHub, not in the repository. They are set once by hand, for the repository and for a fork with the same protection. The reasons are in [Build and CI choices](../explanation/build-and-ci-choices.md), [Security choices](../explanation/security-choices.md) and [Hobby project](../explanation/hobby-project.md).

## Settings

The labels are those of GitHub's settings pages as of October 2026. The last column links to the rule a setting enforces, where there is one.

| Settings → | Setting | Rule |
| --- | --- | --- |
| General → Features | Issues on; Wikis, Projects and Discussions off; pull requests open to everyone | [`SUPPORT.md`](../../../../SUPPORT.md) |
| General → Pull requests | squash merging only; delete head branches automatically | [Contributing, "Commits"](../../../../CONTRIBUTING.md#commits) |
| General → Releases | release immutability on: the tag and the files of a published release can't be changed or deleted, and GitHub adds a signed release attestation ([immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)) | |
| Actions → General | allow only actions created by GitHub; require actions to be pinned to a full-length commit SHA | [Workflow security](build-and-ci.md#workflow-security) |
| Actions → General | approval for fork pull request workflows: all external contributors | |
| Actions → General | workflow permissions read-only; GitHub Actions may not create or approve pull requests | [Workflow security](build-and-ci.md#workflow-security) |
| Advanced Security | private vulnerability reporting | [`SECURITY.md`](../../../../SECURITY.md) |
| Advanced Security | dependency graph, Dependabot alerts with malware alerts ([GitHub's description](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-malware-alerts)), Dependabot security updates; version updates come from `.github/dependabot.yml` | |
| Advanced Security | secret scanning with push protection | |
| Advanced Security | code scanning: CodeQL default setup (JavaScript/TypeScript, GitHub Actions), which runs on pushes, pull requests and weekly | |
| Rules → Rulesets | branch `main`: pull request required with 0 approvals, status check `check`, linear history, no force push, no deletion, no bypass | [Workflows](build-and-ci.md#workflows) |
| Rules → Rulesets | tags `v*`: no update, no deletion | |
| Moderation | "Interaction limits" for new accounts only if needed; no stale bot, issues are closed by hand | |

GitHub's workflow execution protections need no setting: the default rule for public repositories blocks `pull_request_target`, which no workflow uses ([Workflow security](build-and-ci.md#workflow-security)).

## Setup order

1. The repository is created empty, without README, license or `.gitignore`.
2. `main` is pushed.
3. The rulesets are created after that push.
4. The status check `check` is added to the ruleset for `main` once the workflow exists and has run once.
5. After SHA pinning is enabled, the runs managed by GitHub (Dependabot, CodeQL default setup) must still start.
