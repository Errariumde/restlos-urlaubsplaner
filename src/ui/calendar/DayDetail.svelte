<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The detail of a day (docs/SPEC.md, "Detail view"): the date; the required work as a line and a bar of work and
  // free time; the leave as a line and a bar of switches with the "Full day" checkbox, its cost and the work left;
  // the calendars as bars; the reasons; the problems. A popover next to the cell; a bottom sheet on a narrow calendar
  // or a touch screen; inline in the gallery.
  import { tick } from "svelte";
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
  import { amountText, dayDetail, fixedText, partText, reasonText, switchText, type DaySpan, type SwitchSegment } from "./detail.ts";
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

  let content = $state<HTMLElement>();
  let bar = $state<HTMLElement>();

  /** The leave bar's switches that a press can change, in the order of the day: the stops of its arrow keys. */
  const usable = $derived(detail.leave?.segments.filter((segment): segment is SwitchSegment => segment.kind === "switch" && segment.change !== undefined) ?? []);
  /** The switch the focus was on last, on this day. */
  let focused = $state<{ day: number; from: Units }>();
  /** The bar's one Tab stop (roving tabindex): the switch the focus was on last, else the first one. */
  const stop = $derived(usable.find((segment) => focused?.day === day.day && segment.from === focused.from)?.from ?? usable[0]?.from);

  function focusSwitch(from: Units): void {
    bar?.querySelector<HTMLElement>(`[data-from="${String(from)}"]`)?.focus();
  }

  /** The arrow keys move to the next or the previous switch (in the reading direction), Home and End to the first or the last. */
  function moveInBar(event: KeyboardEvent, from: Units): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const at = usable.findIndex((segment) => segment.from === from);
    const ahead = i18n.dir === "rtl" ? -1 : 1;
    const steps: Record<string, number> = { ArrowRight: at + ahead, ArrowLeft: at - ahead, ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: usable.length - 1 };
    const to = steps[event.key];
    if (to === undefined || at < 0) return;
    event.preventDefault();
    const target = usable[Math.max(0, Math.min(to, usable.length - 1))];
    if (target) focusSwitch(target.from);
  }

  /** The switch nearest to the stretch `span` of the day, the one over it first. */
  function nearestSwitch(span: DaySpan): SwitchSegment | undefined {
    const distance = (segment: SwitchSegment): number => Math.max(0, segment.from - span.to, span.from - segment.to);
    return usable.reduce<SwitchSegment | undefined>((best, segment) => (best === undefined || distance(segment) < distance(best) ? segment : best), undefined);
  }

  /**
   * One click, one change, one undo step. The detail stays open and shows the day as it is now. `pressed` is the
   * switch that made the change: if it is gone or disabled now, the focus goes to the switch nearest to it.
   */
  async function run(change: LeaveChange | undefined, pressed?: DaySpan): Promise<void> {
    if (change === undefined || app.applying) return;
    await onapply(change);
    await tick();
    // The control just used may be disabled or gone now: keep the focus in the detail.
    const active = document.activeElement;
    const stale = active === null || active === document.body || ((active instanceof HTMLButtonElement || active instanceof HTMLInputElement) && active.disabled);
    if (!content || (!stale && content.contains(active))) return;
    const near = pressed === undefined ? undefined : nearestSwitch(pressed);
    if (near !== undefined) focusSwitch(near.from);
    else (content.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? content).focus();
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
          <span class="block" class:work={block.work} style:flex-basis={percent(block.to - block.from)}>{block.work ? i18n.t("detail.work") : i18n.t("detail.off")}</span>
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
        <!--
          One element per segment, in the order of the day, each as wide as its share of the day. Switches are
          toggle buttons named by their part; fixed blocks show a short word and are read by their full name.
        -->
        <div class={["bar switches", { few: leave.parts <= 4 }]} role="group" aria-label={i18n.t("detail.actions")} bind:this={bar}>
          {#each leave.segments as segment (segment.from)}
            {#if segment.kind === "switch"}
              <button
                type="button"
                class="segment"
                style:flex-basis={percent(segment.to - segment.from)}
                data-from={segment.from}
                tabindex={segment.from === stop ? 0 : -1}
                aria-label={switchText(segment, day.required, words.t)}
                aria-pressed={segment.pressed}
                disabled={!segment.change}
                onfocus={() => (focused = { day: day.day, from: segment.from })}
                onkeydown={(event) => moveInBar(event, segment.from)}
                onclick={() => void run(segment.change, segment)}
              >
                {#each segment.fills as fill (fill.from)}
                  {@render stretch(fill, segment.from, segment.to - segment.from, fill.kind)}
                {/each}
                <span class="text">{partText(segment.name, words.t)}</span>
              </button>
            {:else}
              <span class={["locked", segment.kind, segment.kind === "free" && `off-${required.off}`]} style:flex-basis={percent(segment.to - segment.from)}>
                <span class="text" aria-hidden="true">{segment.kind === "free" ? i18n.t("detail.off") : i18n.t("detail.locked", { kind: segment.kind })}</span>
                <span class="spoken">{fixedText(segment, words.t)}</span>
              </span>
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

    /*
     * The two bars: blocks of the day side by side, each as long as its share of the day (its flex-basis), over the
     * full width, so that the blocks of both bars line up.
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

    .block,
    .segment,
    .locked {
      position: relative;
      display: grid;
      min-inline-size: 0;
      place-items: center;
      padding-inline: var(--space-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /*
     * The leave bar's segments can be a sliver of the day, so their padding sits on the text, and a segment
     * too narrow for its text shows none.
     */
    .segment,
    .locked {
      container-type: inline-size;
      padding-inline: 0;
    }

    .switches .text {
      max-inline-size: 100%;
      padding-inline: var(--space-1);
    }

    @container (inline-size < 2.5rem) {
      .switches .text {
        display: none;
      }
    }

    /*
     * With up to four parts (units 1, ½ and ¼) a switch is never narrower than the touch size: the fixed blocks
     * beside it give way first.
     */
    .few .segment {
      min-inline-size: 2.75rem;
    }

    .switches .locked {
      flex-shrink: 1000;
    }

    .bar > :not(:first-child) {
      border-inline-start: 1px solid var(--r-border-strong);
    }

    /* The required work in the month view's colours and patterns. */
    .block.work {
      background: var(--r-workday);
    }

    /* The leave bar's blocks of time without work look exactly like the free time above them. */
    .off-weekend .block:not(.work),
    .locked.free.off-weekend {
      background: var(--r-fill-weekend);
    }

    .off-holiday .block:not(.work),
    .locked.free.off-holiday {
      background: var(--r-fill-holiday);
    }

    .off-halfRequired .block:not(.work),
    .locked.free.off-halfRequired {
      background: var(--r-fill-half-required);
    }

    .off-free .block:not(.work),
    .locked.free.off-free {
      background: var(--r-fill-free);
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
      background: var(--r-fill-mandatory);
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
