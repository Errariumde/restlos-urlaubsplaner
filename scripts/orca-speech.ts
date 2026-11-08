// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The screen reader check before a release (docs/SPEC.md, "Accessibility" and the release checklist): Orca writes
// what it says to its debug log, and this reads the log after a fixed sequence of keys in the app. It looks only for
// what a person would otherwise have to listen for: a result of a change that wasn't said, a text said twice in a
// row, and a very long text (a whole calendar row). Nothing has to be heard; the speakers can be muted. The log also
// has every text Firefox sent Orca, so a result the app didn't give Orca is told apart from one Orca dropped.

/** What a step's key makes the hint line say: the day's new leave, or undone or redone. */
export type ResultKind = "day" | "undo" | "redo";

export interface Step {
  readonly keys: string;
  readonly result?: ResultKind;
}

/** The keys after Tab has brought the focus to 1 January in the example, one at a time, a second apart. */
export const STEPS: readonly Step[] = [
  { keys: "Down, Down (to 15 January)" },
  { keys: "Space", result: "day" },
  { keys: "H", result: "day" },
  { keys: "Delete", result: "day" },
  { keys: "Ctrl+Z", result: "undo" },
  { keys: "Ctrl+Y", result: "redo" },
  { keys: "Enter (the day's detail opens on its Full day checkbox)" },
  { keys: "Space", result: "day" },
  { keys: "Escape" },
  { keys: "Ctrl+Z", result: "undo" },
];

/** The procedure, as `npm run orca` prints it without a log file. */
export function procedure(): string {
  return [
    "Screen reader check with Orca (about two minutes, nothing to listen to):",
    "1. Mute the speakers. Start Orca with a log: orca --replace --debug-file=/tmp/orca.log",
    '2. In the dev shell: npm run build, then firefox-esr --new-instance --profile "$(mktemp -d)" dist/restlos-urlaubsplaner.html',
    "3. Open the example and press Tab until 1 January has the focus.",
    `4. Press, one key at a time, a second apart: ${STEPS.map((step) => step.keys).join("; ")}.`,
    "5. Close Firefox, stop Orca with Ctrl+C, then: npm run orca -- /tmp/orca.log",
  ].join("\n");
}

/** One line of Orca's debug log that it spoke: `20:15:12.0 - SPEECH OUTPUT: 'text' {voice}`. */
const SPEECH = /^\S+ - SPEECH OUTPUT: '(.*)'(?: \{.*\})?$/;

/**
 * A text change Firefox sent Orca, as Orca's event manager logs it on arrival, before it decides whether to present it:
 * `20:15:12.0 - EVENT MANAGER: object:text-changed:insert:system for [section (0x…)]  in Firefox (Gecko 153.5.0) (0, 21, text)`.
 * The same event's later lines (queued, dequeued) have other words after "EVENT MANAGER:" or after the text.
 */
const DELIVERED = /^\S+ - EVENT MANAGER: object:text-changed:insert:system for \[[^\]]*\]\s+in Firefox [^)]*\) \(-?\d+, \d+, (.*)\)$/;

const normalize = (text: string): string => text.replace(/\s+/gu, " ").trim();

/** The hint line's result of a change ends with what is left or how far the allowance is exceeded (status.ts). */
const RESULT_END = /(?:left|übrig|over the allowance|über dem Kontingent)\.$/u;

/** A result's kind, or undefined for any other text. */
export function resultKind(text: string): ResultKind | undefined {
  if (!RESULT_END.test(text)) return undefined;
  if (/^(?:Undone|Rückgängig)\./u.test(text)) return "undo";
  if (/^(?:Redone|Wiederholt)\./u.test(text)) return "redo";
  return "day";
}

export interface OrcaLog {
  /** What Orca spoke, in order, with runs of white space (also no-break spaces) as one space. */
  readonly spoken: readonly string[];
  /** The hint line's results Firefox sent Orca, in order, whether Orca then said them or not. */
  readonly delivered: readonly string[];
}

