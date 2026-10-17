<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# restlos – Urlaubsplaner für Brückentage und Feiertage

*English below.*

Offline-Urlaubsplaner als einzelne HTML-Datei: Feiertage berechnen, Urlaub per Klick planen, Kontingent live sehen, als PDF und .ics exportieren. Alle Daten bleiben auf deinem Gerät.

> **Status:** in Planung. Die Spezifikation (englisch) steht in [`docs/SPEC.md`](docs/SPEC.md).

## Projektstatus

restlos ist ein Hobbyprojekt, das ich in meiner Freizeit pflege.
Es gibt keine Zusagen zu Antwortzeiten, Fehlerbehebungen, neuen
Funktionen oder weiterer Pflege.

- Issues und Pull Requests sind willkommen. Ich schaue sie an, wenn ich
  Zeit und Lust habe, und schließe sie auch ohne ausführliche Begründung.
- Größere Änderungen bitte vorher in einem Issue besprechen.
- Die Software wird ohne Gewährleistung bereitgestellt (EUPL-1.2, Art. 7 und 8).
  Maßgeblich für deinen Urlaub sind dein Arbeitsvertrag und deine Personalabteilung.
- Wenn du mehr brauchst: Forken ist ausdrücklich erwünscht.

## Entwicklung

Die Entwicklung ist auf Englisch dokumentiert, siehe [Development](#development).

## Lizenz

Das Repository folgt [REUSE](https://reuse.software). Code und Daten: EUPL-1.2; Vorlagen und Beispiele: MIT-0; Dokumentation: CC-BY-4.0. Lizenztexte in [`LICENSES/`](LICENSES/).

---

# restlos – vacation planner for bridge days and holidays

Offline vacation planner as a single HTML file: calculates public holidays, lets you plan leave with a click, shows your remaining allowance live, exports to PDF and .ics. All data stays on your device.

> **Status:** planning stage. The specification is in [`docs/SPEC.md`](docs/SPEC.md).

## Project status

restlos is a hobby project I maintain in my spare time.
There are no promises about response times, bug fixes, new features
or continued maintenance.

- Issues and pull requests are welcome. I look at them when I have the
  time and energy, and I may close them without a detailed explanation.
- Please open an issue before starting larger changes.
- The software is provided without warranty (EUPL-1.2, Articles 7 and 8).
  Your employment contract and HR department are authoritative for your leave.
- If you need more: forking is explicitly welcome.

## Development

Requirements: Nix with flakes; direnv is optional.

```sh
nix develop          # or: direnv allow
npm ci
npm run check
npm run build
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and [`docs/ai-tooling.md`](docs/ai-tooling.md) for using AI coding tools.

## License

This repository follows [REUSE](https://reuse.software). Code and data: EUPL-1.2; templates and examples: MIT-0; documentation: CC-BY-4.0. License texts are in [`LICENSES/`](LICENSES/).
