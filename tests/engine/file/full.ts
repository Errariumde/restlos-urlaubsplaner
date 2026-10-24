// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

const RULE_SET_ID = "company-rules";
const FULL_TIME = { mon: "1", tue: "1", wed: "1", thu: "1", fri: "1", sat: "0", sun: "0" };
/** A 1×1 PNG. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * A plan file that holds every optional key at least once and reads with an empty report.
 * Every weight is a multiple of ½, every date lies in 2027, and no rule or match entry gets a hint.
 */
export const FULL_PLAN: Record<string, unknown> = {
  schema: "restlos/1",
  kind: "plan",
  id: "full-plan-2027",
  revision: 3,
  ruleSet: { id: RULE_SET_ID, name: "Company rules", revision: 2 },
  contract: {
    name: { de: "Vollständiges Beispiel", en: "Full example" },
    description: "Every optional key at least once.",
    references: {
      basis: { title: "Works agreement on Christmas Eve", version: "of 4 January 2027", url: "https://example.org/works-agreement", checked: "2027-01-04" },
    },
    region: { country: "DE", state: "BY", options: { assumption: true } },
    minUnit: "1/2",
    week: [{ from: "2027-01-01", required: FULL_TIME }],
    rules: [
      {
        id: "christmas-eve",
        origin: RULE_SET_ID,
        label: { de: "Heiligabend", en: "Christmas Eve" },
        match: { type: "fixed", month: 12, day: 24 },
        validFrom: 2027,
        validUntil: 2030,
        requiredAtMost: "1/2",
        part: "end",
        note: "The afternoon is off.",
        references: ["basis"],
      },
    ],
  },
  sources: [
    {
      id: "company-holidays",
      origin: RULE_SET_ID,
      name: "Company holidays",
      type: "holiday",
      color: { slot: "accent-1" },
      visible: true,
      entries: [{ date: "2027-11-11", name: "St. Martin", required: "1/2", part: "start" }],
    },
    {
      id: "closure",
      name: "Company closure",
      type: "mandatory",
      color: { rgb: "#1a7f37" },
      visible: true,
      entries: [
        {
          match: {
            type: "range",
            from: { type: "fixed", month: 12, day: 27 },
            to: { type: "fixed", month: 12, day: 30 },
            weekdays: ["mon", "tue", "wed", "thu", "fri"],
          },
          validFrom: 2027,
          validUntil: 2030,
          except: ["2027-12-29"],
          name: "Closure",
          take: "1/2",
          part: "end",
        },
      ],
    },
    {
      id: "partner",
      name: "Partner",
      type: "otherPlan",
      color: { slot: "accent-2" },
      visible: false,
      plan: { id: "partner-plan-2027", name: "Partner 2027", revision: 7 },
      entries: [{ date: "2027-09-10", name: "Wedding", from: "0", to: "1/2", kind: "leave" }],
    },
    { id: "school", name: "School holidays", type: "info", color: { slot: "accent-3" }, visible: true, entries: [{ date: "2027-08-02" }] },
    { id: "kita", name: "Kita", type: "needed", color: { slot: "accent-4" }, visible: true, entries: [{ date: "2027-10-15" }] },
  ],
  templates: [
    {
      id: "leave-request",
      origin: RULE_SET_ID,
      name: "Leave request",
      api: 1,
      typst: ">=0.13",
      typ: "= Leave request\n",
      images: [{ name: "logo.png", type: "image/png", data: PNG }],
    },
  ],
  theme: {},
  plan: {
    range: { from: "2027-01", to: "2027-12" },
    allowance: "30",
    // A bridge day without `part`, and half a Monday at the start.
    days: [
      { date: "2027-05-07", take: "1" },
      { date: "2027-07-05", take: "1/2", part: "start" },
    ],
    overrides: [{ date: "2027-03-10", required: "1/2", part: "end" }],
    notes: [{ date: "2027-05-07", text: "Bridge day" }],
  },
};

/** A deep copy of `file` without the key at `path` ("sources[2].entries[0].take"). Throws when there is no such key. */
export function without(file: Record<string, unknown>, path: string): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
  const steps = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  const last = steps.pop() ?? "";
  let parent: unknown = copy;
  for (const step of steps) {
    if (typeof parent !== "object" || parent === null || !Object.hasOwn(parent, step)) throw new Error(`The file has no ${path}`);
    parent = (parent as Record<string, unknown>)[step];
  }
  // Only a key of an object: deleting an element would leave a hole in its list.
  if (typeof parent !== "object" || parent === null || Array.isArray(parent) || !Object.hasOwn(parent, last)) {
    throw new Error(`The file has no key ${path}`);
  }
  delete (parent as Record<string, unknown>)[last];
  return copy;
}
