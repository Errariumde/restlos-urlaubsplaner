// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

export const UNITS_PER_DAY = 480;

/** Integer multiples of 1/480 day. */
export type Units = number;

export type WeightErrorCode = "syntax" | "range" | "inexact";

export class WeightError extends Error {
  readonly code: WeightErrorCode;
  readonly input: string;

  constructor(code: WeightErrorCode, input: string) {
    super(`Invalid weight ${JSON.stringify(input)}: ${code}`);
    this.name = "WeightError";
    this.code = code;
    this.input = input;
  }
}

// Fraction terms longer than this (after dropping leading zeros) are rejected as
// "syntax": numerator * 480 must stay a safe integer. 12 digits -> < 4.8e14.
const MAX_FRACTION_DIGITS = 12;
// 480 = 2^5 * 3 * 5, so a decimal with more fractional digits than this is never exact.
const MAX_EXACT_FRACTION_DIGITS = 5;

const stripLeadingZeros = (digits: string): string => digits.replace(/^0+(?=\d)/, "");

// A regex like /0+$/ backtracks quadratically on long runs of zeros; scan instead.
function stripTrailingZeros(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits.charCodeAt(end - 1) === 48) end--;
  return digits.slice(0, end);
}

/**
 * Parses "1", "0.5" or "1/2" (a share of one day, 0..1) into integer units.
 * Integer arithmetic only. Check order: syntax, range, exactness.
 */
export function parseWeight(text: string): Units {
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return parseFraction(text, fraction[1] ?? "", fraction[2] ?? "");
  const decimal = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (decimal) return parseDecimal(text, decimal[1] ?? "", decimal[2] ?? "");
  throw new WeightError("syntax", text);
}

function parseFraction(text: string, numText: string, denText: string): Units {
  const num = stripLeadingZeros(numText);
  const den = stripLeadingZeros(denText);
  if (num.length > MAX_FRACTION_DIGITS || den.length > MAX_FRACTION_DIGITS) {
    throw new WeightError("syntax", text);
  }
  const n = Number(num);
  const d = Number(den);
  if (d === 0) throw new WeightError("syntax", text);
  if (n > d) throw new WeightError("range", text);
  if ((n * UNITS_PER_DAY) % d !== 0) throw new WeightError("inexact", text);
  return (n * UNITS_PER_DAY) / d;
}

function parseDecimal(text: string, intText: string, fracText: string): Units {
  const whole = stripLeadingZeros(intText);
  const frac = stripTrailingZeros(fracText);
  // No arithmetic on the integer part: only "0" and "1" can be in range.
  if (whole.length > 1 || (whole !== "0" && whole !== "1")) throw new WeightError("range", text);
  if (whole === "1") {
    if (frac.length > 0) throw new WeightError("range", text);
    return UNITS_PER_DAY;
  }
  if (frac.length === 0) return 0;
  if (frac.length > MAX_EXACT_FRACTION_DIGITS) throw new WeightError("inexact", text);
  const scale = 10 ** frac.length;
  const scaled = Number(frac) * UNITS_PER_DAY;
  if (scaled % scale !== 0) throw new WeightError("inexact", text);
  return scaled / scale;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Writes integer units as the reduced fraction of a day used in files:
 * "0", "1", "1/2", "3/32". Throws RangeError unless units is an integer in 0..UNITS_PER_DAY.
 */
export function formatWeight(units: Units): string {
  if (!Number.isInteger(units) || units < 0 || units > UNITS_PER_DAY) {
    throw new RangeError(`Weight units out of range: ${units}`);
  }
  const divisor = gcd(units, UNITS_PER_DAY);
  const num = units / divisor;
  const den = UNITS_PER_DAY / divisor;
  return den === 1 ? String(num) : `${num}/${den}`;
}
