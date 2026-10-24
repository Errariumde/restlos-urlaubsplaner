// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import fc from "fast-check";
import { periodBounds } from "../../../src/engine/counting/plan";
import type { DayMatch, LeaveDay, Part, PlanPeriod, RequiredOverride, WorkWeekEntry } from "../../../src/engine/counting/types";
import { dayRuleWarnings } from "../../../src/engine/counting/warnings";
import { WEEKDAYS, dayFromYmd, daysInMonth, isoFromDay, type DayNumber, type Weekday } from "../../../src/engine/days";
import type { DateRule } from "../../../src/engine/holidays/types";
import type {
  AnyFile,
  Color,
  FileContract,
  FilePlan,
  FileRule,
  FileSource,
  OtherPlanRef,
  PlanFile,
  Reference,
  RuleSetFile,
  Template,
  Text,
  Theme,
} from "../../../src/engine/file/types";

/** Models exactly as `readFile` produces them: sorted lists, minUnit 1/32, valid dates, no rule warnings, unique IDs. */

const MIN_UNIT = 15;
const WEEKDAY_LIST: readonly Weekday[] = WEEKDAYS;

const word = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
const identifier = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
const plainText = (maxLength: number): fc.Arbitrary<string> =>
  fc.oneof(
    fc.string({ maxLength: Math.min(maxLength, 20) }),
    fc.constantFrom("Ünï", "日本語", "Silvester 😀", "a\"b\\c\n", "").filter((text) => text.length <= maxLength),
  );

export const text = (maxLength = 200): fc.Arbitrary<Text> =>
  fc.oneof(
    plainText(maxLength),
    fc
      .uniqueArray(fc.constantFrom("de", "en", "fr", "pt-br", "zh-hans"), { minLength: 1, maxLength: 3 })
      .chain((languages) => fc.tuple(...languages.map(() => plainText(maxLength))).map((texts) => Object.fromEntries(languages.map((language, i) => [language, texts[i] ?? ""])))),
  );

