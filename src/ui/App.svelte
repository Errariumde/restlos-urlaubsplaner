<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "./i18n/i18n.svelte.ts";

  $effect(() => {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
  });
</script>

<h1>{i18n.t("app.name")}</h1>
<p>{i18n.t("app.subtitle")}</p>
