<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { ICONS, MIRRORED_ICONS, type IconName } from "../icons/index.ts";

  // Decorative: the control around it carries the name.
  let { name }: { name: IconName } = $props();

  const icon = $derived(ICONS[name]);
</script>

<svg
  class={["icon", { mirror: MIRRORED_ICONS.has(name) }]}
  viewBox={icon.viewBox}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each icon.elements as element, index (index)}
    <svelte:element this={element.tag} xmlns="http://www.w3.org/2000/svg" {...element.attrs} />
  {/each}
</svg>

<style>
  @layer components {
    .icon {
      flex: none;
      inline-size: 1.25rem;
      block-size: 1.25rem;
    }

    /* Icons that point in the reading direction turn round in right-to-left text (D14). */
    .mirror:dir(rtl) {
      scale: -1 1;
    }
  }
</style>
