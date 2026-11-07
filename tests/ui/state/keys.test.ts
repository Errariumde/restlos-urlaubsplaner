// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { shortcut } from "../../../src/ui/state/keys";

const NONE = { key: "", code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
const press = (event: Partial<typeof NONE>) => shortcut({ ...NONE, ...event });

describe("shortcut", () => {
  it("maps Ctrl or Cmd with Z to undo, and with Shift to redo", () => {
    expect(press({ key: "z", code: "KeyZ", ctrlKey: true })).toBe("undo");
    expect(press({ key: "z", code: "KeyZ", metaKey: true })).toBe("undo");
    expect(press({ key: "Z", code: "KeyZ", ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(press({ key: "z", code: "KeyZ", metaKey: true, shiftKey: true })).toBe("redo");
  });

  it("maps Ctrl or Cmd with Y to redo", () => {
    expect(press({ key: "y", code: "KeyY", ctrlKey: true })).toBe("redo");
    expect(press({ key: "y", code: "KeyY", metaKey: true })).toBe("redo");
    expect(press({ key: "Y", code: "KeyY", ctrlKey: true, shiftKey: true })).toBeUndefined();
  });

  it("maps V, W and K without modifiers, in either case", () => {
    expect(press({ key: "v", code: "KeyV" })).toBe("view");
    expect(press({ key: "W", code: "KeyW" })).toBe("align");
    expect(press({ key: "k", code: "KeyK" })).toBe("weeks");
  });

  it("falls back to the physical key when the layout isn't Latin", () => {
    expect(press({ key: "я", code: "KeyZ", ctrlKey: true })).toBe("undo");
    expect(press({ key: "я", code: "KeyV" })).toBe("view");
    expect(press({ key: "Dead", code: "KeyK" })).toBe("weeks");
  });

  it("prefers the typed Latin letter over the physical key", () => {
    // Dvorak: the key at KeyV types "k".
    expect(press({ key: "k", code: "KeyV" })).toBe("weeks");
  });

  it("ignores the letters with other modifiers", () => {
    expect(press({ key: "v", code: "KeyV", ctrlKey: true })).toBeUndefined();
    expect(press({ key: "v", code: "KeyV", metaKey: true })).toBeUndefined();
    expect(press({ key: "v", code: "KeyV", altKey: true })).toBeUndefined();
    expect(press({ key: "V", code: "KeyV", shiftKey: true })).toBeUndefined();
    expect(press({ key: "z", code: "KeyZ", ctrlKey: true, altKey: true })).toBeUndefined();
  });

  it("ignores everything else", () => {
    expect(press({ key: "a", code: "KeyA" })).toBeUndefined();
    expect(press({ key: "z", code: "KeyZ" })).toBeUndefined();
    expect(press({ key: "Enter", code: "Enter" })).toBeUndefined();
  });
});
