// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/** The loaded path of a kept list element ("sources[0].entries[3]") → its index in that list in the text that was read. */
export type Positions = ReadonlyMap<string, number>;

/**
 * The path in the text for a path in the loaded file: each list index along the path is replaced by the text
 * index of that element. An element without an entry in `positions` keeps its index.
 */
export function textPath(positions: Positions, loadedPath: string): string {
  let result = "";
  let last = 0;
  for (const match of loadedPath.matchAll(/\[(\d+)\]/g)) {
    const end = match.index + match[0].length;
    const textIndex = positions.get(loadedPath.slice(0, end));
    result += loadedPath.slice(last, match.index) + `[${String(textIndex ?? match[1])}]`;
    last = end;
  }
  return result + loadedPath.slice(last);
}
