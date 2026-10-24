#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
# SPDX-License-Identifier: EUPL-1.2

# Fails when the installed Nix isn't the one the pinned nixpkgs ships, so a
# flake.lock update that brings another Nix says what to change. Run in the
# repository's root.
set -euo pipefail
installed="$(nix --version | awk '{print $NF}')"
expected="$(nix eval --raw --inputs-from . nixpkgs#nix.version)"
if [ "$installed" != "$expected" ]; then
  echo "::error title=Nix version::flake.lock ships Nix $expected, the action installs $installed. Update NIX_VERSION and NIX_TARBALL_SHA256 in .github/actions/nix/action.yml (dependency-update skill, step 8)."
  exit 1
fi
echo "Nix $installed, as flake.lock's nixpkgs ships."
