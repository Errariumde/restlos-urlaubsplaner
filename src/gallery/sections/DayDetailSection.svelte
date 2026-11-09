<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import type { DayResult } from "../../engine/counting/plan.ts";
  import DayDetail from "../../ui/calendar/DayDetail.svelte";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";
  import type { LeaveChange, PlanState } from "../../ui/worker/protocol.ts";
  import { Session } from "../../ui/worker/session.ts";
  import { planText, situations, type PlanName } from "./detail-situations.ts";

  // Every situation of the day detail, shown inline (the content of the popover and the sheet). Three plans hold
  // them all, one of them per smallest leave unit; the real engine computes them here in the page, and the switches
  // change them, so each detail can be tried.
  const sessions: Record<PlanName, Session> = { situations: new Session(), quarters: new Session(), sixteenths: new Session() };
  const t = (key: string): string => i18n.t(key);

  /** The plans as opened; a click replaces one with the changed plan, a change of language opens them again. */
  let states = $derived.by((): Partial<Record<PlanName, PlanState>> => {
    const example = document.getElementById("example-plan")?.textContent;
    if (!example) return {};
    const opened: Partial<Record<PlanName, PlanState>> = {};
    for (const name of ["situations", "quarters", "sixteenths"] as const) {
      const state = sessions[name].open(planText(name, example, t), true);
      if (!("refused" in state)) opened[name] = state;
    }
    return opened;
  });

  const groups = $derived(situations(t));

  function dayOf(current: PlanState, day: number): DayResult | undefined {
    const first = current.result.days[0]?.day ?? 0;
    return current.result.days[day - first];
  }

  function apply(name: PlanName, change: LeaveChange): void {
    states = { ...states, [name]: sessions[name].apply([change]) };
  }
</script>

<div class="stack">
  {#each groups as group (group.title)}
    {@const plan = group.plan ?? "situations"}
    {@const current = states[plan]}
    {#if current}
      <!-- The accessibility check (axe) leaves out the groups marked with data-axe-skip; their `skipAxe` says why. -->
      <section class="stack" data-axe-skip={group.skipAxe ? "" : undefined}>
        <h2>{group.title}</h2>
        <div class="samples">
          {#each group.samples as [caption, day] (day)}
            {@const result = dayOf(current, day)}
            {#if result}
              <figure>
                <figcaption>{caption}</figcaption>
                <DayDetail
                  day={result}
                  meta={current.meta}
                  problems={current.result.problems}
                  presentation="inline"
                  onapply={(change: LeaveChange) => apply(plan, change)}
                />
              </figure>
            {/if}
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</div>

<style>
  @layer components {
    h2 {
      font-size: var(--font-size-2);
      font-weight: 700;
    }

    .samples {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(20rem, 100%), 1fr));
      gap: var(--space-4);
      align-items: start;
    }

    figure {
      display: grid;
      gap: var(--space-1);
      margin: 0;
    }

    figcaption {
      color: var(--r-text-muted);
      font-size: var(--font-size-1);
      font-weight: 700;
    }
  }
</style>
