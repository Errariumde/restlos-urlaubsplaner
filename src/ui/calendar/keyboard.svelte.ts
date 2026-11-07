// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Planning leave with the keyboard (docs/SPEC.md, "Calendar interaction"): the grid is one Tab stop with
// a roving tabindex. The arrows, Home/End and PageUp/PageDown move; with Shift they grow a visible selection
// (`app.selection`, `aria-selected` on the cells) whose cost the hint line shows. Space sets full days, H half
// days and Delete or Backspace removes own leave on the selection, else on the focused day; each is one undo
// step and ends the selection. Enter and the context-menu key open the day's detail; Escape ends the selection.
//
// This is also the keyboard path to the week action: select the week with Shift+arrows and press
// Space or Delete; a week number is a button, but this is how the whole range is reached from the grid.
import type { DayNumber } from "../../engine/days.ts";
import { i18n } from "../i18n/i18n.svelte.ts";
import type { app as appState } from "../state/app.svelte.ts";
import type { LeaveChange } from "../worker/protocol.ts";
import { navKeyOf, nextDay } from "./grid-nav.ts";
import { rangeChanges, toggleDay, type RangeAction } from "./range.ts";

export interface KeyboardOptions {
  readonly view: () => "tiles" | "columns";
  readonly app: typeof appState;
  /** Opens the detail of a day next to its cell. */
  readonly openDetail: (day: DayNumber, anchor: HTMLElement) => void;
}

/** The cell an event comes from, inside `node`. */
function cellOf(node: HTMLElement, target: EventTarget | null): HTMLElement | undefined {
  const cell = target instanceof Element ? target.closest<HTMLElement>("[data-day]") : null;
  return cell !== null && node.contains(cell) ? cell : undefined;
}

/** The action a key stands for, or undefined. H is matched by the typed letter or, on other layouts, the physical key. */
function actionKey(event: KeyboardEvent): RangeAction | "toggle" | undefined {
  if (event.key === " " || event.key === "Spacebar") return "toggle";
  if (event.key === "Delete" || event.key === "Backspace") return "remove";
  if (/^[hH]$/.test(event.key) || (!/^[A-Za-z]$/.test(event.key) && event.code === "KeyH")) return "half";
  return undefined;
}

/** A Svelte action on the calendar grid. */
export function calendarKeyboard(node: HTMLElement, initial: KeyboardOptions): { update(options: KeyboardOptions): void; destroy(): void } {
  let options = initial;

  function focusCell(day: DayNumber): void {
    options.app.focusDay = day;
    node.querySelector<HTMLElement>(`[data-day="${String(day)}"]`)?.focus();
  }

  /** Ends the selection: the hint goes, and a preview still on its way never shows (its guard sees the change). */
  function clearSelection(): void {
    if (options.app.selection === undefined) return;
    options.app.selection = undefined;
    options.app.hint = undefined;
  }

  /** Grows the selection from its anchor (or the day the focus leaves) to `head`, and previews setting it. */
  function extend(from: DayNumber, head: DayNumber): void {
    const app = options.app;
    const result = app.state?.result;
    if (result === undefined) return;
    app.selection = { anchor: app.selection?.anchor ?? from, head };
    const mine = app.selection;
    // Like a drag: a preview that arrives after the selection changed or ended doesn't refill the hint.
    void app.preview(rangeChanges(result, mine.anchor, mine.head, "full"), () => app.selection === mine);
  }

  function apply(action: RangeAction | "toggle", day: DayNumber): void {
    const app = options.app;
    const result = app.state?.result;
    if (result === undefined) return;
    const selection = app.selection;
    let changes: LeaveChange[];
    if (selection !== undefined) changes = rangeChanges(result, selection.anchor, selection.head, action === "toggle" ? "full" : action);
    else if (action === "toggle") changes = toggleDay(result, day);
    else changes = rangeChanges(result, day, day, action);
    clearSelection();
    void app.apply(changes);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const cell = cellOf(node, event.target);
    const state = options.app.state;
    if (cell === undefined || state === undefined) return;
    const from = Number(cell.dataset.day);

    const key = navKeyOf(event);
    if (key !== undefined) {
      // Moving works while a change is being applied; only the preview of a selection would be stale for a moment.
      event.preventDefault();
      const ctx = { dir: i18n.dir, weekStart: state.meta.weekStart, period: state.result.period, alignByWeekday: options.app.align };
      const to = nextDay(options.view(), key, from, ctx);
      if (event.shiftKey) extend(from, to);
      else clearSelection();
      focusCell(to);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "Escape") {
      if (options.app.selection === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      clearSelection();
      return;
    }

    if (event.key === "Enter" || event.key === "ContextMenu") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) options.openDetail(from, cell);
      return;
    }

    // Shift means nothing here: it is often still held from growing the selection.
    const action = actionKey(event);
    if (action === undefined) return;
    // No page scroll on Space, no letter shortcut on H (MainScreen skips handled keys).
    event.preventDefault();
    event.stopPropagation();
    // Holding the key must not toggle back and forth; while a change is applied, the result is about to be replaced.
    if (event.repeat || options.app.applying) return;
    apply(action, from);
  }

  node.addEventListener("keydown", onKeyDown);

  return {
    update(next) {
      options = next;
    },
    destroy() {
      node.removeEventListener("keydown", onKeyDown);
    },
  };
}
