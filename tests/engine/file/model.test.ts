// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { computePlan, computationWindow } from "../../../src/engine/counting/plan";
import type { PlanInput, SourceDay } from "../../../src/engine/counting/types";
import { dayFromIso } from "../../../src/engine/days";
import { expandSources, planInput } from "../../../src/engine/file/model";
import type { FileSource, PlanFile } from "../../../src/engine/file/types";
import { countries } from "../../../src/data/holidays";

const d = dayFromIso;
const FULL = 480;
const HALF = 240;
const week = { mon: FULL, tue: FULL, wed: FULL, thu: FULL, fri: FULL, sat: 0, sun: 0 };
const range = { from: { year: 2027, month: 9 }, to: { year: 2028, month: 2 } };

const sources: FileSource[] = [
  {
    id: "school",
    name: "School",
    color: { slot: "a" },
    visible: true,
    type: "holiday",
    entries: [{ date: d("2027-10-29"), name: "Bridge", required: HALF, part: "start" }, { date: d("2027-11-02"), required: 0 }],
  },
  {
    id: "kita",
    name: "Kita",
    color: { slot: "b" },
    visible: true,
    type: "needed",
    entries: [
      {
        match: {
          type: "range",
          from: { type: "fixed", month: 9, day: 1 },
          to: { type: "fixed", month: 8, day: 31 },
          weekdays: ["tue"],
        },
        validFrom: 2027,
        validUntil: 2027,
        except: [d("2027-12-28")],
        take: FULL,
      },
    ],
  },
  {
    id: "partner",
    name: "Partner",
    color: { slot: "c" },
    visible: true,
    type: "otherPlan",
    plan: { id: "p2", name: "Partner", revision: 1 },
    entries: [{ date: d("2027-10-05"), from: 0, to: HALF, kind: "leave" }],
  },
];

const file: PlanFile = {
  kind: "plan",
  id: "plan-1",
  revision: 1,
  contract: {
    references: {},
    region: { country: "DE", state: "BY" },
    minUnit: 15,
    week: [{ from: d("2020-01-01"), required: week }],
    rules: [
      { id: "eve", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: HALF, label: "Eve", note: "n", references: ["r"], origin: "x" },
      { id: "nye", match: { type: "fixed", month: 12, day: 31 }, requiredAtMost: 0 },
    ],
  },
  sources,
  templates: [],
  theme: null,
  plan: {
    range,
    allowance: 30 * FULL,
    days: [{ day: d("2027-10-04"), take: FULL }],
    overrides: [{ day: d("2027-10-06"), required: HALF, part: "end" }],
    notes: [],
  },
};

describe("planInput", () => {
  it("builds the counting model input", () => {
    const { from, to } = computationWindow(range);
    const tuesdays: SourceDay[] = [];
    for (let day = d("2027-09-07"); day <= to; day += 7) {
      if (day !== d("2027-12-28")) tuesdays.push({ type: "needed", day, sourceId: "kita", take: FULL });
    }
    const expected: PlanInput = {
      country: countries["DE"]!,
      contract: {
        region: { country: "DE", state: "BY" },
        week: [{ from: d("2020-01-01"), required: week }],
        rules: [
          { id: "eve", match: { type: "fixed", month: 12, day: 24 }, requiredAtMost: HALF },
          { id: "nye", match: { type: "fixed", month: 12, day: 31 }, requiredAtMost: 0 },
        ],
      },
      sources: [
        { type: "holiday", day: d("2027-10-29"), sourceId: "school", required: HALF, part: "start" },
        { type: "holiday", day: d("2027-11-02"), sourceId: "school", required: 0 },
        ...tuesdays,
        { type: "otherPlan", day: d("2027-10-05"), sourceId: "partner", from: 0, to: HALF, kind: "leave" },
      ],
      period: range,
      allowance: 30 * FULL,
      leave: [{ day: d("2027-10-04"), take: FULL }],
      overrides: [{ day: d("2027-10-06"), required: HALF, part: "end" }],
    };
    const input = planInput(file);
    expect(input).toEqual(expected);
    expect(tuesdays[0]?.day).toBe(d("2027-09-07"));
    expect(tuesdays.some((s) => s.day === d("2027-12-28"))).toBe(false);
    for (const s of input.sources) expect(s.day >= from && s.day <= to).toBe(true);
  });

  it("can be computed", () => {
    const result = computePlan(planInput(file));
    expect(result.totals.planned).toBeGreaterThan(0);
  });

  it("refuses a plan without a state", () => {
    const stateless = { ...file, contract: { ...file.contract, region: { country: "DE" } } };
    expect(() => planInput(stateless)).toThrow(RangeError);
  });
});

describe("expandSources", () => {
  it("returns null above the limit and stops early", () => {
    const entry = {
      match: { type: "range" as const, from: { type: "fixed" as const, month: 1, day: 1 }, days: 366 },
      validFrom: 2028,
      validUntil: 2028,
      required: 0,
    };
    const many: FileSource[] = [
      { id: "s", name: "S", color: { slot: "a" }, visible: true, type: "holiday", entries: Array.from({ length: 200 }, () => entry) },
    ];
    const start = Date.now();
    expect(expandSources(many, d("2028-01-01"), d("2028-12-31"), 1000)).toBeNull();
    expect(Date.now() - start).toBeLessThan(50);
    expect(expandSources(many, d("2028-01-01"), d("2028-12-31"))).toBeNull();
  });

  it("stops before expanding later entries", () => {
    let reads = 0;
    const entries = new Proxy(
      Array.from({ length: 200 }, () => ({
        match: { type: "range" as const, from: { type: "fixed" as const, month: 1, day: 1 }, days: 366 },
        validFrom: 2028,
        validUntil: 2028,
        required: 0,
      })),
      {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) reads++;
          return Reflect.get(target, key, receiver) as unknown;
        },
      },
    );
    const source: FileSource = { id: "s", name: "S", color: { slot: "a" }, visible: true, type: "holiday", entries };
    expect(expandSources([source], d("2028-01-01"), d("2028-12-31"), 1000)).toBeNull();
    expect(reads).toBeLessThan(10);
  });
});
