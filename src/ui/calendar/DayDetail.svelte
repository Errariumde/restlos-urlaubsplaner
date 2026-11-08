<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The detail of a day (docs/SPEC.md, "Detail view"): the date; the required work as a line and a bar of work and
  // free time; the leave as a line and a bar of switches with the "Full day" checkbox, its cost and the work left;
  // the calendars as bars; the reasons; the problems. A popover next to the cell; a bottom sheet on a narrow calendar
  // or a touch screen; inline in the gallery.
  import { tick, untrack } from "svelte";
  import type { DayResult, Problem } from "../../engine/counting/plan.ts";
  import { textFor } from "../../engine/file/text.ts";
  import { UNITS_PER_DAY, type Units } from "../../engine/weight.ts";
  import Checkbox from "../controls/Checkbox.svelte";
  import Popover from "../controls/Popover.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { formatDate, formatList } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { LeaveChange, PlanMeta } from "../worker/protocol.ts";
  import { lineStyle, sourceAccent } from "./cell-lanes.ts";
  import { amountText, dayDetail, reasonText, type DaySpan } from "./detail.ts";
  import { announced, statusText } from "./status.ts";

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
  }

  let { day, meta, problems, presentation, anchor, onclose = () => {}, onapply = (change) => app.apply([change]) }: Props = $props();

  const words = $derived({ t: (key: string, args?: Record<string, string | number>) => i18n.t(key, args), locale: i18n.locale });
  const detail = $derived(dayDetail(day, meta, problems, i18n.locale));
  const date = $derived(formatDate(day.day, i18n.locale, "long"));
  const label = $derived(i18n.t("detail.label", { date }));
  const id = $derived(`day-detail-${String(day.day)}`);

  /** A share of the day as a percentage of `whole`, for a stretch drawn inside a bar. */
  const percent = (units: Units, whole: Units = UNITS_PER_DAY): string => `${String((units / whole) * 100)}%`;

  const calendars = $derived(
    detail.calendars.map(({ source, index, entries, spans }) => {
      const name = textFor(source.name, i18n.lang);
      // The calendar, and the names of its entries on this day after it: "School holidays: Autumn break".
      const text = entries.length === 0 ? name : i18n.t("detail.sourceEntries", { source: name, entries: formatList(entries, i18n.locale) });
      return { id: source.id, text, accent: sourceAccent(source, index), style: lineStyle(index), spans };
    }),
  );

  function problemText(code: Problem["code"]): string {
    switch (code) {
      case "leaveOutsidePeriod":
        return i18n.t("detail.problem.leaveOutsidePeriod");
      case "leaveWithoutRequiredWork":
        return i18n.t("detail.problem.leaveWithoutRequiredWork");
      case "leaveTakenInOtherPlan":
        return i18n.t("detail.problem.leaveTakenInOtherPlan");
      case "conflictingForcedRules":
        return i18n.t("detail.problem.conflictingForcedRules");
      case "uncoveredNeed":
        return i18n.t("detail.problem.uncoveredNeed");
    }
  }

  let content = $state<HTMLElement>();

  // The bottom sheet makes the page inert, so the hint line can't announce what an action here did: the sheet says
  // it in its own live line, for the statuses reported while it is open.
  const openedAt = untrack(() => app.statusCount);
  const sheetStatus = $derived.by(() => {
    if (app.status === undefined || app.statusCount <= openedAt) return "";
    return announced(statusText(app.status, app.state, words), app.statusCount);
  });

  /** One click, one change, one undo step. The detail stays open and shows the day as it is now. */
  async function run(change: LeaveChange | undefined): Promise<void> {
    if (change === undefined || app.applying) return;
    await onapply(change);
    await tick();
    // The control just used may be disabled or gone now: keep the focus in the detail.
    const active = document.activeElement;
    const stale = active === null || active === document.body || ((active instanceof HTMLButtonElement || active instanceof HTMLInputElement) && active.disabled);
    if (content && (stale || !content.contains(active))) {
      (content.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? content).focus();
    }
  }
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

