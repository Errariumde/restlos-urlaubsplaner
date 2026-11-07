<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The action bar of the touch selection mode (docs/SPEC.md, "Calendar interaction"), kept at the block
  // end of the window: the hint line for the selection, and Full day, Half day, Remove and Cancel. Each action
  // goes through the range rules as one undo step and ends the selection; the mode stays on.
  import Button from "../controls/Button.svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import HintLine from "./HintLine.svelte";
  import { rangeChanges, type RangeAction } from "./range.ts";

  const disabled = $derived(app.selection === undefined || app.applying);

  let bar = $state<HTMLElement>();

  /** Ends the selection. The pressed button is disabled now: a focus in the bar moves to the calendar's Tab stop. */
  function clear(): void {
    app.selection = undefined;
    app.hint = undefined;
    if (bar?.contains(document.activeElement)) document.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus({ preventScroll: true });
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

<section bind:this={bar} class="bar" aria-label={i18n.t("selection.label")}>
  <HintLine idle={i18n.t("selection.prompt")} />
  <div class="actions cluster">
    <Button variant="primary" {disabled} onclick={() => apply("full")}>{i18n.t("selection.full")}</Button>
    <Button {disabled} onclick={() => apply("half")}>{i18n.t("selection.half")}</Button>
    <Button {disabled} onclick={() => apply("remove")}>{i18n.t("selection.remove")}</Button>
    <Button {disabled} onclick={clear}>{i18n.t("selection.cancel")}</Button>
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
