// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Planning leave with the pointer (docs/SPEC.md, "Calendar interaction"; D8): drag to paint a range, click to
// toggle a day, Shift-click to extend from the last clicked day; on touch a tap toggles and a long press
// opens the detail. Every gesture ends in exactly one `apply` (one undo step) or none (Review Focus 1).
import type { PlanResult } from "../../engine/counting/plan.ts";
import type { DayNumber } from "../../engine/days.ts";
import type { app as appState } from "../state/app.svelte.ts";
import type { LeaveChange } from "../worker/protocol.ts";
import { actionForDrag, rangeChanges, toggleDay } from "./range.ts";

/** How long a touch must rest on a day to open its detail, and how far it may move meanwhile. */
const LONG_PRESS_MS = 500;
const TOUCH_SLOP_PX = 10;

/** The range a drag is painting: the days that would change, so the cells follow the pointer at once. */
class DragPreview {
  range = $state.raw<{ readonly action: "full" | "remove"; readonly days: ReadonlySet<DayNumber> } | undefined>(undefined);
}

/** The drag going on in the calendar, for the cells' `previewed` state. There is one calendar at a time. */
export const dragPreview = new DragPreview();

export interface GestureOptions {
  readonly getResult: () => PlanResult;
  readonly app: typeof appState;
  /** Opens the detail of a day (long press, right-click). Unset: the browser's context menu stays. */
  readonly onDetail?: ((day: DayNumber) => void) | undefined;
}

interface MousePress {
  readonly kind: "mouse";
  readonly id: number;
  readonly start: DayNumber;
  readonly action: "full" | "remove";
  readonly shift: boolean;
  /** Where a Shift-click extends from: the last plain-clicked day, else the focused day. */
  readonly anchor: DayNumber | undefined;
  current: DayNumber;
  moved: boolean;
}

interface TouchPress {
  readonly kind: "touch";
  readonly id: number;
  readonly start: DayNumber;
  readonly x: number;
  readonly y: number;
  readonly timer: ReturnType<typeof setTimeout>;
  /** The long press opened the detail: lifting the finger doesn't toggle the day any more. */
  done: boolean;
}

/** The day of the calendar cell an element is in, or undefined outside the cells of `node`. */
function dayOf(node: HTMLElement, target: EventTarget | null): DayNumber | undefined {
  if (!(target instanceof Element)) return undefined;
  const cell = target.closest<HTMLElement>("[data-day]");
  if (cell === null || !node.contains(cell)) return undefined;
  return Number(cell.dataset.day);
}

/** A Svelte action on the calendar grid. */
export function calendarGestures(node: HTMLElement, initial: GestureOptions): { update(options: GestureOptions): void; destroy(): void } {
  let options = initial;
  let press: MousePress | TouchPress | undefined;
  let lastClicked: DayNumber | undefined;
  /** Counts the drags; a preview asked for by an earlier one never shows (it may arrive after the drag ended). */
  let generation = 0;

  function showPreview(drag: MousePress): void {
    const changes = rangeChanges(options.getResult(), drag.start, drag.current, drag.action);
    // A new set each time in a raw state, never changed in place: no SvelteSet needed.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    dragPreview.range = { action: drag.action, days: new Set(changes.map((change) => change.day)) };
    const mine = generation;
    void options.app.preview(changes, () => generation === mine);
  }

  /** Ends the press: the preview and the hint go, and nothing else happens. */
  function finish(): void {
    const ended = press;
    if (ended === undefined) return;
    press = undefined;
    generation += 1;
    window.removeEventListener("keydown", onKeyDown, true);
    if (ended.kind === "touch") clearTimeout(ended.timer);
    if (node.hasPointerCapture(ended.id)) node.releasePointerCapture(ended.id);
    dragPreview.range = undefined;
    options.app.hint = undefined;
  }

  function onPointerDown(event: PointerEvent): void {
    if (press !== undefined || !event.isPrimary) return;
    const day = dayOf(node, event.target);
    if (day === undefined) return;
    if (event.pointerType === "touch") {
      // No capture and no preventDefault: moving the finger scrolls the page (touch-action: auto).
      const timer = setTimeout(onLongPress, LONG_PRESS_MS);
      press = { kind: "touch", id: event.pointerId, start: day, x: event.clientX, y: event.clientY, timer, done: false };
      return;
    }
    if (event.button !== 0) return;
    // No text selection and no focus by the browser: the cell takes the focus below, before the capture moves events to the grid.
    event.preventDefault();
    const anchor = lastClicked ?? options.app.focusDay;
    (event.target as Element).closest<HTMLElement>("[data-day]")?.focus({ preventScroll: true });
    press = {
      kind: "mouse",
      id: event.pointerId,
      start: day,
      action: actionForDrag(options.getResult(), day),
      shift: event.shiftKey,
      anchor,
      current: day,
      moved: false,
    };
    generation += 1;
    node.setPointerCapture(event.pointerId);
    window.addEventListener("keydown", onKeyDown, true);
  }

  function onPointerMove(event: PointerEvent): void {
    const current = press;
    if (current === undefined || event.pointerId !== current.id) return;
    if (current.kind === "touch") {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > TOUCH_SLOP_PX) finish();
      return;
    }
    // The capture sends every move to the grid; the day under the pointer decides. Between tiles there is
    // none, so the last day found stays.
    const day = dayOf(node, document.elementFromPoint(event.clientX, event.clientY));
    if (day === undefined || day === current.current) return;
    current.current = day;
    current.moved = true;
    showPreview(current);
  }

  function onPointerUp(event: PointerEvent): void {
    const ended = press;
    if (ended === undefined || event.pointerId !== ended.id) return;
    const result = options.getResult();
    let changes: LeaveChange[] = [];
    if (ended.kind === "touch") {
      if (!ended.done) {
        changes = toggleDay(result, ended.start);
        lastClicked = ended.start;
      }
    } else if (ended.moved) {
      changes = rangeChanges(result, ended.start, ended.current, ended.action);
    } else if (ended.shift && ended.anchor !== undefined) {
      changes = rangeChanges(result, ended.anchor, ended.start, "full");
    } else {
      changes = toggleDay(result, ended.start);
      lastClicked = ended.start;
    }
    finish();
    void options.app.apply(changes);
  }

  /** The browser took the pointer (pointercancel), or the capture went without a pointerup: nothing is applied. */
  function onCancel(): void {
    finish();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || press?.kind !== "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  }

  function onLongPress(): void {
    if (press?.kind !== "touch" || press.done) return;
    press.done = true;
    options.onDetail?.(press.start);
  }

  function onContextMenu(event: MouseEvent): void {
    const day = dayOf(node, event.target);
    if (day === undefined || press?.kind === "mouse") return;
    if (press?.kind === "touch") {
      clearTimeout(press.timer);
      // The long press has opened the detail already.
      if (press.done) {
        if (options.onDetail) event.preventDefault();
        return;
      }
      press.done = true;
    }
    if (!options.onDetail) return;
    event.preventDefault();
    options.onDetail(day);
  }

  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerup", onPointerUp);
  node.addEventListener("pointercancel", onCancel);
  node.addEventListener("lostpointercapture", onCancel);
  node.addEventListener("contextmenu", onContextMenu);

  return {
    update(next) {
      options = next;
    },
    destroy() {
      finish();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointercancel", onCancel);
      node.removeEventListener("lostpointercapture", onCancel);
      node.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
