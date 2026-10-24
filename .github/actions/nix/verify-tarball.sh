#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
# SPDX-License-Identifier: EUPL-1.2

# Checks the Nix release tarball $1 against NIX_TARBALL_SHA256 (pinned in
# action.yml) before anything is extracted. Exit 1 on a mismatch.
set -euo pipefail
if ! echo "$NIX_TARBALL_SHA256  $1" | sha256sum --check --quiet - >/dev/null 2>&1; then
  echo "::error title=Nix tarball::$1 doesn't match the SHA-256 pinned in .github/actions/nix/action.yml."
  exit 1
fi
