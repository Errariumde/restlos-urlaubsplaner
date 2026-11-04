<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../../ui/controls/Button.svelte";
  import Checkbox from "../../ui/controls/Checkbox.svelte";
  import IconButton from "../../ui/controls/IconButton.svelte";
  import Segmented from "../../ui/controls/Segmented.svelte";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";
  import type { IconName } from "../../ui/icons/index.ts";

  // Every control in every state it has, one row per control that wraps on narrow screens. A cell's
  // data-force shows hover, the pressed edge or the focus ring without the pointer (src/ui/controls/control.css).
  type State = "default" | "hover" | "active" | "on" | "focus" | "disabled";
  const ALL: readonly State[] = ["default", "hover", "active", "on", "focus", "disabled"];

  function stateName(state: State): string {
    switch (state) {
      case "default":
        return i18n.t("gallery.state.default");
      case "hover":
        return i18n.t("gallery.state.hover");
      case "active":
        return i18n.t("gallery.state.active");
      case "on":
        return i18n.t("gallery.state.on");
      case "focus":
        return i18n.t("gallery.state.focus");
      case "disabled":
        return i18n.t("gallery.state.disabled");
    }
  }

  const force = (state: State) => (state === "hover" || state === "active" || state === "focus" ? state : undefined);

  const iconLabels = $derived<Record<IconName, string>>({
    undo: i18n.t("gallery.icon.undo"),
    redo: i18n.t("gallery.icon.redo"),
    tiles: i18n.t("gallery.icon.tiles"),
    columns: i18n.t("gallery.icon.columns"),
    sun: i18n.t("gallery.icon.sun"),
    moon: i18n.t("gallery.icon.moon"),
    "sun-moon": i18n.t("gallery.icon.sunMoon"),
    languages: i18n.t("gallery.icon.languages"),
    select: i18n.t("gallery.icon.select"),
    close: i18n.t("dialog.close"),
    warning: i18n.t("gallery.icon.warning"),
    check: i18n.t("gallery.icon.check"),
    more: i18n.t("gallery.icon.more"),
  });

  const viewOptions = $derived([
    { value: "tiles", label: i18n.t("gallery.sample.tiles"), icon: "tiles" as const },
    { value: "columns", label: i18n.t("gallery.sample.columns"), icon: "columns" as const },
  ]);

  let view = $state("tiles");
  let weeks = $state(true);
  let toggled = $state(false);
  const nothing = () => {};
</script>

{#snippet row(title: string, states: readonly State[], control: Snippet<[State]>)}
  <section class="stack">
    <h2>{title}</h2>
    <div class="states">
      {#each states as state (state)}
        <div class="cell" data-force={force(state)}>
          <span class="state">{stateName(state)}</span>
          {@render control(state)}
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{#snippet button(state: State)}
  {#if state === "on"}
    <Button pressed={!toggled} onclick={() => (toggled = !toggled)}>{i18n.t("gallery.sample.button")}</Button>
  {:else}
    <Button disabled={state === "disabled"} onclick={nothing}>{i18n.t("gallery.sample.button")}</Button>
  {/if}
{/snippet}

{#snippet primary(state: State)}
  <Button variant="primary" disabled={state === "disabled"} onclick={nothing}>{i18n.t("gallery.sample.primary")}</Button>
{/snippet}

{#snippet iconButton(state: State)}
  {#if state === "on"}
    <IconButton icon="select" label={iconLabels.select} pressed={true} onclick={nothing} />
  {:else}
    <IconButton icon="undo" label={iconLabels.undo} disabled={state === "disabled"} onclick={nothing} />
  {/if}
{/snippet}

{#snippet segmented(state: State)}
  <Segmented
    label={i18n.t("gallery.sample.view")}
    options={viewOptions}
    value={state === "on" ? "columns" : view}
    onchange={(value: string) => (view = value)}
  />
{/snippet}

{#snippet checkbox(state: State)}
  <Checkbox
    label={i18n.t("gallery.sample.weeks")}
    checked={state === "on" ? true : state === "default" ? false : weeks}
    disabled={state === "disabled"}
    onchange={(checked: boolean) => (weeks = checked)}
  />
{/snippet}

<div class="stack">
  {@render row(i18n.t("gallery.row.button"), ALL, button)}
  {@render row(i18n.t("gallery.row.primary"), ["default", "hover", "active", "focus", "disabled"], primary)}
  {@render row(i18n.t("gallery.row.iconButton"), ALL, iconButton)}
  {@render row(i18n.t("gallery.row.segmented"), ["default", "hover", "active", "on", "focus"], segmented)}
  {@render row(i18n.t("gallery.row.checkbox"), ["default", "on", "focus", "disabled"], checkbox)}

  <section class="stack">
    <h2>{i18n.t("gallery.icons")}</h2>
    <div class="cluster">
      {#each Object.entries(iconLabels) as [icon, label] (icon)}
        <IconButton icon={icon as IconName} {label} onclick={nothing} />
      {/each}
    </div>
  </section>
</div>

<style>
  @layer components {
    h2 {
      font-size: var(--font-size-2);
    }

    .states {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .cell {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-2);
      min-inline-size: 9rem;
      padding-block: var(--space-2);
      padding-inline: var(--space-3);
      border: 1px solid var(--r-border);
      border-radius: var(--radius-control);
    }

    .state {
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }
  }
</style>
