<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Licensing

## Licenses

The repository follows [REUSE](https://reuse.software) by the FSFE: every file has a machine-readable license and copyright statement, and every license text used is in `LICENSES/`. The "Licensing (REUSE)" [hard rule](../../../../AGENTS.md#hard-rules) sums up the table and states what a new file needs.

| Component | License (SPDX) | Stated via |
| --- | --- | --- |
| Source code, holiday data, build scripts, configuration (including `REUSE.toml`) | `EUPL-1.2` | SPDX header in the file or `REUSE.toml` |
| PDF templates, example template, example data, example plan file and rule set | `MIT-0` | `REUSE.toml` |
| Documentation, help texts, agent instructions (`AGENTS.md`, `CLAUDE.md`) and skills (all Markdown) | `CC-BY-4.0` | SPDX header in the file |
| Generated lockfiles (`package-lock.json`, `flake.lock`) | `CC0-1.0` | `REUSE.toml` |
| Third-party files: Lucide icons (`src/ui/icons/*.svg`) | `ISC`; the Feather-derived icons among them `ISC AND MIT`; with the original copyright | `REUSE.toml`, license texts in `LICENSES/` |

## Checks

- A `reuse lint` error fails the check. The command and the workflow that run `reuse lint` are in [Local setup](build-and-ci.md#local-setup) and [Workflows](build-and-ci.md#workflows).
