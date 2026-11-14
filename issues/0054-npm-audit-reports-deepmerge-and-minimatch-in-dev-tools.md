---
status: open
priority:
area: dependencies
branch:
created: 2026-11-14
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# npm audit reports deepmerge and minimatch in dev tools

## Problem

`npm ci` reports 13 vulnerabilities (4 low, 9 moderate). They come from two advisories, each reached through several packages:

- **deepmerge** 4.3.1, "mergeObject() allows prototype poisoning of returned objects" ([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), low, affects `>=4.2.0 <=4.3.1`). Pulled in by `@sveltejs/vite-plugin-svelte` 7.3.1 and by `date-holidays` 3.38.0 through `date-holidays-parser` 3.4.7. On 2026-11-14 there is no fixed release: 4.3.1 from 2023-03-16 is the newest deepmerge.
- **minimatch** 10.2.6, "potential denial of service via globparts amplification" ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate, affects `>=7.0.0 <11.0.1`). Pulled in by `eslint` 10.13.0, `@eslint/config-array` 0.23.5 and `@typescript-eslint/typescript-estree` 8.72.0.

The fixes `npm audit` suggests are wrong: `date-holidays` 1.8.4 and `typescript-eslint` 8.36.0 are old releases, not fixes.

## Context

- Every affected package is a devDependency, and none of them ends up in `dist/restlos-urlaubsplaner.html`. `date-holidays` is only used by the reference tests (`tests/reference/`, `tests/examples/plans.test.ts`), `vite-plugin-svelte` only at build time, ESLint only for `npm run lint`. All of them only process the repository's own files and configuration, so neither advisory can be triggered by a plan file or any other user input.
- Noticed while updating nixpkgs to `da6dc0e`; `package-lock.json` was unchanged, so main has the same findings.
- Where a fix can come from, as of 2026-11-14:
  - `eslint` 10.15.0 (published 2026-11-13) and `@eslint/config-array` 0.23.6 require `minimatch ^11.0.5`. With `min-release-age=14` in `.npmrc`, `eslint` 10.15.0 can be installed from 2026-11-27.
  - `@typescript-eslint/typescript-estree` still requires `minimatch ^10.2.2` in its newest release (typescript-eslint 8.72.2 from 2026-11-09), so it stays affected until typescript-eslint moves to minimatch 11.
  - deepmerge: needs a fixed deepmerge release, or `date-holidays-parser` and `vite-plugin-svelte` dropping it.

## Acceptance criteria

- [ ] `eslint` is updated to a release that requires minimatch 11 (10.15.0 or later), through the monthly Dependabot npm group or by hand following `docs/dev/en/howto/dependency-update.md`.
- [ ] `npm audit` no longer reports minimatch once typescript-eslint requires minimatch 11 and is updated.
- [ ] `npm audit` no longer reports deepmerge once a fixed release exists and the packages that use it allow it, or this issue records why the remaining finding is accepted.

## Notes

- No `overrides` in `package.json` to force minimatch 11 under typescript-eslint: its declared range is `^10.2.2`, and forcing a major it hasn't tested is a bigger risk than a denial of service on our own glob patterns.
- Not a case for skipping the 14-day delay (`docs/dev/en/howto/dependency-update.md`, step 7): nothing shipped is affected.
