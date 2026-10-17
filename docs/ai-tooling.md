<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# AI tooling in this repository

As of 2026-10-17. The setup targets Claude Code and stays usable for other agents (Codex, Cursor, Copilot, Gemini CLI, …).

## 1. Instruction files

| File | Purpose | Read by |
| --- | --- | --- |
| `AGENTS.md` | Canonical rules for all agents | Codex, Cursor, Copilot, Gemini CLI, Zed, … |
| `CLAUDE.md` | Imports `@AGENTS.md`, plus a few Claude Code notes | Claude Code |
| `docs/SPEC.md` | Specification, authoritative | linked from `AGENTS.md`, not loaded automatically |
| `.claude/skills/*/SKILL.md` | Procedures (holiday data, UI texts, updates, release) | Claude Code automatically; other agents as plain Markdown |

Why the import instead of `AGENTS.md` alone: Claude Code reads `AGENTS.md` natively only since version 2.1.277, and only when there is no `CLAUDE.md` (nixpkgs 26.05 ships 2.1.223). With both files present it loads only `CLAUDE.md`, so the `@AGENTS.md` import is what loads the shared rules; the import never loads them twice. It works in every version and keeps a single source. The specification is deliberately not imported (about 65 KB in every session); agents read the relevant sections on demand.

Block-level HTML comments, such as the SPDX headers, are stripped before `CLAUDE.md` is loaded, so they cost no context.

Personal additions go in `CLAUDE.local.md` or `.claude/settings.local.json` (both in `.gitignore`).

## 2. Language servers (LSP)

Claude Code uses language servers through plugins: after each edit the agent sees type errors directly and can jump to definitions and references. The binaries come from the Nix dev shell.

| Language | Server (nixpkgs 26.05) | Plugin |
| --- | --- | --- |
| TypeScript/JS | typescript-language-server 5.3.0 | official: `typescript-lsp@claude-plugins-official` |
| Svelte | svelte-language-server 0.17.31 (`svelteserver`) | own plugin `restlos-lsp` (no official one) |
| Typst | tinymist 0.14.18 | own plugin `restlos-lsp` |
| Nix | nixd 2.9.1 | own plugin `restlos-lsp` |
| JSON/CSS/HTML | vscode-langservers-extracted | optional, editors only; not in the plugin |

The own plugin is defined in `tools/claude-plugins/restlos-lsp/.lsp.json` and provided through a marketplace inside the repository (`tools/claude-plugins/.claude-plugin/marketplace.json`, name `restlos-tools`). `.claude/settings.json` registers the marketplace (`extraKnownMarketplaces`) and enables both plugins (`enabledPlugins`). Enabling does not download anything, so every collaborator installs the plugins once per machine:

```sh
claude plugin marketplace add ./tools/claude-plugins
claude plugin install restlos-lsp@restlos-tools --scope project
claude plugin install typescript-lsp@claude-plugins-official --scope project
```

LSP plugins only run in local sessions; Claude Code cloud sessions don't start plugin language servers.

## 3. MCP servers

Recommendation: **only the Svelte MCP server, as a remote server** (`.mcp.json` → `https://mcp.svelte.dev/mcp`). It provides current Svelte 5 documentation and an autofixer for components. That matters for Svelte 5 (runes), because models often still write Svelte 4 syntax.

- Remote instead of local: the official Svelte plugin starts the MCP server via `npx`, an unreviewed npm download that bypasses the lockfile. The remote server downloads nothing.
- Project MCP servers need a one-time approval. `.claude/settings.json` lists only `svelte` in `enabledMcpjsonServers`; committed MCP settings take effect only once the folder is trusted.
- Not recommended for now: Playwright MCP (the tests run via npm scripts anyway), GitHub MCP (`gh` is enough), filesystem or browser MCPs (Claude Code does that itself). Every additional MCP server adds attack surface and context usage.

## 4. Skills

The skills follow the open Agent Skills format (agentskills.io) and use only portable frontmatter fields (`name`, `description`, `license`, `metadata`). Other agents can read them as plain instructions; `AGENTS.md` points to them.

| Skill | When | Key points |
| --- | --- | --- |
| `holiday-data` | changing holiday rules | official source, rule as data, tests over several years, cross-check with python-holidays |
| `ui-texts` | changing texts | both catalogs, ICU MessageFormat, no sentence concatenation |
| `dependency-update` | package and nixpkgs updates | no new packages without asking, review the lockfile diff, couple Playwright to the Nix version |
| `release` | preparing a release | checks, `reuse lint`, SPDX bill of materials, manual test in Firefox ESR; tagging and pushing only by the maintainer |

No external skills (marketplaces) are needed. Deliberately left out: a skill for Typst templates, which only makes sense once templates exist.

## 5. Nix dev shell and Claude Code

`flake.nix` provides Node.js 24, Typst, REUSE, all language servers, Python with `holidays`, Firefox ESR and the Playwright browsers; on Linux also bubblewrap and socat for the Claude Code sandbox.

