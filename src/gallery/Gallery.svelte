<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { i18n } from "../ui/i18n/i18n.svelte.ts";
  import { allCombinations, SECTIONS, searchFor, type Combination, type Mode, type SectionId } from "./params.ts";
  import AllowanceSection from "./sections/AllowanceSection.svelte";
  import ControlsSection from "./sections/ControlsSection.svelte";
  import DayCellSection from "./sections/DayCellSection.svelte";
  import DayDetailSection from "./sections/DayDetailSection.svelte";
  import MainTilesSection from "./sections/MainTilesSection.svelte";
  import PopoverSection from "./sections/PopoverSection.svelte";
  import SheetSection from "./sections/SheetSection.svelte";
  import ToolbarSection from "./sections/ToolbarSection.svelte";

  /** One section in one locale and mode (from the URL), or undefined for the overview of all of them. */
  let { combination }: { combination: Combination | undefined } = $props();

  const COLOR_SCHEME = { light: "light", dark: "dark" } as const;

  $effect(() => {
    const root = document.documentElement;
    root.lang = i18n.lang;
    root.dir = i18n.dir;
    root.style.colorScheme = combination ? COLOR_SCHEME[combination.mode] : "light dark";
    document.title = i18n.t("gallery.title");
  });

  function sectionTitle(section: SectionId): string {
    switch (section) {
      case "controls":
        return i18n.t("gallery.section.controls");
      case "popover":
        return i18n.t("gallery.section.popover");
      case "sheet":
        return i18n.t("gallery.section.sheet");
      case "toolbar":
        return i18n.t("gallery.section.toolbar");
      case "day-cell":
        return i18n.t("gallery.section.dayCell");
      case "day-detail":
        return i18n.t("gallery.section.dayDetail");
      case "allowance":
        return i18n.t("gallery.section.allowance");
      case "main-tiles":
        return i18n.t("gallery.section.mainTiles");
    }
  }

  function modeName(mode: Mode): string {
    return mode === "light" ? i18n.t("gallery.mode.light") : i18n.t("gallery.mode.dark");
  }

  const combinations = allCombinations();
</script>

{#if combination}
  <!-- The main screen brings its own main landmark. -->
  <svelte:element this={combination.section === "main-tiles" ? "div" : "main"} class="page stack" data-section={combination.section}>
    <h1>{sectionTitle(combination.section)}</h1>
    {#if combination.section === "controls"}
      <ControlsSection />
    {:else if combination.section === "popover"}
      <PopoverSection />
    {:else if combination.section === "sheet"}
      <SheetSection />
    {:else if combination.section === "toolbar"}
      <ToolbarSection />
    {:else if combination.section === "day-cell"}
      <DayCellSection />
    {:else if combination.section === "day-detail"}
      <DayDetailSection />
    {:else if combination.section === "allowance"}
      <AllowanceSection />
    {:else}
      <MainTilesSection />
    {/if}
  </svelte:element>
{:else}
  <main class="page stack">
    <hgroup class="stack">
      <h1>{i18n.t("gallery.title")}</h1>
      <p>{i18n.t("gallery.overview")}</p>
    </hgroup>
    {#each SECTIONS as section (section)}
      <section class="stack">
        <h2>{sectionTitle(section)}</h2>
        <!-- Links, not frames: the gallery runs under the app's CSP, whose default-src 'none' blocks frames. -->
        <ul class="links">
          {#each combinations.filter((candidate) => candidate.section === section) as link (searchFor(link))}
            <li>
              <a href={searchFor(link)}>{i18n.t("gallery.link", { section: sectionTitle(section), mode: modeName(link.mode), locale: link.locale })}</a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </main>
{/if}

<style>
  @layer components {
    .page {
      --gap: var(--space-4);
      padding: var(--space-4);
    }

    h1 {
      font-size: var(--font-size-4);
    }

    h2 {
      font-size: var(--font-size-3);
    }

    hgroup {
      --gap: var(--space-1);
    }

    .links {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
      gap: var(--space-1) var(--space-3);
      padding: 0;
      list-style: none;
    }

    a {
      color: var(--r-text);
    }
  }
</style>
