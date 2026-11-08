// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// What the hint line says after a change (docs/SPEC.md, "Calendar interaction"): the changed day's leave or the
// number of changed days, or undo and redo, then the allowance left or how far it is exceeded; or why a key did
// nothing. The status is kept structured and turned into words from the current plan, so a language switch
// re-renders it and it stays true until the next preview or change replaces it.
import type { DayNumber } from "../../engine/days.ts";
import { formatDate, formatDays, pluralCount } from "../i18n/format.ts";
import type { Locale } from "../i18n/locale.ts";
import type { PlanState } from "../worker/protocol.ts";
import { dayLeave } from "./day-leave.ts";
import { leaveText, type Translate } from "./label.ts";

export type Status =
  | { readonly kind: "noHalfDays" } // H in a plan whose smallest leave unit has no half days
  | { readonly kind: "day"; readonly day: DayNumber } // one day changed
  | { readonly kind: "days"; readonly count: number } // several days changed
  | { readonly kind: "undo" }
  | { readonly kind: "redo" };

/** A date or an amount without a line break inside: Intl separates its parts with a normal space. */
const unbroken = (text: string): string => text.replaceAll(" ", " ");

/** The status in words, from the plan as it is now; "" without a plan. */
export function statusText(status: Status, state: PlanState | undefined, i18n: { t: Translate; locale: Locale }): string {
  const { t, locale } = i18n;
  if (status.kind === "noHalfDays") return t("hint.noHalfDays");
  if (state === undefined) return "";
  const { result } = state;
  const remaining = result.totals.remaining;
  const first = result.days[0]?.day;
  const day = status.kind === "day" && first !== undefined ? result.days[status.day - first] : undefined;
  return t("status.text", {
    kind: status.kind,
    date: status.kind === "day" ? unbroken(formatDate(status.day, locale, "dayMonth")) : "",
    leave: day === undefined ? "" : leaveText(dayLeave(day), i18n),
    count: status.kind === "days" ? status.count : 0,
    over: remaining < 0 ? "yes" : "no",
    amount: formatDays(Math.abs(remaining), locale),
    amountCount: pluralCount(remaining),
  });
}

/**
 * The text for a live region that announces the `count`-th status: every second one ends in a no-break space, so
 * the same words twice are still a change of the region's text, which screen readers announce again.
 */
export function announced(text: string, count: number): string {
  return count % 2 === 0 ? text : `${text}\u00a0`;
}
