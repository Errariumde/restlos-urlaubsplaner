<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The planned leave against the allowance. The bar is scaled to what is planned when that exceeds the
  // allowance: the overdraft is hatched (not only red) and a warning line says how far over it is.
  import type { Units } from "../../engine/weight.ts";
  import { pluralCount, formatDays } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { barGeometry } from "./bar.ts";

  interface Props {
    allowance: Units;
    planned: Units;
  }

  let { allowance, planned }: Props = $props();

  const geometry = $derived(barGeometry(allowance, planned));
  const overdrawn = $derived(planned - allowance);
  const percent = (share: number): string => `${String(share * 100)}%`;
  const valuetext = $derived(
    i18n.t("allowance.valuetext", {
      planned: formatDays(planned, i18n.locale),
      allowance: formatDays(allowance, i18n.locale),
      allowanceCount: pluralCount(allowance),
    }),
  );
</script>

<div class="bar-block">
  <div class="track" role="meter" aria-label={i18n.t("allowance.bar")} aria-valuemin={0} aria-valuemax={geometry.scale} aria-valuenow={planned} aria-valuetext={valuetext}>
    <div class="planned" style:inline-size={percent(geometry.plannedShare)}></div>
    {#if geometry.overShare > 0}
      <div class="over" style:inset-inline-start={percent(geometry.tickShare)} style:inline-size={percent(geometry.overShare)}></div>
    {/if}
    <div class="tick" style:inset-inline-start={percent(geometry.tickShare)}></div>
  </div>
  {#if overdrawn > 0}
    <p class="warning">{i18n.t("allowance.over", { days: formatDays(overdrawn, i18n.locale), count: pluralCount(overdrawn) })}</p>
  {/if}
</div>

<style>
  @layer components {
    .bar-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    /* The border keeps the track visible in dark mode, whatever the fill is. */
    .track {
      position: relative;
      block-size: 1rem;
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-surface-sunken);
      overflow: hidden;
    }

    .planned {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      background: var(--r-leave-full);
    }

    /* Hatched, so the overdraft does not rely on its colour. */
    .over {
      position: absolute;
      inset-block: 0;
      background: repeating-linear-gradient(135deg, var(--r-overdraft) 0 4px, var(--r-surface-sunken) 4px 8px);
      border-inline-start: 1px solid var(--r-overdraft);
    }

    .tick {
      position: absolute;
      inset-block: 0;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--r-text);
    }

    .warning {
      color: var(--r-overdraft);
      font-weight: 600;
      font-size: var(--font-size-1);
    }
  }
</style>
