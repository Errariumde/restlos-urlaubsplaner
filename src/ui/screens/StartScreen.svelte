<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import Button from "../controls/Button.svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
</script>

<main class="start stack">
  <hgroup class="stack">
    <h1>{i18n.t("app.name")}</h1>
    <p>{i18n.t("app.subtitle")}</p>
  </hgroup>
  <Button variant="primary" onclick={() => app.openExample()}>{i18n.t("start.viewExample")}</Button>
  {#if app.openFailed}
    <p role="alert">{i18n.t("start.exampleFailed")}</p>
  {/if}
</main>

<style>
  @layer components {
    .start {
      --gap: var(--space-5);
      align-items: center;
      justify-content: center;
      min-block-size: 100dvh;
      padding: var(--space-4);
      text-align: center;
    }

    hgroup {
      --gap: var(--space-1);
    }

    h1 {
      font-size: var(--font-size-4);
    }

    hgroup p {
      color: var(--r-text-muted);
    }
  }
</style>
