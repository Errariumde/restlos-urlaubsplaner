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
  import { situations, situationsPlan } from "./detail-situations.ts";

  // Every situation of the day detail, shown inline (the content of the popover and the sheet). One plan holds them
  // all; the real engine computes it here in the page, and the switches change it, so each detail can be tried.
  const session = new Session();
  const t = (key: string): string => i18n.t(key);

  /** The plan as opened; a click replaces it with the changed plan, a change of language opens it again. */
  let state = $derived.by((): PlanState | undefined => {
    const example = document.getElementById("example-plan")?.textContent;
    if (!example) return undefined;
    const opened = session.open(situationsPlan(example, t), true);
    return "refused" in opened ? undefined : opened;
  });

  const groups = $derived(situations(t));

  function dayOf(current: PlanState, day: number): DayResult | undefined {
    const first = current.result.days[0]?.day ?? 0;
    return current.result.days[day - first];
  }

  function apply(change: LeaveChange): void {
    state = session.apply([change]);
  }
</script>

{#if state}
  {@const current = state}
  <div class="stack">
    {#each groups as group (group.title)}
      <section class="stack">
        <h2>{group.title}</h2>
        <div class="samples">
          {#each group.samples as [caption, day] (day)}
            {@const result = dayOf(current, day)}
            {#if result}
              <figure>
                <figcaption>{caption}</figcaption>
                <DayDetail day={result} meta={current.meta} problems={current.result.problems} presentation="inline" onapply={apply} />
              </figure>
            {/if}
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

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