const day = (fromYear: number, toYear: number): fc.Arbitrary<DayNumber> =>
  fc
    .tuple(fc.integer({ min: fromYear, max: toYear }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
    .map(([year, month, d]) => dayFromYmd(year, month, Math.min(d, daysInMonth(year, month))));

const anyDay = day(2000, 2100);
const units = (min: number, max: number): fc.Arbitrary<number> => fc.integer({ min: Math.ceil(min / MIN_UNIT), max: Math.floor(max / MIN_UNIT) }).map((n) => n * MIN_UNIT);
const part: fc.Arbitrary<Part> = fc.constantFrom("start", "end");
const maybe = <T>(arbitrary: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> => fc.option(arbitrary, { nil: undefined });

/** Optional keys: `undefined` values are left out. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

const weekday: fc.Arbitrary<Weekday> = fc.constantFrom(...WEEKDAY_LIST);

const dateRule: fc.Arbitrary<DateRule> = fc.oneof(
  fc
    .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
    .filter(([month, d]) => d <= daysInMonth(2001, month))
    .map(([month, d]): DateRule => ({ type: "fixed", month, day: d })),
  fc.constantFrom("drop", "feb28", "mar1").map((nonLeap): DateRule => ({ type: "fixed", month: 2, day: 29, nonLeap })),
  fc.integer({ min: -200, max: 200 }).map((offset): DateRule => ({ type: "easter", offset })),
  fc.integer({ min: -200, max: 200 }).map((offset): DateRule => ({ type: "orthodoxEaster", offset })),
  fc
    .tuple(weekday, fc.constantFrom("before", "onOrBefore", "after", "onOrAfter"), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
    .filter(([, , month, d]) => d <= daysInMonth(2001, month))
    .map(([w, relation, month, d]): DateRule => ({ type: "weekdayRelative", weekday: w, relation, month, day: d })),
  fc
    .tuple(fc.integer({ min: 1, max: 12 }), weekday, fc.constantFrom(1, 2, 3, 4, -1))
    .map(([month, w, n]): DateRule => ({ type: "nthWeekday", month, weekday: w, n })),
  day(2000, 2100).map((d): DateRule => ({ type: "once", date: isoFromDay(d) })),
);

const range: fc.Arbitrary<DayMatch> = fc
  .tuple(
    dateRule,
    fc.oneof(dateRule.map((to) => ({ to })), fc.integer({ min: 1, max: 366 }).map((days) => ({ days }))),
    maybe(fc.uniqueArray(weekday, { minLength: 1, maxLength: 7 })),
  )
  .map(([from, end, weekdays]) => ({ type: "range" as const, from, ...end, ...(weekdays ? { weekdays } : {}) }));

interface Validity {
  readonly match: DayMatch;
  readonly validFrom?: number;
  readonly validUntil?: number;
}

/** A match with optional validity years that `dayRuleWarnings` has nothing to say about. */
const matchWithValidity: fc.Arbitrary<Validity> = fc
  .tuple(fc.oneof(dateRule, range), maybe(fc.integer({ min: 2000, max: 2100 })), maybe(fc.integer({ min: 2000, max: 2100 })))
  .map(([match, a, b]) => {
    const [validFrom, validUntil] = a !== undefined && b !== undefined && a > b ? [b, a] : [a, b];
    return compact({ match, validFrom, validUntil }) as Validity;
  })
  .filter((value) => dayRuleWarnings({ id: "x", ...value, requiredAtMost: 0 }).length === 0);

const color: fc.Arbitrary<Color> = fc.oneof(
  fc.constantFrom("blue", "green", "red-2", "slot-3").map((slot) => ({ slot })),
  fc.stringMatching(/^#[0-9a-fA-F]{6}$/).map((rgb) => ({ rgb })),
);

const reference: fc.Arbitrary<Reference> = fc.record({
  title: text(),
  version: text(),
  url: word.map((path) => `https://example.org/${path}`),
  checked: anyDay,
});

const planRef: fc.Arbitrary<OtherPlanRef> = fc.record({ id: identifier, name: text(), revision: fc.integer({ min: 1, max: 1000 }) });

const week: fc.Arbitrary<WorkWeekEntry[]> = fc
  .uniqueArray(anyDay, { minLength: 1, maxLength: 3 })
  .chain((froms) =>
    fc.tuple(
      ...froms
        .sort((a, b) => a - b)
        .map((from) =>
          fc
            .tuple(...WEEKDAY_LIST.map(() => fc.integer({ min: 0, max: 480 })))
            .map((values): WorkWeekEntry => ({ from, required: Object.fromEntries(WEEKDAY_LIST.map((w, i) => [w, values[i] ?? 0])) as Record<Weekday, number> })),
        ),
    ),
  );

const LOCAL_RULES: Readonly<Record<string, readonly string[]>> = { BY: ["assumption", "augsburg"], SN: ["corpusChristi"], TH: ["corpusChristi"] };
const STATES = ["BB", "BE", "BW", "BY", "HB", "HE", "HH", "MV", "NI", "NW", "RP", "SH", "SL", "SN", "ST", "TH"];

function region(requireState: boolean): fc.Arbitrary<FileContract["region"]> {
  const withState = fc.constantFrom(...STATES).chain((state) => {
    const local = LOCAL_RULES[state] ?? [];
    const options = maybe(
      fc.tuple(...local.map(() => fc.option(fc.boolean(), { nil: undefined }))).map((flags) =>
        Object.fromEntries(local.flatMap((id, i) => (flags[i] === undefined ? [] : [[id, flags[i]]]))) as Record<string, boolean>,
      ),
    );
    return options.map((o) => compact({ country: "DE", state, options: o }) as FileContract["region"]);
  });
  return requireState ? withState : fc.oneof(withState, fc.constant({ country: "DE" }));
}

function rules(kind: "plan" | "ruleSet", referenceKeys: readonly string[]): fc.Arbitrary<FileRule[]> {
  const effect = fc.oneof(
    units(0, 480).map((requiredAtMost) => ({ requiredAtMost })),
    units(0, 480).map((requiredExactly) => ({ requiredExactly })),
    units(15, 480).map((mandatory) => ({ mandatory })),
  );
  const cited = referenceKeys.length === 0 ? fc.constant(undefined) : maybe(fc.array(fc.constantFrom(...referenceKeys), { maxLength: 3 }));
  const rule = fc
    .tuple(matchWithValidity, effect, maybe(part), maybe(text()), maybe(text(2000)), cited, kind === "plan" ? maybe(identifier) : fc.constant(undefined))
    .map(([validity, e, p, label, note, references, origin]) => ({ validity, e, p, label, note, references, origin }));
  return fc.array(rule, { maxLength: 6 }).map((list) =>
    list.map(
      ({ validity, e, p, label, note, references, origin }, i) =>
        compact({ id: `rule-${String(i)}`, ...validity, ...e, part: p, label, note, references, origin }) as FileRule,
    ),
  );
}

function contract(kind: "plan" | "ruleSet"): fc.Arbitrary<FileContract> {
  return fc
    .uniqueArray(word, { maxLength: 3 })
    .chain((keys) =>
      fc.tuple(
        maybe(text()),
        maybe(text(2000)),
        fc.tuple(...keys.map(() => reference)).map((list) => Object.fromEntries(keys.map((key, i) => [`ref-${key}`, list[i]]))) as fc.Arbitrary<Record<string, Reference>>,
        region(kind === "plan"),
        week,
        rules(kind, keys.map((key) => `ref-${key}`)),
      ),
    )
    .map(([name, description, references, reg, w, r]) => compact({ name, description, references, region: reg, minUnit: MIN_UNIT, week: w, rules: r }) as FileContract);
}

const entryName = maybe(text());
const exceptDays = maybe(fc.array(anyDay, { maxLength: 3 }));

function when(): fc.Arbitrary<Record<string, unknown>> {
  return fc.oneof(
    anyDay.map((date) => ({ date })),
    fc.tuple(matchWithValidity, exceptDays).map(([validity, except]) => compact({ ...validity, except })),
  );
}

/** Date entries by date (then `from`), then match entries in list order, as the reader sorts them. */
function canonical(entries: Record<string, unknown>[]): Record<string, unknown>[] {
  const dated = entries.filter((entry) => entry["date"] !== undefined);
  dated.sort((a, b) => (a["date"] as number) - (b["date"] as number) || ((a["from"] as number | undefined) ?? 0) - ((b["from"] as number | undefined) ?? 0));
  return [...dated, ...entries.filter((entry) => entry["date"] === undefined)];
}

function entries(type: FileSource["type"]): fc.Arbitrary<Record<string, unknown>[]> {
  let extra: fc.Arbitrary<Record<string, unknown>>;
  switch (type) {
    case "holiday":
      extra = fc.tuple(units(0, 480), maybe(part)).map(([required, p]) => compact({ required, part: p }));
      break;
    case "mandatory":
    case "needed":
      extra = fc.tuple(units(15, 480), maybe(part)).map(([take, p]) => compact({ take, part: p }));
      break;
    case "otherPlan":
      return fc
        .array(
          fc
            .tuple(anyDay, fc.integer({ min: 0, max: 479 }), fc.integer({ min: 1, max: 480 }), fc.constantFrom("leave", "mandatory"), entryName)
            .filter(([, from, to]) => from < to)
            .map(([date, from, to, kind, name]) => compact({ date, name, from, to, kind })),
          { maxLength: 4 },
        )
        .map(canonical);
    default:
      extra = fc.constant({});
  }
  return fc
    .array(fc.tuple(when(), entryName, extra).map(([w, name, e]) => compact({ ...w, name, ...e })), { maxLength: 4 })
    .map(canonical);
}

function sources(kind: "plan" | "ruleSet"): fc.Arbitrary<FileSource[]> {
  const types: FileSource["type"][] = ["holiday", "paidClosure", "mandatory", "info", ...(kind === "plan" ? (["otherPlan", "needed"] as const) : [])];
  const source = fc.constantFrom(...types).chain((type) =>
    fc
      .tuple(text(), color, fc.boolean(), kind === "plan" ? maybe(identifier) : fc.constant(undefined), type === "otherPlan" ? planRef : fc.constant(undefined), entries(type))
      .map(([name, c, visible, origin, plan, list]) => ({ type, name, color: c, visible, origin, plan, entries: list })),
  );
  return fc.array(source, { maxLength: 3 }).map(
    (list) => list.map(({ type, name, color: c, visible, origin, plan, entries: e }, i) => compact({ id: `source-${String(i)}`, origin, name, type, color: c, visible, plan, entries: e }) as unknown as FileSource),
  );
}

const template: fc.Arbitrary<Omit<Template, "id" | "origin">> = fc
  .tuple(
    text(),
    fc.integer({ min: 1, max: 5 }),
    word,
    fc.string({ maxLength: 40 }),
    maybe(
      fc.array(
        fc.record({ name: word, type: fc.constantFrom("image/png", "image/jpeg", "image/svg+xml"), data: fc.base64String({ maxLength: 40 }) }),
        { maxLength: 2 },
      ),
    ),
  )
  .map(([name, api, typst, typ, images]) => compact({ name, api, typst, typ, images }) as Omit<Template, "id" | "origin">);

function templates(kind: "plan" | "ruleSet"): fc.Arbitrary<Template[]> {
  return fc.array(fc.tuple(template, kind === "plan" ? maybe(identifier) : fc.constant(undefined)), { maxLength: 3 }).map((list) =>
    list.map(([t, origin], i) => compact({ id: `template-${String(i)}`, origin, name: t.name, api: t.api, typst: t.typst, typ: t.typ, images: t.images }) as unknown as Template),
  );
}

const themeValue: fc.Arbitrary<unknown> = fc.oneof(fc.string({ maxLength: 10 }), fc.integer(), fc.boolean(), fc.constant(null));
const theme: fc.Arbitrary<Theme> = fc.oneof(
  fc.constant(null),
  fc.dictionary(word, fc.oneof(themeValue, fc.array(themeValue, { maxLength: 3 }), fc.dictionary(word, themeValue, { maxKeys: 3 })), { maxKeys: 4 }),
);

const period: fc.Arbitrary<PlanPeriod> = fc
  .tuple(fc.integer({ min: 2000, max: 2100 }), fc.integer({ min: 0, max: 11 }), fc.integer({ min: 0, max: 35 }))
  .map(([year, month, length]) => {
    const last = year * 12 + month + length;
    return { from: { year, month: month + 1 }, to: { year: Math.floor(last / 12), month: (last % 12) + 1 } };
  });

function plan(): fc.Arbitrary<FilePlan> {
  return period.chain((range) => {
    const bounds = periodBounds(range);
    const inside = fc.integer({ min: bounds.from, max: bounds.to });
    const leave = fc
      .uniqueArray(inside, { maxLength: 8 })
      .chain((days) =>
        fc.tuple(
          ...days
            .sort((a, b) => a - b)
            .map((d) =>
              fc.tuple(units(15, 480), part).map(([take, p]): LeaveDay => (take === 480 && p === "start" ? { day: d, take } : { day: d, take, part: p })),
            ),
        ),
      );
    const overrides = fc
      .uniqueArray(inside, { maxLength: 8 })
      .chain((days) =>
        fc.tuple(...days.sort((a, b) => a - b).map((d) => fc.tuple(units(0, 480), maybe(part)).map(([required, p]): RequiredOverride => compact({ day: d, required, part: p }) as RequiredOverride))),
      );
    const notes = fc
      .uniqueArray(inside, { maxLength: 5 })
      .chain((days) => fc.tuple(...days.sort((a, b) => a - b).map((d) => fc.string({ minLength: 1, maxLength: 30 }).map((t) => ({ day: d, text: t })))));
    return fc
      .tuple(fc.integer({ min: 0, max: 20_000 }), leave, overrides, notes)
      .map(([allowance, days, o, n]) => ({ range, allowance, days, overrides: o, notes: n }));
  });
}

/** A valid plan file as `readFile` reads it back. */
export const planFileModel: fc.Arbitrary<PlanFile> = fc
  .tuple(identifier, fc.integer({ min: 1, max: 1000 }), maybe(planRef), contract("plan"), sources("plan"), templates("plan"), theme, plan())
  .map(([id, revision, ruleSet, c, s, t, th, p]) => compact({ kind: "plan", id, revision, ruleSet, contract: c, sources: s, templates: t, theme: th, plan: p }) as PlanFile);

/** A valid rule set as `readFile` reads it back. */
export const ruleSetModel: fc.Arbitrary<RuleSetFile> = fc
  .tuple(identifier, fc.integer({ min: 1, max: 1000 }), contract("ruleSet"), sources("ruleSet"), templates("ruleSet"), theme)
  .map(([id, revision, c, s, t, th]): RuleSetFile => ({ kind: "ruleSet", id, revision, contract: c, sources: s, templates: t, theme: th }));

export const fileModel: fc.Arbitrary<AnyFile> = fc.oneof(planFileModel, ruleSetModel);
