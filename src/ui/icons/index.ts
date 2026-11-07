// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The icons as data for Icon.svelte. The SVG files come in as text (?raw) and are parsed once, when the
// module loads; parseIcon refuses anything but simple shapes.
import check from "./check.svg?raw";
import columns from "./columns-3.svg?raw";
import more from "./ellipsis.svg?raw";
import languages from "./languages.svg?raw";
import tiles from "./layout-grid.svg?raw";
import moon from "./moon.svg?raw";
import redo from "./redo-2.svg?raw";
import select from "./square-dashed-mouse-pointer.svg?raw";
import sunMoon from "./sun-moon.svg?raw";
import sun from "./sun.svg?raw";
import warning from "./triangle-alert.svg?raw";
import undo from "./undo-2.svg?raw";
import close from "./x.svg?raw";
import type { IconName } from "./names.ts";
import { parseIcon, type IconData } from "./parse.ts";

export { MIRRORED_ICONS, type IconName } from "./names.ts";
export type { IconData, IconElement } from "./parse.ts";

const SOURCES: Record<IconName, string> = {
  undo,
  redo,
  tiles,
  columns,
  sun,
  moon,
  "sun-moon": sunMoon,
  languages,
  select,
  close,
  warning,
  check,
  more,
};

export const ICONS: Record<IconName, IconData> = Object.fromEntries(
  Object.entries(SOURCES).map(([name, text]) => [name, parseIcon(text)]),
) as Record<IconName, IconData>;
