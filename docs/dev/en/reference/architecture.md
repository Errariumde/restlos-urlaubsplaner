<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Architecture

How restlos is built: the technology, the engine, its day numbers, the worker it runs in and the single HTML file. The reasons are in [Architecture choices](../explanation/architecture-choices.md).

## Technology

- **UI:** Svelte 5 and TypeScript.
- **Build:** Vite with vite-plugin-singlefile (`vite.config.ts`).
- **Tests:** Vitest; the other test tools are in [Test strategy](test-strategy.md).

The approved packages are in [Dependencies](dependencies.md), their exact versions in [`package.json`](../../../../package.json).

## Engine

The engine (`src/engine/`) is a pure TypeScript module without DOM and without runtime dependencies:

- It imports only its own modules and the holiday data in `src/data/holidays/`, no package.
- It is type-checked without the DOM types: `tsconfig.json` has `lib: ["es2023"]` and leaves out `src/ui`.
- It must not import Node modules: ESLint's `no-restricted-imports` in `eslint.config.js` forbids them in `src/`.

Every output reads the state the engine computes, and no output has its own cost logic. The UI is the only output built. It shows the costs and totals the worker sends (`PlanState` and `Hint` in `src/ui/worker/protocol.ts`).

## Day numbers

The engine counts calendar days as integer day numbers, as the "Dates" [hard rule](../../../../AGENTS.md#hard-rules) requires. `DayNumber` in `src/engine/days.ts` is the number of days since 1970-01-01, which is day 0. Day numbers cover the years 1583 to 9999 (`MIN_YEAR` and `MAX_YEAR`). ESLint's `no-restricted-globals` forbids `Date` in `src/engine/`.

## Worker

- **Start:** the engine runs in a classic Web Worker started from a `blob:` URL. The build bundles `src/ui/worker/engine-worker.ts` into one classic script and gives it to the page as a string (`virtual:restlos-worker` in `scripts/build/vite-restlos.ts`). `startEngine` in `src/ui/worker/client.ts` makes the `blob:` URL from it.
- **State:** the worker holds the open file, its leave with undo and redo, and the computed result (`Session` in `src/ui/worker/session.ts`). Opening a file and every change run there.
- **Handover:** the page receives only what it shows, `PlanState` and `Hint`. Messages in both directions are plain objects (`Request` and `Response` in `src/ui/worker/protocol.ts`); a file's text travels as a string. Messages must not carry Blobs.
- **Policy:** the worker inherits the page's Content Security Policy (`standardPolicy` in `scripts/build/html.ts`, `worker-src blob:`). What it forbids is in the "Security" [hard rule](../../../../AGENTS.md#hard-rules).

## Single-file build

- **One file:** `npm run build` writes one HTML file, `dist/restlos-urlaubsplaner.html` (`OUTPUT_FILE` in `scripts/build/vite-restlos.ts`).
- **Inlined:** vite-plugin-singlefile puts the scripts and styles into the page. The worker's code with the holiday data (`src/data/holidays/`), the SVG icons (`src/ui/icons/`) and the built-in example plan are in it too. The build fails when the page still loads a script or style file.
- **Size budget:** the build fails when the HTML file is larger than 600 KB, 614,400 bytes (`MAX_BYTES`). The limit covers the whole file, the DE/EN catalogs included.
