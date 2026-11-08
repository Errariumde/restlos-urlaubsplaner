---
status: open
priority: 3
area: tests (screen reader)
branch:
created: 2026-11-08
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Orca check in a private session

## Problem

The screen reader check before a release (`npm run orca`, docs/SPEC.md "Accessibility" and the release checklist) needs a person: Orca takes over the desktop it runs on, so someone starts it, presses a fixed sequence of keys in the Firefox ESR and hands over the log. A run that needs no one, in its own session, would let the check run as often as the e2e tests.

## Context

- `scripts/orca-speech.ts` reads Orca's debug log (`--debug-file`) and checks the results of the key sequence; it doesn't care how the log came about.
- A first attempt started its own session: an X server of its own, its own D-Bus session bus, the AT-SPI bus launcher and registry, Orca with `--debug-file`, and the Firefox ESR with a fresh profile, driven by a script that sent the keys. The session itself worked and Firefox took the keys, but Orca stopped at once with "AT-SPI: Couldn't connect to accessibility bus. Is at-spi-bus-launcher running?", and its log stayed empty. The cause wasn't found.

## Acceptance criteria

- [ ] One command starts Orca and the Firefox ESR in a session of their own, sends the keys of `STEPS` in `scripts/orca-speech.ts`, stops both and runs the check, without touching the desktop it is started from.
- [ ] It runs in the Nix dev shell; whether it can run in CI is decided then.
- [ ] The release checklist and `npm run orca` name it instead of the manual steps.

## Notes

- Worth checking first: whether Orca finds the accessibility bus through `AT_SPI_BUS_ADDRESS` or only through the `org.a11y.Bus` name on the session bus, and whether the bus launcher was started with the same session bus address as Orca.
