// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The situations of the day detail (docs/SPEC.md, "Detail view") in one plan: the built-in example with the rules,
// calendars, leave and overrides that make each situation, so the real engine computes every one of them. Two more
// plans show the leave bar in a finer smallest leave unit.
import { dayFromYmd, type DayNumber } from "../../engine/days.ts";

type Translate = (key: string) => string;

interface Source {
  type: string;
  entries: unknown[];
  [key: string]: unknown;
}

interface PlanFile {
  contract: { minUnit: string; week: unknown[]; rules: unknown[] };
  sources: Source[];
  plan: { days: unknown[]; overrides: unknown[] };
}

const NORMAL_WEEK = { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" };
const on = (month: number, day: number): { type: "fixed"; month: number; day: number } => ({ type: "fixed", month, day });
const once = (date: string): { type: "once"; date: string } => ({ type: "once", date });

/** The example plan's text with everything the situations need; names in the gallery's language. */
export function situationsPlan(example: string, t: Translate): string {
  const file = JSON.parse(example) as PlanFile;
  // Friday 12 March is a free weekday of a part-time week.
  file.contract.week.push({ from: "2027-03-08", required: { ...NORMAL_WEEK, fri: "0" } }, { from: "2027-03-15", required: NORMAL_WEEK });
  file.contract.rules.push(
    { id: "stocktaking", label: t("gallery.detail.rule.stocktaking"), match: { type: "range", from: on(11, 22), to: on(11, 24) }, requiredAtMost: "1/2", part: "end" },
    { id: "carnival", label: t("gallery.detail.rule.carnival"), match: on(2, 11), requiredAtMost: "1/2", part: "start" },
    { id: "nicholas", label: t("gallery.detail.rule.nicholas"), match: on(12, 5), requiredAtMost: "1/2", part: "end" },
    { id: "half-closure", label: t("gallery.detail.rule.halfClosure"), match: { type: "range", from: on(3, 4), to: on(3, 5) }, mandatory: "1/2", part: "end" },
    {
      id: "working-saturday",
      label: t("gallery.detail.rule.workingSaturday"),
      match: { type: "range", from: on(11, 6), to: on(11, 13), weekdays: ["sat"] },
      requiredExactly: "1",
    },
    { id: "special-shift", label: t("gallery.detail.rule.specialShift"), match: on(11, 13), requiredExactly: "1/2" },
    { id: "on-call", label: t("gallery.detail.rule.onCall"), match: on(5, 17), requiredExactly: "1" },
  );
  const otherPlan = file.sources.find((source) => source.type === "otherPlan");
  if (otherPlan) {
    otherPlan.entries = [
      { date: "2027-01-04", from: "0", to: "1", kind: "leave" },
      { date: "2027-01-05", from: "1/2", to: "1", kind: "leave" },
      { date: "2027-01-08", from: "0", to: "1", kind: "leave" },
    ];
  }
  const source = (id: string, name: string, type: string, slot: string, entries: unknown[]): Source => ({ id, name, type, color: { slot }, visible: true, entries });
  file.sources.push(
    source("carnival-days", t("gallery.detail.source.carnival"), "holiday", "accent-4", [
      { date: "2027-02-08", name: t("gallery.detail.entry.shroveMonday"), required: "1/2", part: "end" },
    ]),
    source("works-holiday", t("gallery.detail.source.worksHoliday"), "paidClosure", "accent-5", [{ date: "2027-11-15" }]),
    source("company-holidays", t("gallery.detail.source.companyHolidays"), "mandatory", "accent-6", [{ date: "2027-01-06" }]),
    source("school", t("gallery.source.school"), "info", "accent-1", [{ match: { type: "range", from: once("2027-12-23"), to: once("2028-01-07") } }]),
    source("party", t("gallery.detail.source.party"), "info", "accent-7", [{ date: "2027-12-23" }]),
    source("kita", t("gallery.source.kita"), "needed", "accent-8", [
      { date: "2027-03-09", take: "1/2" },
      { date: "2027-03-16", take: "1/2" },
      { date: "2027-12-23", take: "1/2" },
    ]),
  );
  file.plan.days.push(
    { date: "2027-03-05", take: "1/2", part: "start" },
    { date: "2027-03-09", take: "1/2", part: "end" },
    { date: "2027-08-17", take: "1/2", part: "start" },
    { date: "2027-08-18", take: "1/2", part: "end" },
    { date: "2027-09-07", take: "1/2", part: "start" },
    { date: "2027-11-09", take: "1/4", part: "start" },
    { date: "2027-11-22", take: "1/2", part: "start" },
    { date: "2027-11-23", take: "1/2", part: "end" },
    { date: "2027-11-24", take: "1" },
    { date: "2027-12-11", take: "1" },
    { date: "2027-12-23", take: "1/2", part: "end" },
  );
  file.plan.overrides.push({ date: "2027-11-11", required: "1/2", part: "end" });
  return JSON.stringify(file);
}

/** The plans the situations are in: the one above, and the example in quarters or in sixteenths of a day. */
export type PlanName = "situations" | "quarters" | "sixteenths";

/**
 * The example in a finer smallest leave unit, with a Friday 18 June that works ¾ (quarters) or 9/16 (sixteenths)
 * of a day, and a little leave on Monday 14 June.
 */
function finerPlan(example: string, name: "quarters" | "sixteenths"): string {
  const file = JSON.parse(example) as PlanFile;
  const quarters = name === "quarters";
  file.contract.minUnit = quarters ? "1/4" : "1/16";
  file.contract.week.push({ from: "2027-06-14", required: { ...NORMAL_WEEK, fri: quarters ? "3/4" : "9/16" } }, { from: "2027-06-21", required: NORMAL_WEEK });
  file.plan.days.push(quarters ? { date: "2027-06-14", take: "1/4", part: "start" } : { date: "2027-06-14", take: "3/16", part: "end" });
  return JSON.stringify(file);
}

/** The text of a plan the situations are in, made from the example plan's text. */
export function planText(name: PlanName, example: string, t: Translate): string {
  return name === "situations" ? situationsPlan(example, t) : finerPlan(example, name);
}

export interface SituationGroup {
  title: string;
  /** The plan its days are in; the situations plan if not given. */
  plan?: PlanName;
  /** Left out of the accessibility check (axe): see the group for why. */
  skipAxe?: boolean;
  samples: [caption: string, day: DayNumber][];
}

const day = (month: number, date: number, year = 2027): DayNumber => dayFromYmd(year, month, date);

/** The situations in groups: a caption and the day that shows it. */
export function situations(t: Translate): SituationGroup[] {
  return [
  {
    title: t("gallery.detail.group.workday"),
    samples: [
      [t("gallery.detail.noLeave"), day(5, 10)],
      [t("gallery.detail.morning"), day(8, 17)],
      [t("gallery.detail.afternoon"), day(8, 18)],
      [t("gallery.detail.full"), day(1, 7)],
    ],
  },
  {
    title: t("gallery.detail.group.halfDay"),
    samples: [
      [t("gallery.detail.noLeave"), day(12, 24)],
      [t("gallery.detail.onWork"), day(11, 22)],
      [t("gallery.detail.onFree"), day(11, 23)],
      [t("gallery.detail.full"), day(11, 24)],
      [t("gallery.detail.freeMorning"), day(2, 11)],
      [t("gallery.detail.holidayCalendar"), day(2, 8)],
    ],
  },
  {
    title: t("gallery.detail.group.free"),
    samples: [
      [t("gallery.detail.weekend"), day(12, 18)],
      [t("gallery.detail.holidayOnWorkday"), day(1, 1)],
      [t("gallery.detail.holidayOnWeekend"), day(12, 25)],
      [t("gallery.detail.freeWeekday"), day(3, 12)],
      [t("gallery.detail.paidClosure"), day(11, 15)],
      [t("gallery.detail.ruleWithoutEffect"), day(12, 5)],
      [t("gallery.detail.outside"), day(1, 1, 2028)],
    ],
  },
  {
    title: t("gallery.detail.group.locked"),
    samples: [
      [t("gallery.detail.mandatory"), day(12, 27)],
      [t("gallery.detail.mandatoryHalf"), day(3, 4)],
      [t("gallery.detail.mandatoryHalfOwn"), day(3, 5)],
      [t("gallery.detail.mandatoryHoliday"), day(1, 6)],
      [t("gallery.detail.otherPlan"), day(1, 4)],
      [t("gallery.detail.otherPlanHalf"), day(1, 5)],
    ],
  },
  {
    title: t("gallery.detail.group.changed"),
    samples: [
      [t("gallery.detail.workingSaturday"), day(11, 6)],
      [t("gallery.detail.workedHoliday"), day(5, 17)],
      [t("gallery.detail.override"), day(11, 11)],
      [t("gallery.detail.quarter"), day(11, 9)],
    ],
  },
  {
    title: t("gallery.detail.group.calendars"),
    samples: [
      [t("gallery.detail.info"), day(9, 7)],
      [t("gallery.detail.three"), day(12, 23)],
      [t("gallery.detail.needCovered"), day(3, 9)],
    ],
  },
  {
    title: t("gallery.detail.group.problems"),
    samples: [
      [t("gallery.detail.needUncovered"), day(3, 16)],
      [t("gallery.detail.leaveOnFreeDay"), day(12, 11)],
      [t("gallery.detail.conflict"), day(11, 13)],
      [t("gallery.detail.otherPlanToo"), day(1, 8)],
    ],
  },
  {
    title: t("gallery.detail.group.quarters"),
    plan: "quarters",
    samples: [
      [t("gallery.detail.leaveAtStart"), day(6, 14)],
      [t("gallery.detail.shortFriday"), day(6, 18)],
      [t("gallery.detail.christmasEve"), day(12, 24)],
    ],
  },
  {
    title: t("gallery.detail.group.sixteenths"),
    plan: "sixteenths",
    // Left out of axe: the leave bar's parts below ¼ are smaller than the target size of WCAG 2.5.8 (24 px), which
    // axe checks, as long as the bar has no equivalent control of full size: issue 0049 (leave bar parts below ¼ are
    // under the target size).
    skipAxe: true,
    samples: [
      [t("gallery.detail.leaveAtEnd"), day(6, 14)],
      [t("gallery.detail.shortFriday"), day(6, 18)],
      [t("gallery.detail.christmasEve"), day(12, 24)],
    ],
  },
];
}
