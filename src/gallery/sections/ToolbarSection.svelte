<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";
  import Toolbar from "../../ui/screens/Toolbar.svelte";
  import { app } from "../../ui/state/app.svelte.ts";
  import type { PlanState } from "../../ui/worker/protocol.ts";

  // The toolbar reads the app state; the gallery gives it a stub with just what the toolbar shows. The
  // result is never read here.
  const stub = {
    meta: {
      name: { de: "Beispiel GmbH", en: "Example Ltd" },
      period: { from: { year: 2027, month: 1 }, to: { year: 2027, month: 12 } },
      example: true,
    },
    canUndo: true,
    canRedo: false,
    changed: false,
  } as unknown as PlanState;
  app.state = stub;
  app.view = "columns";
</script>

<section class="stack">
  <h2>{i18n.t("gallery.toolbar.wide")}</h2>
  <div class="frame wide"><Toolbar compact={false} /></div>
</section>
<section class="stack">
  <h2>{i18n.t("gallery.toolbar.compact")}</h2>
  <div class="frame narrow"><Toolbar compact={true} /></div>
</section>

<style>
  @layer components {
    h2 {
      font-size: var(--font-size-2);
    }

    .frame {
      border: 1px solid var(--r-border);
    }

    .narrow {
      max-inline-size: 22rem;
    }
  }
</style>
