<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import "./control.css";

  interface Props {
    /** One filled primary button per area (D5). */
    variant?: "default" | "primary";
    type?: "button";
    /** A toggle button: sets aria-pressed. Leave it out for a plain button. */
    pressed?: boolean;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    /** The rendered <button>, for anchoring a popover to it. */
    element?: HTMLButtonElement | undefined;
    children: Snippet;
  }

  let { variant = "default", type = "button", pressed, disabled = false, onclick, element = $bindable(), children }: Props = $props();
</script>

<button bind:this={element} {type} class={["control", variant === "primary" && "primary"]} aria-pressed={pressed} {disabled} {onclick}>
  {@render children()}
</button>
