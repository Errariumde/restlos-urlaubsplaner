<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { dayFromYmd } from "../../engine/days.ts";
  import MainScreen from "../../ui/screens/MainScreen.svelte";
  import { app } from "../../ui/state/app.svelte.ts";

  // The main screen in the month tiles with the built-in example, computed by the real engine worker.
  // Today is fixed, so the screenshots don't change from day to day.
  const TODAY = dayFromYmd(2027, 6, 9);

  onMount(() => {
    app.view = "tiles";
    void app.openExample();
  });
</script>

{#if app.state}
  <MainScreen today={TODAY} />
{/if}
