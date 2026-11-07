<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import Button from "../../ui/controls/Button.svelte";
  import Popover from "../../ui/controls/Popover.svelte";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";

  // Open from the start, so tests and screenshots see it; the button closes and reopens it.
  let anchor = $state<HTMLButtonElement>();
  let open = $state(true);
</script>

<div>
  <Button bind:element={anchor} onclick={() => (open = !open)}>{i18n.t("gallery.popover.open")}</Button>
</div>

<Popover id="gallery-popover" {anchor} {open} onclose={() => (open = false)} label={i18n.t("gallery.popover.label")}>
  <div class="stack">
    <p>{i18n.t("gallery.popover.text")}</p>
    <div>
      <Button variant="primary" onclick={() => (open = false)}>{i18n.t("gallery.popover.action")}</Button>
    </div>
  </div>
</Popover>
