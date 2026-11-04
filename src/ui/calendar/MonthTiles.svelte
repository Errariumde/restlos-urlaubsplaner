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
  import { nextDay, type NavKey } from "./grid-nav.ts";
  import { periodMonths, tileWeeks } from "./months.ts";
  import { weekChanges } from "./range.ts";
  import WeekNumber from "./WeekNumber.svelte";

  interface Props {
    meta: PlanMeta;
    result: PlanResult;
    /** Today's day number, for the today ring. */
    today: DayNumber;
    /** Opens the detail of a day (long press, right-click); Task 13 sets it. */
    onDetail?: ((day: DayNumber) => void) | undefined;
  }

  let { meta, result, today, onDetail }: Props = $props();

  const NAV_KEYS: ReadonlySet<string> = new Set<NavKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
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

  function focusCell(day: DayNumber): void {
    app.focusDay = day;
    grid?.querySelector<HTMLElement>(`[data-day="${String(day)}"]`)?.focus();
  }

  function cellDay(target: EventTarget | null): DayNumber | undefined {
    const cell = target instanceof Element ? target.closest<HTMLElement>("[data-day]") : null;
    return cell ? Number(cell.dataset.day) : undefined;
  }

  function onkeydown(event: KeyboardEvent): void {
    // Shift+arrows (the selection) and the other keys of the grid come with the detail popover (Task 13).
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !NAV_KEYS.has(event.key)) return;
    const from = cellDay(event.target);
    if (from === undefined) return;
    event.preventDefault();
    const ctx = { dir: i18n.dir, weekStart: meta.weekStart, period: result.period, alignByWeekday: app.align };
    focusCell(nextDay("tiles", event.key as NavKey, from, ctx));
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
  class:removing={dragPreview.range?.action === "remove"}
  role="grid"
  aria-label={i18n.t("calendar.label")}
  tabindex="-1"
  use:calendarGestures={{ getResult: () => result, app, onDetail }}
  {onkeydown}
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
            <WeekNumber week={week.isoWeek} onclick={() => app.apply(weekChanges(result, week.startDay))} />
          {/if}
          {#each week.cells as day, column (column)}
            {#if day === null}
              <span class="pad" aria-hidden="true"></span>
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
      /* Moving a finger scrolls the page; ranges on touch come with the selection mode. */
      touch-action: auto;
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
