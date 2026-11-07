<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // View 2, the month columns (docs/SPEC.md, "View 2"): one ARIA grid with a column per month and a row per
  // day of the month (or, aligned by weekday, per weekday position). The grid scrolls sideways itself; its day
  // column stays at the inline start. All columns, scrolling, 6 or 3 visible by the width of the calendar
  // area (container queries, "Screen sizes").
  import type { Attachment } from "svelte/attachments";
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
  import { rangeChanges, weekChanges, weekSelection } from "./range.ts";

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

  /**
   * A week-marker click; ignored while a change is being applied, like the cells (gestures.svelte.ts). In the
   * selection mode it selects the week's working days, which the selection bar applies.
   */
  function planWeek(startDay: DayNumber): void {
    if (app.applying) return;
    if (app.selectMode) {
      const range = weekSelection(result, startDay);
      app.select(range, range === undefined ? [] : rangeChanges(result, range.anchor, range.head, "full"));
      return;
    }
    void app.apply(weekChanges(result, startDay));
  }

  /**
   * The months scroll sideways under an overlay scrollbar (Firefox on Linux, macOS, phones): it is drawn over
   * the content, so the grid keeps room for it below row 31. A classic scrollbar takes its own room (the
   * client area is shorter than the box) and gets no extra gap; `scrollbar-width: none` has no scrollbar.
   */
  let overlayScrollbar = $state(false);

  /**
   * Measures on every resize of the grid. The number of columns changes what scrolls without resizing the
   * grid: a new count makes a new attachment, which measures again.
   */
  function watchScrollbar(columns: number): Attachment<HTMLElement> {
    void columns;
    return (element) => {
      const observer = new ResizeObserver(() => {
        overlayScrollbar =
          element.scrollWidth > element.clientWidth &&
          element.offsetHeight === element.clientHeight &&
          getComputedStyle(element).scrollbarWidth !== "none";
      });
      observer.observe(element);
      return () => observer.disconnect();
    };
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
  class:overlay-scrollbar={overlayScrollbar}
  {@attach watchScrollbar(months.length)}
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
          <!-- An empty cell, so every cell stays under its month header. -->
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
                  <!-- The grid keeps one Tab stop (docs/SPEC.md, "Calendar interaction"): the keyboard selects the week with Shift+arrows instead. -->
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
     * and the gaps still scroll the page and the months.
     */
    .columns.selecting :global([data-day]) {
      touch-action: none;
    }

    /* Room for an overlay scrollbar, so it never covers row 31 (see `overlayScrollbar`). */
    .columns.overlay-scrollbar {
      padding-block-end: var(--space-3);
    }

    .columns:focus {
      outline: none;
    }

    @container calendar (inline-size >= 32.5rem) {
      .columns {
        --visible: 6;
      }
    }

    @container calendar (inline-size >= 50rem) {
      .columns {
        --column: minmax(5.5rem, 1fr);
      }
    }

    /*
     * All the columns that fit, each wide enough for "September" and the week markers beside the day and
     * weekday; a longer plan scrolls. 13 still fit at 68.75rem: (1100 px - 48 px - 13 gaps) / 13 is 78.9 px.
     */
    @container calendar (inline-size >= 68.75rem) {
      .columns {
        --column: minmax(4.875rem, 1fr);
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

    @container calendar (inline-size < 50rem) {
      .long {
        display: none;
      }

      .short {
        display: inline;
      }
    }

    /*
     * The calendar-week marker at the block start of the cell that starts a week, left of the lanes. In a
     * narrow cell (6 or 12 columns of about 80 px) the day, its weekday ("28 Mon"), the marker and the lanes
     * don't fit side by side: the marker moves over the block start of the lanes, which go on below it.
     * Narrow means a content box under 92 px, so a cell under 100 px with its 8 px start padding. The place
     * follows from the cell's width (100 % of the containing block) in the same layout: a container query on
     * each cell let Firefox ESR paint the wide place first and move the marker after.
     */
    .week {
      position: absolute;
      inset-block-start: 0;
      inset-inline-end: clamp(1px, (100% - 100px) * 1000, 16px);
      z-index: 2;
      block-size: 0.9rem;
      padding: 0 2px;
      border: 0;
      border-end-start-radius: 3px;
      border-end-end-radius: 3px;
      background: var(--r-weekend);
      box-shadow: inset 0 0 0 1px var(--r-border-strong);
      color: var(--r-text-muted);
      font: inherit;
      font-size: 0.625rem;
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