{#snippet stretch(span: DaySpan, from: Units, whole: Units, kind: string)}
  <span class="stretch {kind}" style:inset-inline-start={percent(span.from - from, whole)} style:inline-size={percent(span.to - span.from, whole)} aria-hidden="true"
  ></span>
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
          <span class="block" class:work={block.work} style:flex-grow={block.to - block.from}>{block.work ? i18n.t("detail.work") : i18n.t("detail.off")}</span>
        {/each}
      </div>
    </div>
    {#if leave}
      <div class="part">
        <div class="line">
          <p>{@render amount(i18n.t("detail.leave.label"), leave.amount, i18n.t("detail.leave.none"))}</p>
          {#if leave.fullDay}
            {@const fullDay = leave.fullDay}
            <Checkbox
              label={i18n.t("detail.fullDay")}
              checked={fullDay.checked === "true"}
              mixed={fullDay.checked === "mixed"}
              disabled={!fullDay.change}
              onchange={() => void run(fullDay.change)}
            />
          {/if}
        </div>
        <div class="bar switches" role="group" aria-label={i18n.t("detail.actions")}>
          {#each leave.segments as segment (segment.from)}
            {#if segment.kind === "switch"}
              <button
                type="button"
                class="segment"
                style:flex-grow={segment.to - segment.from}
                aria-pressed={segment.pressed}
                disabled={!segment.change}
                onclick={() => void run(segment.change)}
              >
                {#each segment.fills as fill (fill.from)}
                  {@render stretch(fill, segment.from, segment.to - segment.from, fill.kind)}
                {/each}
                <span class="text">{i18n.t("detail.segment", { name: segment.name })}</span>
              </button>
            {:else}
              <span class="locked {segment.kind}" style:flex-grow={segment.to - segment.from}>{i18n.t("detail.locked", { kind: segment.kind })}</span>
            {/if}
          {/each}
        </div>
      </div>
      <div class="part">
        <p class="line">{@render amount(i18n.t("detail.cost.label"), leave.cost, i18n.t("detail.cost.none"))}</p>
        <p class="line">{@render amount(i18n.t("detail.remaining.label"), leave.remaining, i18n.t("detail.remaining.none"))}</p>
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
          <li>{problemText(code)}</li>
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
    <p class="status" aria-live="polite" aria-atomic="true">{sheetStatus}</p>
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

    /* A line with its value or its checkbox at the end. */
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

    /* The two bars: blocks of the day side by side, as long as their share of it, over the full width. */
    .bar {
      display: flex;
      min-block-size: 1.75rem;
      overflow: hidden;
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      font-size: var(--font-size-1);
      font-weight: 700;
    }

    .block,
    .segment,
    .locked {
      position: relative;
      display: grid;
      flex-basis: 0;
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

    .off-weekend .block:not(.work) {
      background: repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px), var(--r-weekend);
    }

    .off-holiday .block:not(.work) {
      background: radial-gradient(circle, var(--r-day-pattern) 0 1px, transparent 1.5px) 0 0 / 6px 6px, var(--r-holiday);
    }

    .off-halfRequired .block:not(.work) {
      background: repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px), var(--r-half-required);
    }

    .off-free .block:not(.work) {
      background:
        repeating-linear-gradient(in srgb 45deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        repeating-linear-gradient(in srgb 135deg, transparent 0 4px, var(--r-day-pattern) 4px 5px),
        var(--r-weekend);
    }

    /* The leave switches: grey where no leave is taken, the leave drawn inside as the cell draws it. */
    .segment {
      margin: 0;
      border: 0;
      background: var(--r-border);
      color: var(--r-text);
      font: inherit;
      font-weight: 400;
      cursor: pointer;
    }

    .segment:focus-visible {
      z-index: 1;
      outline: 3px solid var(--r-focus);
      outline-offset: -3px;
    }

    .segment:disabled {
      color: var(--r-text-muted);
      cursor: not-allowed;
    }

    .segment[aria-pressed="true"] {
      color: var(--r-on-leave);
      font-weight: 700;
    }

    .segment[aria-pressed="true"] .text {
      text-shadow: 0 0 2px var(--r-leave-aura), 0 0 1px var(--r-leave-aura);
    }

    .text {
      position: relative;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stretch {
      position: absolute;
      inset-block: 0;
    }

    .stretch.own {
      background: var(--r-leave-full);
    }

    .stretch.mandatory,
    .locked.mandatory {
      background: repeating-linear-gradient(in srgb 45deg, var(--r-mandatory) 0 4px, var(--r-mandatory-stripe) 4px 7px);
    }

    .locked.mandatory {
      color: var(--r-on-mandatory);
    }

    .stretch.otherPlan,
    .locked.otherPlan {
      background: var(--r-surface);
      outline: 2px dashed var(--r-other-plan);
      outline-offset: -3px;
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

    /* What an action in the sheet did, quiet like the hint line; empty until then. */
    .status {
      margin-block-start: var(--space-3);
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }

    /* Kept in the accessibility tree while empty, so its first text is announced too. */
    .status:empty {
      margin: 0;
    }

    .inline {
      inline-size: 20rem;
      max-inline-size: 100%;
      padding: var(--space-3);
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-surface-raised);
    }

    /* Forced colours: own leave and pressed switches in the highlight colours, the other kinds outlined. */
    @media (forced-colors: active) {
      .stretch.own {
        forced-color-adjust: none;
        background: Highlight;
      }

      .segment[aria-pressed="true"] {
        forced-color-adjust: none;
        color: HighlightText;
      }

      .segment[aria-pressed="true"] .text {
        text-shadow: none;
      }

      .stretch.mandatory,
      .locked.mandatory {
        outline: 2px solid CanvasText;
        outline-offset: -3px;
      }

      .mark {
        --mark: CanvasText;
        forced-color-adjust: none;
      }
    }
  }
</style>
