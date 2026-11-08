<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The allowance, what is planned and what remains, the bar, the plan's problems, the stretches off and the totals
  // per year.
  import type { PlanTotals, Problem } from "../../engine/counting/plan.ts";
  import type { Stretch } from "../../engine/counting/stretches.ts";
  import type { DayNumber } from "../../engine/days.ts";
  import type { Units } from "../../engine/weight.ts";
  import { pluralCount, formatDate, formatDays } from "../i18n/format.ts";
  import { problemText } from "../calendar/problems.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import AllowanceBar from "./AllowanceBar.svelte";

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
    period?: { readonly from: DayNumber; readonly to: DayNumber } | undefined;
  }

  let { allowance, totals, stretches, showBar = true, problems = [], onproblem, period }: Props = $props();

  // Per instance: the gallery shows several panels on one page.
  const uid = $props.id();
  const headingId = `${uid}-stretches`;
  const problemsId = `${uid}-problems`;

  /** A problem's day can be shown when it lies in the calendar, which shows the plan period. */
  const showable = (day: DayNumber): boolean => onproblem !== undefined && period !== undefined && day >= period.from && day <= period.to;

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
      <ul class="problems" aria-labelledby={problemsId}>
        {#each problems as problem, index (index)}
          <li>
            {#if showable(problem.day)}
              <button type="button" class="jump" onclick={() => onproblem?.(problem.day)}>{problemRow(problem)}</button>
            {:else}
              {problemRow(problem)}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="stack" style:--gap="var(--space-2)">
    <h3 id={headingId}>{i18n.t("allowance.stretches")}</h3>
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

    h3 {
      font-size: var(--font-size-1);
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

    .jump:focus-visible {
      border-radius: 2px;
      outline: 2px solid var(--r-focus);
      outline-offset: 2px;
    }

    .years {
      border-collapse: collapse;
      font-size: var(--font-size-1);
    }

    caption {
      margin-block-end: var(--space-1);
      text-align: start;
      color: var(--r-text-muted);
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
