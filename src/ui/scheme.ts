// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The light/dark switch (D2, issue 0032): tokens.css holds a finished colour per mode, chosen by data-scheme on <html>.
// color-scheme follows only so native controls and scrollbars match.

export type Scheme = "light" | "dark";

/** Puts `scheme` on the root: `data-scheme` picks the tokens, `color-scheme` the native controls. */
export function setScheme(root: HTMLElement, scheme: Scheme): void {
  root.dataset["scheme"] = scheme;
  root.style.colorScheme = scheme;
}

/**
 * Applies `mode` to the root. For "auto" it follows `prefers-color-scheme`, also when that changes later; the
 * returned function stops following it.
 */
export function applyMode(root: HTMLElement, mode: Scheme | "auto"): () => void {
  if (mode !== "auto") {
    setScheme(root, mode);
    return () => {};
  }
  const query = matchMedia("(prefers-color-scheme: dark)");
  const follow = () => setScheme(root, query.matches ? "dark" : "light");
  follow();
  query.addEventListener("change", follow);
  return () => query.removeEventListener("change", follow);
}
