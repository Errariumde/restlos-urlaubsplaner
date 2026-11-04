<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // View 2, the month columns (docs/SPEC.md, "View 2"): one ARIA grid with a column per month and a row per
  // day of the month (or, aligned by weekday, per weekday position). The grid scrolls sideways itself; its day
  // column stays at the inline start. All columns, scrolling, 6 or 3 visible by the width of the calendar
  // area (container queries, "Screen sizes").
  import type { PlanResult } from "../../engine/counting/plan.ts";
  import type { DayNumber } from "../../engine/days.ts";
  import { formatDate } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { PlanMeta } from "../worker/protocol.ts";
  import { periodCellLanes, type CellLane } from "./cell-lanes.ts";
  import DayCell from "./DayCell.svelte";
  import { calendarGestures, dragPreview } from "./gestures.svelte.ts";
  import { calendarKeyboard } from "./keyboard.svelte.ts";
  import { columnRows, columnWeekMarker, offsetInWeek, periodMonths } from "./months.ts";
  import { weekChanges } from "./range.ts";

  interface Props {
    meta: PlanMeta;
    result: PlanResult;
    /** Today's day number, for the today ring. */
    today: DayNumber;
    /** Opens the detail of a day next to its cell: right-click, long press, Enter or the context-menu key. */
    onDetail: (day: DayNumber, anchor: HTMLElement, pointerType?: string) => void;
  }

  let { meta, result, today, onDetail }: Props = $props();

  const NO_LANES: readonly CellLane[] = [];

  let grid = $state<HTMLElement>();

  const months = $derived(periodMonths(meta.period));
  const rows = $derived(columnRows(months, app.align, meta.weekStart));
  /** With more than one year in the period, every header names its year (two Januaries are told apart). */
  const withYear = $derived(meta.period.from.year !== meta.period.to.year);
  /** The day of the first weekday row: any day that starts a week. */
  const firstRowDay = $derived(months[0] ? months[0].first - offsetInWeek(months[0].first, meta.weekStart) : 0);

  /** The source lanes of every day; in a column every day follows the one above. */
  const lanes = $derived(periodCellLanes(months, result, meta.sources, meta.weekStart, "column"));

  const firstDay = $derived(result.days[0]?.day ?? 0);
  const focusDay = $derived(app.focusDay ?? result.period.from);

  function isSelected(day: DayNumber): boolean {
    const selection = app.selection;
    if (selection === undefined) return false;
    return day >= Math.min(selection.anchor, selection.head) && day <= Math.max(selection.anchor, selection.head);
  }

  function cellDay(target: EventTarget | null): DayNumber | undefined {
    const cell = target instanceof Element ? target.closest<HTMLElement>("[data-day]") : null;
    return cell ? Number(cell.dataset.day) : undefined;
  }

  /** A long press or a right-click: the detail opens next to the day's cell. */
  function detailOf(day: DayNumber, pointerType: string): void {
    const cell = grid?.querySelector<HTMLElement>(`[data-day="${String(day)}"]`);
    if (cell) onDetail(day, cell, pointerType);
  }

  /** A week-marker click; ignored while a change is being applied, like the cells (gestures.svelte.ts). */
  function planWeek(startDay: DayNumber): void {
    if (!app.applying) void app.apply(weekChanges(result, startDay));
  }

  function onfocusin(event: FocusEvent): void {
    const day = cellDay(event.target);
    if (day !== undefined) app.focusDay = day;
  }
</script>

<div
  bind:this={grid}
  class="columns"
  class:selecting={app.selectMode}
  class:removing={dragPreview.range?.action === "remove"}
  style:--months={months.length}
  role="grid"
  aria-label={i18n.t("calendar.label")}
  aria-multiselectable="true"
  tabindex="-1"
  use:calendarGestures={{ getResult: () => result, app, onDetail: detailOf }}
  use:calendarKeyboard={{ view: () => "columns", app, openDetail: onDetail }}
  {onfocusin}
