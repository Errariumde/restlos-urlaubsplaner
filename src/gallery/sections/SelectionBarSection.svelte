<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { dayFromYmd } from "../../engine/days.ts";
  import SelectionBar from "../../ui/calendar/SelectionBar.svelte";
  import { rangeChanges } from "../../ui/calendar/range.ts";
  import { app } from "../../ui/state/app.svelte.ts";

  // The selection bar of the touch selection mode with 14 to 18 June 2027 of the example selected; the hint
  // comes from the real engine worker. The bar is sticky: here, with nothing above it, it sits under the title.
  onMount(() => {
    void (async () => {
      await app.openExample();
      const result = app.state?.result;
      if (result === undefined) return;
      app.selectMode = true;
      const anchor = dayFromYmd(2027, 6, 14);
      const head = dayFromYmd(2027, 6, 18);
      app.selection = { anchor, head };
      await app.preview(rangeChanges(result, anchor, head, "full"));
    })();
  });
</script>

{#if app.state && app.selectMode}
  <SelectionBar />
{/if}
