<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // What the gesture going on would do (docs/SPEC.md, "Calendar interaction"): the working days it changes,
  // its cost, the resulting stretch and the remaining allowance. Without a hint it shows `idle`, else nothing.
  import { pluralCount, formatDate, formatDays } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";

  interface Props {
    /** What the line says while there is no hint (the selection bar's instruction). */
    idle?: string;
  }

  let { idle = "" }: Props = $props();

  const text = $derived.by(() => {
    const hint = app.hint;
    if (hint === undefined) return "";
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
      from: stretch === undefined ? "" : formatDate(stretch.start.day, locale, "dayMonth"),
      to: stretch === undefined ? "" : formatDate(last, locale, "dayMonth"),
      daysOff: stretch === undefined ? "" : formatDays(stretch.daysOff, locale),
      daysOffCount: stretch === undefined ? 0 : pluralCount(stretch.daysOff),
    });
  });
</script>

<!-- Only real hints are announced: the idle text sits next to the live region, not in it. -->
<div class="hint" class:active={text !== ""}>
  <span aria-live="polite" aria-atomic="true">{text}</span>
  {#if text === "" && idle !== ""}<span>{idle}</span>{/if}
</div>

<style>
  @layer components {
    .hint {
      min-block-size: 2rem;
      padding: var(--space-1) var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface);
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }

    .active {
      background: var(--r-info-band);
      color: var(--r-text);
      font-weight: 600;
    }
  }
</style>
