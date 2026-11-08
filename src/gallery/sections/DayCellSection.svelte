<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { evaluateLeave, type LeavePiece } from "../../engine/counting/leave.ts";
  import type { DayResult, Problem } from "../../engine/counting/plan.ts";
  import type { Part } from "../../engine/counting/types.ts";
  import { dayFromYmd, type DayNumber } from "../../engine/days.ts";
  import type { CellLane } from "../../ui/calendar/cell-lanes.ts";
  import DayCell from "../../ui/calendar/DayCell.svelte";
  import { i18n } from "../../ui/i18n/i18n.svelte.ts";
  import type { PlanMeta } from "../../ui/worker/protocol.ts";

  // Every layer and state of a day cell. The day results are stubs with just what the cell reads; the engine
  // evaluates their leave, so each fill is drawn as the app draws it.
  const meta = $derived({
    weekend: ["sat", "sun"],
    sources: [
      { id: "project", name: i18n.t("gallery.source.project"), type: "info", color: { slot: "accent-2" }, visible: true },
      { id: "school", name: i18n.t("gallery.source.school"), type: "info", color: { slot: "accent-1" }, visible: true },
      { id: "fair", name: i18n.t("gallery.source.fair"), type: "info", color: { slot: "accent-5" }, visible: true },
      { id: "kita", name: i18n.t("gallery.source.kita"), type: "needed", color: { slot: "accent-4" }, visible: true },
    ],
  } as unknown as PlanMeta);

  interface Stub {
    day: DayNumber;
    required?: number;
    freePart?: Part;
    holiday?: string;
    leave?: LeavePiece[];
  }

  function stub({ day, required = 480, freePart = "end", holiday, leave = [] }: Stub): DayResult {
    return {
      day,
      inPeriod: true,
      facts: { holidays: holiday ? [{ nameKey: holiday }] : [], sources: [] },
      required: { value: required, freePart },
      leave,
      evaluation: evaluateLeave({ value: required, freePart }, leave, true),
    } as unknown as DayResult;
  }

  const may = (day: number): DayNumber => dayFromYmd(2027, 5, day);
  const own = (take: number, part: Part): LeavePiece => ({ kind: "own", take, part });
  const mandatory = (take: number, part: Part): LeavePiece => ({ kind: "mandatory", take, part, ruleId: "closure" });
  const lanes = (count: number): CellLane[] =>
    ["project", "school", "fair", "kita"].slice(0, count).map((sourceId, i) => ({
      sourceId,
      lane: i < 3 ? (i as 0 | 1 | 2) : "more",
      joinStart: i % 2 === 0,
      joinEnd: true,
    }));

  interface Sample {
    caption: string;
    day: DayResult;
    lanes?: CellLane[];
    today?: boolean;
    focused?: boolean;
    selected?: boolean;
    previewed?: boolean;
    removing?: boolean;
    problems?: Problem["code"][];
  }

  const required = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.workday"), day: stub({ day: may(4) }) },
    { caption: i18n.t("gallery.cell.weekend"), day: stub({ day: may(8), required: 0 }) },
    { caption: i18n.t("gallery.cell.holiday"), day: stub({ day: may(6), required: 0, holiday: "holiday.ascension-day" }) },
    { caption: i18n.t("gallery.cell.halfRequired"), day: stub({ day: dayFromYmd(2027, 12, 24), required: 240 }) },
    { caption: i18n.t("gallery.cell.halfRequiredHoliday"), day: stub({ day: may(5), required: 240, holiday: "holiday.labour-day" }) },
    { caption: i18n.t("gallery.cell.halfRequiredStart"), day: stub({ day: may(7), required: 240, freePart: "start" }) },
    { caption: i18n.t("gallery.cell.free"), day: stub({ day: may(10), required: 0 }) },
  ]);

  const leave = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.full"), day: stub({ day: may(11), leave: [own(480, "end")] }) },
    { caption: i18n.t("gallery.cell.halfEnd"), day: stub({ day: may(12), leave: [own(240, "end")] }) },
    { caption: i18n.t("gallery.cell.halfStart"), day: stub({ day: may(13), leave: [own(240, "start")] }) },
    { caption: i18n.t("gallery.cell.quarterStart"), day: stub({ day: may(3), leave: [own(120, "start")] }) },
    { caption: i18n.t("gallery.cell.threeQuartersEnd"), day: stub({ day: may(4), leave: [own(360, "end")] }) },
    { caption: i18n.t("gallery.cell.mandatory"), day: stub({ day: may(14), leave: [mandatory(480, "end")] }) },
    { caption: i18n.t("gallery.cell.mandatoryHalf"), day: stub({ day: may(15), leave: [mandatory(240, "end")] }) },
    { caption: i18n.t("gallery.cell.ownAndMandatory"), day: stub({ day: may(16), leave: [own(480, "end"), mandatory(240, "end")] }) },
    { caption: i18n.t("gallery.cell.otherPlan"), day: stub({ day: may(17), leave: [{ kind: "otherPlan", from: 0, to: 480 }] }) },
  ]);

  const sources = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.lanes", { count: 1 }), day: stub({ day: may(18) }), lanes: lanes(1) },
    { caption: i18n.t("gallery.cell.lanes", { count: 2 }), day: stub({ day: may(19) }), lanes: lanes(2) },
    { caption: i18n.t("gallery.cell.lanes", { count: 3 }), day: stub({ day: may(20), leave: [own(480, "end")] }), lanes: lanes(3) },
    { caption: i18n.t("gallery.cell.lanesMore"), day: stub({ day: may(21) }), lanes: lanes(4) },
  ]);

  const states = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.today"), day: stub({ day: may(24) }), today: true },
    { caption: i18n.t("gallery.cell.focus"), day: stub({ day: may(25) }), focused: true },
    { caption: i18n.t("gallery.cell.selected"), day: stub({ day: may(26) }), selected: true },
    { caption: i18n.t("gallery.cell.previewed"), day: stub({ day: may(27) }), previewed: true },
    { caption: i18n.t("gallery.cell.removing"), day: stub({ day: may(28), leave: [own(480, "end")] }), previewed: true, removing: true },
    { caption: i18n.t("gallery.cell.todaySelected"), day: stub({ day: may(31), leave: [own(480, "end")] }), today: true, selected: true },
  ]);

  // The problem mark on the kinds of day it must stay legible on.
  const need: Problem["code"][] = ["uncoveredNeed"];
  const problems = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.workday"), day: stub({ day: may(4) }), problems: need },
    { caption: i18n.t("gallery.cell.full"), day: stub({ day: may(11), leave: [own(480, "end")] }), problems: need },
    { caption: i18n.t("gallery.cell.halfStart"), day: stub({ day: may(13), leave: [own(240, "start")] }), problems: need },
    { caption: i18n.t("gallery.cell.mandatory"), day: stub({ day: may(14), leave: [mandatory(480, "end")] }), problems: need },
    { caption: i18n.t("gallery.cell.holiday"), day: stub({ day: may(6), required: 0, holiday: "holiday.ascension-day" }), problems: need },
    { caption: i18n.t("gallery.cell.otherPlan"), day: stub({ day: may(17), leave: [{ kind: "otherPlan", from: 0, to: 480 }] }), problems: need },
    { caption: i18n.t("gallery.cell.lanes", { count: 1 }), day: stub({ day: may(18) }), lanes: lanes(1), problems: need },
    { caption: i18n.t("gallery.cell.today"), day: stub({ day: may(24) }), today: true, problems: need },
    { caption: i18n.t("gallery.cell.selected"), day: stub({ day: may(26), leave: [own(480, "end")] }), selected: true, problems: need },
  ]);

  const groups = $derived([
    { title: i18n.t("gallery.cell.group.required"), samples: required },
    { title: i18n.t("gallery.cell.group.leave"), samples: leave },
    { title: i18n.t("gallery.cell.group.sources"), samples: sources },
    { title: i18n.t("gallery.cell.group.states"), samples: states },
    { title: i18n.t("gallery.cell.group.problems"), samples: problems },
  ]);

  const columnSamples = $derived<Sample[]>([
    { caption: i18n.t("gallery.cell.full"), day: stub({ day: may(11), leave: [own(480, "end")] }), lanes: lanes(2) },
    { caption: i18n.t("gallery.cell.weekend"), day: stub({ day: may(8), required: 0 }), lanes: lanes(1) },
    { caption: i18n.t("gallery.cell.group.problems"), day: stub({ day: may(12), leave: [own(240, "end")] }), problems: need },
  ]);

  let section = $state<HTMLElement>();

  // The focus sample shows its focus ring.
  onMount(() => section?.querySelector<HTMLElement>('[tabindex="0"]')?.focus());
