<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Licensing

## Licenses

The repository follows the FSFE's [REUSE specification](https://reuse.software): every file has a machine-readable license and copyright statement, and all license texts used are in the `LICENSES/` folder.

| Component | License (SPDX) | Stated via |
| --- | --- | --- |
| Source code, holiday data, build scripts, configuration (incl. `REUSE.toml`) | `EUPL-1.2` | SPDX header in the file or `REUSE.toml` |
| PDF templates, example template, example data, example plan file and rule set | `MIT-0` | `REUSE.toml` |
| Documentation, help texts, agent instructions (`AGENTS.md`, `CLAUDE.md`) and skills (all Markdown) | `CC-BY-4.0` | SPDX header in the file or `REUSE.toml` |
| Generated files (`package-lock.json`, `flake.lock`) | `CC0-1.0` | `REUSE.toml` |
| Third-party files (Lucide SVGs) | original license (Lucide `ISC`, Feather-derived icons `MIT`) with the original copyright | `REUSE.toml`, license text in `LICENSES/` |

## Checks

- `reuse lint` runs in `npm run check` and in the CI workflow `check`; an error fails the build.
- New files get an SPDX header (`SPDX-FileCopyrightText`, `SPDX-License-Identifier`) when they are created, where the file format allows comments; otherwise an entry in `REUSE.toml`.
