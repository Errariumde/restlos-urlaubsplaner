<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The action bar of the touch selection mode (docs/SPEC.md, "Calendar interaction"), kept at the block
  // end of the window: the hint line for the selection with the button that leaves the mode, and Full day,
  // Half day (only where the plan's smallest leave unit has half days), Remove and Clear selection. Each action
  // goes through the range rules as one undo step and ends the selection; the mode stays on. The bar looks the
  // same with and without a selection.
  import Button from "../controls/Button.svelte";
  import IconButton from "../controls/IconButton.svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import HintLine from "./HintLine.svelte";
  import { halfDayFits, rangeChanges, type RangeAction } from "./range.ts";

  interface Props {
    /** The bar's height in px: a day reached with the keyboard stops above it. */
    size?: number;
  }

  let { size = $bindable(0) }: Props = $props();

  const disabled = $derived(app.selection === undefined || app.applying);
  const halfDays = $derived(app.state !== undefined && halfDayFits(app.state.meta.minUnit));

  let bar = $state<HTMLElement>();

  /** Ends the selection. The pressed button is disabled now: a focus in the bar moves to the calendar's Tab stop. */
  function clear(): void {
    app.selection = undefined;
    app.hint = undefined;
    if (bar?.contains(document.activeElement)) document.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus({ preventScroll: true });
  }

  /** Leaves the mode, which drops the selection; the focus goes from the bar, which goes too, to the calendar. */
  function exit(): void {
    const focusHere = bar?.contains(document.activeElement) ?? false;
    app.selectMode = false;
    if (focusHere) document.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus({ preventScroll: true });
  }

  /**
   * Escape clears the selection, and with nothing selected leaves the mode, like the exit button. The grid
   * clears its own selection first (keyboard.svelte.ts); an open popover or sheet takes its own Escape.
   */
  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || event.defaultPrevented || document.querySelector(":popover-open, dialog[open]")) return;
    event.preventDefault();
    if (app.selection !== undefined) clear();
    else exit();
  }

  function apply(action: RangeAction): void {
    const selection = app.selection;
    const result = app.state?.result;
    if (selection === undefined || result === undefined || app.applying) return;
    const changes = rangeChanges(result, selection.anchor, selection.head, action);
    clear();
    void app.apply(changes);
  }
</script>

<svelte:window {onkeydown} />

<section bind:this={bar} class="bar" aria-label={i18n.t("selection.label")} bind:offsetHeight={size}>
  <HintLine idle={i18n.t("selection.prompt")}>
    {#snippet end()}
      <IconButton icon="close" label={i18n.t("selection.exit")} onclick={exit} />
    {/snippet}
  </HintLine>
  <div class="actions cluster">
    <Button variant="primary" {disabled} onclick={() => apply("full")}>{i18n.t("selection.full")}</Button>
    {#if halfDays}
      <Button {disabled} onclick={() => apply("half")}>{i18n.t("selection.half")}</Button>
    {/if}
    <Button {disabled} onclick={() => apply("remove")}>{i18n.t("selection.remove")}</Button>
    <Button {disabled} onclick={clear}>{i18n.t("selection.clear")}</Button>
  </div>
</section>

<style>
  @layer components {
    /*
     * Sticky, not fixed: it stays at the bottom of the window while the page scrolls, and at the end of the
     * page it takes its own room after the calendar, so it never covers the last row. Its parent is the whole
     * screen, so it sticks for all of it.
     */
    .bar {
      position: sticky;
      inset-block-end: 0;
      z-index: 10;
      border-block-start: 1px solid var(--r-border-strong);
      background: var(--r-surface-raised);
      box-shadow: 0 -2px 8px var(--r-shadow);
    }

    .actions {
      padding: var(--space-2) var(--space-4) var(--space-3);
    }
  }
</style>
