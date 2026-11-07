<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
</script>

<main class="start stack">
  <hgroup class="stack">
    <h1>{i18n.t("app.name")}</h1>
    <p>{i18n.t("app.subtitle")}</p>
  </hgroup>
  <button type="button" class="primary" onclick={() => app.openExample()}>{i18n.t("start.viewExample")}</button>
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

    /* A plain primary button until Task 9's Button component. The border keeps 3:1 in dark mode (Ruling G). */
    .primary {
      padding-block: var(--space-2);
      padding-inline: var(--space-4);
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-primary);
      color: var(--r-on-primary);
      font: inherit;
      cursor: pointer;
    }
  }
</style>
