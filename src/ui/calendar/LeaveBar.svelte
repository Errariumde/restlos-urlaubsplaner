<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The leave part of the day detail (docs/SPEC.md, "Detail view" and "Leave bar"): the leave as a line with the
  // "Full day" checkbox, and the leave bar below it, one switch per part of the plan's unit with the fixed blocks
  // beside them. One Tab stop with arrow keys; after a press the focus stays in the bar. Pressing a switch and
  // dragging along the bar sets how far the leave reaches; the bar draws the change meanwhile, and the engine's cost
  // and work left for it go to the detail's lines through `preview`.
  import { onDestroy, tick, untrack } from "svelte";
  import type { DayResult } from "../../engine/counting/plan.ts";
  import type { Part } from "../../engine/counting/types.ts";
  import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
  import Checkbox from "../controls/Checkbox.svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { Hint, LeaveChange } from "../worker/protocol.ts";
  import { amountText, fixedText, partText, percent, switchText, type DaySpan, type OffKind, type SwitchSegment } from "./detail.ts";
  import { dragEdge, leaveSwitch, nearest, reach, withOwnLeave, type LeaveSwitch } from "./leave-switch.ts";

  interface Props {
    day: DayResult;
    /** The day's leave bar. */
    leave: LeaveSwitch;
    /** The plan's smallest leave unit, which the bar is split into. */
    minUnit: Units;
    /** The pattern of the day's free time, which the blocks of time without work show as the Soll bar does. */
    off: OffKind;
    /** The detail's content: it takes the focus when the control just used is gone and no switch is near. */
    content: HTMLElement | undefined;
    /** Makes a change. */
    onapply: (change: LeaveChange) => Promise<void> | void;
    /** Asks what a change would do; `undefined` for an answer that a newer request made stale. */
    onpreview: (change: LeaveChange) => Promise<Hint | undefined> | Hint | undefined;
    /** While a drag shows a change: the day's cost and work left after it, as the engine gives them. */
    preview?: Hint["day"];
  }

  let { day, leave, minUnit, off, content, onapply, onpreview, preview = $bindable() }: Props = $props();

  const words = $derived({ t: (key: string, args?: Record<string, string | number>) => i18n.t(key, args), locale: i18n.locale });

  let bar = $state<HTMLElement>();
  /** Whether the bar is still shown: a change can take the leave part away while it is being made. */
  let mounted = true;
  onDestroy(() => {
    mounted = false;
  });

  /** A pointer pressed on a switch, until it lets go. */
  interface Drag {
    readonly pointerId: number;
    /** The pressed switch: after the change the focus goes near it when it is gone. */
    readonly pressed: DaySpan;
    /** The part the press started on, and the edge of the day the leave reaches from. */
    readonly start: number;
    readonly edge: Part;
    /** The part of the switch nearest to the pointer. */
    readonly index: number;
    /** The pointer has been over another part: the release applies the drag. Else it is a plain press. */
    readonly moved: boolean;
    /** The pointer is on the bar (`onBar`); a release off it changes nothing, and the bar shows no change meanwhile. */
    readonly inside: boolean;
    /** Escape ended it, or its pointer let go and its change is on its way. */
    readonly state: "down" | "cancelled" | "released";
  }

  let drag = $state.raw<Drag>();
  /** The change the drag shows. */
  const dragged = $derived(drag?.moved === true && drag.inside && drag.state !== "cancelled" ? reach(day, minUnit, drag.edge, drag.index) : undefined);
  /** What the bar draws: the day with the dragged change, else as it is. */
  const shown = $derived(dragged === undefined ? leave : leaveSwitch(withOwnLeave(day, dragged), minUnit));

  /**
   * The leave bar's switches that a press can change, in the order of the day: the stops of its arrow keys. Of the
   * bar as it is, also during a drag.
   */
  const usable = $derived(leave.segments.filter((segment): segment is SwitchSegment => segment.kind === "switch" && segment.change !== undefined));

  /**
   * The switch at `from` in the bar as it is. During a drag a drawn switch takes its state for assistive technology
   * from it, so screen readers hear only the result, not the steps; the preview shows in the switch's look only.
   */
  function actual(from: Units): SwitchSegment | undefined {
    return leave.segments.find((segment): segment is SwitchSegment => segment.kind === "switch" && segment.from === from);
  }

  /** The switch the focus was on last, on this day. */
  let focused = $state<{ day: number; from: Units }>();
  /** The bar's one Tab stop (roving tabindex): the switch the focus was on last, else the first one. */
  const stop = $derived(usable.find((segment) => focused?.day === day.day && segment.from === focused.from)?.from ?? usable[0]?.from);

  function focusSwitch(from: Units): void {
    bar?.querySelector<HTMLElement>(`[data-from="${String(from)}"]`)?.focus();
  }

  /** The arrow keys move to the next or the previous switch (in the reading direction), Home and End to the first or the last. */
  function moveInBar(event: KeyboardEvent, from: Units): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const at = usable.findIndex((segment) => segment.from === from);
    const ahead = i18n.dir === "rtl" ? -1 : 1;
    const steps: Record<string, number> = { ArrowRight: at + ahead, ArrowLeft: at - ahead, ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: usable.length - 1 };
    const to = steps[event.key];
    if (to === undefined || at < 0) return;
    event.preventDefault();
    const target = usable[Math.max(0, Math.min(to, usable.length - 1))];
    if (target) focusSwitch(target.from);
  }

  /**
   * One click or drag, one change, one undo step. The detail stays open and shows the day as it is now. `pressed` is
   * the switch that made the change: if it is gone or disabled now, the focus goes to the switch nearest to it.
   */
  async function run(change: LeaveChange | undefined, pressed?: DaySpan): Promise<void> {
    if (change === undefined || app.applying) return;
    const root = content;
    await onapply(change);
    await tick();
    // The control just used may be disabled or gone now: keep the focus in the detail.
    const active = document.activeElement;
    const stale = active === null || active === document.body || ((active instanceof HTMLButtonElement || active instanceof HTMLInputElement) && active.disabled);
    if (!root?.isConnected || (!stale && root.contains(active))) return;
    const near = mounted && pressed !== undefined ? nearest(usable, pressed) : undefined;
    if (near !== undefined) focusSwitch(near.from);
    else (root.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? root).focus();
  }

  /**
   * After a drag that changed nothing: the preview may have taken the pressed switch away (own leave on free time),
   * and the focus with it. Then it goes to the switch nearest to the pressed one, which is mostly that one again.
   */
  async function keepFocus(pressed: DaySpan): Promise<void> {
    await tick();
    const active = document.activeElement;
    if (!mounted || (active !== null && active !== document.body)) return;
    const near = nearest(usable, pressed);
    if (near !== undefined) focusSwitch(near.from);
  }

  /**
   * Hides a segment's text while it doesn't fit: a part too narrow for its text shows none. The hidden text keeps its
   * box, which follows the segment's width and the text's own, so a change of either (a wider detail, another
   * language, a loaded font) measures it again.
   */
  function hideWhenCut(text: HTMLElement): () => void {
    const observer = new ResizeObserver(() => {
      text.classList.toggle("cut", text.scrollWidth > text.clientWidth);
    });
    observer.observe(text);
    return () => observer.disconnect();
  }

  /** The part of the switch nearest to the viewport x: over a fixed block or past an end of the bar, the nearest switch's. */
  function partAt(x: number): number | undefined {
    if (!bar) return undefined;
    const boxes = [...bar.querySelectorAll<HTMLElement>("[data-from]")].map((element) => {
      const box = element.getBoundingClientRect();
      return { from: box.left, to: box.right, at: Number(element.dataset["from"]) };
    });
    const hit = nearest(boxes, { from: x, to: x });
    return hit === undefined ? undefined : Math.floor(hit.at / (UNITS_PER_DAY / shown.parts));
  }

  /**
   * Whether the pointer is on the bar: past either end it still is (and picks the end switch); above or below it only
   * within the bar's own height.
   */
  function onBar(event: PointerEvent): boolean {
    const box = bar?.getBoundingClientRect();
    return box !== undefined && event.clientY >= box.top - box.height && event.clientY <= box.bottom + box.height;
  }

  /** A release that is no press: the click that follows it, if any, does nothing. */
  let swallowClick = false;

  function ignoreClick(): void {
    swallowClick = true;
    // The click comes in the same task as the release, if at all.
    setTimeout(() => (swallowClick = false));
  }

  /** Stops the click after a drag or a release off the bar before it reaches a switch (capture phase). */
  function swallow(event: MouseEvent): void {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }

  /** A primary pointer pressed on a switch starts a drag; one that is still going on was lost and gives way. */
  function press(event: PointerEvent, segment: SwitchSegment): void {
    if (!event.isPrimary || event.button !== 0 || app.applying || segment.change === undefined) return;
    const start = Math.floor(segment.from / (UNITS_PER_DAY / shown.parts));
    drag = { pointerId: event.pointerId, pressed: { from: segment.from, to: segment.to }, start, edge: dragEdge(day, minUnit, start), index: start, moved: false, inside: true, state: "down" };
    capture(event.currentTarget, event.pointerId);
  }

  /** Sends the pointer's events to the element (they also reach the window's listeners below without it). */
  function capture(target: EventTarget | null, pointerId: number): void {
    try {
      if (target instanceof Element) target.setPointerCapture(pointerId);
    } catch {
      // A pointer the browser doesn't know, from an event made by a script.
    }
  }

  function follow(event: PointerEvent): void {
    const current = drag;
    if (current?.state !== "down" || event.pointerId !== current.pointerId) return;
    const index = partAt(event.clientX) ?? current.index;
    const inside = onBar(event);
    const moved = current.moved || index !== current.start;
    if (moved && !current.moved) {
      // The pressed switch may go in the preview; the bar keeps the pointer.
      capture(bar ?? null, event.pointerId);
    }
    if (index !== current.index || inside !== current.inside || moved !== current.moved) drag = { ...current, index, inside, moved };
  }

  /**
   * The pointer lets go: on the bar after a drag the shown change is applied as one change, and the bar keeps
   * drawing it until it is in. A release without a drag is a press, made by the click that follows; a release
   * off the bar or after Escape changes nothing.
   */
  function release(event: PointerEvent): void {
    const current = drag;
    if (current === undefined || current.state === "released" || event.pointerId !== current.pointerId) return;
    const inside = onBar(event);
    if (current.state === "down" && !current.moved && inside) {
      drag = undefined;
      return;
    }
    ignoreClick();
    if (current.state === "cancelled" || !current.moved || !inside) {
      drag = undefined;
      void keepFocus(current.pressed);
      return;
    }
    const index = partAt(event.clientX) ?? current.index;
    const done: Drag = { ...current, index, inside, state: "released" };
    drag = done;
    void run(reach(day, minUnit, done.edge, index), done.pressed).finally(() => {
      if (drag === done) drag = undefined;
    });
  }

  /** A cancelled pointer, or leaving the window, ends the drag without a change. */
  function drop(event: PointerEvent | FocusEvent): void {
    const current = drag;
    if (current === undefined || current.state === "released") return;
    if (event instanceof PointerEvent && event.pointerId !== current.pointerId) return;
    drag = undefined;
    if (event instanceof PointerEvent) void keepFocus(current.pressed);
  }

  /** Escape ends a drag, not the detail; the release that follows changes nothing. */
  function escape(event: KeyboardEvent): void {
    const current = drag;
    if (event.key !== "Escape" || current?.state !== "down") return;
    event.preventDefault();
    event.stopPropagation();
    drag = { ...current, state: "cancelled" };
    void keepFocus(current.pressed);
  }

  // The engine's cost and work left for the shown change, once it answers; an answer for an older change is dropped.
  $effect(() => {
    const change = dragged;
    if (change === undefined) {
      if (preview !== undefined) preview = undefined;
      return;
    }
    let current = true;
    void Promise.resolve(untrack(() => onpreview(change))).then((hint) => {
      if (current && hint?.day !== undefined) preview = hint.day;
    });
    return () => {
      current = false;
    };
  });
