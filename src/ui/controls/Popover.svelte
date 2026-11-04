<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    id: string;
    /** The element the popover opens next to; focus returns to it on close. */
    anchor: HTMLElement | undefined;
    open: boolean;
    /** Called when the popover closes: Escape, a click outside, or `open` set to false. */
    onclose: () => void;
    /** The dialog's accessible name. */
    label: string;
    children: Snippet;
  }

  let { id, anchor, open, onclose, label, children }: Props = $props();

  /** Browsers without CSS anchor positioning get a JS placement below the anchor instead. */
  const anchorPositioning = typeof CSS !== "undefined" && CSS.supports("position-area: block-end");
  /** The space between the anchor and the popover, in px (--space-1). */
  const GAP = 4;

  let element = $state<HTMLDivElement>();
  let fallback = $state<{ block: number; inline: number }>();
  const anchorName = $derived(`--popover-${id}`);

  $effect(() => {
    if (!anchor) return;
    const target = anchor;
    target.style.setProperty("anchor-name", anchorName);
    return () => target.style.removeProperty("anchor-name");
  });

  /** Below the anchor, starting at its inline start (its right edge in right-to-left text). The popover is position: fixed. */
  function place(): void {
    if (anchorPositioning || !anchor) return;
    const box = anchor.getBoundingClientRect();
    const rtl = getComputedStyle(anchor).direction === "rtl";
    fallback = { block: box.bottom + GAP, inline: rtl ? document.documentElement.clientWidth - box.right : box.left };
  }

  $effect(() => {
    if (!element) return;
    const shown = element.matches(":popover-open");
    // Placed again when the anchor arrives after the popover opened.
    if (open) place();
    if (open && !shown) {
      // `source` keeps a click on the anchor from closing and reopening the popover (where supported).
      element.showPopover(anchor ? { source: anchor } : undefined);
      const first = element.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      (first ?? element).focus();
    } else if (!open && shown) {
      element.hidePopover();
    }
  });

  function ontoggle(event: ToggleEvent): void {
    if (event.newState !== "closed") return;
    onclose();
    anchor?.focus();
  }
</script>

<div
  bind:this={element}
  {id}
  popover="auto"
  role="dialog"
  aria-label={label}
  tabindex="-1"
  class="popover"
  data-placement={anchorPositioning ? "anchor" : "fallback"}
  style:position-anchor={anchorName}
  style:inset-block-start={fallback ? `${fallback.block}px` : undefined}
  style:inset-inline-start={fallback ? `${fallback.inline}px` : undefined}
  {ontoggle}
>
  {@render children()}
</div>

<style>
  @layer components {
    .popover {
      position-area: block-end span-inline-end;
      position-try-fallbacks: flip-block, flip-inline;
      inset: auto;
      margin: 0;
      margin-block: var(--space-1);
      max-inline-size: min(24rem, calc(100vw - 2 * var(--space-2)));
      padding: var(--space-3);
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-surface-raised);
      box-shadow: 0 4px 16px var(--r-shadow);
      color: var(--r-text);
    }

    /* Without anchor positioning the inline style sets the start corner; the margin would add to it. */
    .popover[data-placement="fallback"] {
      margin: 0;
    }
  }
</style>
