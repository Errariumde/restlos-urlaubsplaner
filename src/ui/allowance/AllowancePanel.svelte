<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The allowance, what is planned and what remains, the bar, the plan's problems, the stretches off, the totals
  // per year and the legend. All section headings look alike.
  import { tick } from "svelte";
  import type { PlanTotals, Problem } from "../../engine/counting/plan.ts";
  import type { Stretch } from "../../engine/counting/stretches.ts";
  import type { DayNumber } from "../../engine/days.ts";
  import type { Units } from "../../engine/weight.ts";
  import { pluralCount, formatDate, formatDays } from "../i18n/format.ts";
  import { problemText } from "../calendar/problems.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import AllowanceBar from "./AllowanceBar.svelte";
  import LegendList from "./Legend.svelte";
  import type { Legend } from "./legend.ts";

  interface Props {
    allowance: Units;
    totals: PlanTotals;
    stretches: readonly Stretch[];
    /** The compact layout shows the bar above the details, so the details leave it out. */
    showBar?: boolean;
    /** The plan's problems (docs/SPEC.md, "Problems"), listed only when there are any. */
    problems?: readonly Problem[];
    /** Shows a day's detail; a problem of a day in the plan period offers it. */
    onproblem?: ((day: DayNumber) => void) | undefined;
    /** Removes a day's own leave; leave outside the plan period offers it, as the calendar can't show that day. */
    onremove?: ((day: DayNumber) => Promise<void> | void) | undefined;
    period?: { readonly from: DayNumber; readonly to: DayNumber } | undefined;
    /** What the calendar draws in the plan period; the panel ends with it when there is anything. */
    legend?: Legend | undefined;
  }

  let { allowance, totals, stretches, showBar = true, problems = [], onproblem, onremove, period, legend }: Props = $props();

  // Per instance: the gallery shows several panels on one page.
  const uid = $props.id();
  const headingId = `${uid}-stretches`;
  const problemsId = `${uid}-problems`;
  const legendId = `${uid}-legend`;

  /** A problem's day can be shown when it lies in the calendar, which shows the plan period. */
  const showable = (day: DayNumber): boolean => onproblem !== undefined && period !== undefined && day >= period.from && day <= period.to;

  let problemList = $state<HTMLUListElement>();
  let stretchesHeading = $state<HTMLHeadingElement>();

  /**
   * Removes the leave of a problem's row. The row goes with its problem, so the focus moves to the row now in its
   * place, else to the row before, else (no problem left) to the stretches heading.
   */
  async function remove(day: DayNumber, index: number): Promise<void> {
    await onremove?.(day);
    await tick();
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    const rows = problemList ? [...problemList.children] : [];
    const row = rows[Math.min(index, rows.length - 1)];
    (row?.querySelector<HTMLElement>("button") ?? stretchesHeading)?.focus();
  }

  function problemRow(problem: Problem): string {
    return i18n.t("allowance.problem", {
      date: formatDate(problem.day, i18n.locale, "dayMonth"),
      problem: problemText(problem.code, (key) => i18n.t(key)),
    });
  }

  const listed = $derived(stretches.filter((stretch) => stretch.listed));

  function stretchText(stretch: Stretch): string {
    const locale = i18n.locale;
    // Only offset 240 (noon) is shown as "from noon" / "until noon": UI v1 has full and half days only, so any
    // other offset reads as a whole day.
    // The end is exclusive: offset 0 means the stretch ends with the day before.
    const last = stretch.end.offset === 0 ? stretch.end.day - 1 : stretch.end.day;
    return i18n.t("allowance.stretch", {
      from: formatDate(stretch.start.day, locale, "dayMonth"),
      fromNoon: stretch.start.offset === 240 ? "yes" : "no",
      to: formatDate(last, locale, "dayMonth"),
      untilNoon: stretch.end.offset === 240 ? "yes" : "no",
      cost: formatDays(stretch.cost, locale),
      costCount: pluralCount(stretch.cost),
      daysOff: formatDays(stretch.daysOff, locale),
      daysOffCount: pluralCount(stretch.daysOff),
    });
  }
</script>

