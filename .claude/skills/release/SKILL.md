---
name: release
description: Prepare a restlos release (version bump, changelog, checks, SBOM). Use when asked to prepare or check a release. Never publish or push tags without explicit approval.
license: CC-BY-4.0
metadata:
  project: restlos-urlaubsplaner
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Release checklist

1. Working tree clean, on `main`, CI green.
2. Choose the version (SemVer). File format changes → check the `schema` version (`urlaubsplaner/N`) and migration tests.
3. Update `CHANGELOG.md` (move "Unreleased" entries, date in ISO format) and `package.json` version.
4. Run in the dev shell:
   - `npm ci`
   - `npm run check` (tests, lint, types, `reuse lint`)
   - `npm run build`
   - `npm run test:e2e` (Playwright: Firefox, Chromium, WebKit – Playwright's own browser builds, not Firefox ESR)
5. Generate the SBOM: `reuse spdx -o dist/restlos.spdx`.
6. Open `dist/*.html` from disk (file://) in the current Firefox ESR from the dev shell (`firefox-esr`) and check: open, save, PDF and .ics export, no network requests (devtools).
6a. Largest file: `npm run perf -- --largest-file /tmp/largest.urlaub.json`; open it in the Firefox ESR from the dev shell and note the times for reading and checking (target: under 2 s together on the i7-8650U).
7. Show the summary to the user. Tagging, pushing and publishing are done by the maintainer: the release workflow creates a draft release, attaches the HTML files, `SHA256SUMS` and the SBOM, adds provenance and then publishes it. Releases are immutable: once published, a release can't be changed and its tag can't be reused, so a mistake needs a new patch version.
