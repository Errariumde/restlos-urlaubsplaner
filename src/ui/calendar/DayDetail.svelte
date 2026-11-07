<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The detail of a day (docs/SPEC.md, "Detail view"; D7): the date, the required work and what decided it,
  // the calendar sources, the leave, its cost and the day's problems, with one action per kind of leave.
  // A popover next to the cell; a bottom sheet on a narrow calendar or a touch screen; inline in the gallery.
  import { tick } from "svelte";
  import type { DayResult, Problem } from "../../engine/counting/plan.ts";
  import { textFor } from "../../engine/file/text.ts";
  import Button from "../controls/Button.svelte";
  import Popover from "../controls/Popover.svelte";
  import Sheet from "../controls/Sheet.svelte";
  import { pluralCount, formatDate, formatDays } from "../i18n/format.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { app } from "../state/app.svelte.ts";
  import type { LeaveChange, PlanMeta } from "../worker/protocol.ts";
  import { lineStyle, sourceAccent } from "./cell-lanes.ts";
  import { dayDetail, detailActions, type Blocked, type DayDetailData } from "./detail.ts";

  interface Props {
    day: DayResult;
    meta: PlanMeta;
    /** The result's problems; the detail keeps those of its day. */
    problems: readonly Problem[];
    presentation: "popover" | "sheet" | "inline";
    /** The day's cell: the popover opens next to it, and the focus goes back to it on close. */
    anchor?: HTMLElement | undefined;
    onclose?: () => void;
  }

  let { day, meta, problems, presentation, anchor, onclose = () => {} }: Props = $props();

  const detail = $derived(dayDetail(day, meta, problems, i18n.locale));
  const actions = $derived(detailActions(day));
  const date = $derived(formatDate(day.day, i18n.locale, "long"));
  const label = $derived(i18n.t("detail.label", { date }));
  const id = $derived(`day-detail-${String(day.day)}`);

  /** Each key spelled out, so the catalog check sees it used; a holiday's `nameKey` becomes its name. */
  function reasonText({ key, args }: DayDetailData["requiredReason"]): string {
    const nameKey = args["nameKey"];
    const values = typeof nameKey === "string" ? { ...args, name: i18n.t(nameKey) } : args;
    switch (key) {
      case "detail.required.workWeek":
        return i18n.t("detail.required.workWeek", values);
      case "detail.required.publicHoliday":
        return i18n.t("detail.required.publicHoliday", values);
      case "detail.required.holidaySource":
        return i18n.t("detail.required.holidaySource", values);
      case "detail.required.paidClosure":
        return i18n.t("detail.required.paidClosure", values);
      case "detail.required.ruleAtMost":
        return i18n.t("detail.required.ruleAtMost", values);
      case "detail.required.ruleExactly":
        return i18n.t("detail.required.ruleExactly", values);
      case "detail.required.override":
        return i18n.t("detail.required.override", values);
    }
  }

  const reason = $derived(reasonText(detail.requiredReason));

  const sources = $derived(
    detail.sources.map((source) => {
      const index = meta.sources.indexOf(source);
      return { id: source.id, name: textFor(source.name, i18n.lang), accent: sourceAccent(source, index), style: lineStyle(index) };
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

  function blockedText(blocked: Blocked): string {
    switch (blocked) {
      case "noRequired":
        return i18n.t("detail.blocked.noRequired");
      case "mandatory":
        return i18n.t("detail.blocked.mandatory");
      case "otherPlan":
        return i18n.t("detail.blocked.otherPlan");
    }
  }

  let content = $state<HTMLElement>();

  /** One action, one change, one undo step. The detail stays open and shows the day as it is now. */
  async function run(change: LeaveChange | undefined): Promise<void> {
    if (change === undefined || app.applying) return;
    await app.apply([change]);
    await tick();
    // The button just used is disabled now (it would change nothing): keep the focus in the detail.
    const active = document.activeElement;
    if (content && (active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled && content.contains(active)))) {
      (content.querySelector<HTMLElement>("button:not(:disabled)") ?? content).focus();
    }
  }
</script>

{#snippet body()}
  <div class="detail stack" bind:this={content} tabindex="-1">
    <h2>{date}</h2>
    <div class="stack tight">
      <p class="required">{i18n.t("detail.required", { days: formatDays(day.required.value, i18n.locale) })}</p>
      <p class="muted">{reason}</p>
    </div>
    {#if sources.length > 0}
      <div class="stack tight">
        <h3>{i18n.t("detail.sources")}</h3>
        <ul class="sources">
          {#each sources as source (source.id)}
            <li>
              <span class="swatch {source.style}" style:--accent="var(--r-accent-{source.accent})" aria-hidden="true"></span>
              {source.name}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="stack tight">
      <p class="leave">{i18n.t("detail.leave", { leave: detail.leave })}</p>
      <p class="muted">{i18n.t("detail.cost", { count: pluralCount(detail.cost), days: formatDays(detail.cost, i18n.locale) })}</p>
    </div>
    {#if detail.problems.length > 0}
      <div class="stack tight">
        <h3>{i18n.t("detail.problems")}</h3>
        <ul class="problems">
          {#each detail.problems as code, index (index)}
            <li>{problemText(code)}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="stack tight">
      <div class="actions" role="group" aria-label={i18n.t("detail.actions")}>
        <Button variant="primary" disabled={!actions.full} onclick={() => void run(actions.full)}>{i18n.t("detail.action.full")}</Button>
        <Button disabled={!actions.morning} onclick={() => void run(actions.morning)}>{i18n.t("detail.action.morning")}</Button>
        <Button disabled={!actions.afternoon} onclick={() => void run(actions.afternoon)}>{i18n.t("detail.action.afternoon")}</Button>
        <Button disabled={!actions.remove} onclick={() => void run(actions.remove)}>{i18n.t("detail.action.remove")}</Button>
      </div>
      {#if actions.blocked}
        <p class="muted">{blockedText(actions.blocked)}</p>
      {/if}
    </div>
  </div>
{/snippet}

{#if presentation === "popover"}
  <Popover {id} {anchor} open={true} {onclose} {label}>
    {@render body()}
  </Popover>
{:else if presentation === "sheet"}
  <Sheet {id} {anchor} open={true} {onclose} {label}>
    {@render body()}
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
      min-inline-size: min(18rem, 100%);
    }

    .detail:focus {
      outline: none;
    }

    .tight {
      --gap: var(--space-1);
    }

    h2 {
      font-size: var(--font-size-2);
      font-weight: 700;
    }

    h3 {
      font-size: var(--font-size-1);
      font-weight: 600;
    }

    .required,
    .leave {
      font-weight: 600;
    }

    .muted {
      color: var(--r-text-muted);
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sources li {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }

    .problems {
      padding-inline-start: var(--space-4);
      list-style: disc;
    }

    /* The source's line as the cell draws it: its accent and its line style. */
    .swatch {
      /* The inline style sets the source's accent; forced colours replace it below. */
      --swatch: var(--accent);
      flex: none;
      inline-size: 1.5rem;
      block-size: 3px;
      background: var(--swatch);
    }

    .swatch.dashed {
      background: repeating-linear-gradient(90deg, var(--swatch) 0 7px, transparent 7px 10px);
    }

    .swatch.dotted {
      background: repeating-linear-gradient(90deg, var(--swatch) 0 3px, transparent 3px 6px);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .inline {
      max-inline-size: 24rem;
      padding: var(--space-3);
      border: 1px solid var(--r-border-strong);
      border-radius: var(--radius-control);
      background: var(--r-surface-raised);
    }

    /* The line keeps its style in forced colours: only its colour changes. */
    @media (forced-colors: active) {
      .swatch {
        --swatch: CanvasText;
        forced-color-adjust: none;
      }
    }
  }
</style>
