// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber } from "../days";
import { checkUnits } from "../weight";
import type { Units } from "../weight";
import { evaluateLeave } from "./leave";
import { computePlan, periodBounds } from "./plan";
import type { Part, PlanInput } from "./types";

export interface PartRequest {
  readonly day: DayNumber;
  readonly take: Units;
}

/**
 * `suggestPart` for several requests at once, from one `computePlan` of `input` without the leave of the requested days.
 * The answers are the same as asking one by one, as long as the requested days are distinct.
 * Throws RangeError when a day is outside the plan period or a `take` is not an integer from 1 to 480.
 */
export function suggestParts(input: PlanInput, requests: readonly PartRequest[]): (Part | null)[] {
  const bounds = periodBounds(input.period);
  for (const { day, take } of requests) {
    checkUnits(take, "Leave take", 1);
    if (day < bounds.from || day > bounds.to) throw new RangeError("The day lies outside the plan period");
  }
  const requested = new Set(requests.map((request) => request.day));
  const plan = computePlan({ ...input, leave: input.leave.filter((entry) => !requested.has(entry.day)) });
  const indexOfDay = new Map<DayNumber, number>();
  plan.days.forEach((result, index) => indexOfDay.set(result.day, index));

  return requests.map(({ day, take }) => {
    const index = indexOfDay.get(day);
    const today = index === undefined ? undefined : plan.days[index];
    if (index === undefined || !today) throw new Error("The day is missing from the plan result"); // the period check above rules this out

    const wholeWith = (part: Part): boolean =>
      evaluateLeave(today.required, [...today.leave, { kind: "own", take, part }], today.inPeriod).whole;
    const startWhole = wholeWith("start");
    const endWhole = wholeWith("end");
    if (startWhole && endWhole) return "end";
    if (startWhole) return "start";
    if (endWhole) return "end";

    const previousFree = (plan.days[index - 1]?.evaluation.freeEnd ?? 0) > 0;
    const nextFree = (plan.days[index + 1]?.evaluation.freeStart ?? 0) > 0;
    if (previousFree && !nextFree) return "start";
    if (nextFree && !previousFree) return "end";
    return null;
  });
}

/**
 * Where partial own leave of `take` on `day` should lie: "start", "end", or null when the user has to choose.
 * Prefers the side that frees the whole day, then the side that joins free time of a neighbouring day.
 * Throws RangeError when `day` is outside the plan period or `take` is not an integer from 1 to 480.
 */
export function suggestPart(input: PlanInput, day: DayNumber, take: Units): Part | null {
  return suggestParts(input, [{ day, take }])[0] ?? null;
}
