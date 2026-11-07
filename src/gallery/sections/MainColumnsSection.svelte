<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { dayFromYmd } from "../../engine/days.ts";
  import MainScreen from "../../ui/screens/MainScreen.svelte";
  import { app } from "../../ui/state/app.svelte.ts";

  // The main screen in the month columns with the built-in example, computed by the real engine worker, in a
  // 900 px wide app: the sidebar leaves the calendar less than 800 px, so six columns show and the rest scroll.
  // Today is fixed, so the screenshots don't change from day to day.
  const TODAY = dayFromYmd(2027, 6, 9);

  onMount(() => {
    app.view = "columns";
    void app.openExample();
  });
</script>

<div class="app">
  {#if app.state}
    <MainScreen today={TODAY} />
  {/if}
</div>

<style>
  @layer components {
    .app {
      inline-size: min(56.25rem, 100%);
    }
  }
</style>
