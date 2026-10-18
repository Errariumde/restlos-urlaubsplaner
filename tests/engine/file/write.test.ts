// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dayFromIso } from "../../../src/engine/days";
import { readFile } from "../../../src/engine/file/read";
import type { PlanFile, RuleSetFile } from "../../../src/engine/file/types";
import { prepareSave, toRuleSet, writeFile } from "../../../src/engine/file/write";
import { fileModel } from "./arbitraries";

const d = dayFromIso;

// Written with scrambled key order on purpose: the writer must put the keys in the canonical order.
const MODEL: PlanFile = {
  plan: {
    notes: [{ text: "Bring the passport", day: d("2027-03-02") }],
    overrides: [{ part: "start", required: 120, day: d("2027-03-04") }],
    days: [
      { take: 480, day: d("2027-03-01") },
      { part: "end", take: 240, day: d("2027-03-03") },
    ],
    allowance: 14_640,
    range: { to: { month: 12, year: 2027 }, from: { month: 1, year: 2027 } },
  },
  theme: null,
  templates: [
    {
      images: [{ data: "AAAA", type: "image/png", name: "logo.png" }],
      typ: "#set page()",
      typst: "0.13",
      api: 1,
      name: "Year",
      origin: "rs",
      id: "t1",
    },
  ],
  sources: [
    {
      entries: [
        { required: 0, name: "Bridge day", date: d("2027-05-14") },
        { part: "start", required: 240, except: [d("2028-10-31")], validUntil: 2028, validFrom: 2027, match: { type: "fixed", month: 10, day: 31 } },
      ],
      visible: true,
      color: { slot: "green" },
      type: "holiday",
      name: "Company",
      origin: "rs",
      id: "company",
    },
    {
      entries: [
        { kind: "leave", to: 240, from: 0, date: d("2027-03-01") },
        { kind: "mandatory", to: 240, from: 120, name: { en: "Half", de: "Halb" }, date: d("2027-03-02") },
      ],
      plan: { revision: 4, name: "Partner", id: "pp" },
      visible: false,
      color: { rgb: "#aabbcc" },
      type: "otherPlan",
      name: "Partner",
      id: "partner",
    },
  ],
  contract: {
    rules: [
      {
        references: ["law"],
        part: "end",
        requiredAtMost: 240,
        validFrom: 2020,
        match: { month: 12, type: "fixed", day: 24 },
        label: { en: "Christmas Eve", de: "Heiligabend" },
        origin: "rs",
        id: "xmas",
      },
      {
        mandatory: 480,
        match: { weekdays: ["fri", "mon"], to: { offset: 1, type: "easter" }, from: { offset: -2, type: "easter" }, type: "range" },
        id: "easter",
      },
    ],
    week: [{ required: { sun: 0, sat: 0, fri: 480, thu: 480, wed: 480, tue: 480, mon: 480 }, from: d("2020-01-01") }],
    minUnit: 15,
    region: { options: { augsburg: false, assumption: true }, state: "BY", country: "DE" },
    references: { law: { checked: d("2026-01-02"), url: "https://example.org/law", version: "2020", title: "Law" } },
    name: "Contract",
  },
  ruleSet: { revision: 2, name: "Base", id: "rs" },
  revision: 3,
  id: "p1",
  kind: "plan",
};

const EXPECTED = `{
  "schema": "restlos/1",
  "kind": "plan",
  "id": "p1",
  "revision": 3,
  "ruleSet": {
    "id": "rs",
    "name": "Base",
    "revision": 2
  },
  "contract": {
    "name": "Contract",
    "references": {
      "law": {
        "title": "Law",
        "version": "2020",
        "url": "https://example.org/law",
        "checked": "2026-01-02"
      }
    },
    "region": {
      "country": "DE",
      "state": "BY",
      "options": {
        "assumption": true,
        "augsburg": false
      }
    },
    "minUnit": "1/32",
    "week": [
      {
        "from": "2020-01-01",
        "required": {
          "mon": "1",
          "tue": "1",
          "wed": "1",
          "thu": "1",
          "fri": "1",
          "sat": "0",
          "sun": "0"
        }
      }
    ],
    "rules": [
      {
        "id": "xmas",
        "origin": "rs",
        "label": {
          "en": "Christmas Eve",
          "de": "Heiligabend"
        },
        "match": {
          "type": "fixed",
          "month": 12,
          "day": 24
        },
        "validFrom": 2020,
        "requiredAtMost": "1/2",
        "part": "end",
        "references": [
          "law"
        ]
      },
      {
        "id": "easter",
        "match": {
          "type": "range",
          "from": {
            "type": "easter",
            "offset": -2
          },
          "to": {
            "type": "easter",
            "offset": 1
          },
          "weekdays": [
            "fri",
            "mon"
          ]
        },
        "mandatory": "1"
      }
    ]
  },
  "sources": [
    {
      "id": "company",
      "origin": "rs",
      "name": "Company",
      "type": "holiday",
      "color": {
        "slot": "green"
      },
      "visible": true,
      "entries": [
        {
          "date": "2027-05-14",
          "name": "Bridge day",
          "required": "0"
        },
        {
          "match": {
            "type": "fixed",
            "month": 10,
            "day": 31
          },
          "validFrom": 2027,
          "validUntil": 2028,
          "except": [
            "2028-10-31"
          ],
          "required": "1/2",
          "part": "start"
        }
      ]
    },
    {
      "id": "partner",
      "name": "Partner",
      "type": "otherPlan",
      "color": {
        "rgb": "#aabbcc"
      },
      "visible": false,
      "plan": {
        "id": "pp",
        "name": "Partner",
        "revision": 4
      },
      "entries": [
        {
          "date": "2027-03-01",
          "from": "0",
          "to": "1/2",
          "kind": "leave"
        },
        {
          "date": "2027-03-02",
          "name": {
            "en": "Half",
            "de": "Halb"
          },
          "from": "1/4",
          "to": "2/4",
          "kind": "mandatory"
        }
      ]
    }
  ],
  "templates": [
    {
      "id": "t1",
      "origin": "rs",
      "name": "Year",
      "api": 1,
      "typst": "0.13",
      "typ": "#set page()",
      "images": [
        {
          "name": "logo.png",
          "type": "image/png",
          "data": "AAAA"
        }
      ]
    }
  ],
  "theme": null,
  "plan": {
    "range": {
      "from": "2027-01",
      "to": "2027-12"
    },
    "allowance": "61/2",
    "days": [
      {
        "date": "2027-03-01",
        "take": "1"
      },
      {
        "date": "2027-03-03",
        "take": "1/2",
        "part": "end"
      }
    ],
    "overrides": [
      {
        "date": "2027-03-04",
        "required": "1/4",
        "part": "start"
      }
    ],
    "notes": [
      {
        "date": "2027-03-02",
        "text": "Bring the passport"
      }
    ]
  }
}
`;