>
  <div class="row" role="row">
    <span class="corner" role="columnheader">{app.align ? i18n.t("calendar.weekdayColumn") : i18n.t("calendar.dayColumn")}</span>
    {#each months as month (month.first)}
      <span class="month" role="columnheader">
        <span class="long">{formatDate(month.first, i18n.locale, withYear ? "monthLongYear" : "month")}</span>
        <span class="short">{formatDate(month.first, i18n.locale, withYear ? "monthYear" : "monthShort")}</span>
      </span>
    {/each}
  </div>
  {#each rows as row, index (index)}
    <div class="row" role="row">
      <span class="day" role="rowheader">
        {app.align ? formatDate(firstRowDay + index, i18n.locale, "weekday") : index + 1}
      </span>
      {#each row as day, column (column)}
        {#if day === null}
          <!-- An empty cell, so every cell stays under its month header (Ruling V). -->
          <span class="pad" role="gridcell"></span>
        {:else}
          {@const dayResult = result.days[day - firstDay]}
          {@const week = app.weeks ? columnWeekMarker(day, meta.weekStart, result.period.from) : undefined}
          {#if dayResult}
            <DayCell
              day={dayResult}
              {meta}
              lanes={lanes.get(day) ?? NO_LANES}
              orientation="column"
              focused={day === focusDay}
              selected={isSelected(day)}
              today={day === today}
              previewed={dragPreview.range?.days.has(day) ?? false}
            >
              {#snippet marker()}
                {#if week}
                  {@const label = i18n.t("calendar.week", { week: week.isoWeek })}
                  <!-- The grid keeps one Tab stop (D4): the keyboard selects the week with Shift+arrows instead. -->
                  <button type="button" class="week" tabindex="-1" aria-label={label} title={label} onclick={() => planWeek(week.startDay)}>
                    {week.isoWeek}
                  </button>
                {/if}
              {/snippet}
            </DayCell>
          {/if}
        {/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  @layer components {
    .columns {
      --day-column: 3rem;
      --gap: 2px;
      --visible: 3;
      /* The width that shows --visible month columns next to the day column. */
      --column: calc((100cqi - var(--day-column) - var(--visible) * var(--gap)) / var(--visible));
      display: grid;
      grid-template-columns: var(--day-column) repeat(var(--months), var(--column));
      gap: var(--gap);
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      /* A cell scrolled into view (focus, keyboard) stops beside the sticky day column, not under it. */
      scroll-padding-inline-start: var(--day-column);
      /* Moving a finger scrolls the months (ranges on touch come with the selection mode); no double-tap zoom. */
      touch-action: manipulation;
    }

    /*
     * In the selection mode a finger on a day selects instead of scrolling (gestures.svelte.ts); the headers
     * and the gaps still scroll the page and the months (Ruling U).
     */
    .columns.selecting :global([data-day]) {
      touch-action: none;
    }

    .columns:focus {
      outline: none;
    }

    @container calendar (inline-size >= 520px) {
      .columns {
        --visible: 6;
      }
    }

    @container calendar (inline-size >= 800px) {
      .columns {
        --column: minmax(5.5rem, 1fr);
      }
    }

    @container calendar (inline-size >= 1100px) {
      .columns {
        --column: minmax(0, 1fr);
      }
    }

    .row {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }

    /* The day column stays while the months scroll. */
    .corner,
    .day {
      position: sticky;
      inset-inline-start: 0;
      z-index: 3;
      background: var(--r-surface);
      color: var(--r-text-muted);
      font-size: var(--font-size-0);
      font-variant-numeric: tabular-nums;
    }

    .day {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-inline-end: var(--space-2);
    }

    .corner {
      align-self: end;
      padding-inline-end: var(--space-2);
      text-align: end;
    }

    .month {
      min-inline-size: 0;
      padding-block-end: var(--space-1);
      font-size: var(--font-size-1);
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .short {
      display: none;
    }

    @container calendar (inline-size < 800px) {
      .long {
        display: none;
      }

      .short {
        display: inline;
      }
    }

    /* The calendar-week marker at the block start of the cell that starts a week, left of the lanes. */
    .week {
      position: absolute;
      inset-block-start: 0;
      inset-inline-end: 16px;
      z-index: 2;
      block-size: 0.9rem;
      padding: 0 3px;
      border: 0;
      border-end-start-radius: 3px;
      border-end-end-radius: 3px;
      background: var(--r-weekend);
      box-shadow: inset 0 0 0 1px var(--r-border-strong);
      color: var(--r-text-muted);
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      line-height: 0.9rem;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }

    .week:hover {
      background: var(--r-surface-raised);
      color: var(--r-text);
    }

    .week:active {
      background: var(--r-control-hover);
    }

    /* Touch: a target 40 px tall (the cell's height) and at most 24 px wide, so the day keeps most of the cell. */
    @media (pointer: coarse) {
      .week::after {
        content: "";
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 50%;
        inline-size: 1.5rem;
        block-size: 2.5rem;
        translate: -50% 0;
      }

      .week:dir(rtl)::after {
        translate: 50% 0;
      }
    }
  }
</style>
