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
  import { cellLabel, kindOf, leaveOf, ownPart } from "./label.ts";

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
  const leave = $derived(leaveOf(day));
  const part = $derived(ownPart(day));
  const otherPlan = $derived(day.leave.some((piece) => piece.kind === "otherPlan"));

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
  class="cell {kind} leave-{leave} part-{part} {orientation}"
  class:other-plan={otherPlan}
  class:today
  class:selected
  class:previewed
  data-day={day.day}
  tabindex={focused ? 0 : -1}
  aria-selected={selected}
  aria-label={label}
  title={label}
>
  <span class="fill"></span>
  {#if otherPlan}<span class="border"></span>{/if}
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

    /* Layer 1: the required work. Each day type has its own pattern, not only its own colour (Ruling H). */
    .weekend {
      background: repeating-linear-gradient(135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px), var(--r-weekend);
      color: var(--r-text-muted);
    }

    .holiday {
      background: radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px, var(--r-holiday);
      font-weight: 700;
    }

    /* Half required work: the free half (below the diagonal) carries the weekend hatch or the holiday dots. */
    .halfRequired {
      background:
        linear-gradient(135deg, var(--r-workday) 50%, transparent 50%),
        repeating-linear-gradient(135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-half-required);
    }

    .halfRequiredHoliday {
      background:
        linear-gradient(135deg, var(--r-workday) 50%, transparent 50%),
        radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px,
        var(--r-holiday);
    }

    /* Right to left: the split mirrors, so the free half stays at the end of the day (the inline end). */
    .halfRequired:dir(rtl) {
      background:
        linear-gradient(225deg, var(--r-workday) 50%, transparent 50%),
        repeating-linear-gradient(135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-half-required);
    }

    .halfRequiredHoliday:dir(rtl) {
      background:
        linear-gradient(225deg, var(--r-workday) 50%, transparent 50%),
        radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px,
        var(--r-holiday);
    }

    /* No work for another reason (a paid closure): crossed hatch. */
    .free {
      background:
        repeating-linear-gradient(45deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        repeating-linear-gradient(135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-weekend);
      color: var(--r-text-muted);
    }

    /* Layer 2: the leave. */
    .fill {
      position: absolute;
      inset: 3px;
      border-radius: 2px;
      pointer-events: none;
    }

    .leave-full .fill {
      background: var(--r-leave-full);
    }

    .leave-half.part-end .fill {
      background: linear-gradient(135deg, transparent 50%, var(--r-leave-half) 50%);
    }

    .leave-half.part-start .fill {
      background: linear-gradient(135deg, var(--r-leave-half) 50%, transparent 50%);
    }

    .leave-half.part-end:dir(rtl) .fill {
      background: linear-gradient(225deg, transparent 50%, var(--r-leave-half) 50%);
    }

    .leave-half.part-start:dir(rtl) .fill {
      background: linear-gradient(225deg, var(--r-leave-half) 50%, transparent 50%);
    }

    .leave-half.part-start .number {
      text-shadow: 0 0 2px var(--r-surface), 0 0 1px var(--r-surface);
    }

    .leave-mandatory .fill {
      background: repeating-linear-gradient(45deg, var(--r-mandatory) 0 4px, color-mix(in oklab, var(--r-mandatory) 72%, var(--r-text)) 4px 7px);
    }

    .leave-full,
    .leave-mandatory {
      font-weight: 700;
    }

    /* Light digits on the leave blue; in dark mode a dark halo keeps them clear of the blue's edges. */
    .leave-full {
      color: var(--r-on-leave);
      text-shadow: 0 0 2px var(--r-leave-aura), 0 0 1px var(--r-leave-aura);
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
      background: repeating-linear-gradient(90deg, var(--lane-color) 0 7px, transparent 7px 10px);
    }

    .lane.dotted::before {
      background: repeating-linear-gradient(90deg, var(--lane-color) 0 3px, transparent 3px 6px);
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
      background: repeating-linear-gradient(180deg, var(--lane-color) 0 7px, transparent 7px 10px);
    }

    .column .lane.dotted::before {
      background: repeating-linear-gradient(180deg, var(--lane-color) 0 3px, transparent 3px 6px);
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
    .more {
      position: absolute;
      inset-block-start: 2px;
      inset-inline-end: 2px;
      inline-size: 7px;
      block-size: 7px;
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

    .cell.previewed:not(.leave-full, .leave-mandatory) .fill {
      background: color-mix(in oklab, var(--r-leave-full) 35%, transparent);
    }

    /* A drag that removes leave (the grid has .removing) hatches what goes. */
    :global(.removing) .cell.previewed .fill {
      background: repeating-linear-gradient(-45deg, transparent 0 3px, color-mix(in oklab, var(--r-overdraft) 55%, transparent) 3px 5px);
    }

    :global(.removing) .previewed {
      color: var(--r-text);
    }

    @media (forced-colors: active) {
      .fill,
      .ring,
      .lane::before {
        forced-color-adjust: none;
      }

      .leave-full .fill,
      .previewed .fill {
        background: Highlight;
      }

      .leave-half.part-end .fill {
        background: linear-gradient(135deg, transparent 50%, Highlight 50%);
      }

      .leave-half.part-start .fill {
        background: linear-gradient(135deg, Highlight 50%, transparent 50%);
      }

      .leave-half.part-end:dir(rtl) .fill {
        background: linear-gradient(225deg, transparent 50%, Highlight 50%);
      }

      .leave-half.part-start:dir(rtl) .fill {
        background: linear-gradient(225deg, Highlight 50%, transparent 50%);
      }

      .leave-mandatory .fill {
        background: repeating-linear-gradient(45deg, Highlight 0 4px, Canvas 4px 7px);
      }

      .leave-full,
      .leave-mandatory {
        color: HighlightText;
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
