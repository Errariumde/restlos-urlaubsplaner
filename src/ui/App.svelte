<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "./i18n/i18n.svelte.ts";
  import MainScreen from "./screens/MainScreen.svelte";
  import StartScreen from "./screens/StartScreen.svelte";
  import { app } from "./state/app.svelte.ts";

  const COLOR_SCHEME = { light: "light", dark: "dark", auto: "light dark" } as const;

  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });

  $effect(() => {
    document.documentElement.style.colorScheme = COLOR_SCHEME[app.mode];
  });
</script>

{#if app.screen === "start"}
  <StartScreen />
{:else}
  <MainScreen />
{/if}