<div class="panel stack">
  <dl class="figures">
    <div>
      <dt>{i18n.t("allowance.allowance")}</dt>
      <dd data-testid="allowance">{formatDays(allowance, i18n.locale)}</dd>
    </div>
    <div>
      <dt>{i18n.t("allowance.planned")}</dt>
      <dd data-testid="planned">{formatDays(totals.planned, i18n.locale)}</dd>
    </div>
    <div>
      <dt>{i18n.t("allowance.remaining")}</dt>
      <dd data-testid="remaining" class:negative={totals.remaining < 0}>{formatDays(totals.remaining, i18n.locale)}</dd>
    </div>
  </dl>

  {#if showBar}
    <AllowanceBar {allowance} planned={totals.planned} />
  {/if}

  {#if problems.length > 0}
    <section class="stack" style:--gap="var(--space-2)">
      <h3 id={problemsId} class="problems-heading">{i18n.t("allowance.problems", { count: problems.length })}</h3>
      <ul class="problems" aria-labelledby={problemsId} bind:this={problemList}>
        {#each problems as problem, index (index)}
          <li>
            {#if showable(problem.day)}
              <button type="button" class="jump" onclick={() => onproblem?.(problem.day)}>{problemRow(problem)}</button>
            {:else if problem.code === "leaveOutsidePeriod" && onremove}
              {problemRow(problem)}
              <button
                type="button"
                class="jump"
                aria-label={i18n.t("allowance.removeLeaveOn", { date: formatDate(problem.day, i18n.locale, "dayMonth") })}
                onclick={() => void remove(problem.day, index)}>{i18n.t("allowance.removeLeave")}</button
              >
            {:else}
              {problemRow(problem)}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="stack" style:--gap="var(--space-2)">
    <!-- Takes the focus when the last problem's row is removed. -->
    <h3 id={headingId} tabindex="-1" bind:this={stretchesHeading}>{i18n.t("allowance.stretches")}</h3>
    {#if listed.length === 0}
      <p class="muted">{i18n.t("allowance.noStretches")}</p>
    {:else}
      <ul class="stretches" aria-labelledby={headingId}>
        {#each listed as stretch (`${String(stretch.start.day)}:${String(stretch.start.offset)}`)}
          <li>{stretchText(stretch)}</li>
        {/each}
      </ul>
    {/if}
  </section>

  <table class="years">
    <caption>{i18n.t("allowance.years")}</caption>
    <thead>
      <tr>
        <th scope="col">{i18n.t("allowance.year")}</th>
        <th scope="col">{i18n.t("allowance.planned")}</th>
      </tr>
    </thead>
    <tbody>
      {#each totals.byYear as entry (entry.year)}
        <tr>
          <th scope="row">{entry.year}</th>
          <td>{formatDays(entry.planned, i18n.locale)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if legend && (legend.marks.length > 0 || legend.calendars.length > 0)}
    <section class="stack" style:--gap="var(--space-2)">
      <h3 id={legendId}>{i18n.t("legend.heading")}</h3>
      <LegendList {legend} labelledby={legendId} />
    </section>
  {/if}
</div>

<style>
  @layer components {
    .panel {
      --gap: var(--space-4);
      min-inline-size: 0;
    }

    .figures {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
    }

    dt {
      overflow-wrap: anywhere;
      color: var(--r-text-muted);
      font-size: var(--font-size-0);
    }

    dd {
      font-size: var(--font-size-3);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .negative {
      color: var(--r-overdraft);
    }

    /* One style for every section heading, the table's caption included. */
    h3,
    caption {
      color: var(--r-text);
      font-size: var(--font-size-1);
      font-weight: 700;
    }

    .muted {
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
    }

    .problems-heading {
      color: var(--r-overdraft);
    }

    /* One row per problem; a row that can show its day is a button that reads like a link. */
    .problems,
    .stretches {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: 0;
      list-style: none;
      font-size: var(--font-size-1);
      /* Long words (long translations) wrap instead of running past the sidebar, which scrolls. */
      overflow-wrap: anywhere;
    }

    .jump {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      text-decoration: underline;
      text-underline-offset: 0.15em;
      cursor: pointer;
    }

    .jump:hover {
      text-decoration-thickness: 2px;
    }

    .jump:focus-visible,
    h3:focus-visible {
      border-radius: 2px;
      outline: 2px solid var(--r-focus);
      outline-offset: 2px;
    }

    /* Touch: a 40 px tap target (docs/SPEC.md, "Screen sizes"). */
    @media (pointer: coarse) {
      .jump {
        min-block-size: 2.5rem;
        vertical-align: middle;
      }
    }

    .years {
      border-collapse: collapse;
      font-size: var(--font-size-1);
    }

    caption {
      margin-block-end: var(--space-2);
      text-align: start;
    }

    th,
    td {
      padding-block: var(--space-1);
      padding-inline: 0;
      border-block-end: 1px solid var(--r-border);
      text-align: start;
      font-variant-numeric: tabular-nums;
    }

    td {
      text-align: end;
    }
  }
</style>
