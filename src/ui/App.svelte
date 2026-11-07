<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "./i18n/i18n.svelte.ts";
  import MainScreen from "./screens/MainScreen.svelte";
  import StartScreen from "./screens/StartScreen.svelte";
  import { applyMode } from "./scheme.ts";
  import { app } from "./state/app.svelte.ts";

  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });

  // Returns the cleanup, which stops following prefers-color-scheme when the mode leaves "auto".
  $effect(() => applyMode(document.documentElement, app.mode));
</script>

{#if app.screen === "start"}
  <StartScreen />
{:else}
  <MainScreen />
{/if}
