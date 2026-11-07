<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { app } from "../state/app.svelte.ts";
  import { shortcut } from "../state/keys.ts";
  import Toolbar from "./Toolbar.svelte";

  /** Below this width of the app (not of the window) the toolbar moves its less used controls into a menu. */
  const COMPACT_BELOW = 520;

  let width = $state<number>();
  let heading = $state<HTMLHeadingElement>();

  // The main screen has just replaced the start screen: the focus would otherwise be lost with the old button.
  $effect(() => heading?.focus());
  const compact = $derived(width !== undefined && width < COMPACT_BELOW);

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
</div>
