<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { IconName } from "../icons/index.ts";
  import Icon from "./Icon.svelte";
  import "./control.css";

  interface Props {
    icon: IconName;
    /** The accessible name, also shown as the hover title. */
    label: string;
    onclick?: (event: MouseEvent) => void;
    /** A toggle button: sets aria-pressed. Leave it out for a plain button. */
    pressed?: boolean;
    disabled?: boolean;
    /** The rendered <button>, for anchoring a popover to it. */
    element?: HTMLButtonElement | undefined;
  }

  let { icon, label, onclick, pressed, disabled = false, element = $bindable() }: Props = $props();
</script>

<button bind:this={element} type="button" class="control icon-only" aria-label={label} title={label} aria-pressed={pressed} {disabled} {onclick}>
  <Icon name={icon} />
</button>