</script>

<!-- A drag's pointer wherever it goes, first of all listeners (capture). -->
<svelte:window
  onpointermovecapture={follow}
  onpointerupcapture={release}
  onpointercancelcapture={drop}
  onkeydowncapture={escape}
  onblur={drop}
/>

{#snippet stretch(span: DaySpan, from: Units, whole: Units, kind: string)}
  <span class="stretch {kind}" style:inset-inline-start={percent(span.from - from, whole)} style:inline-size={percent(span.to - span.from, whole)} aria-hidden="true"
  ></span>
{/snippet}

<div class="part">
  <div class="line">
    <!-- The value line: the label and the amount, or at zero a dash that screen readers hear as `none`. -->
    <p>
      {#if shown.amount > 0}
        <span class="name">{i18n.t("detail.leave.label")}</span>
        <b>{amountText(shown.amount, words)}</b>
      {:else}
        <span class="name" aria-hidden="true">{i18n.t("detail.leave.label")}</span>
        <b aria-hidden="true">{i18n.t("detail.zero")}</b><span class="spoken">{i18n.t("detail.leave.none")}</span>
      {/if}
    </p>
    {#if shown.fullDay}
      {@const fullDay = shown.fullDay}
      <Checkbox
        label={i18n.t("detail.fullDay")}
        checked={fullDay.checked === "true"}
        mixed={fullDay.checked === "mixed"}
        disabled={!fullDay.change}
        onchange={() => void run(fullDay.change)}
      />
    {/if}
  </div>
  <!--
    One element per segment, in the order of the day, each as wide as its share of the day. Switches are
    toggle buttons named by their part; fixed blocks show a short word and are read by their full name.
  -->
  <div
    class={["bar switches", { few: shown.parts <= 4 }]}
    role="group"
    aria-label={i18n.t("detail.actions")}
    bind:this={bar}
    onclickcapture={swallow}
  >
    {#each shown.segments as segment (segment.from)}
      {#if segment.kind === "switch"}
        <!-- A switch only the preview has is hidden from assistive technology until the drag ends. -->
        {@const now = actual(segment.from)}
        <button
          type="button"
          class={["segment", { pressed: segment.pressed === "true", unavailable: !segment.change }]}
          style:flex-basis={percent(segment.to - segment.from)}
          data-from={segment.from}
          tabindex={segment.from === stop ? 0 : -1}
          aria-label={switchText(segment, words.t)}
          aria-hidden={now === undefined ? "true" : undefined}
          aria-pressed={(now ?? segment).pressed}
          disabled={!(now ?? segment).change}
          onfocus={() => (focused = { day: day.day, from: segment.from })}
          onkeydown={(event) => moveInBar(event, segment.from)}
          onpointerdown={(event) => press(event, segment)}
          onclick={() => void run(segment.change, segment)}
        >
          {#each segment.fills as fill (fill.from)}
            {@render stretch(fill, segment.from, segment.to - segment.from, fill.kind)}
          {/each}
          <span class="text" {@attach hideWhenCut}>{partText(segment.name, words.t)}</span>
        </button>
      {:else}
        <span class={["locked", segment.kind, segment.kind === "free" && `off-${off}`]} style:flex-basis={percent(segment.to - segment.from)}>
          <span class="text" aria-hidden="true" {@attach hideWhenCut}>{segment.kind === "free" ? i18n.t("detail.off") : i18n.t("detail.locked", { kind: segment.kind })}</span>
          <span class="spoken">{fixedText(segment, words.t)}</span>
        </span>
      {/if}
    {/each}
  </div>
</div>

<style>
  @layer components {
    /* The rules of the detail's parts and value lines (DayDetail.svelte), for the leave part. */
    .part {
      display: grid;
      gap: var(--space-1);
    }

    /* The leave line with its checkbox at the end. */
    .line {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-2);
      align-items: center;
      justify-content: space-between;
    }

    .name {
      color: var(--r-text-muted);
    }

    b {
      font-weight: 700;
      white-space: nowrap;
    }

    /* Read by screen readers, not shown. */
    .spoken {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /*
     * The bar: segments of the day side by side, each as long as its share of the day (its flex-basis), over the
     * full width, so that they line up with the blocks of the Soll bar above.
     */
    .bar {
      display: flex;
      min-block-size: 1.75rem;
      overflow: hidden;
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      font-size: var(--font-size-1);
      font-weight: 700;
    }

    /* A drag along the bar selects no text, and a finger moving sideways on it drags instead of scrolling. */
    .switches {
      user-select: none;
    }

    /*
     * The segments can be a sliver of the day, so their padding sits on the text, and a segment too narrow for
     * its text shows none.
     */
    .segment,
    .locked {
      position: relative;
      display: grid;
      min-inline-size: 0;
      place-items: center;
      padding-inline: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .switches .text {
      max-inline-size: 100%;
      padding-inline: var(--space-1);
    }

    /* A text that doesn't fit (hideWhenCut) keeps its box, so that it can be measured again. */
    .switches .text:global(.cut) {
      visibility: hidden;
    }

    /*
     * With up to four parts (units 1, ½, ⅓ and ¼) a switch is never narrower than the touch size: the fixed blocks
     * beside it give way first.
     */
    .few .segment {
      min-inline-size: 2.75rem;
    }

    .switches .locked {
      flex-shrink: 1000;
    }

    .bar > :not(:first-child) {
      border-inline-start: 1px solid var(--r-border-strong);
    }

    /* The blocks of time without work look exactly like the free time of the Soll bar above them. */
    .locked.free.off-weekend {
      background: var(--r-fill-weekend);
    }

    .locked.free.off-holiday {
      background: var(--r-fill-holiday);
    }

    .locked.free.off-halfRequired {
      background: var(--r-fill-half-required);
    }

    .locked.free.off-free {
      background: var(--r-fill-free);
    }

    /* The leave switches: grey where no leave is taken, the leave drawn inside as the cell draws it. */
    .segment {
      margin: 0;
      border: 0;
      background: var(--r-border);
      color: var(--r-text);
      font: inherit;
      font-weight: 400;
      cursor: pointer;
      touch-action: pan-y pinch-zoom;
    }

    .segment:focus-visible {
      z-index: 1;
      outline: 3px solid var(--r-focus);
      outline-offset: -3px;
    }

    /* The look follows the switch as drawn, also in a drag's preview; the attributes stay with the bar as it is. */
    .segment.unavailable {
      color: var(--r-text-muted);
      cursor: not-allowed;
    }

    .segment.pressed {
      color: var(--r-on-leave);
      font-weight: 700;
    }

    .segment.pressed .text {
      text-shadow: 0 0 2px var(--r-leave-aura), 0 0 1px var(--r-leave-aura);
    }

    .text {
      position: relative;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stretch {
      position: absolute;
      inset-block: 0;
    }

    .stretch.own {
      background: var(--r-leave-full);
    }

    .stretch.mandatory,
    .locked.mandatory {
      background: var(--r-fill-mandatory);
    }

    .locked.mandatory {
      color: var(--r-on-mandatory);
    }

    .stretch.otherPlan,
    .locked.otherPlan {
      background: var(--r-surface);
      outline: 2px dashed var(--r-other-plan);
      outline-offset: -3px;
    }

    /* Forced colours: own leave and pressed switches in the highlight colours, the other kinds outlined. */
    @media (forced-colors: active) {
      .stretch.own {
        forced-color-adjust: none;
        background: Highlight;
      }

      .segment.pressed {
        forced-color-adjust: none;
        color: HighlightText;
      }

      .segment.pressed .text {
        text-shadow: none;
      }

      .stretch.mandatory,
      .locked.mandatory {
        outline: 2px solid CanvasText;
        outline-offset: -3px;
      }
    }
  }
</style>