**Claude Code itself is not part of the flake.** It is unfree and a personal tool, not a project component. Install it system-wide or per user, e.g. in `configuration.nix`:

```nix
nixpkgs.config.allowUnfree = true;   # or selectively via allowUnfreePredicate
environment.systemPackages = [ pkgs.claude-code ];
programs.direnv.enable = true;       # includes nix-direnv
```

Alternatively use the official installer (newer versions, updates itself).

**Start Claude inside the dev shell**, so Claude Code inherits `PATH` and the environment variables (language servers, Node, Typst):

```sh
cd restlos-urlaubsplaner
nix develop        # or automatically via direnv: run `direnv allow` once
claude
```

With direnv, `cd` into the directory is enough. If Claude is started outside the shell, the LSP plugins can't find their binaries.

Nix flakes only see files tracked by git: run `git add` on new files before `nix develop` picks them up.

**Permissions:** `.claude/settings.json` allows tests, build and read-only git commands; asks before `npm install`/`update`/`uninstall`, `npx`/`npm exec` and `git commit`; and denies `npm publish`, `git push`, `curl`/`wget` and reading `~/.ssh`, `~/.gnupg`, `~/.config/gh`, `~/.git-credentials` and `.env`. Bash permission rules are not a security boundary on their own: they don't match `/usr/bin/curl` or `sh -c '…'`.

**Sandbox:** `.claude/settings.json` therefore enables the Claude Code sandbox, which enforces limits at OS level (bubblewrap and socat from the dev shell on Linux):

- Writes only to the project, the temp directory and `~/.npm` (npm cache, needed by `npm ci`); no reads of `~/.ssh`, `~/.gnupg`, `~/.config/gh` and `~/.git-credentials`.
- Network only to `registry.npmjs.org`; any other domain asks for approval the first time.
- `autoAllowBashIfSandboxed` is off, so the permission rules above still apply inside the sandbox.
- `nix` runs outside the sandbox (`excludedCommands`): on Linux the sandbox blocks Unix sockets, which the Nix daemon needs. This only applies when the whole command is a `nix` command; inside a compound command (`&&`, `;`, pipes) nix fails.
- On Linux a sandboxed command has its own private localhost. End-to-end tests work as long as the preview server and the browser are started by the same command (as `npm run test:e2e` does).
- git over SSH doesn't work inside the sandbox (no keys, no SSH agent); see section 6.
- Inside the sandbox, protected paths that don't exist yet (shell rc files, `.vscode`, `.claude/hooks`, …) show up as `/dev/null` placeholders. They don't exist on disk; `.gitignore` lists them so `git add -A` and `reuse lint` keep working inside the sandbox.

A separate user account for agent sessions is still recommended.

## 6. Git: signing and pushing

The maintainer pushes over SSH with a passphrase-protected key that also signs commits and tags (`gpg.format ssh`, vigilant mode on GitHub). HTTPS would need a stored token (`gh`, a credential manager or a personal access token), which anything running as the user, such as a malicious npm package, could copy and use elsewhere. A key in the SSH agent can be used while it is loaded, but not copied.

Agents never get the key:

- The sandbox blocks `~/.ssh`, the SSH agent's socket and github.com, and `git push` is denied. `~/.config/gh` and `~/.git-credentials` are blocked too, in case `gh` or HTTPS credentials are ever used (`gh` stores its token as plain text when no keyring is running).
- Agent commits are unsigned: `.claude/settings.json` sets `commit.gpgsign` and `tag.gpgsign` to `false` through `GIT_CONFIG_*` environment variables for every command Claude Code runs. Without that, commits fail in the sandbox because the signing key is unreadable, and an approved retry outside the sandbox would sign with the key loaded in the agent, without any prompt.

Workflow:

1. The agent commits on a branch.
2. The maintainer reviews the branch and signs all of its commits in their own terminal: `git rebase --force-rebase --gpg-sign main`. The signature means "reviewed".
3. Push, pull request, `check` green.
4. Squash merge on GitHub; GitHub signs the resulting commit on `main`.

GitHub MCP servers and connectors stay off (see section 3): they would act on GitHub as the maintainer, outside the sandbox.

## 7. Open checks

- **Marketplace path:** the docs don't say how the relative `path` of a `directory` marketplace in `extraKnownMarketplaces` is resolved. If Claude Code doesn't find it, run the commands from section 2.
- **Server arguments:** `svelteserver --stdio`, `tinymist lsp` and `nixd` without arguments are untested; check with `/plugin` and the LSP diagnostics in a session.
- **Sandbox with the toolchain:** writing to `~/.npm`, Node child processes with IPC and worker threads work inside the sandbox (checked 2026-10-17). `npm install` against the registry works inside the sandbox (checked 2026-10-18). Still to check: `npm ci` and `npm run test:e2e`.
- **Unsigned agent commits:** check that the `env` setting reaches the shell: in a Claude Code session, `git config commit.gpgsign` should print `false`.
- **GitHub workflows** are still missing. Actions must be pinned by commit SHA (see the specification).
