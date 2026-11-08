<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "./i18n/i18n.svelte.ts";
  import MainScreen from "./screens/MainScreen.svelte";
  import StartScreen from "./screens/StartScreen.svelte";
  import { app } from "./state/app.svelte.ts";

  // The mode is color-scheme on <html> (docs/SPEC.md, "Colors, light and dark mode"); with "light dark" the
  // light-dark() tokens follow prefers-color-scheme, also when it changes.
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
