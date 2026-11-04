// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Modules that only Vite provides.

/** The engine worker's code as one classic script (scripts/build/vite-restlos.ts). */
declare module "virtual:restlos-worker" {
  const source: string;
  export default source;
}

/** A file's text (`import text from "./x.svg?raw"`), used for the icons. */
declare module "*?raw" {
  const text: string;
  export default text;
}

/** The part of Vite's `import.meta.env` the UI uses. */
interface ImportMetaEnv {
  /** True on the Vite dev server (`vite`, `npm run gallery`), false in a build. */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
