<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { IconName } from "../icons/index.ts";
  import Icon from "./Icon.svelte";
  import "./control.css";

  interface Option {
    value: string;
    label: string;
    icon?: IconName;
  }

  interface Props {
    /** The group's accessible name. */
    label: string;
    options: readonly Option[];
    value: string;
    onchange: (value: string) => void;
    /** Show only the icons (every option needs one); the labels stay as accessible names and titles. */
    iconOnly?: boolean;
  }

  let { label, options, value, onchange, iconOnly = false }: Props = $props();
</script>

<div class="segmented" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="control"
      class:icon-only={iconOnly && option.icon !== undefined}
      aria-label={iconOnly && option.icon ? option.label : undefined}
      title={iconOnly && option.icon ? option.label : undefined}
      aria-pressed={option.value === value}
      onclick={() => onchange(option.value)}
    >
      {#if option.icon}
        <Icon name={option.icon} />
      {/if}
      {#if !(iconOnly && option.icon)}
        {option.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  @layer components {
    .segmented {
      display: inline-flex;
    }

    /* The segments share their borders; only the outer corners are round. */
    .segmented > :global(.control:not(:first-child)) {
      margin-inline-start: -1px;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }

    .segmented > :global(.control:not(:last-child)) {
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }
  }
</style>
