<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { PlanTotals, Problem } from "../../engine/counting/plan.ts";
  import type { Stretch } from "../../engine/counting/stretches.ts";
  import { dayFromYmd } from "../../engine/days.ts";
  import { UNITS_PER_DAY } from "../../engine/weight.ts";
  import AllowanceBar from "../../ui/allowance/AllowanceBar.svelte";
  import AllowancePanel from "../../ui/allowance/AllowancePanel.svelte";
  import type { Legend } from "../../ui/allowance/legend.ts";
  import { pluralCount, formatDays } from "../../ui/i18n/format.ts";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";

  const days = (count: number): number => count * UNITS_PER_DAY;
  const ALLOWANCE = days(30);

  // The bar in its three states: under the allowance, exactly at it and over it.
  const states = [
    { key: "under", planned: days(12) },
    { key: "exact", planned: days(30) },
    { key: "over", planned: days(32.5) },
  ] as const;

  const stretches: Stretch[] = [
    { start: { day: dayFromYmd(2027, 8, 2), offset: 0 }, end: { day: dayFromYmd(2027, 8, 15), offset: 0 }, cost: days(10), daysOff: days(14), listed: true },
    { start: { day: dayFromYmd(2027, 12, 24), offset: 240 }, end: { day: dayFromYmd(2027, 12, 31), offset: 240 }, cost: days(4), daysOff: days(8), listed: true },
  ];
  const totals: PlanTotals = { allowance: ALLOWANCE, planned: days(14), remaining: days(16), byYear: [{ year: 2027, planned: days(14) }] };
  const overTotals: PlanTotals = { allowance: ALLOWANCE, planned: days(32.5), remaining: days(-2.5), byYear: [{ year: 2027, planned: days(32.5) }] };
  // Every mark, and a calendar in each line style.
  const legend: Legend = {
    marks: ["leave", "mandatory", "otherPlan", "weekend", "holiday", "halfRequired", "free", "problem"],
    calendars: [
      { source: { id: "school", name: { de: "Schulferien", en: "School holidays" }, type: "info", color: { slot: "accent-1" }, visible: true }, accent: 1, style: "solid" },
      { source: { id: "project", name: { de: "Projektphase", en: "Project phase" }, type: "info", color: { slot: "accent-2" }, visible: true }, accent: 2, style: "dashed" },
      { source: { id: "kita", name: "Kita", type: "needed", color: { slot: "accent-4" }, visible: true }, accent: 4, style: "dotted" },
    ],
  };
  const noneTotals: PlanTotals = { allowance: ALLOWANCE, planned: 0, remaining: ALLOWANCE, byYear: [{ year: 2027, planned: 0 }] };

  // Two problems in the period, whose rows show the day, and one after it, whose row is plain text.
  const period = { from: dayFromYmd(2027, 1, 1), to: dayFromYmd(2027, 12, 31) };
  const problems: Problem[] = [
    { code: "leaveWithoutRequiredWork", day: dayFromYmd(2027, 2, 13) },
    { code: "uncoveredNeed", day: dayFromYmd(2027, 6, 4), sourceIds: ["need"] },
    { code: "leaveOutsidePeriod", day: dayFromYmd(2028, 1, 3) },
  ];
</script>

<div class="stack" style:--gap="var(--space-5)">
  {#each states as state (state.key)}
    <section class="stack" style:--gap="var(--space-2)" data-state={state.key}>
      <h2>{state.key === "under" ? i18n.t("gallery.allowance.under") : state.key === "exact" ? i18n.t("gallery.allowance.exact") : i18n.t("gallery.allowance.over")}</h2>
      <AllowanceBar allowance={ALLOWANCE} planned={state.planned} />
    </section>
  {/each}

  <section class="stack frame" style:--gap="var(--space-2)">
    <h2>{i18n.t("gallery.allowance.panel")}</h2>
    <AllowancePanel allowance={ALLOWANCE} {totals} {stretches} {legend} />
  </section>

  <section class="stack frame" style:--gap="var(--space-2)">
    <h2>{i18n.t("gallery.allowance.panelOver")}</h2>
    <AllowancePanel allowance={ALLOWANCE} totals={overTotals} {stretches} />
  </section>

  <section class="stack frame" style:--gap="var(--space-2)">
    <h2>{i18n.t("gallery.allowance.problems")}</h2>
    <AllowancePanel allowance={ALLOWANCE} {totals} {stretches} {problems} {period} onproblem={() => {}} />
  </section>

  <section class="stack frame" style:--gap="var(--space-2)">
    <h2>{i18n.t("gallery.allowance.empty")}</h2>
    <AllowancePanel allowance={ALLOWANCE} totals={noneTotals} stretches={[]} />
  </section>

  <section class="stack frame" style:--gap="var(--space-2)">
    <h2>{i18n.t("gallery.allowance.compact")}</h2>
    <p><strong>{i18n.t("allowance.left", { days: formatDays(totals.remaining, i18n.locale), count: pluralCount(totals.remaining) })}</strong></p>
    <AllowanceBar allowance={ALLOWANCE} planned={totals.planned} />
  </section>
</div>

<style>
  @layer components {
    .frame {
      max-inline-size: 22rem;
      padding: var(--space-4);
      border: 1px solid var(--r-border);
    }
  }
</style>
