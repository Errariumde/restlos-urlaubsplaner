<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { dayFromYmd } from "../../engine/days.ts";
  import DayDetail from "../../ui/calendar/DayDetail.svelte";
  import { app } from "../../ui/state/app.svelte.ts";

  // The detail of a few days of the built-in example, computed by the real engine worker, shown inline
  // (the content of the popover and the sheet).
  const DAYS = [
    dayFromYmd(2027, 6, 14), // a working day without leave
    dayFromYmd(2027, 1, 7), // planned leave
    dayFromYmd(2027, 12, 24), // a day rule halves the required work
    dayFromYmd(2027, 5, 27), // a public holiday
    dayFromYmd(2027, 1, 4), // leave in another plan
    dayFromYmd(2027, 12, 27), // mandatory leave
    dayFromYmd(2027, 9, 6), // an info source
  ];

  onMount(() => {
    void app.openExample();
  });

  const shown = $derived.by(() => {
    const state = app.state;
    if (!state) return [];
    const first = state.result.days[0]?.day ?? 0;
    return DAYS.flatMap((day) => {
      const result = state.result.days[day - first];
      return result ? [result] : [];
    });
  });
</script>

{#if app.state}
  {@const { meta, result } = app.state}
  <div class="samples">
    {#each shown as day (day.day)}
      <DayDetail {day} {meta} problems={result.problems} presentation="inline" />
    {/each}
  </div>
{/if}

<style>
  @layer components {
    .samples {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      align-items: start;
    }
  }
</style>
