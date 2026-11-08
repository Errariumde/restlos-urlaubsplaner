<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import type { DayNumber } from "../../engine/days.ts";
  import AllowanceBar from "../allowance/AllowanceBar.svelte";
  import AllowancePanel from "../allowance/AllowancePanel.svelte";
  import { legendOf } from "../allowance/legend.ts";
  import DayDetail from "../calendar/DayDetail.svelte";
  import HintLine from "../calendar/HintLine.svelte";
  import MonthColumns from "../calendar/MonthColumns.svelte";
  import MonthTiles from "../calendar/MonthTiles.svelte";
  import SelectionBar from "../calendar/SelectionBar.svelte";
  import Button from "../controls/Button.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { pluralCount, formatDays } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import { shortcut } from "../state/keys.ts";
  import { today as todayNow } from "../state/today.ts";
  import { belowRem } from "../state/width.ts";
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    /** Today's day number; the gallery fixes it so its screenshots stay the same. */
    today?: DayNumber;
  }

  let { today = todayNow() }: Props = $props();

  // The width limits are in rem, like the views' container queries (520 px, 800 px at the default text size).
  /** Below this width of the app (not of the window) the toolbar moves its less used controls into a menu. */
  const COMPACT_BELOW = 32.5;

  /** From this width of the app the allowance panel is a sidebar; below it, a bar above the calendar. */
  const SIDEBAR_FROM = 50;

  /** What 1rem is in pixels: the root font size, which the browser's text size setting changes. */
  const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  let width = $state<number>();
  let detailsOpen = $state(false);
  let detailsButton = $state<HTMLButtonElement>();
  let heading = $state<HTMLHeadingElement>();

  // The main screen has just replaced the start screen: the focus would otherwise be lost with the old button.
  $effect(() => heading?.focus());
  const compact = $derived(width !== undefined && belowRem(width, COMPACT_BELOW, rem()));
  const sidebar = $derived(width !== undefined && !belowRem(width, SIDEBAR_FROM, rem()));
  /** What the calendar draws, for the legend at the end of the allowance panel. */
  const legend = $derived(app.state ? legendOf(app.state.result, app.state.meta) : undefined);

  // Crossing a threshold closes the details: they must neither pop up as a modal sheet when the app narrows
  // nor reappear when it narrows again after being wide. Only these two values are read here, so the effect
  // doesn't run when the Details button toggles.
  $effect(() => {
    if (sidebar || compact) detailsOpen = false;
  });

  /** Below this width of the calendar area the detail of a day is a bottom sheet, not a popover. */
  const DETAIL_SHEET_BELOW = 32.5;

  /** The compact allowance bar (with the hint line under it) is shown instead of the sidebar. */
  const barShown = $derived(app.state !== undefined && width !== undefined && !sidebar);
  /** The height of the compact bar with the hint line, which stick to the top of the window over the calendar. */
  let barSize = $state<number>();
  /** The height of the hint line that sticks to the top of the calendar area beside the sidebar. */
  let hintSize = $state<number>();
  /** The hint line's height and its one-line slot's: a wrapped line grows past the slot over the calendar. */
  let hintLine = $state(0);
  let hintSlot = $state(0);
  /**
   * What covers the top of the window over the calendar, with a wrapped hint line. Each binding keeps its
   * last value once its element goes, so only the one that is shown counts; in the selection mode the hint
   * line is in the selection bar, and the sidebar layout has nothing there.
   */
  const stuckSize = $derived.by(() => {
    if (app.selectMode) return barShown ? barSize : undefined;
    const size = barShown ? barSize : hintSize;
    return size === undefined ? undefined : size + Math.max(0, hintLine - hintSlot);
  });
  const stuckBlockStart = $derived(stuckSize === undefined ? undefined : `${String(stuckSize)}px`);

  /** The selection bar's height: it covers the bottom of the window over the calendar in the selection mode. */
  let selectionBarSize = $state(0);
  const stuckBlockEnd = $derived(app.selectMode ? `${String(selectionBarSize)}px` : undefined);

  /** The sidebar's content is taller than the window, so the sidebar scrolls itself. */
  let panelScrolls = $state(false);

  /** Measures when the sidebar (the window's height) or its content (more stretches) changes size. */
  function watchPanel(panel: HTMLElement): () => void {
    const observer = new ResizeObserver(() => {
      panelScrolls = panel.scrollHeight > panel.clientHeight;
    });
    observer.observe(panel);
    for (const child of panel.children) observer.observe(child);
    return () => observer.disconnect();
  }

  let calendarWidth = $state<number>();
  let calendar = $state<HTMLElement>();

  /** Below this width of the app, or on a touch screen, the toolbar offers the touch selection mode. */
  const SELECT_BELOW = 50;
  const coarse = new MediaQuery("(pointer: coarse)");
  const selectable = $derived(coarse.current || (width !== undefined && belowRem(width, SELECT_BELOW, rem())));
  /**
   * Changes the grid's layout: the view (V and the toolbar) or the alignment by weekday (W). The detail closes
   * first, since its anchor cell goes with the old layout. The focused day stays: it is scrolled into view in
   * the new layout and keeps the focus if the old grid or the detail had it.
   */
  async function relayout(change: () => void): Promise<void> {
    const active = document.activeElement;
    const refocus = (calendar?.contains(active) ?? false) || (detail !== undefined && active?.closest("[popover], dialog") != null);
    detail = undefined;
    change();
    await tick();
    const cell = calendar?.querySelector<HTMLElement>(`[data-day="${String(app.focusDay)}"]`);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (refocus) cell?.focus({ preventScroll: true });
  }

  function switchView(view: "tiles" | "columns"): Promise<void> {
    return view === app.view ? Promise.resolve() : relayout(() => (app.view = view));
  }

  interface DetailRequest {
    readonly day: DayNumber;
    readonly anchor: HTMLElement;
    readonly sheet: boolean;
  }

  let detail = $state.raw<DetailRequest>();

  /** Opens the detail of a day in the period; asking again for the day that is shown changes nothing. */
  function openDetail(day: DayNumber, anchor: HTMLElement, pointerType?: string): void {
    const state = app.state;
    if (state === undefined || day < state.result.period.from || day > state.result.period.to) return;
    if (detail?.day === day && detail.anchor === anchor) return;
    // A sheet on a narrow calendar and on a touch screen (as the toolbar's More menu), and always
    // for a touch: a long press opens it while the finger is down, and lifting it would light-dismiss a popover.
    const narrow = calendarWidth !== undefined && belowRem(calendarWidth, DETAIL_SHEET_BELOW, rem());
    const sheet = narrow || matchMedia("(pointer: coarse)").matches || pointerType === "touch";
    detail = { day, anchor, sheet };
  }

  /**
   * A problem's row in the allowance panel (docs/SPEC.md, "Problems"): the details close where they cover the
   * calendar (the bar's details, the phone's sheet), the day scrolls into view and takes the focus, and its detail
   * opens next to it.
   */
  async function showProblem(day: DayNumber): Promise<void> {
    if (!sidebar) detailsOpen = false;
    app.focusDay = day;
    await tick();
    const cell = calendar?.querySelector<HTMLElement>(`[data-day="${String(day)}"]`);
    if (!cell) return;
    cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    cell.focus({ preventScroll: true });
    openDetail(day, cell);
  }

  /** Only the request that is shown closes it: a popover replaced by the next one reports its close late. */
  function closeDetail(request: DetailRequest): void {
    if (detail === request) detail = undefined;
  }

  /** Text fields keep their letters; checkboxes and radio buttons are not text input. */
  const NOT_TEXT = new Set(["button", "submit", "reset", "range", "color", "file", "image", "checkbox", "radio"]);

  function takesText(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
    return target instanceof HTMLInputElement && !NOT_TEXT.has(target.type);
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || takesText(event.target)) return;
    // A modal dialog (the sheet) owns the keyboard while it is open.
    if (document.querySelector("dialog[open]")) return;
    const action = shortcut(event);
    // Holding a toggle key must not flip it back and forth; undo and redo may repeat.
    if (event.repeat && action !== "undo" && action !== "redo") return;
    switch (action) {
      case "undo":
        event.preventDefault();
        if (app.state?.canUndo) void app.undo();
        break;
      case "redo":
        event.preventDefault();
        if (app.state?.canRedo) void app.redo();
        break;
      case "view":
        void switchView(app.view === "tiles" ? "columns" : "tiles");
        break;
      case "align":
        if (app.view === "columns") void relayout(() => (app.align = !app.align));
        break;
      case "weeks":
        app.weeks = !app.weeks;
        break;
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="screen" bind:clientWidth={width} style:--stuck-block-start={stuckBlockStart} style:--stuck-block-end={stuckBlockEnd}>
  <Toolbar {compact} {selectable} onview={(view: "tiles" | "columns") => void switchView(view)} bind:heading />
  <!--
    The hint line is the drag's feedback (docs/SPEC.md, "Calendar interaction"), so it sticks with the
    allowance: under the compact bar here, at the top of the calendar area beside the sidebar. It is rendered
    in one place only, so there is one live region. In the selection mode it moves into the selection bar.
  -->
  {#if app.state && barShown}
    {@const { meta, result } = app.state}
    <div class="stuck" bind:offsetHeight={barSize}>
      <section class="compact-bar stack" aria-label={i18n.t("allowance.label")} style:--gap="var(--space-2)">
        <div class="cluster compact-head">
          <p class="left">{i18n.t("allowance.left", { days: formatDays(result.totals.remaining, i18n.locale), count: pluralCount(result.totals.remaining) })}</p>
          {#if result.problems.length > 0}
            <!-- The list is in the details. -->
            <p class="problem-count">{i18n.t("allowance.problemCount", { count: result.problems.length })}</p>
          {/if}
          <Button bind:element={detailsButton} expanded={detailsOpen} controls="allowance-details" onclick={() => (detailsOpen = !detailsOpen)}>
            {i18n.t("allowance.details")}
          </Button>
        </div>
        <AllowanceBar allowance={meta.allowance} planned={result.totals.planned} />
        {#if !compact}
          <!-- Always there, so aria-controls points at something; the Sheet takes this id below 520 px. -->
          <div id="allowance-details" hidden={!detailsOpen}>
            {#if detailsOpen}
              <AllowancePanel
                allowance={meta.allowance}
                totals={result.totals}
                stretches={result.stretches}
                showBar={false}
                problems={result.problems}
                period={result.period}
                onproblem={(day: DayNumber) => void showProblem(day)}
                {legend}
              />
            {/if}
          </div>
        {/if}
      </section>
      {#if !app.selectMode}
        <HintLine overlay bind:lineSize={hintLine} bind:slotSize={hintSlot} />
      {/if}
    </div>
    {#if compact}
      <Sheet id="allowance-details" anchor={detailsButton} open={detailsOpen} onclose={() => (detailsOpen = false)} label={i18n.t("allowance.label")}>
        <AllowancePanel
          allowance={meta.allowance}
          totals={result.totals}
          stretches={result.stretches}
          showBar={false}
          problems={result.problems}
          period={result.period}
          onproblem={(day: DayNumber) => void showProblem(day)}
          {legend}
        />
      </Sheet>
    {/if}
  {/if}
  <div class="workspace">
    <div class="area">
      {#if !barShown && !app.selectMode}
        <div class="stuck" bind:offsetHeight={hintSize}>
          <HintLine overlay bind:lineSize={hintLine} bind:slotSize={hintSlot} />
        </div>
      {/if}
      <main bind:this={calendar} class="calendar" bind:clientWidth={calendarWidth}>
        {#if app.state && app.view === "tiles"}
          <MonthTiles meta={app.state.meta} result={app.state.result} {today} onDetail={openDetail} />
        {:else if app.state}
          <MonthColumns meta={app.state.meta} result={app.state.result} {today} onDetail={openDetail} />
        {/if}
      </main>
    </div>
    {#if app.state && sidebar}
      <!-- After the calendar in the document and on screen (at the inline end). -->
      <!--
        Stays in view while the page scrolls (docs/SPEC.md: the allowance is always visible). When its content
        is taller than the window it scrolls itself, and then takes the focus so the keyboard can scroll it.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <aside class="panel" aria-label={i18n.t("allowance.label")} tabindex={panelScrolls ? 0 : undefined} {@attach watchPanel}>
        <AllowancePanel
          allowance={app.state.meta.allowance}
          totals={app.state.result.totals}
          stretches={app.state.result.stretches}
          problems={app.state.result.problems}
          period={app.state.result.period}
          onproblem={(day: DayNumber) => void showProblem(day)}
          {legend}
        />
      </aside>
    {/if}
  </div>
  {#if app.state}
    {@const { meta, result } = app.state}
    <!-- A new popover or sheet for each request: its anchor and its focus handling belong to that cell. -->
    {#each detail ? [detail] : [] as request (request)}
      {@const dayResult = result.days[request.day - (result.days[0]?.day ?? 0)]}
      {#if dayResult}
        <DayDetail
          day={dayResult}
          {meta}
          problems={result.problems}
          presentation={request.sheet ? "sheet" : "popover"}
          anchor={request.anchor}
          onclose={() => closeDetail(request)}
        />
      {/if}
    {/each}
  {/if}
  {#if app.state && app.selectMode}
    <!-- Last in the screen: it sticks to the bottom of the window and ends the page below the calendar. -->
    <SelectionBar bind:size={selectionBarSize} />
  {/if}
</div>

<style>
  @layer components {
    .workspace {
      display: flex;
      min-inline-size: 0;
    }

    /*
     * The allowance is always visible (docs/SPEC.md, "Main screen"): the compact bar and the hint line stick
     * to the top of the window, above the cells and the columns' day column, below the selection bar. Beside
     * the sidebar the hint line alone sticks to the top of the calendar area.
     */
    .stuck {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
    }

    /* Expanded details scroll inside the bar, so it never takes more than half the window. */
    .compact-bar {
      max-block-size: 50dvh;
      overflow-y: auto;
      padding: var(--space-3) var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface);
    }

    /*
     * A cell scrolled into view (keyboard, view switch) stops below the sticky region and a wrapped hint line,
     * and above the selection bar.
     */
    .calendar :global([data-day]) {
      scroll-margin-block-start: var(--stuck-block-start, 0);
      scroll-margin-block-end: var(--stuck-block-end, 0);
    }

    .compact-head {
      justify-content: space-between;
    }

    .left {
      font-weight: 600;
    }

    /* Pushes the Details button to the end, as the remaining days do without it. */
    .problem-count {
      margin-inline-end: auto;
      color: var(--r-overdraft);
      font-weight: 600;
    }

    /* The sidebar sits at the inline end of the workspace, after the calendar. */
    /* It sticks to the top of the window; a long list of stretches scrolls inside it. */
    .panel {
      position: sticky;
      inset-block-start: 0;
      flex: 0 0 var(--sidebar-size, 20rem);
      align-self: flex-start;
      min-inline-size: 0;
      max-block-size: 100dvh;
      overflow-y: auto;
      padding: var(--space-4);
      border-inline-start: 1px solid var(--r-border);
    }

    /*
     * The line between calendar and sidebar runs the full height, also below the end of the sidebar: the
     * calendar draws it on top of the sidebar's own line, so neither loses a pixel of width.
     */
    .workspace:has(.panel) .area {
      margin-inline-end: -1px;
      border-inline-end: 1px solid var(--r-border);
    }

    /* The hint line and the calendar; as tall as the workspace, so the hint line sticks all the way down. */
    .area {
      flex: 1;
      min-inline-size: 0;
    }

    /* The views switch on this width, not the window's (docs/SPEC.md, "Screen sizes"). */
    .calendar {
      min-inline-size: 0;
      padding: var(--space-4);
      container: calendar / inline-size;
    }
  }
</style>
