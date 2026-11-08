<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // One day of the calendar, drawn in the layers of docs/SPEC.md, "Day cell": background (required work),
  // fill (leave), border (another plan), source lanes, and the ring (today, selection, preview).
  import type { Snippet } from "svelte";
  import type { DayResult } from "../../engine/counting/plan.ts";
  import { textFor } from "../../engine/file/text.ts";
  import { ymdFromDay } from "../../engine/days.ts";
  import { formatDate } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import type { PlanMeta } from "../worker/protocol.ts";
  import { lineStyle, sourceAccent, type CellLane } from "./cell-lanes.ts";
  import { dayLeave, maskStops, workStops } from "./day-leave.ts";
  import { cellLabel, kindOf } from "./label.ts";

  interface Props {
    day: DayResult;
    meta: PlanMeta;
    lanes: readonly CellLane[];
    /** "row" in the month tiles (lanes at the bottom), "column" in the month columns (lanes at the inline end). */
    orientation: "row" | "column";
    /** The grid's one Tab stop (roving tabindex). */
    focused: boolean;
    selected: boolean;
    today: boolean;
    /** A drag would change this day. */
    previewed: boolean;
    /** Drawn inside the cell above the ring: the calendar-week marker of the month columns. */
    marker?: Snippet | undefined;
  }

  let { day, meta, lanes, orientation, focused, selected, today, previewed, marker }: Props = $props();

  const kind = $derived(kindOf(day, meta));
  const leave = $derived(dayLeave(day));
  // A share is drawn where it lies: a mask along the diagonal lets its spans through.
  const ownMask = $derived.by(() => {
    const share = leave.shares.find((candidate) => candidate.kind === "own");
    return share === undefined ? undefined : maskStops(share.spans);
  });
  const mandatoryMask = $derived.by(() => {
    const share = leave.shares.find((candidate) => candidate.kind === "mandatory");
    return share === undefined ? undefined : maskStops(share.spans);
  });
  // A partly free day: where its work block lies on the diagonal; the rest shows the free time's pattern.
  const work = $derived(kind === "halfRequired" || kind === "halfRequiredHoliday" ? workStops(day.required) : undefined);

  /** The sources of the lanes, in the order of the sources list, with their accent and line style. */
  const drawn = $derived(
    lanes.map((lane) => {
      const index = meta.sources.findIndex((source) => source.id === lane.sourceId);
      const source = meta.sources[index];
      return { ...lane, index, accent: source ? sourceAccent(source, index) : 1, style: lineStyle(Math.max(index, 0)) };
    }),
  );
  const more = $derived(drawn.some((lane) => lane.lane === "more"));
  const label = $derived.by(() => {
    const names = [...drawn]
      .sort((a, b) => a.index - b.index)
      .map((lane) => meta.sources[lane.index])
      .filter((source) => source !== undefined)
      .map((source) => textFor(source.name, i18n.lang));
    return cellLabel(day, meta, { t: (key, args) => i18n.t(key, args), locale: i18n.locale }, names);
  });
</script>

<div
  role="gridcell"
  class="cell {kind} leave-{leave.fill} {orientation}"
  class:other-plan={leave.otherPlan}
  class:today
  class:selected
  class:previewed
  data-day={day.day}
  tabindex={focused ? 0 : -1}
  aria-selected={selected}
  aria-label={label}
  title={label}
  style:--work-from={work?.from}
  style:--work-to={work?.to}
