<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Releases

The steps of a release are in the [release checklist](../howto/release.md).

## Versions

- Versions follow [Semantic Versioning](https://semver.org/). Which schemas of the file format a version reads is in [Kinds and versions](file-format.md#kinds-and-versions).

## Updates

- The downloaded HTML must not check for updates itself; it has no [network access](security.md#network-access).
- A new version must be published as a GitHub release with its `CHANGELOG.md` entries. The [GitHub settings](github-settings.md#settings) make a published release immutable.
