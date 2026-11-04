<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { dayFromYmd } from "../../engine/days.ts";
  import { textFor } from "../../engine/file/text.ts";
  import Checkbox from "../controls/Checkbox.svelte";
  import IconButton from "../controls/IconButton.svelte";
  import Popover from "../controls/Popover.svelte";
  import Segmented from "../controls/Segmented.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { formatDate } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";

  interface Props {
    /** The app is narrower than 520 px: mode, language and the checkboxes move into the More menu. */
    compact: boolean;
    /** Open the More menu as a sheet (true) or a popover (false). Unset: a sheet on touch devices. */
    sheet?: boolean;
    /** The title element, for the screen to focus after it replaces the start screen. */
    heading?: HTMLHeadingElement | undefined;
  }

  let { compact, sheet, heading = $bindable() }: Props = $props();

  const meta = $derived(app.state?.meta);
  const title = $derived(meta?.name !== undefined ? textFor(meta.name, i18n.lang) : i18n.t("app.name"));

  const period = $derived.by(() => {
    if (!meta) return "";
    const { from, to } = meta.period;
    const start = dayFromYmd(from.year, from.month, 1);
    const end = dayFromYmd(to.year, to.month, 1);
    return i18n.t("plan.period", {
      sameYear: from.year === to.year ? "yes" : "no",
      from: formatDate(start, i18n.locale, "monthShort"),
      to: formatDate(end, i18n.locale, "monthShort"),
      year: String(to.year),
      fromFull: formatDate(start, i18n.locale, "monthYear"),
      toFull: formatDate(end, i18n.locale, "monthYear"),
    });
  });

  let moreButton = $state<HTMLButtonElement>();
  let moreOpen = $state(false);
  let moreAsSheet = $state(false);

  // The menu only exists in the compact bar.
  const menuOpen = $derived(compact && moreOpen);

  // Widening the app closes the menu for good: narrowing again must not bring it back.
  $effect(() => {
    if (!compact) moreOpen = false;
  });

  function openMore(): void {
    moreAsSheet = sheet ?? matchMedia("(pointer: coarse)").matches;
    moreOpen = !menuOpen;
  }

  const MODES = ["light", "dark", "auto"] as const;
  const LANGUAGES = ["de", "en"] as const;

  const viewOptions = $derived([
    { value: "tiles", label: i18n.t("toolbar.view.tiles"), icon: "tiles" as const },
    { value: "columns", label: i18n.t("toolbar.view.columns"), icon: "columns" as const },
  ]);
  const modeOptions = $derived([
    { value: "light", label: i18n.t("toolbar.mode.light"), icon: "sun" as const },
    { value: "dark", label: i18n.t("toolbar.mode.dark"), icon: "moon" as const },
    { value: "auto", label: i18n.t("toolbar.mode.auto"), icon: "sun-moon" as const },
  ]);
  const languageOptions = $derived([
    { value: "de", label: i18n.t("toolbar.language.de") },
    { value: "en", label: i18n.t("toolbar.language.en") },
  ]);

  function setMode(value: string): void {
    const mode = MODES.find((candidate) => candidate === value);
    if (mode) app.mode = mode;
  }

  function setLanguage(value: string): void {
    const language = LANGUAGES.find((candidate) => candidate === value);
    if (language) i18n.locale = language;
  }

  function setView(value: string): void {
    if (value === "tiles" || value === "columns") app.view = value;
  }
</script>

{#snippet weeksAndAlign()}
  <Checkbox label={i18n.t("toolbar.weeks")} checked={app.weeks} onchange={(checked: boolean) => (app.weeks = checked)} />
  {#if app.view === "columns"}
    <Checkbox label={i18n.t("toolbar.align")} checked={app.align} onchange={(checked: boolean) => (app.align = checked)} />
  {/if}
{/snippet}

{#snippet modeAndLanguage()}
  <Segmented label={i18n.t("toolbar.mode")} options={modeOptions} value={app.mode} onchange={setMode} />
  <Segmented label={i18n.t("toolbar.language")} options={languageOptions} value={i18n.locale === "de" ? "de" : "en"} onchange={setLanguage} />
{/snippet}

<header class="bar" class:compact>
  <div class="title">
    <h1 bind:this={heading} tabindex="-1">{title}</h1>
    {#if meta}
      <p class="period">{period}</p>
    {/if}
    {#if meta?.example}
      <p class="note">{i18n.t("plan.exampleNote")}</p>
    {/if}
  </div>
  <div class="tools" role="toolbar" aria-label={i18n.t("toolbar.label")}>
    <Segmented label={i18n.t("toolbar.view")} options={viewOptions} value={app.view} iconOnly={compact} onchange={setView} />
    {#if !compact}
      {@render weeksAndAlign()}
    {/if}
    <IconButton icon="undo" label={i18n.t("toolbar.undo")} disabled={!app.state?.canUndo} onclick={() => app.undo()} />
    <IconButton icon="redo" label={i18n.t("toolbar.redo")} disabled={!app.state?.canRedo} onclick={() => app.redo()} />
    {#if compact}
      <IconButton bind:element={moreButton} icon="more" label={i18n.t("toolbar.more")} pressed={menuOpen} onclick={openMore} />
    {:else}
      {@render modeAndLanguage()}
    {/if}
  </div>
</header>

{#if compact}
  {#if moreAsSheet}
    <Sheet id="toolbar-more" anchor={moreButton} open={menuOpen} onclose={() => (moreOpen = false)} label={i18n.t("toolbar.moreLabel")}>
      <div class="menu">
        {@render weeksAndAlign()}
        {@render modeAndLanguage()}
      </div>
    </Sheet>
  {:else}
    <Popover id="toolbar-more" anchor={moreButton} open={menuOpen} onclose={() => (moreOpen = false)} label={i18n.t("toolbar.moreLabel")}>
      <div class="menu">
        {@render weeksAndAlign()}
        {@render modeAndLanguage()}
      </div>
    </Popover>
  {/if}
{/if}

<style>
  @layer components {
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
      padding-block: var(--space-2);
      padding-inline: var(--space-4);
      border-block-end: 1px solid var(--r-border);
      background: var(--r-surface-raised);
    }

    .title {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1) var(--space-3);
      min-inline-size: 0;
    }

    h1 {
      font-size: var(--font-size-3);
      overflow-wrap: anywhere;
    }

    .period,
    .note {
      color: var(--r-text-muted);
    }

    .bar.compact .tools {
      flex: 1 1 100%;
      justify-content: space-between;
    }

    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
    }

    .menu {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
  }
</style>
