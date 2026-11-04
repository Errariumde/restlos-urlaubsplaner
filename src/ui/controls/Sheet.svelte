<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import IconButton from "./IconButton.svelte";

  interface Props {
    id: string;
    /** The element that opened the sheet; focus returns to it on close. */
    anchor: HTMLElement | undefined;
    open: boolean;
    /** Called when the sheet closes: Escape, a click on the backdrop, the close button, or `open` set to false. */
    onclose: () => void;
    /** The dialog's accessible name. */
    label: string;
    children: Snippet;
  }

  let { id, anchor, open, onclose, label, children }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function handleClose(): void {
    onclose();
    anchor?.focus();
  }

  /** A click on the dialog element itself is a click on its backdrop: the content box covers the rest. */
  function handleClick(event: MouseEvent): void {
    if (event.target === dialog) dialog?.close();
  }
</script>

<!-- The backdrop click is a pointer shortcut; Escape and the close button do the same from the keyboard. -->
<dialog bind:this={dialog} {id} class="sheet" aria-label={label} onclose={handleClose} onclick={handleClick}>
  <div class="content">
    <div class="close">
      <IconButton icon="close" label={i18n.t("dialog.close")} onclick={() => dialog?.close()} />
    </div>
    {@render children()}
  </div>
</dialog>

<style>
  @layer components {
    /* Docked to the block end (the bottom of the screen), full width. */
    .sheet {
      inline-size: 100%;
      max-inline-size: 100%;
      max-block-size: 85dvh;
      margin: 0;
      margin-block-start: auto;
      padding: 0;
      border: 1px solid var(--r-border-strong);
      border-block-end: none;
      border-start-start-radius: 12px;
      border-start-end-radius: 12px;
      background: var(--r-surface-raised);
      color: var(--r-text);
    }

    .sheet::backdrop {
      background: var(--r-backdrop);
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .close {
      align-self: end;
    }
  }
</style>
