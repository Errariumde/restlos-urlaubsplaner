<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { textFor } from "../../engine/file/text.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";

  const meta = $derived(app.state?.meta);
</script>

<!-- A placeholder until Task 10 builds the toolbar. -->
<header class="toolbar cluster">
  {#if meta?.name !== undefined}
    <h1>{textFor(meta.name, i18n.lang)}</h1>
  {/if}
  {#if meta?.example}
    <p class="note">{i18n.t("plan.exampleNote")}</p>
  {/if}
</header>

<style>
  @layer components {
    .toolbar {
      padding-block: var(--space-2);
      padding-inline: var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface-raised);
    }

    h1 {
      font-size: var(--font-size-3);
    }

    .note {
      color: var(--r-text-muted);
    }
  }
</style>
