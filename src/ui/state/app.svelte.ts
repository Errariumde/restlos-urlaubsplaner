// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The central state of the page: which screen shows, the last plan state from the engine worker and the
// view settings. Every change of the plan goes through the worker; the page never computes costs itself.
import workerSource from "virtual:restlos-worker";
import type { DayNumber } from "../../engine/days.ts";
import { startEngine, type Engine } from "../worker/client.ts";
import type { Hint, LeaveChange, PlanState } from "../worker/protocol.ts";
import { initialFocusDay, today } from "./today.ts";

/** The id of the data block the build embeds the example plan in (scripts/build/vite-restlos.ts). */
const EXAMPLE_BLOCK_ID = "example-plan";

class App {
  screen = $state<"start" | "main">("start");
  /** The last state from the worker. */
  state = $state.raw<PlanState | undefined>(undefined);
  view = $state<"tiles" | "columns">("tiles");
  /** Sets `data-scheme` and `color-scheme` on `<html>` (App.svelte, scheme.ts); "auto" follows `prefers-color-scheme`. */
  mode = $state<"light" | "dark" | "auto">("auto");
  /** Calendar weeks. */
  weeks = $state(true);
  /** Align the month columns by weekday. */
  align = $state(false);
  focusDay = $state<DayNumber | undefined>(undefined);
  selection = $state<{ anchor: DayNumber; head: DayNumber } | undefined>(undefined);
  hint = $state.raw<Hint | undefined>(undefined);
  #selectMode = $state(false);

  /**
   * The touch selection mode (D8): a drag or two taps select a range, which the selection bar applies.
   * Leaving it ends the selection and its hint.
   */
  get selectMode(): boolean {
    return this.#selectMode;
  }

  set selectMode(on: boolean) {
    this.#selectMode = on;
    if (!on) {
      this.selection = undefined;
      this.hint = undefined;
    }
  }

  /** The example couldn't be opened; the start screen says so. */
  openFailed = $state(false);

  #engine: Engine | undefined;
  #opening = false;

  /** The worker starts with the first plan that is opened. */
  #engineNow(): Engine {
    this.#engine ??= startEngine(workerSource, (url) => new Worker(url));
    return this.#engine;
  }

  /** Opens the built-in example from its data block and shows the main screen. */
  async openExample(): Promise<void> {
    if (this.#opening) return;
    this.#opening = true;
    this.openFailed = false;
    try {
      const text = document.getElementById(EXAMPLE_BLOCK_ID)?.textContent;
      if (!text) throw new Error(`The page has no #${EXAMPLE_BLOCK_ID} data block.`);
      const state = await this.#engineNow().open(text, true);
      this.state = state;
      this.focusDay = initialFocusDay(state.meta.period, today());
      this.selection = undefined;
      this.hint = undefined;
      this.screen = "main";
    } catch (error) {
      this.openFailed = true;
      console.error(error);
    } finally {
      this.#opening = false;
    }
  }

  /**
   * An apply, undo or redo is on its way to the worker. The calendar ignores new input meanwhile: it would be
   * computed from the state before the change (a second click wouldn't take the first one back).
   */
  applying = $state(false);
  #inFlight = 0;

  /** Waits for a new state from the worker, with `applying` set meanwhile. */
  async #change(request: () => Promise<PlanState>): Promise<void> {
    this.#inFlight += 1;
    this.applying = true;
    try {
      this.state = await request();
    } finally {
      this.#inFlight -= 1;
      this.applying = this.#inFlight > 0;
    }
  }

  /** Sets the plan's own leave; no worker call when nothing changes. */
  async apply(changes: readonly LeaveChange[]): Promise<void> {
    if (changes.length === 0) return;
    const copy = $state.snapshot(changes);
    await this.#change(() => this.#engineNow().apply(copy));
  }

  /**
   * Shows what the changes would do, unless a newer request made the hint stale or `current` says the
   * gesture that asked for it is over (a drag that ended while the worker was still computing).
   */
  async preview(changes: readonly LeaveChange[], current: () => boolean = () => true): Promise<void> {
    const hint = await this.#engineNow().preview($state.snapshot(changes));
    if (hint !== undefined && current()) this.hint = hint;
  }

  /**
   * Selects a range (or ends the selection) and previews `changes`, the days the selection bar's Full day
   * would set. A preview that arrives after the selection changed or ended doesn't refill the hint.
   */
  select(range: { anchor: DayNumber; head: DayNumber } | undefined, changes: readonly LeaveChange[]): void {
    this.selection = range;
    this.hint = undefined;
    if (range === undefined) return;
    const mine = this.selection;
    void this.preview(changes, () => this.selection === mine);
  }

  async undo(): Promise<void> {
    await this.#change(() => this.#engineNow().undo());
  }

  async redo(): Promise<void> {
    await this.#change(() => this.#engineNow().redo());
  }
}

export const app = new App();
