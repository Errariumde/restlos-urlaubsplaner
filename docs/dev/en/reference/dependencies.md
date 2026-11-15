<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dependencies

The approved packages and the measures against supply chain attacks. Exact versions, `npm ci`, the `.npmrc` settings `ignore-scripts` and `min-release-age`, the `@playwright/test` version, the ban on `npx` and the Content Security Policy's `connect-src` are stated in the [hard rules](../../../../AGENTS.md#hard-rules). The reasons are in [dependencies and supply chain](../explanation/supply-chain.md).

## Approved packages

| Package | Purpose | In the HTML | Installed |
| --- | --- | --- | --- |
| svelte 5 | UI | runtime part | yes |
| vite, @sveltejs/vite-plugin-svelte | build, dev server | no | yes |
| vite-plugin-singlefile | everything into one HTML | no | yes |
| typescript | types | no | yes |
| vitest | tests | no | yes |
| fast-check | property-based testing | no | yes |
| eslint, eslint-plugin-svelte, svelte-check | lint, type checking | no | yes |
| typescript-eslint | ESLint parser and rules for TypeScript | no | yes |
| @eslint/js | ESLint's recommended rule set | no | yes |
| ical.js | read iCal, verify the iCal export | yes | with the iCal import |
| intl-messageformat (FormatJS) | ICU messages | yes | yes |
| markdown-it 15.0.3, approved 2026-11-14 | parses the help Markdown | no | with the help |
| mdBook 0.5.2, approved 2026-11-14 | builds the documentation website; a tool from the Nix dev shell, not an npm package | no | with the documentation website |
| date-holidays | reference model in tests | no | yes |
| @playwright/test | end-to-end tests; browsers from the Nix dev shell | no | yes |
| axe-core, approved 2026-11-04 | accessibility checks in the end-to-end tests | no | yes |
| typst.ts + WASM | PDF export (Pro), loaded on the first export | yes (Pro) | with the PDF export |

## Measures against supply chain attacks

- **Lockfile:** `package-lock.json` must be checked in.
- **Native binaries:** Vite bundles with rolldown and lightningcss. Their native binaries come as platform-specific packages from the lockfile. esbuild is not installed. The only package in the lockfile with an install script is `fsevents`, an optional macOS package of Vite and Playwright.
- **Dependabot** ([`.github/dependabot.yml`](../../../../.github/dependabot.yml)):
  - It covers npm, GitHub Actions and Nix (`flake.lock`), each monthly with a `cooldown` of 14 days.
  - npm updates come as one group, `npm-all`; GitHub Actions updates as one group, `actions`.
  - It ignores `@playwright/test` and major updates of `typescript`, the latter for issue 0042 (TypeScript 7 waits for typescript-eslint and svelte-check).
  - Its pull requests must not be merged automatically.
  - A pull request for `flake.lock` must be checked with the [dependency update how-to](../howto/dependency-update.md).
- **Update cadence:** routine updates come through the monthly Dependabot pull requests. An update made by hand follows the [dependency update how-to](../howto/dependency-update.md). An update for a security advisory may bypass the 14-day delay only after the maintainer's explicit approval.
- **Alerts:** Dependabot alerts, malware alerts for known malicious packages ([GitHub's description](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-malware-alerts)) and Dependabot security updates must be on for the repository.
- **Dependency Review:** [`.github/workflows/dependency-review.yml`](../../../../.github/workflows/dependency-review.yml) runs GitHub's dependency review on every pull request that changes `package-lock.json`.
- **Isolated build:** `npm ci` and builds must run in a separate user account or container without access to SSH keys, the password manager or tokens.
- **Network lock:** the delivered HTML carries the Content Security Policy in a `<meta http-equiv="Content-Security-Policy">` tag right after `<meta charset="utf-8">` (`insertCsp` in `scripts/build/html.ts`).
