<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Contributing

restlos is a hobby project. Contributions are welcome, but there is no entitlement to review, reply or merge.

## Process

1. Discuss larger changes in an issue first.
2. Develop inside the Nix dev shell (`nix develop`).
3. `npm run check` must pass (tests, lint, types, REUSE).
4. Holiday data only with a link to the official source and a test.
5. New dependencies only after discussion.

## Commits

- Pull requests are squash-merged; GitHub signs the resulting commit on `main`.
- Signed commits (SSH or GPG) are welcome, not required.
- If an AI tool wrote part of your change, review it yourself before pushing. The agent setup is described in [`docs/ai-tooling.md`](docs/ai-tooling.md).

## Language

- Code, identifiers, file-format keys, comments, commit messages and developer documentation (including `docs/SPEC.md`): English.
- User-visible texts (UI, help, bundled templates): always both German and English, via the message catalogs.
- Domain terms follow the glossary in `docs/SPEC.md`.
- Issues and pull request descriptions may be written in German or English.

## License of contributions

By contributing you agree that your contribution is licensed under the license of the respective file:

- code, data and configuration: EUPL-1.2
- templates and examples: MIT-0
- documentation (Markdown, including agent instructions and skills): CC-BY-4.0

Every new file needs REUSE information (SPDX header or an entry in `REUSE.toml`).

## Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