</script>

<div class="stack" bind:this={section}>
  {#each groups as group (group.title)}
    <section class="stack">
      <h2>{group.title}</h2>
      <div class="samples">
        {#each group.samples as sample (sample.caption)}
          <figure>
            <div class="grid" class:removing={sample.removing} role="grid" aria-label={sample.caption}>
              <div class="row" role="row">
                <DayCell
                  day={sample.day}
                  {meta}
                  lanes={sample.lanes ?? []}
                  orientation="row"
                  focused={sample.focused ?? false}
                  selected={sample.selected ?? false}
                  today={sample.today ?? false}
                  previewed={sample.previewed ?? false}
                  problems={sample.problems ?? []}
                />
              </div>
            </div>
            <figcaption>{sample.caption}</figcaption>
          </figure>
        {/each}
      </div>
    </section>
  {/each}
  <section class="stack">
    <h2>{i18n.t("gallery.cell.group.columns")}</h2>
    <div class="grid column-grid" role="grid" aria-label={i18n.t("gallery.cell.group.columns")}>
      {#each columnSamples as sample (sample.caption)}
        <div class="row" role="row">
          <DayCell
            day={sample.day}
            {meta}
            lanes={sample.lanes ?? []}
            orientation="column"
            focused={false}
            selected={false}
            today={false}
            previewed={false}
            problems={sample.problems ?? []}
          />
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  @layer components {
    h2 {
      font-size: var(--font-size-2);
    }

    .samples {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    figure {
      display: grid;
      gap: var(--space-1);
      inline-size: 6.5rem;
      margin: 0;
    }

    .grid {
      inline-size: 2.75rem;
      padding: 2px;
    }

    .row {
      display: grid;
    }

    figcaption {
      color: var(--r-text-muted);
      font-size: var(--font-size-0);
    }

    .column-grid {
      display: grid;
      gap: 1px;
      inline-size: 6rem;
    }

    .column-grid .row {
      block-size: 1.25rem;
    }
  }
</style>
