// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/** The Lucide file (without `.svg`) behind each icon. The files are copied from lucide-static 1.60.0. */
export const ICON_FILES = {
  undo: "undo-2",
  redo: "redo-2",
  tiles: "layout-grid",
  columns: "columns-3",
  sun: "sun",
  moon: "moon",
  "sun-moon": "sun-moon",
  languages: "languages",
  select: "square-dashed-mouse-pointer",
  close: "x",
  warning: "triangle-alert",
  check: "check",
  more: "ellipsis",
} as const;

export type IconName = keyof typeof ICON_FILES;

/** The icons that point in the reading direction and are mirrored in right-to-left text (D14). */
export const MIRRORED_ICONS: ReadonlySet<IconName> = new Set<IconName>(["undo", "redo"]);
