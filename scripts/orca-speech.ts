// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The screen reader check before a release (docs/SPEC.md, "Accessibility" and the release checklist): Orca writes
// what it says to its debug log, and this reads the log after a fixed sequence of keys in the app. It looks only for
// what a person would otherwise have to listen for: a result of a change that wasn't said, a text said twice in a
// row, and a very long text (a whole calendar row). Nothing has to be heard; the speakers can be muted.

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

/** The texts Orca spoke, in order, with runs of white space (also no-break spaces) as one space. */
export function spokenTexts(log: string): string[] {
  const texts: string[] = [];
  for (const line of log.split("\n")) {
    const match = SPEECH.exec(line.trimEnd());
    if (match?.[1] !== undefined) texts.push(normalize(match[1]));
  }
  return texts;
}

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

/** Orca's echo of a key it saw ("space", "Control_L"), which a key pressed twice repeats on purpose. */
const KEY_ECHO = /^(?:[A-Za-z]|space|Tab|ISO_Left_Tab|Return|Escape|Delete|BackSpace|(?:Control|Shift|Alt|Super)_[LR]|Up|Down|Left|Right|Home|End|Page_(?:Up|Down))$/u;

/** Above this many characters a text is probably a whole row or a whole dialog read out. */
const LONG = 200;

export interface SpeechCheck {
  /** The results that were said, in order. */
  readonly results: readonly string[];
  /** Empty when the results' kinds are the steps' kinds in order; else a sentence that says what differs. */
  readonly mismatch: string;
  /** Texts said twice in a row, other than the echo of a key pressed twice. */
  readonly repeated: readonly string[];
  /** Texts longer than 200 characters, which are worth a look but not wrong in themselves. */
  readonly long: readonly string[];
}

export function checkSpeech(texts: readonly string[], steps: readonly Step[] = STEPS): SpeechCheck {
  const results = texts.filter((text) => resultKind(text) !== undefined);
  const heard = results.map((text) => resultKind(text));
  const expected = steps.flatMap((step) => (step.result === undefined ? [] : [step.result]));
  const same = heard.length === expected.length && heard.every((kind, index) => kind === expected[index]);
  const mismatch = same ? "" : `Expected the results ${expected.join(", ")}; heard ${heard.length === 0 ? "none" : heard.join(", ")}.`;
  const repeated = texts.filter((text, index) => index > 0 && text === texts[index - 1] && !KEY_ECHO.test(text));
  const long = texts.filter((text) => text.length > LONG);
  return { results, mismatch, repeated, long };
}

/** The report `npm run orca` prints for a log. */
export function formatCheck(check: SpeechCheck): string {
  const lines = ["Results said:", ...check.results.map((text) => `  ${text}`)];
  lines.push(check.mismatch === "" ? "Every result was said, in order." : check.mismatch);
  if (check.repeated.length > 0) lines.push("Said twice in a row:", ...check.repeated.map((text) => `  ${text}`));
  if (check.long.length > 0) lines.push("Long texts (worth a look):", ...check.long.map((text) => `  ${text.slice(0, LONG)}…`));
  return lines.join("\n");
}

/** Whether the check found something wrong; long texts alone are not. */
export const speechOk = (check: SpeechCheck): boolean => check.mismatch === "" && check.repeated.length === 0;
