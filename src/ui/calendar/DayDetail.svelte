<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The detail of a day (docs/SPEC.md, "Detail view"): the date; the required work as a line and a bar of work and
  // free time; the leave as a line with the "Full day" checkbox and a bar of switches (LeaveBar.svelte), its cost and
  // the work left; the calendars as bars; the reasons; the problems. A popover next to the cell; a bottom sheet on a
  // narrow calendar or a touch screen; inline in the gallery.
  import type { DayResult, Problem } from "../../engine/counting/plan.ts";
  import { textFor } from "../../engine/file/text.ts";
  import type { Units } from "../../engine/weight.ts";
  import Popover from "../controls/Popover.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { formatDate, formatList } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { Hint, LeaveChange, PlanMeta } from "../worker/protocol.ts";
  import { lineStyle, sourceAccent } from "./cell-lanes.ts";
  import { amountText, dayDetail, percent, reasonText } from "./detail.ts";
  import LeaveBar from "./LeaveBar.svelte";
  import { problemText } from "./problems.ts";
  import SheetStatus from "./SheetStatus.svelte";

  interface Props {
    day: DayResult;
    meta: PlanMeta;
    /** The result's problems; the detail keeps those of its day. */
    problems: readonly Problem[];
    presentation: "popover" | "sheet" | "inline";
    /** The day's cell: the popover opens next to it, and the focus goes back to it on close. */
    anchor?: HTMLElement | undefined;
    onclose?: () => void;
    /** Makes a change: the app's plan by default; the gallery passes its own. */
    onapply?: (change: LeaveChange) => Promise<void> | void;
    /** Asks what a change would do, for the preview of a drag along the leave bar: the app's worker by default; the gallery passes its own. */
    onpreview?: (change: LeaveChange) => Promise<Hint | undefined> | Hint | undefined;
  }

  let {
    day,
    meta,
    problems,
    presentation,
    anchor,
    onclose = () => {},
    onapply = (change) => app.apply([change]),
    onpreview = (change) => app.previewDay(change),
  }: Props = $props();

  const words = $derived({ t: (key: string, args?: Record<string, string | number>) => i18n.t(key, args), locale: i18n.locale });
  const detail = $derived(dayDetail(day, meta, problems, i18n.locale));
  const date = $derived(formatDate(day.day, i18n.locale, "long"));
  const label = $derived(i18n.t("detail.label", { date }));
  const id = $derived(`day-detail-${String(day.day)}`);

  const calendars = $derived(
    detail.calendars.map(({ source, index, entries, spans }) => {
      const name = textFor(source.name, i18n.lang);
      // The calendar, and the names of its entries on this day after it: "School holidays: Autumn break".
      const text = entries.length === 0 ? name : i18n.t("detail.sourceEntries", { source: name, entries: formatList(entries, i18n.locale) });
      return { id: source.id, text, accent: sourceAccent(source, index), style: lineStyle(index), spans };
    }),
  );

  let content = $state<HTMLElement>();
  /** During a drag along the leave bar: the cost and the work left the change would give, which the lines show. */
  let preview = $state<Hint["day"]>();
</script>

