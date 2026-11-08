<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // A bottom sheet's own live line (docs/SPEC.md, "Screen sizes"): the sheet makes the page inert, so the hint line
  // can't announce what an action in the sheet did. The line says the statuses reported while it is shown.
  import { untrack } from "svelte";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import { announced, statusText } from "./status.ts";

  const shownAt = untrack(() => app.statusCount);
  const text = $derived.by(() => {
    if (app.status === undefined || app.statusCount <= shownAt) return "";
    const words = { t: (key: string, args?: Record<string, string | number>) => i18n.t(key, args), locale: i18n.locale };
    return announced(statusText(app.status, app.state, words), app.statusCount);
  });
</script>

<p class="status" aria-live="polite" aria-atomic="true">{text}</p>

<style>
  @layer components {
    /* What an action in the sheet did, quiet like the hint line; empty until then. */
    .status {
      margin-block-start: var(--space-3);
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }

    /* Kept in the accessibility tree while empty, so its first text is announced too. */
    .status:empty {
      margin: 0;
    }
  }
</style>
