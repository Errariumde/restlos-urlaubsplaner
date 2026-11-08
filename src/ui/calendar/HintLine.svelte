<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // What the gesture going on would do (docs/SPEC.md, "Calendar interaction"): the working days it changes,
  // its cost, the resulting stretch and the remaining allowance, on a band. Without a gesture it says, quietly,
  // what the last change did or why a key did nothing (`app.status`, status.ts); without either it shows `idle`.
  import type { Snippet } from "svelte";
  import { pluralCount, formatDate, formatDays } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import { announced, statusText } from "./status.ts";

  interface Props {
    /** What the line says while there is no hint (the selection bar's instruction). */
    idle?: string;
    /** A control at the inline end of the line, on its band (the selection bar's exit button). */
    end?: Snippet;
    /**
     * Keeps a one-line slot in the layout and lets a longer text grow over what follows, so the content below
     * doesn't move when the text wraps during a drag.
     */
    overlay?: boolean;
    /** The line's height in px, which can be more than the slot's with `overlay`. */
    lineSize?: number;
    /** The slot's height in px with `overlay`. */
    slotSize?: number;
  }

  let { idle = "", end, overlay = false, lineSize = $bindable(0), slotSize = $bindable(0) }: Props = $props();

  /** A date without a line break inside: Intl separates day and month with a normal space. */
  const unbroken = (date: string): string => date.replaceAll(" ", "\u00a0");

  const text = $derived.by(() => {
    const hint = app.hint;
    if (hint === undefined) {
      if (app.status === undefined) return "";
      return announced(statusText(app.status, app.state, { t: (key, args) => i18n.t(key, args), locale: i18n.locale }), app.statusCount);
    }
    const { stretch } = hint;
    const locale = i18n.locale;
    // The stretch's end is exclusive: offset 0 means it ends with the day before.
    const last = stretch === undefined ? 0 : stretch.end.offset === 0 ? stretch.end.day - 1 : stretch.end.day;
    return i18n.t("hint.range", {
      days: hint.days,
      cost: formatDays(hint.cost, locale),
      costCount: pluralCount(hint.cost),
      remaining: formatDays(hint.remaining, locale),
      remainingCount: pluralCount(hint.remaining),
      hasStretch: stretch === undefined ? "no" : "yes",
      from: stretch === undefined ? "" : unbroken(formatDate(stretch.start.day, locale, "dayMonth")),
      to: stretch === undefined ? "" : unbroken(formatDate(last, locale, "dayMonth")),
      daysOff: stretch === undefined ? "" : formatDays(stretch.daysOff, locale),
      daysOffCount: stretch === undefined ? 0 : pluralCount(stretch.daysOff),
    });
  });
</script>

{#if overlay}
  <div class="slot" bind:offsetHeight={slotSize}>
    {@render line()}
  </div>
{:else}
  {@render line()}
{/if}

{#snippet line()}
  <!-- Only real hints are announced: the idle text sits next to the live region, not in it. -->
  <div class="hint" class:active={app.hint !== undefined} class:with-end={end !== undefined} data-testid="hint-line" bind:offsetHeight={lineSize}>
    {#if end}
      <span class="text">{@render words()}</span>
      {@render end()}
    {:else}
      {@render words()}
    {/if}
  </div>
{/snippet}

{#snippet words()}
  <span aria-live="polite" aria-atomic="true">{text}</span>
  {#if text === "" && idle !== ""}<span>{idle}</span>{/if}
{/snippet}

<style>
  @layer components {
    /* One line of text with its padding and border fits in 2rem. */
    .slot {
      position: relative;
      block-size: 2rem;
    }

    .slot > .hint {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 0;
    }

    .hint {
      min-block-size: 2rem;
      padding: var(--space-1) var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface);
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }

    .with-end {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-inline-end: var(--space-2);
    }

    .text {
      flex: 1;
      min-inline-size: 0;
    }

    .active {
      background: var(--r-info-band);
      color: var(--r-text);
      font-weight: 600;
    }
  }
</style>
