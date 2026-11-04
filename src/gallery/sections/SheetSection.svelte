<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import Button from "../../ui/controls/Button.svelte";
  import Checkbox from "../../ui/controls/Checkbox.svelte";
  import Sheet from "../../ui/controls/Sheet.svelte";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";

  // Open from the start, so tests and screenshots see it; the button opens it again.
  let anchor = $state<HTMLButtonElement>();
  let open = $state(true);
  let weeks = $state(true);
</script>

<div>
  <Button bind:element={anchor} onclick={() => (open = true)}>{i18n.t("gallery.sheet.open")}</Button>
</div>

<Sheet id="gallery-sheet" {anchor} {open} onclose={() => (open = false)} label={i18n.t("gallery.sheet.label")}>
  <p>{i18n.t("gallery.sheet.text")}</p>
  <Checkbox label={i18n.t("gallery.sample.weeks")} checked={weeks} onchange={(checked: boolean) => (weeks = checked)} />
</Sheet>
