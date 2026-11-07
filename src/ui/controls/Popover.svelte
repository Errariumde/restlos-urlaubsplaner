<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /**
     * The element id. It also names the anchor (`anchor-name: --popover-<id>`), so it must be a CSS ident:
     * a letter, `_` or `-` first, then letters, digits, `_` and `-`.
     */
    id: string;
    /**
     * The element the popover opens next to; focus returns to it on close. An anchor serves one popover at a
     * time: a second popover on the same anchor would overwrite its anchor-name.
     */
    anchor: HTMLElement | undefined;
    open: boolean;
    /** Called when the popover closes: Escape, a click outside, or `open` set to false. */
    onclose: () => void;
    /** The dialog's accessible name. */
    label: string;
    children: Snippet;
  }

  let { id, anchor, open, onclose, label, children }: Props = $props();

  /** What `id` must look like to be used in `anchor-name` (ASCII only, which is all the app needs). */
  const IDENT = /^-?[A-Za-z_][\w-]*$/;

  /**
   * Browsers without CSS anchor positioning get a best-effort JS placement below the anchor instead. Firefox
   * ESR 153, current Firefox and Chromium take the CSS path; the fallback is for older browsers only.
   */
  const anchorPositioning = typeof CSS !== "undefined" && CSS.supports("position-area: block-end");
  /** The space between the anchor and the popover, and the least space to the window's edges, in px (--space-1). */
  const GAP = 4;

  let element = $state<HTMLDivElement>();
  let fallback = $state<{ block: number; inline: number }>();
  const anchorName = $derived(`--popover-${id}`);

  $effect(() => {
    if (import.meta.env.DEV && !IDENT.test(id)) console.warn(`Popover: the id "${id}" is not a CSS ident, so anchor-name won't work.`);
  });

  $effect(() => {
    if (!anchor) return;
    const target = anchor;
    target.style.setProperty("anchor-name", anchorName);
    return () => target.style.removeProperty("anchor-name");
  });

  /**
   * The fallback: below the anchor, starting at its inline start (its right edge in right-to-left text),
   * kept inside the window. The popover is position: fixed, so the values are viewport coordinates.
   */
  function place(): void {
    if (anchorPositioning || !anchor || !element) return;
    const box = anchor.getBoundingClientRect();
    const size = element.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const rtl = getComputedStyle(anchor).direction === "rtl";
    const inline = rtl ? width - box.right : box.left;
    const clamp = (value: number, room: number) => Math.max(GAP, Math.min(value, room - GAP));
    fallback = { block: clamp(box.bottom + GAP, height - size.height), inline: clamp(inline, width - size.width) };
  }

  $effect(() => {
    if (!element) return;
    const shown = element.matches(":popover-open");
    if (open && !shown) {
      // `source` keeps a click on the anchor from closing and reopening the popover (where supported).
      element.showPopover(anchor ? { source: anchor } : undefined);
      // A disabled control can't take the focus; the popover itself does when nothing else can.
      const first = element.querySelector<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      );
      (first ?? element).focus();
    } else if (!open && shown) {
      element.hidePopover();
    }
    // Placed after showing, when the popover has a size; again when the anchor arrives after the popover opened.
    if (open) place();
  });

  // The fallback follows the anchor while the popover is open: scrolling anywhere (capture) and resizing.
  $effect(() => {
    if (anchorPositioning || !open) return;
    const update = () => place();
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  });

  /**
   * Whether the focus should go back to the anchor when the popover closes: only when it was inside the
   * popover or nowhere (on the body). A click elsewhere, say on another day cell, keeps the focus there.
   */
  let returnFocus = false;

  function onbeforetoggle(event: ToggleEvent): void {
    if (event.newState !== "closed" || !element) return;
    const active = document.activeElement;
    returnFocus = active === null || active === document.body || element.contains(active);
  }

  function ontoggle(event: ToggleEvent): void {
    if (event.newState !== "closed") return;
    onclose();
    // A popover removed from the page (its owner went away) leaves the focus to whatever comes next.
    if (returnFocus && element?.isConnected) {
      const active = document.activeElement;
      if (active === null || active === document.body || element.contains(active)) anchor?.focus();
    }
    returnFocus = false;
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
  {onbeforetoggle}
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