export function readLog(log: string): OrcaLog {
  const spoken: string[] = [];
  const delivered: string[] = [];
  let lastSent: string | undefined;
  for (const raw of log.split("\n")) {
    const line = raw.trimEnd();
    const said = SPEECH.exec(line)?.[1];
    if (said !== undefined) {
      spoken.push(normalize(said));
      continue;
    }
    // One event can be logged twice on arrival; two results with the same words still differ in their trailing
    // no-break space (status.ts, `announced`).
    const sent = DELIVERED.exec(line)?.[1];
    if (sent !== undefined && sent !== lastSent && resultKind(normalize(sent)) !== undefined) {
      delivered.push(normalize(sent));
      lastSent = sent;
    }
  }
  return { spoken, delivered };
}

/** Orca's echo of a key it saw ("space", "Control_L"), which a key pressed twice repeats on purpose. */
const KEY_ECHO = /^(?:[A-Za-z]|space|Tab|ISO_Left_Tab|Return|Escape|Delete|BackSpace|(?:Control|Shift|Alt|Super)_[LR]|Up|Down|Left|Right|Home|End|Page_(?:Up|Down))$/u;

/** Above this many characters a text is probably a whole row or a whole dialog read out. */
const LONG = 200;

export interface SpeechCheck {
  /** The results the app gave Orca, in order. */
  readonly delivered: readonly string[];
  /** Empty when those results' kinds are the steps' kinds in order; else a sentence that says what differs. */
  readonly mismatch: string;
  /** The results Orca said. */
  readonly said: readonly string[];
  /**
   * Results the app gave Orca that Orca didn't say: Orca 50 drops some at random with its own filters (issue 0046,
   * Orca 50 drops some hint line results). Fewer than half said points to the app instead.
   */
  readonly dropped: readonly string[];
  /** Texts said twice in a row, other than the echo of a key pressed twice. */
  readonly repeated: readonly string[];
  /** Texts longer than 200 characters, which are worth a look but not wrong in themselves. */
  readonly long: readonly string[];
}

export function checkSpeech(log: OrcaLog, steps: readonly Step[] = STEPS): SpeechCheck {
  const { spoken, delivered } = log;
  const expected = steps.flatMap((step) => (step.result === undefined ? [] : [step.result]));
  const sent = delivered.map((text) => resultKind(text));
  const same = sent.length === expected.length && sent.every((kind, index) => kind === expected[index]);
  const mismatch = same ? "" : `The app was to give Orca the results ${expected.join(", ")}; it gave ${sent.length === 0 ? "none" : sent.join(", ")}.`;
  const said = spoken.filter((text) => resultKind(text) !== undefined);
  const dropped: string[] = [];
  let next = 0;
  for (const text of delivered) {
    const index = said.indexOf(text, next);
    if (index === -1) dropped.push(text);
    else next = index + 1;
  }
  const repeated = spoken.filter((text, index) => index > 0 && text === spoken[index - 1] && !KEY_ECHO.test(text));
  const long = spoken.filter((text) => text.length > LONG);
  return { delivered, mismatch, said, dropped, repeated, long };
}

/** Whether Orca said at least half of the results the app gave it. */
const mostSaid = (check: SpeechCheck): boolean => (check.delivered.length - check.dropped.length) * 2 >= check.delivered.length;

/** The report `npm run orca` prints for a log. */
export function formatCheck(check: SpeechCheck): string {
  const lines = [check.mismatch === "" ? `The app gave Orca all ${String(check.delivered.length)} results, in order.` : check.mismatch];
  lines.push(`Orca said ${String(check.delivered.length - check.dropped.length)} of them:`, ...check.said.map((text) => `  ${text}`));
  if (check.dropped.length > 0) {
    lines.push("Dropped by Orca's own filters (issue 0046, Orca 50 drops some hint line results):", ...check.dropped.map((text) => `  ${text}`));
  }
  if (!mostSaid(check)) lines.push("Fewer than half were said: look for a cause in the app, such as a live region that isn't a div.");
  if (check.repeated.length > 0) lines.push("Said twice in a row:", ...check.repeated.map((text) => `  ${text}`));
  if (check.long.length > 0) lines.push("Long texts (worth a look):", ...check.long.map((text) => `  ${text.slice(0, LONG)}…`));
  return lines.join("\n");
}

/** Whether the check passed: every result given to Orca in order, most of them said, nothing said twice. */
export const speechOk = (check: SpeechCheck): boolean => check.mismatch === "" && mostSaid(check) && check.repeated.length === 0;
