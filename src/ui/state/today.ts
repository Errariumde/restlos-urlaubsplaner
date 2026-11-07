// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Calendar days for the page. The engine never reads the clock; the page converts the local date once.
import { dayFromYmd, daysInMonth, type DayNumber } from "../../engine/days.ts";
import type { PlanPeriod } from "../../engine/counting/types.ts";

/** Today's local date as a day number. */
export function today(): DayNumber {
  const now = new Date();
  return dayFromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** The day the calendar focuses first: `day` if it lies in the period, else the period's first day. */
export function initialFocusDay(period: PlanPeriod, day: DayNumber): DayNumber {
  const first = dayFromYmd(period.from.year, period.from.month, 1);
  const { year, month } = period.to;
  const last = dayFromYmd(year, month, daysInMonth(year, month));
  return day >= first && day <= last ? day : first;
}
