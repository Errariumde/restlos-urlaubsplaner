<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  interface Props {
    label: string;
    checked: boolean;
    /** Neither checked nor unchecked: the box shows a dash (the `indeterminate` property). */
    mixed?: boolean;
    onchange: (checked: boolean) => void;
    disabled?: boolean;
  }

  let { label, checked, mixed = false, onchange, disabled = false }: Props = $props();

  /**
   * Fully controlled: a click only asks the owner. The box then shows `checked` as the owner left it (a
   * prop reads the owner's current state), also when the owner keeps it as it was. A click clears the mixed state,
   * so it is set back too.
   */
  function change(event: Event & { currentTarget: HTMLInputElement }): void {
    const box = event.currentTarget;
    onchange(box.checked);
    box.checked = checked;
    box.indeterminate = mixed;
  }
</script>

<!-- A native checkbox (docs/SPEC.md, "Controls, icons and fonts"): the browser draws the check mark, the label makes the whole text clickable. -->
<label class="checkbox">
  <input type="checkbox" {checked} indeterminate={mixed} {disabled} onchange={change} />
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

    @media (pointer: coarse) {
      .checkbox {
        min-block-size: 2.5rem;
      }
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
