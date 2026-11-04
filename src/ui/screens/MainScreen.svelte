<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { DayNumber } from "../../engine/days.ts";
  import AllowanceBar from "../allowance/AllowanceBar.svelte";
  import AllowancePanel from "../allowance/AllowancePanel.svelte";
  import HintLine from "../calendar/HintLine.svelte";
  import MonthTiles from "../calendar/MonthTiles.svelte";
  import Button from "../controls/Button.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { dayCount, formatDays } from "../i18n/format.ts";
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
        app.view = app.view === "tiles" ? "columns" : "tiles";
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

<div class="screen" bind:clientWidth={width}>
  <Toolbar {compact} bind:heading />
  <HintLine />
  {#if app.state && width !== undefined && !sidebar}
    {@const { meta, result } = app.state}
    <section class="compact-bar stack" aria-label={i18n.t("allowance.label")} style:--gap="var(--space-2)">
      <div class="cluster compact-head">
        <p class="left">{i18n.t("allowance.left", { days: formatDays(result.totals.remaining, i18n.locale), count: dayCount(result.totals.remaining) })}</p>
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
    <main class="calendar">
      {#if app.state && app.view === "tiles"}
        <MonthTiles meta={app.state.meta} result={app.state.result} {today} />
      {/if}
    </main>
    {#if app.state && sidebar}
      <!-- After the calendar in the document and on screen (at the inline end). -->
      <aside class="panel" aria-label={i18n.t("allowance.label")}>
        <AllowancePanel allowance={app.state.meta.allowance} totals={app.state.result.totals} stretches={app.state.result.stretches} />
      </aside>
    {/if}
  </div>
</div>

<style>
  @layer components {
    .workspace {
      display: flex;
      min-inline-size: 0;
    }

    .compact-bar {
      padding: var(--space-3) var(--space-4);
      border-block-end: 1px solid var(--r-border);
    }

    .compact-head {
      justify-content: space-between;
    }

    .left {
      font-weight: 600;
    }

    /* The sidebar sits at the inline end of the workspace, after the calendar. */
    .panel {
      flex: 0 0 var(--sidebar-size, 20rem);
      min-inline-size: 0;
      padding: var(--space-4);
      border-inline-start: 1px solid var(--r-border);
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
