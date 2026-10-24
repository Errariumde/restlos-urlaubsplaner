# SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
# SPDX-License-Identifier: EUPL-1.2
{
  description = "restlos-urlaubsplaner – development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs }:
    let
      # x86_64-darwin is left out: nixpkgs 26.05 is the last release supporting it.
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAll (pkgs:
        let
          # What `npm run check` needs; CI uses only these (devShells.ci,
          # `nix develop .#ci`), the default shell adds the rest.
          ciPackages = with pkgs; [
            nodejs_24
            reuse # License compliance
          ] ++ lib.optionals stdenv.isLinux [
            valgrind # Performance gate (npm run perf): Cachegrind instruction counts
          ];
        in
        {
        ci = pkgs.mkShellNoCC { packages = ciPackages; };

        default = pkgs.mkShell {
          packages = ciPackages ++ (with pkgs; [
            # Build toolchain
            typst

            # Language servers (used by editors and by Claude Code LSP plugins)
            typescript-language-server   # TypeScript/JavaScript
            svelte-language-server       # provides `svelteserver`
            tinymist                     # Typst
            nixd                         # Nix
            vscode-langservers-extracted # JSON/CSS/HTML (optional)

            # Manual check against the current Firefox ESR (the supported
            # browser baseline); Playwright's Firefox is a patched build, not the ESR.
            firefox-esr

            # Holiday cross-check (test oracle, not shipped)
            (python3.withPackages (ps: [ ps.holidays ]))

            # General tools
            git
            ripgrep
          ] ++ lib.optionals stdenv.isLinux [
            # Claude Code sandbox (/sandbox) on Linux
            bubblewrap
            socat
          ]);

          # Playwright uses the browsers from nixpkgs; @playwright/test in
          # package.json must have the same version as playwright-driver.
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";

          shellHook = ''
            echo "restlos dev shell – playwright-driver ${pkgs.playwright-driver.version}"
            npm_ver="$(npm --version 2>/dev/null || echo 0)"
            if [ "$(printf '%s\n' 11.10.0 "$npm_ver" | sort -V | head -n1)" != "11.10.0" ]; then
              echo "WARNING: npm $npm_ver < 11.10 – 'min-release-age' in .npmrc is ignored." >&2
            fi
          '';
        };
      });
    };
}
