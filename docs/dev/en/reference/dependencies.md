<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dependencies

## Approved packages

| Package | Purpose | In the HTML? | Assessment |
| --- | --- | --- | --- |
| svelte 5 | UI | runtime part | needed; 16 direct dependencies (depscope, as of 2026-10), almost all only for the compiler |
| vite, @sveltejs/vite-plugin-svelte | build, dev server | no | standard for Svelte; largest dependency tree in the project, build time only |
| vite-plugin-singlefile | everything into one HTML | no | small, fulfils exactly the core requirement |
| typescript | types | no | no dependencies |
| vitest | tests | no | fits Vite, shares its configuration |
| fast-check | property-based testing | no | few dependencies; high value for the counting model |
| eslint, eslint-plugin-svelte, svelte-check | lint, type checking | no | standard; covers among others "no `Date` in the engine" |
| typescript-eslint | ESLint parser and rules for TypeScript | no | needed to lint TypeScript; umbrella for parser, plugin, utils and typescript-estree from the same project |
| @eslint/js | ESLint's recommended rule set | no | from the ESLint team, no dependencies; no longer installed with eslint since ESLint 10 |
| ical.js | read iCal (and verify the export) | yes | 0 dependencies (depscope, as of 2026-10), MPL-2.0; proven parser instead of an own implementation, also covers `RRULE`/`EXDATE` |
| intl-messageformat (FormatJS) | ICU messages | yes | established ICU implementation; check the dependency tree during setup, otherwise `@messageformat/core` |
| markdown-it 15.0.3 | parses the help Markdown | no | approved 2026-11-14; build only; 6 packages including itself (`argparse` already present); CommonMark; installed with the help |
| mdBook 0.5.2 | builds the documentation website | no | approved 2026-11-14; a tool from the Nix dev shell (nixpkgs), no npm package; comes with the website |
| date-holidays | reference model | no | development dependency, tests only |
| @playwright/test | end-to-end | no | standard; browsers locally from nixpkgs, in CI via Playwright |
| axe-core | accessibility checks | no | MPL-2.0, dev only, pinned exactly; approved 2026-11-04 |
| typst.ts + WASM | PDF (Pro) | yes (Pro) | pinned exactly, loaded only on the first export |
| date library | – | – | not needed; the engine calculates with day numbers |

## Measures against supply chain attacks

- **Exact versions** in `package.json`, `package-lock.json` checked in, installation with `npm ci`.
- **No install scripts:** `.npmrc` with `ignore-scripts=true`. esbuild (used by Vite) brings its binary via platform-specific packages; whether everything runs without an install script is checked during setup, otherwise a targeted exception. With `ignore-scripts=true`, npm also skips the `pre`/`post` scripts of `npm run`; the project doesn't rely on them.
- **Tools via npm scripts, not `npx`:** when stdin is not a TTY (CI, agents), `npx` installs missing packages without a prompt, bypassing the lockfile.
- **Waiting period for new versions:** `.npmrc` with `min-release-age=14` (days; from npm 11.10, [description](https://dev.classmethod.jp/en/articles/npm-min-release-age-dependabot-cooldown/)). Dependabot with a matching `cooldown` (14 days) and grouped updates; no automatic merging. `@playwright/test` is excluded from Dependabot (`ignore`), because it is pinned to the `playwright-driver` version from nixpkgs; `flake.lock` is updated by Dependabot (Nix ecosystem, see below) and checked with the dependency update procedure.
- **Updates deliberately and rarely**, monthly as one collected Dependabot pull request, immediately only for security advisories.
- **Alerts from GitHub:** Dependabot alerts including [malware alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-malware-alerts) for known malicious packages, Dependabot security updates, and Dependency Review on pull requests (see Workflows).
- **Isolated build:** `npm ci` and builds in a separate user account or container without access to SSH keys, password manager and tokens, because malicious code can also run on import.
- **Network lock in the delivered HTML:** Content Security Policy in the `<meta>` tag with `connect-src 'none'`. This doesn't interfere with anything, because holidays are calculated locally from the embedded rules and iCal files come via the file picker, not over the network. Even if a compromised library gets into the HTML, it cannot send data.
