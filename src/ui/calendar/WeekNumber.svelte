<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The calendar week at the start of a tile row. A click plans the whole ISO week (or takes it back),
  // through the range rules (docs/SPEC.md, "Calendar interaction").
  import { i18n } from "../i18n/i18n.svelte.ts";

  interface Props {
    week: number;
    onclick: () => void;
  }

  let { week, onclick }: Props = $props();

  const label = $derived(i18n.t("calendar.week", { week }));
</script>

<!-- The grid keeps one Tab stop (D4): the week buttons are for the pointer; the keyboard selects a range instead. -->
<div role="rowheader" class="week">
  <button type="button" tabindex="-1" aria-label={label} title={label} {onclick}>{week}</button>
</div>

<style>
  @layer components {
    .week {
      display: flex;
      justify-content: center;
    }

    button {
      inline-size: 18px;
      block-size: 100%;
      padding: 0;
      border: 0;
      border-radius: 3px;
      background: var(--r-weekend);
      color: var(--r-text-muted);
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }

    /* Touch: the whole 40 px column (MonthTiles.svelte) and the 40 px row are the target. */
    @media (pointer: coarse) {
      button {
        inline-size: 100%;
        min-block-size: 2.5rem;
      }
    }

    button:hover {
      background: var(--r-surface-raised);
      box-shadow: inset 0 0 0 1px var(--r-border-strong);
      color: var(--r-text);
    }

    button:active {
      background: var(--r-control-hover);
    }
  }
</style>
