<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // View 1, the month tiles (docs/SPEC.md, "View 1"): one ARIA grid over all months with a roving tabindex
  // (D4), 4, 3, 2 or 1 tiles per row by the width of the calendar area (container queries).
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
  import { periodMonths, tileWeeks } from "./months.ts";
  import { rangeChanges, weekChanges, weekSelection } from "./range.ts";
  import WeekNumber from "./WeekNumber.svelte";

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

  /** The layout follows the plan's period and week start only. */
  const months = $derived(
    periodMonths(meta.period).map((month) => ({
      month,
      id: `month-${String(month.first)}`,
      weeks: tileWeeks(month, meta.weekStart),
    })),
  );

  /** The columns' weekday names, from the first week row (any full week starts on the week start). */
  const weekdays = $derived(Array.from({ length: 7 }, (_, i) => (months[0]?.weeks[0]?.startDay ?? 0) + i));

  /** The source lanes of every day, computed once per result. */
  const lanes = $derived(periodCellLanes(months.map(({ month }) => month), result, meta.sources, meta.weekStart, "row"));

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
   * A week-number click; ignored while a change is being applied, like the cells (gestures.svelte.ts). In the
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

  function onfocusin(event: FocusEvent): void {
    const day = cellDay(event.target);
    if (day !== undefined) app.focusDay = day;
  }
</script>

<div
  bind:this={grid}
  class="tiles"
  class:weeks={app.weeks}
  class:selecting={app.selectMode}
  class:removing={dragPreview.range?.action === "remove"}
  role="grid"
  aria-label={i18n.t("calendar.label")}
  aria-multiselectable="true"
  tabindex="-1"
  use:calendarGestures={{ getResult: () => result, app, onDetail: detailOf }}
  use:calendarKeyboard={{ view: () => "tiles", app, openDetail: onDetail }}
  {onfocusin}
>
  {#each months as { month, id, weeks } (month.first)}
    <div class="tile" role="rowgroup" aria-labelledby={id}>
      <div class="row" role="row">
        <div class="title" role="columnheader">
          <h2 {id}>{formatDate(month.first, i18n.locale, "monthLongYear")}</h2>
        </div>
      </div>
      <div class="row heads" role="row">
        {#if app.weeks}
          <span class="head" role="columnheader">{i18n.t("calendar.weekShort")}</span>
        {/if}
        {#each weekdays as weekday (weekday)}
          <span class="head" role="columnheader">{formatDate(weekday, i18n.locale, "weekday")}</span>
        {/each}
      </div>
      {#each weeks as week (week.startDay)}
        <div class="row" role="row">
          {#if app.weeks}
            <WeekNumber week={week.isoWeek} onclick={() => planWeek(week.startDay)} />
          {/if}
          {#each week.cells as day, column (column)}
            {#if day === null}
              <!-- An empty cell, so every cell stays under its weekday header (Ruling V). -->
              <span class="pad" role="gridcell"></span>
            {:else}
              {@const dayResult = result.days[day - firstDay]}
              {#if dayResult}
                <DayCell
                  day={dayResult}
                  {meta}
                  lanes={lanes.get(day) ?? NO_LANES}
                  orientation="row"
                  focused={day === focusDay}
                  selected={isSelected(day)}
                  today={day === today}
                  previewed={dragPreview.range?.days.has(day) ?? false}
                />
              {/if}
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  @layer components {
    .tiles {
      --per-row: 1;
      display: grid;
      grid-template-columns: repeat(var(--per-row), minmax(0, 1fr));
      gap: var(--space-4);
      align-items: start;
      /* Moving a finger scrolls the page (ranges on touch come with the selection mode); no double-tap zoom. */
      touch-action: manipulation;
    }

    /*
     * In the selection mode a finger on a day selects instead of scrolling (gestures.svelte.ts); the headers
     * and the gaps still scroll the page (Ruling U).
     */
    .tiles.selecting :global([data-day]) {
      touch-action: none;
    }

    .tiles:focus {
      outline: none;
    }

    @container calendar (inline-size >= 520px) {
      .tiles {
        --per-row: 2;
      }
    }

    @container calendar (inline-size >= 800px) {
      .tiles {
        --per-row: 3;
      }
    }

    @container calendar (inline-size >= 1100px) {
      .tiles {
        --per-row: 4;
      }
    }

    .tile {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 2px;
      min-inline-size: 0;
      padding: var(--space-2) var(--space-2) var(--space-3);
      border: 1px solid var(--r-border);
      border-radius: 8px;
      background: var(--r-surface);
    }

    .weeks .tile {
      grid-template-columns: 1.5rem repeat(7, minmax(0, 1fr));
    }

    /* Touch: the week number gets a 40 px wide column, its tap target (WeekNumber.svelte). */
    @media (pointer: coarse) {
      .weeks .tile {
        grid-template-columns: 2.5rem repeat(7, minmax(0, 1fr));
      }
    }

    .row {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }

    .title {
      grid-column: 1 / -1;
    }

    h2 {
      margin-block-end: var(--space-1);
      font-size: var(--font-size-1);
      font-weight: 700;
    }

    .head {
      color: var(--r-text-muted);
      font-size: var(--font-size-0);
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
  }
</style>