describe("writeFile", () => {
  it("writes a plan file in the canonical order", () => {
    expect(writeFile(MODEL)).toBe(EXPECTED);
  });
  it("ends with one line break and has no byte-order mark", () => {
    const text = writeFile(MODEL);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.charCodeAt(0)).toBe("{".charCodeAt(0));
  });
  it("writes the lists even when empty and omits empty references", () => {
    const file: RuleSetFile = {
      kind: "ruleSet",
      id: "r",
      revision: 1,
      contract: { references: {}, region: { country: "DE" }, minUnit: 240, week: MODEL.contract.week, rules: [] },
      sources: [],
      templates: [],
      theme: { b: 1, a: [true] },
    };
    const parsed = JSON.parse(writeFile(file)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(["schema", "kind", "id", "revision", "contract", "sources", "templates", "theme"]);
    expect(Object.keys(parsed["contract"] as object)).toEqual(["region", "minUnit", "week", "rules"]);
    expect(parsed["theme"]).toEqual({ b: 1, a: [true] });
  });
  it("is read back to the same model", () => {
    const result = readFile(writeFile(MODEL));
    expect(result.ok && result.report).toEqual([]);
    expect(writeFile(result.ok ? result.file : MODEL)).toBe(EXPECTED);
  });
});

describe("prepareSave", () => {
  it("raises the revision and leaves the rest alone", () => {
    const saved = prepareSave(MODEL);
    expect(saved).toEqual({ ...MODEL, revision: 4 });
    expect(MODEL.revision).toBe(3);
  });
  it("gives a new id and revision 1 with a new id", () => {
    expect(prepareSave(MODEL, "copy")).toEqual({ ...MODEL, id: "copy", revision: 1 });
  });
  it("is never done by writeFile", () => {
    expect(JSON.parse(writeFile(MODEL))).toMatchObject({ revision: 3 });
  });
});

describe("toRuleSet", () => {
  it("drops the plan, the rule set reference, origins and personal sources", () => {
    const ruleSet = toRuleSet(MODEL, "mine");
    expect(ruleSet.kind).toBe("ruleSet");
    expect(ruleSet.id).toBe("mine");
    expect(ruleSet.revision).toBe(1);
    expect("plan" in ruleSet).toBe(false);
    expect("ruleSet" in ruleSet).toBe(false);
    expect(ruleSet.sources.map((source) => source.id)).toEqual(["company"]);
    const text = writeFile(ruleSet);
    expect(text).not.toContain("origin");
    expect(text).not.toContain("otherPlan");
    expect(text).not.toContain('"plan"');
    expect(readFile(text)).toEqual({ ok: true, file: expect.objectContaining({ kind: "ruleSet", id: "mine" }) as unknown, report: [] });
  });
  it("drops needed sources and writes no origin whatever the model contains", () => {
    const needed: PlanFile = {
      ...MODEL,
      sources: [
        ...MODEL.sources,
        { id: "kita", name: "Kita", type: "needed", color: { slot: "red" }, visible: true, entries: [{ date: d("2027-03-01"), take: 480 }] },
      ],
    };
    const text = writeFile(toRuleSet(needed, "x"));
    expect(text).not.toContain("needed");
    // A rule-set model that still carries origins is written without them.
    const sloppy = { ...toRuleSet(MODEL, "x"), contract: MODEL.contract, sources: MODEL.sources, templates: MODEL.templates };
    const written = writeFile(sloppy);
    expect(written).not.toContain("origin");
    expect(written).not.toContain("otherPlan");
    expect(readFile(written)).toMatchObject({ ok: true, report: [] });
  });
});

describe("read(write(x))", () => {
  it("gives the model back with an empty report", () => {
    fc.assert(
      fc.property(fileModel, (file) => {
        expect(readFile(writeFile(file))).toEqual({ ok: true, file, report: [] });
      }),
      { numRuns: 300 },
    );
  });
});
