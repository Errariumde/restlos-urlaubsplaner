// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

export type Shortcut = "undo" | "redo" | "view" | "align" | "weeks";

/** The fields of a KeyboardEvent that count (declared by hand: tests are type-checked without the DOM types). */
interface KeyEvent {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * The Latin letter a key press stands for, lower case. The typed letter wins (so Dvorak and AZERTY users get
 * the letter on their keycap); when it isn't a Latin letter (Cyrillic, a dead key), the physical key (`KeyZ`) decides.
 */
function letterOf(event: KeyEvent): string | undefined {
  if (/^[A-Za-z]$/.test(event.key)) return event.key.toLowerCase();
  const physical = /^Key([A-Z])$/.exec(event.code);
  return physical?.[1]?.toLowerCase();
}

/** The app shortcut for a key press, or undefined. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo; V, W and K stand alone. */
export function shortcut(event: KeyEvent): Shortcut | undefined {
  const letter = letterOf(event);
  if (letter === undefined || event.altKey) return undefined;
  if (event.ctrlKey || event.metaKey) {
    if (letter === "z") return event.shiftKey ? "redo" : "undo";
    if (letter === "y" && !event.shiftKey) return "redo";
    return undefined;
  }
  if (event.shiftKey) return undefined;
  if (letter === "v") return "view";
  if (letter === "w") return "align";
  if (letter === "k") return "weeks";
  return undefined;
}
