<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Test strategy

## Reference models

| Source | Role |
| --- | --- |
| [date-holidays](https://github.com/commenthol/date-holidays) (code ISC, data CC BY-SA 3.0) | reference model in CI, not embedded |
| [python-holidays](https://python-holidays.readthedocs.io/en/latest/_autosummary/holidays.countries.germany.html) (MIT; in version 0.97 Assumption Day in BY and Corpus Christi in SN and TH are in the opt-in category "catholic", and Augsburg is its own subdivision) | second reference model in CI |

date-holidays is a development dependency and runs directly in the Vitest tests (all 16 federal states, 2000–2100); deviations are bugs or are on a documented exception list. python-holidays serves only as an occasional second cross-check: a script generates a reference file on rule changes, which is checked in. No online fetching at runtime.

## Test levels

| Level | What | Tool |
| --- | --- | --- |
| Holidays | rule set against date-holidays (directly) and a checked-in python-holidays reference, all 16 federal states, 2000–2100; cases for SL and MV | Vitest |
| Rule types | Easter early/late, valid-from year, one-off days, substitute day with the country's own weekend, 29 February, 2000 and 2100 | Vitest, table-driven |
| Counting model | cost = the overlap of the leave with the working time for random multiples of 1/32, never more than min(taken, required work) and equal to it on a normal working day; minimum of the lowering layers; 24/31 Dec on a weekend costs 0; ½ source on a holiday stays 0; mandatory leave; work week with a change; the sum is correct | Vitest + fast-check |
| Plans | sources "Leave from another plan" (.urlaub.json) are displayed and never count | Vitest |
| Date arithmetic | no `Date` in the engine | Vitest, ESLint rule `no-restricted-globals` |
| Files | load(save(x)) = x | Vitest + fast-check |
| Performance | no wall-clock assertions in tests; every scenario runs at 8× and 16× its base size and fails when twice the input costs more than 2.2× the work, or when it costs more than 5 % over the checked-in baseline (`tests/perf/baseline.json`); raising the baseline needs the maintainer's approval; a measured run that collects garbage fails, because when a collection runs depends on where the repository is checked out | `npm run perf`: Cachegrind instruction counts with V8 `--predictable` and without garbage collection, part of `npm run check` and CI; on GitHub's runners the counts agree with the local ones within 0.5 %, on AMD and Intel CPUs alike (measured 2026-10-24), so CI compares with the same baseline |
| Multilingual support | missing/unused keys, pseudo-localization | small check scripts |
| Types and style | TypeScript, Svelte components, lint | `tsc`, svelte-check, ESLint |
| End-to-end | standard HTML via `file://` in Firefox (Playwright build), Chromium, WebKit; container widths 375/768/1100/1920 px. The Firefox ESR is not covered by Playwright and is tested manually (release checklist) | Playwright |
| Components, accessibility, keyboard | a component gallery page (dev only, not in the build) shows every component in every state: light and dark, DE, EN and the pseudo-locales; Playwright screenshots of it; axe-core on the gallery and the main screens; keyboard end-to-end tests | Playwright, axe-core |
