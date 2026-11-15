<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

@AGENTS.md

## Claude Code specifics

- Node.js, Typst and the language servers come from the Nix dev shell. If one of them is missing on `PATH`, Claude Code was started outside the shell: stop and ask the user to restart it inside `nix develop`.
- For Svelte components, use the Svelte MCP server (`.mcp.json`) to look up current Svelte 5 docs and run its autofixer on new or changed components.
- Use the language server diagnostics (TypeScript, Svelte, Typst, Nix) after edits; fix reported errors before moving on.
- Run `nix` commands on their own, not inside compound commands (`&&`, `;`, pipes): only a command that is entirely `nix …` runs outside the sandbox, and inside it the Nix daemon socket is blocked.
- Subagents work where the main session puts them: on its branch in this checkout, or in a worktree it created for them. Each dispatch prompt names the branch and the directory and repeats the rules under "Git" and "npm usage" in `AGENTS.md`. Subagents don't switch branches or create worktrees. Skills that set up a worktree by default follow the "Git" rule instead.
