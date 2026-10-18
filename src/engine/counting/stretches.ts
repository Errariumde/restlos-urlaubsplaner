// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { DayNumber } from "../days";
import { UNITS_PER_DAY } from "../weight";
import type { Units } from "../weight";

/** One day as seen by the stretch search: its free time at both ends and the leave charged inside it. */
export interface StretchDay {
  readonly day: DayNumber;
  readonly whole: boolean;
  readonly freeStart: Units;
  readonly freeEnd: Units;
  readonly costStart: Units;
  readonly costEnd: Units;
  readonly closure: boolean; // a paid closure (see Task 7)
}
export interface StretchPoint {
  readonly day: DayNumber;
  readonly offset: Units; // 0 … 480 within the day
}
export interface Stretch {
  readonly start: StretchPoint; // offset 0 = from the start of the day, 240 = from noon
  readonly end: StretchPoint; // exclusive: offset 480 = until the end of the day, 240 = until noon
  readonly cost: Units;
  readonly daysOff: Units;
  readonly listed: boolean; // cost > 0 or a closure day inside
}

interface Open {
  start: StretchPoint;
  cost: Units;
  daysOff: Units;
  closure: boolean;
}

function checkDay(x: StretchDay): void {
  if (!Number.isInteger(x.day)) throw new RangeError("A stretch day must be an integer day number");
  const { freeStart, freeEnd, costStart, costEnd } = x;
  if (![freeStart, freeEnd, costStart, costEnd].every(Number.isInteger)) throw new RangeError("Stretch day values must be integers");
  const valid = x.whole
    ? freeStart === UNITS_PER_DAY && freeEnd === UNITS_PER_DAY && costEnd === 0 && costStart >= 0 && costStart <= UNITS_PER_DAY
    : freeStart >= 0 && freeEnd >= 0 && freeStart + freeEnd < UNITS_PER_DAY && costStart >= 0 && costStart <= freeStart && costEnd >= 0 && costEnd <= freeEnd;
  if (!valid) throw new RangeError("Inconsistent free time or cost of a stretch day");
}

/**
 * Finds the stretches of unbroken time off in a run of consecutive days. Any work, however short,
 * ends a stretch. The first and last day of a stretch may be partial.
 * Throws RangeError for days that are not consecutive or whose free time and cost are inconsistent.
 */
export function findStretches(days: readonly StretchDay[]): Stretch[] {
  days.forEach(checkDay);
  for (let i = 1; i < days.length; i++) {
    if (days[i]!.day !== days[i - 1]!.day + 1) throw new RangeError("days must be consecutive");
  }
  const stretches: Stretch[] = [];
  let open: Open | undefined;
  const close = (end: StretchPoint): void => {
    if (open === undefined) return;
    stretches.push({
      start: open.start,
      end,
      cost: open.cost,
      daysOff: open.daysOff,
      listed: open.cost > 0 || open.closure,
    });
    open = undefined;
  };

  for (const x of days) {
    if (x.whole) {
      open ??= { start: { day: x.day, offset: 0 }, cost: 0, daysOff: 0, closure: false };
      open.cost += x.costStart + x.costEnd;
      open.daysOff += UNITS_PER_DAY;
      open.closure ||= x.closure;
      continue;
    }
    if (x.freeStart > 0) {
      open ??= { start: { day: x.day, offset: 0 }, cost: 0, daysOff: 0, closure: false };
      open.cost += x.costStart;
      open.daysOff += x.freeStart;
      open.closure ||= x.closure;
      close({ day: x.day, offset: x.freeStart });
    } else if (open !== undefined) {
      close({ day: x.day - 1, offset: UNITS_PER_DAY });
    }
    if (x.freeEnd > 0) {
      open = {
        start: { day: x.day, offset: UNITS_PER_DAY - x.freeEnd },
        cost: x.costEnd,
        daysOff: x.freeEnd,
        closure: x.closure,
      };
    }
  }
  const last = days[days.length - 1];
  if (last !== undefined) close({ day: last.day, offset: UNITS_PER_DAY });
  return stretches;
}
