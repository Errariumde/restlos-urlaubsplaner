<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dependencies and supply chain

restlos uses common, widespread tools, but chooses each one deliberately. Standard measures secure them: exact versions, a lockfile, no install scripts, a waiting period for new versions and an isolated build. The packages and measures are listed in the [dependencies reference](../reference/dependencies.md).

## Why the measures

The risk is real. From April to July 2026 alone there were several major npm compromises ([Unit 42](https://unit42.paloaltonetworks.com/?p=179395)). Some ran through `preinstall` hooks, some through malicious code that runs on import, and some carried a valid provenance signature.

Each measure answers one of these paths:

- **No install scripts** stop the `preinstall` path. Vite's native binaries come as platform-specific packages, so the build needs no exception.
- **Tools only through npm scripts:** when stdin is not a TTY, as in CI or with agents, `npx` installs missing packages without a prompt and bypasses the lockfile.
- **A waiting period** of 14 days gives the registry and the community time to find a malicious version before it is installed. `min-release-age` needs npm 11.10 or later ([description](https://dev.classmethod.jp/en/articles/npm-min-release-age-dependabot-cooldown/)). Dependabot's `cooldown` matches it, so Dependabot proposes no version that npm refuses.
- **Rare, collected updates** keep the number of new versions small, and each grouped pull request is reviewed by hand. A security advisory is the exception.
- **An isolated build** limits the damage of code that runs on import, which no install setting stops. It finds no SSH keys, password manager or tokens to steal.
- **The network lock in the HTML** covers a compromised library that reaches the bundle: it cannot send data. The lock costs nothing, because holidays are calculated locally from the embedded rules, and iCal files come through the file picker, not over the network.
- **`@playwright/test` outside Dependabot:** its version is tied to `playwright-driver` in nixpkgs, so it moves only together with `flake.lock`.

## Why these packages

- **svelte:** needed for the UI. It has 16 direct dependencies (depscope, as of 2026-10), almost all only for the compiler.
- **vite and its Svelte plugin:** the standard for Svelte. Vite has the largest dependency tree in the project, but only at build time.
- **vite-plugin-singlefile:** small, and does exactly the core requirement of one HTML file.
- **typescript:** no dependencies.
- **vitest:** fits Vite and shares its configuration.
- **fast-check:** few dependencies, and high value for the counting model.
- **eslint, eslint-plugin-svelte, svelte-check:** the standard. They also enforce rules such as no `Date` in the engine.
- **typescript-eslint:** needed to lint TypeScript. It is the umbrella for parser, plugin, utils and typescript-estree from the same project.
- **@eslint/js:** from the ESLint team, with no dependencies. Since ESLint 10 it is no longer installed with eslint.
- **ical.js:** 0 dependencies (depscope, as of 2026-10), MPL-2.0. A proven parser that also covers `RRULE` and `EXDATE`.
- **intl-messageformat:** an established ICU implementation. Its tree is small: three FormatJS packages.
- **markdown-it:** build only. It brings 6 packages including itself, and `argparse` is already present. It follows CommonMark.
- **mdBook:** comes from nixpkgs, so it adds no npm package.
- **date-holidays:** a second, independent model to check the holiday rules against, used in tests only.
- **@playwright/test:** the standard. The browsers come from nixpkgs.
- **axe-core:** MPL-2.0, used in development only.
- **typst.ts:** loaded only on the first PDF export.

## Rejected alternatives

- **A date library:** not needed, because the engine calculates with integer day numbers.
- **An own iCal parser:** ical.js is proven and already covers recurrence rules and exceptions.
- **`@messageformat/core`:** the fallback if the tree of intl-messageformat had turned out large. It stayed small.
- **An exception to the install-script ban for esbuild:** not needed. Vite builds with rolldown and lightningcss, which ship their binaries as packages.
- **Automatic merging of Dependabot pull requests:** it would install a new version without anyone reading the change.
