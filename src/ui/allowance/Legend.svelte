<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: EUPL-1.2
-->
<script lang="ts">
  // The legend's entries (docs/SPEC.md, "Allowance display"): each mark drawn as the cells draw it, with the same
  // fills, then each calendar with its line. The heading is the allowance panel's, so all its headings look alike.
  import { textFor } from "../../engine/file/text.ts";
  import { i18n } from "../i18n/i18n.svelte.ts";
  import { markText, type Legend } from "./legend.ts";

  interface Props {
    legend: Legend;
    /** The id of the heading that names the list. */
    labelledby: string;
  }

  let { legend, labelledby }: Props = $props();
</script>

<ul class="legend" aria-labelledby={labelledby}>
  {#each legend.marks as mark (mark)}
    <li>
      <span class="swatch {mark}" aria-hidden="true"><span class="inner"></span></span>
      {markText(mark, (key) => i18n.t(key))}
    </li>
  {/each}
  {#each legend.calendars as calendar (calendar.source.id)}
    <li>
      <span class="line {calendar.style}" aria-hidden="true" style:--lane-color="var(--r-accent-{calendar.accent})"></span>
      {textFor(calendar.source.name, i18n.lang)}
    </li>
  {/each}
</ul>

<style>
  @layer components {
    .legend {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: var(--space-2) var(--space-3);
      padding: 0;
      list-style: none;
      font-size: var(--font-size-1);
      overflow-wrap: anywhere;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* A small cell: the same frame, backgrounds and fills as DayCell.svelte. */
    .swatch {
      position: relative;
      flex: none;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      border-radius: 3px;
      background: var(--r-workday);
      box-shadow: inset 0 0 0 1px var(--r-border);
      --diagonal: 135deg;
    }

    .swatch:dir(rtl) {
      --diagonal: 225deg;
    }

    .inner {
      position: absolute;
      inset: 3px;
      border-radius: 2px;
    }

    .leave .inner {
      background: var(--r-leave-full);
    }

    .mandatory .inner {
      background: var(--r-fill-mandatory);
    }

    .otherPlan .inner {
      inset: 1px;
      border: 2px dashed var(--r-other-plan);
      border-radius: 3px;
    }

    .weekend {
      background: var(--r-fill-weekend);
    }

    .holiday {
      background: var(--r-fill-holiday);
    }

    /* The work block in the morning, the free afternoon with its hatch. */
    .halfRequired {
      background:
        linear-gradient(var(--diagonal), var(--r-workday) 50%, transparent 50%),
        var(--r-fill-half-required);
    }

    .free {
      background: var(--r-fill-free);
    }

    /* The box behind a day number with a problem, without the digits. */
    .problem .inner {
      inset: 3px 5px 5px;
      background: var(--r-overdraft);
      box-shadow: 0 0 0 1px var(--r-surface);
    }

    /* A calendar's lane: its accent in its line style. */
    .line {
      flex: none;
      inline-size: 1.25rem;
      block-size: 3px;
      background: var(--lane-color);
    }

    .line.dashed {
      background: repeating-linear-gradient(in srgb 90deg, var(--lane-color) 0 7px, transparent 7px 10px);
    }

    .line.dotted {
      background: repeating-linear-gradient(in srgb 90deg, var(--lane-color) 0 3px, transparent 3px 6px);
    }

    /*
     * Forced colours as in the cells: leave in Highlight, mandatory leave striped, the problem box and the lanes in
     * the text colour. The day types lose their fills there as in the cells, issue 0040 (forced colours: day types
     * and the allowance bar).
     */
    @media (forced-colors: active) {
      .inner,
      .line {
        forced-color-adjust: none;
      }

      .leave .inner {
        background: Highlight;
      }

      .mandatory .inner {
        background: repeating-linear-gradient(in srgb 45deg, Highlight 0 4px, Canvas 4px 7px);
      }

      .otherPlan .inner {
        border-color: CanvasText;
      }

      .problem .inner {
        background: CanvasText;
        box-shadow: 0 0 0 1px Canvas;
      }

      .line {
        background: CanvasText;
      }
    }
  }
</style>
