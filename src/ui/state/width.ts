// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Width limits in code are in rem, like the container queries of the views, so the layout follows the browser's
// text size (docs/SPEC.md, "Screen sizes"). 1rem is 16 px at the default text size.

/** Whether a width in CSS pixels is below a limit in rem; `rem` is the root font size in pixels. */
export function belowRem(width: number, limit: number, rem: number): boolean {
  return width < limit * rem;
}
