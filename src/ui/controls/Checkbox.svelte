<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  interface Props {
    label: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
    disabled?: boolean;
  }

  let { label, checked, onchange, disabled = false }: Props = $props();
</script>

<!-- A native checkbox (D10): the browser draws the check mark, the label makes the whole text clickable. -->
<label class="checkbox">
  <input type="checkbox" {checked} {disabled} onchange={(event) => onchange(event.currentTarget.checked)} />
  <span>{label}</span>
</label>

<style>
  @layer components {
    .checkbox {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-block-size: 2.25rem;
      cursor: pointer;
    }

    input {
      flex: none;
      inline-size: 1.125rem;
      block-size: 1.125rem;
      margin: 0;
      accent-color: var(--r-primary);
      cursor: inherit;
    }

    input:disabled,
    input:disabled + span {
      opacity: 0.5;
    }

    .checkbox:has(input:disabled) {
      cursor: not-allowed;
    }

    :global([data-force="focus"]) input {
      outline: 2px solid var(--r-focus);
      outline-offset: 2px;
    }
  }
</style>
