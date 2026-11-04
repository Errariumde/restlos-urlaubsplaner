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
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    /** Today's day number; the gallery fixes it so its screenshots stay the same. */
    today?: DayNumber;
  }

  let { today = todayNow() }: Props = $props();

  /** Below this width of the app (not of the window) the toolbar moves its less used controls into a menu. */
  const COMPACT_BELOW = 520;

  /** From this width of the app the allowance panel is a sidebar; below it, a bar above the calendar. */
  const SIDEBAR_FROM = 800;

  let width = $state<number>();
  let detailsOpen = $state(false);
  let detailsButton = $state<HTMLButtonElement>();
  let heading = $state<HTMLHeadingElement>();

  // The main screen has just replaced the start screen: the focus would otherwise be lost with the old button.
  $effect(() => heading?.focus());
  const compact = $derived(width !== undefined && width < COMPACT_BELOW);
  const sidebar = $derived(width !== undefined && width >= SIDEBAR_FROM);

  // Crossing a threshold closes the details: they must neither pop up as a modal sheet when the app narrows
  // nor reappear when it narrows again after being wide. Only these two values are read here, so the effect
  // doesn't run when the Details button toggles.
  $effect(() => {
    if (sidebar || compact) detailsOpen = false;
  });

  /** Below this width of the calendar area the detail of a day is a bottom sheet, not a popover. */
  const DETAIL_SHEET_BELOW = 520;

  /** The height of the compact allowance bar, which sticks to the top of the window over the calendar. */
  let barSize = $state<number>();
  /** What covers the top of the window over the calendar; the binding keeps its last value once the bar goes. */
  const stuckBlockStart = $derived(app.state && width !== undefined && !sidebar && barSize !== undefined ? `${String(barSize)}px` : undefined);

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
  const SELECT_BELOW = 800;
  const coarse = new MediaQuery("(pointer: coarse)");
  const selectable = $derived(coarse.current || (width !== undefined && width < SELECT_BELOW));
  /**
   * Switches the view (V and the toolbar). The detail closes first, since its anchor cell goes with the old
   * view. The focused day stays: it is scrolled into view in the new view and keeps the focus if the old grid
   * or the detail had it.
   */
  async function switchView(view: "tiles" | "columns"): Promise<void> {
    if (view === app.view) return;
    const active = document.activeElement;
    const refocus = (calendar?.contains(active) ?? false) || (detail !== undefined && active?.closest("[popover], dialog") != null);
    detail = undefined;
    app.view = view;
    await tick();
    const cell = calendar?.querySelector<HTMLElement>(`[data-day="${String(app.focusDay)}"]`);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (refocus) cell?.focus({ preventScroll: true });
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
    // A sheet on a narrow calendar and on a touch screen (as the toolbar's More menu, Ruling P), and always
    // for a touch: a long press opens it while the finger is down, and lifting it would light-dismiss a popover.
    const narrow = calendarWidth !== undefined && calendarWidth < DETAIL_SHEET_BELOW;
    const sheet = narrow || matchMedia("(pointer: coarse)").matches || pointerType === "touch";
    detail = { day, anchor, sheet };
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
        if (app.view === "columns") app.align = !app.align;
        break;
      case "weeks":
        app.weeks = !app.weeks;
        break;
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="screen" bind:clientWidth={width} style:--stuck-block-start={stuckBlockStart}>
  <Toolbar {compact} {selectable} onview={(view: "tiles" | "columns") => void switchView(view)} bind:heading />
  <!-- In the selection mode the hint line moves into the selection bar, next to its actions. -->
  {#if !app.selectMode}
    <HintLine />
  {/if}
  {#if app.state && width !== undefined && !sidebar}
    {@const { meta, result } = app.state}
    <section class="compact-bar stack" aria-label={i18n.t("allowance.label")} style:--gap="var(--space-2)" bind:offsetHeight={barSize}>
      <div class="cluster compact-head">
        <p class="left">{i18n.t("allowance.left", { days: formatDays(result.totals.remaining, i18n.locale), count: pluralCount(result.totals.remaining) })}</p>
        <Button bind:element={detailsButton} expanded={detailsOpen} controls="allowance-details" onclick={() => (detailsOpen = !detailsOpen)}>
          {i18n.t("allowance.details")}
        </Button>
      </div>
      <AllowanceBar allowance={meta.allowance} planned={result.totals.planned} />
      {#if !compact}
        <!-- Always there, so aria-controls points at something; the Sheet takes this id below 520 px. -->
        <div id="allowance-details" hidden={!detailsOpen}>
          {#if detailsOpen}
            <AllowancePanel allowance={meta.allowance} totals={result.totals} stretches={result.stretches} showBar={false} />
          {/if}
        </div>
      {/if}
    </section>
    {#if compact}
      <Sheet id="allowance-details" anchor={detailsButton} open={detailsOpen} onclose={() => (detailsOpen = false)} label={i18n.t("allowance.label")}>
        <AllowancePanel allowance={meta.allowance} totals={result.totals} stretches={result.stretches} showBar={false} />
      </Sheet>
    {/if}
  {/if}
  <div class="workspace">
    <main bind:this={calendar} class="calendar" bind:clientWidth={calendarWidth}>
      {#if app.state && app.view === "tiles"}
        <MonthTiles meta={app.state.meta} result={app.state.result} {today} onDetail={openDetail} />
      {:else if app.state}
        <MonthColumns meta={app.state.meta} result={app.state.result} {today} onDetail={openDetail} />
      {/if}
    </main>
    {#if app.state && sidebar}
      <!-- After the calendar in the document and on screen (at the inline end). -->
      <!--
        Stays in view while the page scrolls (docs/SPEC.md: the allowance is always visible). When its content
        is taller than the window it scrolls itself, and then takes the focus so the keyboard can scroll it.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <aside class="panel" aria-label={i18n.t("allowance.label")} tabindex={panelScrolls ? 0 : undefined} {@attach watchPanel}>
        <AllowancePanel allowance={app.state.meta.allowance} totals={app.state.result.totals} stretches={app.state.result.stretches} />
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
    <SelectionBar />
  {/if}
</div>

<style>
  @layer components {
    .workspace {
      display: flex;
      min-inline-size: 0;
    }

    /*
     * The allowance is always visible (docs/SPEC.md, "Main screen"): the bar sticks to the top of the window,
     * above the cells and the columns' day column, below the selection bar. Expanded details scroll inside
     * it, so it never takes more than half the window.
     */
    .compact-bar {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
      max-block-size: 50dvh;
      overflow-y: auto;
      padding: var(--space-3) var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface);
    }

    /* A cell scrolled into view (keyboard, view switch) stops below the sticky bar, not under it. */
    .calendar :global([data-day]) {
      scroll-margin-block-start: var(--stuck-block-start, 0);
    }

    .compact-head {
      justify-content: space-between;
    }

    .left {
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
    .workspace:has(.panel) .calendar {
      margin-inline-end: -1px;
      border-inline-end: 1px solid var(--r-border);
    }

    /* The views switch on this width, not the window's (docs/SPEC.md, "Screen sizes"). */
    .calendar {
      flex: 1;
      min-inline-size: 0;
      padding: var(--space-4);
      container: calendar / inline-size;
    }
  }
</style>
