// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Planning leave with the pointer (docs/SPEC.md, "Calendar interaction"): drag to paint a range, click to
// toggle a day, Shift-click to extend from the last clicked day; on touch a tap toggles and a long press
// opens the detail. Every gesture ends in exactly one `apply` (one undo step) or none (Review Focus 1).
// In the selection mode (`app.selectMode`) a drag or two taps only select a range (`app.selection`, with its
// hint); the selection bar applies it. A long press still opens the detail there.
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
  /**
   * Opens the detail of a day (long press, right-click), with the pointer type that asked for it ("touch"
   * gets the sheet). Unset: the browser's context menu stays.
   */
  readonly onDetail?: ((day: DayNumber, pointerType: string) => void) | undefined;
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

/**
 * A press in the selection mode: a drag selects the days it passes, a tap sets the first day of a range
 * and the next tap its last day. Nothing is applied; the selection bar does that.
 */
interface SelectPress {
  readonly kind: "select";
  readonly id: number;
  readonly touch: boolean;
  readonly start: DayNumber;
  readonly x: number;
  readonly y: number;
  /** The long press of a finger; undefined for a mouse or a pen, and once the finger has moved. */
  timer: ReturnType<typeof setTimeout> | undefined;
  current: DayNumber;
  moved: boolean;
  /** The long press opened the detail: lifting the finger selects nothing. */
  done: boolean;
}

/** The day of the calendar cell an element is in, or undefined outside the cells of `node`. */
function dayOf(node: HTMLElement, target: EventTarget | null): DayNumber | undefined {
  if (!(target instanceof Element)) return undefined;
  const cell = target.closest<HTMLElement>("[data-day]");
  if (cell === null || !node.contains(cell)) return undefined;
  return Number(cell.dataset.day);
}

/** Whether the page runs on a Mac, where Ctrl+click stands for the right-click. */
function isMac(): boolean {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  // navigator.platform is the only source in Firefox and Safari.
  return [data?.platform, navigator.platform].some((platform) => platform?.includes("Mac") === true);
}