>
  <span class="fill" class:own={ownMask !== undefined} style:--mask={ownMask}></span>
  {#if mandatoryMask !== undefined}<span class="mandatory-fill" style:--mask={mandatoryMask}></span>{/if}
  {#if leave.otherPlan}<span class="border"></span>{/if}
  <span class="number">
    {ymdFromDay(day.day).day}
    {#if orientation === "column"}<span class="weekday">{formatDate(day.day, i18n.locale, "weekday")}</span>{/if}
  </span>
  {#if drawn.length > 0}
    <span class="lanes">
      {#each drawn as lane (lane.sourceId)}
        {#if lane.lane !== "more"}
          <i class="lane l{lane.lane} {lane.style}" class:join-start={lane.joinStart} class:join-end={lane.joinEnd} style:--lane-color="var(--r-accent-{lane.accent})"></i>
        {/if}
      {/each}
    </span>
  {/if}
  {#if more}<i class="more"></i>{/if}
  <span class="ring"></span>
  {@render marker?.()}
</div>

<style>
  @layer components {
    .cell {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-inline-size: 0;
      block-size: 2.25rem;
      padding-block-start: 0.2rem;
      border-radius: 3px;
      background: var(--r-workday);
      box-shadow: inset 0 0 0 1px var(--r-border);
      color: var(--r-text);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      /* The direction of the day on the cell: from the start corner to the end corner. */
      --diagonal: 135deg;
    }

    .cell:dir(rtl) {
      --diagonal: 225deg;
    }

    @media (pointer: coarse) {
      .cell {
        block-size: 2.5rem;
      }
    }

    .cell:focus-visible {
      z-index: 2;
      outline: 3px solid var(--r-focus);
      outline-offset: 1px;
    }

    /* Layer 1: the required work. Each day type has its own pattern, not only its own colour. */
    .weekend {
      background: repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px), var(--r-weekend);
      color: var(--r-text-muted);
    }

    .holiday {
      background: radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px, var(--r-holiday);
      font-weight: 700;
    }

    /*
     * Partly required work: the work block is the working-day colour where it lies on the diagonal (in the morning
     * unless the free time is at the start); the free time carries the weekend hatch or the holiday dots.
     */
    .halfRequired,
    .halfRequiredHoliday {
      --work: linear-gradient(
        var(--diagonal),
        transparent var(--work-from, 0%),
        var(--r-workday) var(--work-from, 0%) var(--work-to, 50%),
        transparent var(--work-to, 50%)
      );
    }

    .halfRequired {
      background:
        var(--work),
        repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-half-required);
    }

    .halfRequiredHoliday {
      background:
        var(--work),
        radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px,
        var(--r-holiday);
    }

    /* No work for another reason (a paid closure): crossed hatch. */
    .free {
      background:
        repeating-linear-gradient(in srgb 45deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-weekend);
      color: var(--r-text-muted);
    }

    /*
     * Layer 2: the leave. A kind that is the day's only leave and leaves no work fills the cell; otherwise each
     * share is masked to where it lies on the diagonal (--mask, from day-leave.ts), own leave in blue and
     * mandatory leave in its stripes.
     */
    .fill,
    .mandatory-fill {
      position: absolute;
      inset: 3px;
      border-radius: 2px;
      pointer-events: none;
    }

    .leave-full .fill {
      background: var(--r-leave-full);
    }

    .leave-part .fill.own {
      background: var(--r-leave-half);
      mask-image: linear-gradient(var(--diagonal), var(--mask));
    }

    .leave-mandatory .fill,
    .mandatory-fill {
      background: repeating-linear-gradient(in srgb 45deg, var(--r-mandatory) 0 4px, var(--r-mandatory-stripe) 4px 7px);
    }

    .mandatory-fill {
      mask-image: linear-gradient(var(--diagonal), var(--mask));
    }

    /* Digits on leave that isn't wholly mandatory follow one rule in both modes: the mode's text colour with a surface halo. */
    .leave-full,
    .leave-part {
      color: var(--r-on-leave);
    }

    .leave-full .number,
    .leave-part .number {
      text-shadow: 0 0 2px var(--r-leave-aura), 0 0 1px var(--r-leave-aura);
    }

    .leave-full,
    .leave-mandatory {
      font-weight: 700;
    }

    .leave-mandatory {
      color: var(--r-on-mandatory);
    }

    /* Layer 3: leave from another plan, no deduction. */
    .border {
      position: absolute;
      inset: 1px;
      border: 2px dashed var(--r-other-plan);
      border-radius: inherit;
      pointer-events: none;
    }

    .number {
      position: relative;
      display: flex;
      gap: var(--space-1);
    }

    .weekday {
      opacity: 0.8;
    }

    /* Layer 4: the source lanes, each a surface band with a 3 px line, only where a run is. */
    .lanes {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 1px;
      block-size: 15px;
      pointer-events: none;
    }

    .lane {
      position: absolute;
      inset-inline: 2px;
      block-size: 5px;
      background: var(--r-surface);
    }

    .lane.join-start {
      inset-inline-start: -1px;
    }

    .lane.join-end {
      inset-inline-end: -1px;
    }

    .lane::before {
      content: "";
      position: absolute;
      inset-inline: 0;
      inset-block-start: 1px;
      block-size: 3px;
      background: var(--lane-color);
    }

    .lane.dashed::before {
      background: repeating-linear-gradient(in srgb 90deg, var(--lane-color) 0 7px, transparent 7px 10px);
    }

    .lane.dotted::before {
      background: repeating-linear-gradient(in srgb 90deg, var(--lane-color) 0 3px, transparent 3px 6px);
    }

    .l0 {
      inset-block-end: 0;
    }

    .l1 {
      inset-block-end: 5px;
    }

    .l2 {
      inset-block-end: 10px;
    }

    /* In the month columns the lanes stand at the inline end. */
    .column .lanes {
      inset-block: 0;
      inset-inline: auto 1px;
      block-size: auto;
      inline-size: 15px;
    }

    .column .lane {
      inset-block: 2px;
      inset-inline: auto;
      block-size: auto;
      inline-size: 5px;
    }

    .column .lane.join-start {
      inset-block-start: -1px;
    }

    .column .lane.join-end {
      inset-block-end: -1px;
    }

    .column .lane::before {
      inset-block: 0;
      inset-inline: 1px auto;
      block-size: auto;
      inline-size: 3px;
    }

    .column .lane.dashed::before {
      background: repeating-linear-gradient(in srgb 180deg, var(--lane-color) 0 7px, transparent 7px 10px);
    }

    .column .lane.dotted::before {
      background: repeating-linear-gradient(in srgb 180deg, var(--lane-color) 0 3px, transparent 3px 6px);
    }

    .column .l0 {
      inset-inline-end: 0;
    }

    .column .l1 {
      inset-inline-end: 5px;
    }

    .column .l2 {
      inset-inline-end: 10px;
    }

    /*
     * No query container: the week marker's place follows from the cell's width (MonthColumns.svelte), so
     * Firefox doesn't paint the 365 cells before their container queries are resolved.
     */
    .column {
      block-size: auto;
      min-block-size: 1.25rem;
      justify-content: flex-start;
      align-items: center;
      padding-block: 0;
      padding-inline-start: var(--space-2);
      border-radius: 0;
    }

    /* Touch: a 40 px tap target in the columns too. */
    @media (pointer: coarse) {
      .column {
        min-block-size: 2.5rem;
      }
    }

    /* More than three sources: a "+" in the corner; the label and the detail name them all. */
    /* An even box, so the 2 px bars centre on whole pixels and stay sharp; 3 px keeps it off the cell's frame. */
    .more {
      position: absolute;
      inset-block-start: 3px;
      inset-inline-end: 3px;
      inline-size: 8px;
      block-size: 8px;
      background:
        linear-gradient(var(--r-text), var(--r-text)) center / 100% 2px no-repeat,
        linear-gradient(var(--r-text), var(--r-text)) center / 2px 100% no-repeat;
      pointer-events: none;
    }

    /* Layer 5: today, selection and preview, above the fill. */
    .ring {
      position: absolute;
      inset: 0;
      z-index: 1;
      border-radius: inherit;
      pointer-events: none;
    }

    .cell:hover:not(.selected, .previewed) .ring {
      box-shadow: inset 0 0 0 1px var(--r-text);
    }

    .today .ring {
      border: 2px solid var(--r-today);
    }

    .selected .ring,
    .previewed .ring {
      box-shadow: inset 0 0 0 2px var(--r-selection), inset 0 0 0 3px var(--r-surface);
    }

    /* The preview tints the whole cell, also one with a share of leave. */
    .cell.previewed:not(.leave-full, .leave-mandatory) .fill {
      background: var(--r-preview);
      mask-image: none;
    }

    /* A drag that removes leave (the grid has .removing) hatches what goes. */
    :global(.removing) .cell.previewed .fill {
      background: repeating-linear-gradient(in srgb -45deg, transparent 0 3px, var(--r-overdraft-hatch) 3px 5px);
      mask-image: none;
    }

    :global(.removing) .previewed {
      color: var(--r-text);
    }

    @media (forced-colors: active) {
      .fill,
      .mandatory-fill,
      .ring,
      .lane::before {
        forced-color-adjust: none;
      }

      /* The preview's selector matches the token rule above, so it wins by coming later. */
      .leave-full .fill,
      .cell.previewed:not(.leave-full, .leave-mandatory) .fill {
        background: Highlight;
      }

      /* A share keeps its mask, in Highlight. */
      .leave-part .fill.own {
        background: Highlight;
      }

      .leave-mandatory .fill,
      .mandatory-fill {
        background: repeating-linear-gradient(in srgb 45deg, Highlight 0 4px, Canvas 4px 7px);
      }

      /*
       * Digits on a Highlight fill draw their own HighlightText on Highlight: the browser would put a Canvas
       * backplate behind them, and the halo of the normal modes goes.
       */
      .leave-full .number,
      .leave-mandatory .number,
      .previewed .number {
        forced-color-adjust: none;
        background: Highlight;
        color: HighlightText;
        text-shadow: none;
      }

      /* A drag that removes leave hatches in system colours; its digits stay on Canvas. */
      :global(.removing) .cell.previewed .fill {
        background: repeating-linear-gradient(in srgb -45deg, Canvas 0 3px, CanvasText 3px 5px);
      }

      :global(.removing) .previewed .number {
        background: Canvas;
        color: CanvasText;
      }

      .lane::before {
        background: CanvasText;
      }

      .today .ring {
        border-color: CanvasText;
      }

      .selected .ring,
      .previewed .ring {
        box-shadow: inset 0 0 0 3px Highlight;
      }
    }
  }
</style>
