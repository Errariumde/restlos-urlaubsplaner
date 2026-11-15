<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Build and CI choices

Recommendation: everything runs locally with one command; GitHub Actions only runs the same commands, as rarely as possible, with a cache for all downloads and minimal permissions. This way neither the npm registry nor any other server is hit again on every run, and the project stays buildable without GitHub.

**GitHub Free, public repository:** standard runners are free ([GitHub docs](https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions)), GitHub Pages is available ([GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Free doesn't mean unlimited: runs are still kept sparse.