/** A Svelte action on the calendar grid. */
export function calendarGestures(node: HTMLElement, initial: GestureOptions): { update(options: GestureOptions): void; destroy(): void } {
  let options = initial;
  let press: MousePress | TouchPress | SelectPress | undefined;
  let lastClicked: DayNumber | undefined;
  /**
   * The selection a first tap in the selection mode made (as `app.selection` returns it). While it is still
   * the selection, the next tap sets its last day; any other selection, or none, makes the next tap a first one.
   */
  let tapSelection: object | undefined;
  /** A Mac Ctrl+click opened the detail; the contextmenu event that follows it opens nothing more. */
  let ctrlClickDetail = false;
  /** Counts the drags; a preview asked for by an earlier one never shows (it may arrive after the drag ended). */
  let generation = 0;
  /** Stops waiting for the release of the button that asked for a detail. */
  let stopWaiting: (() => void) | undefined;

  /**
   * Opens the detail once the mouse button is up. A popover shown while the button is still down (the
   * contextmenu event comes on the press in Linux and macOS) would be closed again by the browser's light
   * dismiss on its release.
   */
  function detailAfterRelease(day: DayNumber, event: MouseEvent): void {
    stopWaiting?.();
    const pointer = event instanceof PointerEvent ? event : undefined;
    const pointerType = pointer?.pointerType || "mouse";
    if (event.buttons === 0) {
      options.onDetail?.(day, pointerType);
      return;
    }
    // The release of the same pointer; an event without a pointer id (an older browser) waits for any.
    const ours = (other: PointerEvent): boolean => pointer === undefined || other.pointerId === pointer.pointerId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const released = (up: PointerEvent): void => {
      if (!ours(up)) return;
      removeListeners();
      // After the release has been handled, light dismiss included.
      timer = setTimeout(() => {
        stopWaiting = undefined;
        options.onDetail?.(day, pointerType);
      });
    };
    // The pointer went elsewhere (cancelled, the window lost the focus) or the user changed their mind.
    const cancelled = (other: Event): void => {
      if (other instanceof PointerEvent && !ours(other)) return;
      if (other instanceof KeyboardEvent && other.key !== "Escape") return;
      stopWaiting?.();
    };
    function removeListeners(): void {
      window.removeEventListener("pointerup", released, true);
      window.removeEventListener("pointercancel", cancelled, true);
      window.removeEventListener("keydown", cancelled, true);
      window.removeEventListener("blur", cancelled);
    }
    window.addEventListener("pointerup", released, true);
    window.addEventListener("pointercancel", cancelled, true);
    window.addEventListener("keydown", cancelled, true);
    window.addEventListener("blur", cancelled);
    stopWaiting = () => {
      removeListeners();
      clearTimeout(timer);
      stopWaiting = undefined;
    };
  }

  function showPreview(drag: MousePress): void {
    const changes = rangeChanges(options.getResult(), drag.start, drag.current, drag.action);
    // A new set each time in a raw state, never changed in place: no SvelteSet needed.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    dragPreview.range = { action: drag.action, days: new Set(changes.map((change) => change.day)) };
    const mine = generation;
    void options.app.preview(changes, () => generation === mine);
  }

  /** Selects the days from `anchor` to `head` and previews setting them, as the keyboard's selection does. */
  function select(anchor: DayNumber, head: DayNumber): void {
    const app = options.app;
    app.selection = { anchor, head };
    const mine = app.selection;
    tapSelection = undefined;
    // A preview that arrives after the selection changed or ended doesn't refill the hint.
    void app.preview(rangeChanges(options.getResult(), anchor, head, "full"), () => app.selection === mine);
  }

  /**
   * Ends the press: the drag preview and its hint go, and nothing else happens. A press in the selection mode
   * keeps its selection and the selection's hint.
   */
  function finish(): void {
    const ended = press;
    if (ended === undefined) return;
    press = undefined;
    generation += 1;
    window.removeEventListener("keydown", onKeyDown, true);
    if (ended.kind !== "mouse") clearTimeout(ended.timer);
    if (node.hasPointerCapture(ended.id)) node.releasePointerCapture(ended.id);
    if (ended.kind === "select") return;
    dragPreview.range = undefined;
    options.app.hint = undefined;
  }

  function startSelect(event: PointerEvent, day: DayNumber): void {
    // The grid has touch-action: none in the mode, so the finger doesn't scroll; no text selection either.
    event.preventDefault();
    const touch = event.pointerType === "touch";
    // A finger has an implicit capture to the cell it started on; the mouse and the pen take the grid's.
    if (!touch) {
      (event.target as Element).closest<HTMLElement>("[data-day]")?.focus({ preventScroll: true });
      node.setPointerCapture(event.pointerId);
    }
    press = {
      kind: "select",
      id: event.pointerId,
      touch,
      start: day,
      x: event.clientX,
      y: event.clientY,
      timer: touch ? setTimeout(onLongPress, LONG_PRESS_MS) : undefined,
      current: day,
      moved: false,
      done: false,
    };
    generation += 1;
    window.addEventListener("keydown", onKeyDown, true);
  }

  function onPointerDown(event: PointerEvent): void {
    // While a change is being applied, the result is about to be replaced: input computed from it would be stale.
    if (press !== undefined || !event.isPrimary || options.app.applying) return;
    // A button in a cell (the week marker of the month columns) is not a press on the day.
    if (event.target instanceof Element && event.target.closest("button") !== null) return;
    const day = dayOf(node, event.target);
    if (day === undefined) return;
    ctrlClickDetail = false;
    // On a Mac, Ctrl+click is the right-click: it opens the detail and doesn't toggle the day.
    if (event.pointerType === "mouse" && event.button === 0 && event.ctrlKey && isMac() && options.onDetail) {
      event.preventDefault();
      ctrlClickDetail = true;
      detailAfterRelease(day, event);
      return;
    }
    if (options.app.selectMode) {
      if (event.button === 0) startSelect(event, day);
      return;
    }
    if (event.pointerType === "touch") {
      // No capture and no preventDefault: moving the finger scrolls the page (touch-action: auto).
      const timer = setTimeout(onLongPress, LONG_PRESS_MS);
      press = { kind: "touch", id: event.pointerId, start: day, x: event.clientX, y: event.clientY, timer, done: false };
      return;
    }
    if (event.button !== 0) return;
    // No text selection and no focus by the browser: the cell takes the focus below, before the capture moves events to the grid.
    event.preventDefault();
    // Shift-click extends from the keyboard's selection anchor when there is one (keyboard.svelte.ts), else
    // from the last clicked day. Any press ends the keyboard selection.
    const anchor = options.app.selection?.anchor ?? lastClicked ?? options.app.focusDay;
    if (options.app.selection !== undefined) {
      options.app.selection = undefined;
      options.app.hint = undefined;
    }
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
    if (current.kind === "select") {
      if (current.done) return;
      if (current.timer !== undefined && Math.hypot(event.clientX - current.x, event.clientY - current.y) > TOUCH_SLOP_PX) {
        clearTimeout(current.timer);
        current.timer = undefined;
      }
      const day = dayOf(node, document.elementFromPoint(event.clientX, event.clientY));
      if (day === undefined || day === current.current) return;
      // On another day the press is a drag, never a long press any more.
      clearTimeout(current.timer);
      current.timer = undefined;
      current.current = day;
      current.moved = true;
      if (!options.app.selectMode) return;
      select(current.start, day);
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
    if (ended.kind === "select") {
      finish();
      // The mode was left during the press: its selection is gone, and the tap selects nothing.
      if (ended.done || ended.moved || !options.app.selectMode) return;
      // A tap: the second one sets the last day of the range the first one began, a third begins anew.
      const selection = options.app.selection;
      if (tapSelection !== undefined && selection === tapSelection) {
        select(selection.anchor, ended.start);
      } else {
        select(ended.start, ended.start);
        tapSelection = options.app.selection;
      }
      return;
    }
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
    if (event.key !== "Escape" || press === undefined || press.kind === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    const selecting = press.kind === "select";
    finish();
    // Escape during a selection drag drops what it selected.
    if (selecting) {
      options.app.selection = undefined;
      options.app.hint = undefined;
    }
  }

  function onLongPress(): void {
    if (press === undefined || press.kind === "mouse" || press.done) return;
    press.done = true;
    options.onDetail?.(press.start, "touch");
  }

  function onContextMenu(event: MouseEvent): void {
    const day = dayOf(node, event.target);
    if (day === undefined || press?.kind === "mouse" || (press?.kind === "select" && !press.touch)) return;
    // The Mac's Ctrl+click has opened the detail on pointerdown already; only the browser's menu is left.
    if (ctrlClickDetail) {
      ctrlClickDetail = false;
      event.preventDefault();
      return;
    }
    if (press !== undefined) {
      clearTimeout(press.timer);
      // The long press has opened the detail already.
      if (press.done) {
        if (options.onDetail) event.preventDefault();
        return;
      }
      press.done = true;
      if (!options.onDetail) return;
      // The browser's own long press: the sheet opens while the finger is down, like ours.
      event.preventDefault();
      options.onDetail(day, "touch");
      return;
    }
    if (!options.onDetail) return;
    event.preventDefault();
    detailAfterRelease(day, event);
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
      stopWaiting?.();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointercancel", onCancel);
      node.removeEventListener("lostpointercapture", onCancel);
      node.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