<!-- A value line: the label and the amount, or at zero a dash that screen readers hear as `none`. -->
{#snippet amount(name: string, units: Units, none: string, spoken = "")}
  {#if units > 0}
    <span class="name">{name}</span>
    <b>{amountText(units, words)}</b> {#if spoken}<span class="spoken">{spoken}</span>{/if}
  {:else}
    <span class="name" aria-hidden="true">{name}</span>
    <b aria-hidden="true">{i18n.t("detail.zero")}</b><span class="spoken">{none}</span>
  {/if}
{/snippet}

{#snippet body()}
  {@const { required, leave, noLeave } = detail}
  <div class="detail stack" class:fixed={presentation === "popover"} bind:this={content} tabindex="-1">
    <h2>{date}</h2>
    <div class="part">
      <p>
        {@render amount(i18n.t("detail.required.label"), required.value, i18n.t("detail.required.none"), required.where ? i18n.t("detail.required.where", { where: required.where }) : "")}
      </p>
      <div class="bar off-{required.off}" aria-hidden="true">
        {#each required.blocks as block (block.from)}
          <span class="block" class:work={block.work} style:flex-basis={percent(block.to - block.from)}>{block.work ? i18n.t("detail.work") : i18n.t("detail.off")}</span>
        {/each}
      </div>
    </div>
    {#if leave}
      <LeaveBar {day} {leave} minUnit={meta.minUnit} off={required.off} {content} {onapply} {onpreview} bind:preview />
      <div class="part">
        <p class="line">{@render amount(i18n.t("detail.cost.label"), preview?.cost ?? leave.cost, i18n.t("detail.cost.none"))}</p>
        <p class="line">{@render amount(i18n.t("detail.remaining.label"), preview?.remaining ?? leave.remaining, i18n.t("detail.remaining.none"))}</p>
      </div>
    {:else}
      <p class="muted">{noLeave === "outsidePeriod" ? i18n.t("detail.outsidePeriod") : i18n.t("detail.notNeeded")}</p>
    {/if}
    {#if calendars.length > 0}
      <ul class="part calendars" aria-label={i18n.t("detail.sources")}>
        {#each calendars as calendar (calendar.id)}
          <li>
            {calendar.text}
            <span class="track" aria-hidden="true">
              {#each calendar.spans as span (span.from)}
                <span
                  class="stretch mark {calendar.style}"
                  style:--accent="var(--r-accent-{calendar.accent})"
                  style:inset-inline-start={percent(span.from)}
                  style:inline-size={percent(span.to - span.from)}
                ></span>
              {/each}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    <ul class="part reasons" aria-label={i18n.t("detail.reasons")}>
      {#each detail.reasons as reason, index (index)}
        <li>{reasonText(reason, words)}</li>
      {/each}
    </ul>
    {#if detail.problems.length > 0}
      <ul class="part problems" aria-label={i18n.t("detail.problems")}>
        {#each detail.problems as code, index (index)}
          <li>{problemText(code, words.t)}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

{#if presentation === "popover"}
  <Popover {id} {anchor} open={true} {onclose} {label}>
    {@render body()}
  </Popover>
{:else if presentation === "sheet"}
  <Sheet {id} {anchor} open={true} {onclose} {label}>
    {@render body()}
    <SheetStatus />
  </Sheet>
{:else}
  <section class="inline" aria-label={label}>
    {@render body()}
  </section>
{/if}

<style>
  @layer components {
    .detail {
      --gap: var(--space-3);
    }

    /*
     * The popover takes the width of its content, so the detail sets one: the same as in the gallery, so the
     * popover doesn't change its size when a value in it does. A narrow window narrows it.
     */
    .detail.fixed {
      inline-size: 20rem;
      max-inline-size: 100%;
    }

    .detail:focus {
      outline: none;
    }

    h2 {
      font-size: var(--font-size-2);
      font-weight: 700;
    }

    .part {
      display: grid;
      gap: var(--space-1);
    }

    /* Calendars, reasons and problems each start below a thin rule. */
    ul.part {
      margin: 0;
      padding: 0;
      padding-block-start: var(--space-2);
      border-block-start: 1px solid var(--r-border);
      list-style: none;
    }

    /* A line with its value at the end. */
    .line {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-2);
      align-items: center;
      justify-content: space-between;
    }

    .name,
    .muted,
    .reasons {
      color: var(--r-text-muted);
    }

    b {
      font-weight: 700;
      white-space: nowrap;
    }

    /* Read by screen readers, not shown. */
    .spoken {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /*
     * The Soll bar: blocks of the day side by side, each as long as its share of the day (its flex-basis), over the
     * full width, so that they line up with the segments of the leave bar below (LeaveBar.svelte).
     */
    .bar {
      display: flex;
      min-block-size: 1.75rem;
      overflow: hidden;
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      font-size: var(--font-size-1);
      font-weight: 700;
    }

    .block {
      position: relative;
      display: grid;
      min-inline-size: 0;
      place-items: center;
      padding-inline: var(--space-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar > :not(:first-child) {
      border-inline-start: 1px solid var(--r-border-strong);
    }

    /* The required work in the month view's colours and patterns. */
    .block.work {
      background: var(--r-workday);
    }

    /* The free time in its pattern; the leave bar's blocks of time without work look the same. */
    .off-weekend .block:not(.work) {
      background: var(--r-fill-weekend);
    }

    .off-holiday .block:not(.work) {
      background: var(--r-fill-holiday);
    }

    .off-halfRequired .block:not(.work) {
      background: var(--r-fill-half-required);
    }

    .off-free .block:not(.work) {
      background: var(--r-fill-free);
    }

    .stretch {
      position: absolute;
      inset-block: 0;
    }

    /* A calendar: its name, then where it lies in the day in its accent and line style. */
    .calendars li {
      display: grid;
      gap: 2px;
      font-size: var(--font-size-1);
    }

    .track {
      position: relative;
      block-size: 10px;
      overflow: hidden;
      border: 1px solid var(--r-border);
      border-radius: 3px;
    }

    .mark {
      /* The inline style sets the source's accent; forced colours replace it below. */
      --mark: var(--accent);
      background: var(--mark);
    }

    .mark.dashed {
      background: repeating-linear-gradient(in srgb 90deg, var(--mark) 0 7px, transparent 7px 10px);
    }

    .mark.dotted {
      background: repeating-linear-gradient(in srgb 90deg, var(--mark) 0 3px, transparent 3px 6px);
    }

    .reasons {
      font-size: var(--font-size-1);
    }

    .problems {
      color: var(--r-overdraft);
      font-size: var(--font-size-1);
      font-weight: 600;
    }

    .inline {
      inline-size: 20rem;
      max-inline-size: 100%;
      padding: var(--space-3);
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-surface-raised);
    }

    /* Forced colours: the calendars' marks in the text colour. */
    @media (forced-colors: active) {
      .mark {
        --mark: CanvasText;
        forced-color-adjust: none;
      }
    }
  }
</style>
