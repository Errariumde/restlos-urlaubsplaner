<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The leave part of the day detail (docs/SPEC.md, "Detail view" and "Leave bar"): the leave as a line with the
  // "Full day" checkbox, and the leave bar below it, one switch per part of the plan's unit with the fixed blocks
  // beside them. One Tab stop with arrow keys; after a press the focus stays in the bar.
  import { onDestroy, tick } from "svelte";
  import type { DayResult } from "../../engine/counting/plan.ts";
  import type { Units } from "../../engine/weight.ts";
  import Checkbox from "../controls/Checkbox.svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { LeaveChange } from "../worker/protocol.ts";
  import { amountText, fixedText, partText, percent, switchText, type DaySpan, type OffKind, type SwitchSegment } from "./detail.ts";
  import { nearest, type LeaveSwitch } from "./leave-switch.ts";

  interface Props {
    day: DayResult;
    /** The day's leave bar. */
    leave: LeaveSwitch;
    /** The pattern of the day's free time, which the blocks of time without work show as the Soll bar does. */
    off: OffKind;
    /** The detail's content: it takes the focus when the control just used is gone and no switch is near. */
    content: HTMLElement | undefined;
    /** Makes a change. */
    onapply: (change: LeaveChange) => Promise<void> | void;
  }

  let { day, leave, off, content, onapply }: Props = $props();

  const words = $derived({ t: (key: string, args?: Record<string, string | number>) => i18n.t(key, args), locale: i18n.locale });

  let bar = $state<HTMLElement>();
  /** Whether the bar is still shown: a change can take the leave part away while it is being made. */
  let mounted = true;
  onDestroy(() => {
    mounted = false;
  });

  /** The leave bar's switches that a press can change, in the order of the day: the stops of its arrow keys. */
  const usable = $derived(leave.segments.filter((segment): segment is SwitchSegment => segment.kind === "switch" && segment.change !== undefined));
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
   * One click, one change, one undo step. The detail stays open and shows the day as it is now. `pressed` is the
   * switch that made the change: if it is gone or disabled now, the focus goes to the switch nearest to it.
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
</script>

{#snippet stretch(span: DaySpan, from: Units, whole: Units, kind: string)}
  <span class="stretch {kind}" style:inset-inline-start={percent(span.from - from, whole)} style:inline-size={percent(span.to - span.from, whole)} aria-hidden="true"
  ></span>
{/snippet}

<div class="part">
  <div class="line">
    <!-- The value line: the label and the amount, or at zero a dash that screen readers hear as `none`. -->
    <p>
      {#if leave.amount > 0}
        <span class="name">{i18n.t("detail.leave.label")}</span>
        <b>{amountText(leave.amount, words)}</b>
      {:else}
        <span class="name" aria-hidden="true">{i18n.t("detail.leave.label")}</span>
        <b aria-hidden="true">{i18n.t("detail.zero")}</b><span class="spoken">{i18n.t("detail.leave.none")}</span>
      {/if}
    </p>
    {#if leave.fullDay}
      {@const fullDay = leave.fullDay}
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
  <div class={["bar switches", { few: leave.parts <= 4 }]} role="group" aria-label={i18n.t("detail.actions")} bind:this={bar}>
    {#each leave.segments as segment (segment.from)}
      {#if segment.kind === "switch"}
        <button
          type="button"
          class="segment"
          style:flex-basis={percent(segment.to - segment.from)}
          data-from={segment.from}
          tabindex={segment.from === stop ? 0 : -1}
          aria-label={switchText(segment, day.required, words.t)}
          aria-pressed={segment.pressed}
          disabled={!segment.change}
          onfocus={() => (focused = { day: day.day, from: segment.from })}
          onkeydown={(event) => moveInBar(event, segment.from)}
          onclick={() => void run(segment.change, segment)}
        >
          {#each segment.fills as fill (fill.from)}
            {@render stretch(fill, segment.from, segment.to - segment.from, fill.kind)}
          {/each}
          <span class="text">{partText(segment.name, words.t)}</span>
        </button>
      {:else}
        <span class={["locked", segment.kind, segment.kind === "free" && `off-${off}`]} style:flex-basis={percent(segment.to - segment.from)}>
          <span class="text" aria-hidden="true">{segment.kind === "free" ? i18n.t("detail.off") : i18n.t("detail.locked", { kind: segment.kind })}</span>
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
      container-type: inline-size;
    }

    .switches .text {
      max-inline-size: 100%;
      padding-inline: var(--space-1);
    }

    @container (inline-size < 2.5rem) {
      .switches .text {
        display: none;
      }
    }

    /*
     * With up to four parts (units 1, ½ and ¼) a switch is never narrower than the touch size: the fixed blocks
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
    }

    .segment:focus-visible {
      z-index: 1;
      outline: 3px solid var(--r-focus);
      outline-offset: -3px;
    }

    .segment:disabled {
      color: var(--r-text-muted);
      cursor: not-allowed;
    }

    .segment[aria-pressed="true"] {
      color: var(--r-on-leave);
      font-weight: 700;
    }

    .segment[aria-pressed="true"] .text {
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

      .segment[aria-pressed="true"] {
        forced-color-adjust: none;
        color: HighlightText;
      }

      .segment[aria-pressed="true"] .text {
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
