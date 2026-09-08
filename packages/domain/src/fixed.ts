/**
 * Bigint-safe fixed point helpers.
 *
 * Probabilities use basis points: 10000n is 1.0.
 * Prices, sizes, and amounts use PRICE_DECIMALS decimals by default.
 * All arithmetic stays in bigint until display formatting.
 */

export const BPS = 10_000n;
export const PRICE_DECIMALS = 6;
export const PRICE_UNIT = 10n ** BigInt(PRICE_DECIMALS);

const BP_MIN = 0n;
export const BP_MAX = 10_000n;

export function clampBp(value: bigint, min: bigint = BP_MIN, max: bigint = BP_MAX): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampBigint(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Multiply two scaled values and divide by a scale, rounding half away from zero. */
export function mulDiv(a: bigint, b: bigint, scale: bigint): bigint {
  if (scale === 0n) throw new Error("mulDiv: scale must not be zero");
  const product = a * b;
  const sign = product < 0n ? -1n : 1n;
  const abs = product < 0n ? -product : product;
  const half = scale / 2n;
  const q = (abs + half) / scale;
  return sign * q;
}

/** Parse a decimal string like "12.5" into a scaled bigint. Throws on bad input. */
export function parseFixed(input: string, decimals: number = PRICE_DECIMALS): bigint {
  const trimmed = input.trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2] === "" && (match[3] === undefined || match[3] === ""))) {
    throw new Error(`parseFixed: invalid decimal string "${input}"`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] ?? "";
  const frac = match[3] ?? "";
  if (frac.length > decimals) {
    throw new Error(`parseFixed: "${input}" has more than ${decimals} decimals`);
  }
  const paddedFrac = frac.padEnd(decimals, "0");
  const digits = `${whole}${paddedFrac}` || "0";
  return sign * BigInt(digits);
}

/** Format a scaled bigint back to a decimal string, trailing zeros trimmed. */
export function formatFixed(value: bigint, decimals: number = PRICE_DECIMALS): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = abs % scale;
  let fracStr = decimals === 0 ? "" : frac.toString().padStart(decimals, "0");
  fracStr = fracStr.replace(/0+$/, "");
  return `${negative && abs !== 0n ? "-" : ""}${whole.toString()}${fracStr === "" ? "" : `.${fracStr}`}`;
}

/** Parse a probability expressed as 0..1 decimal string into basis points. */
export function probabilityToBp(input: string): bigint {
  return parseFixed(input, 4);
}

/** Format basis points as a percentage string, for example 5230n becomes "52.30%". */
export function formatProbability(bp: bigint): string {
  const clamped = clampBp(bp);
  const whole = clamped / 100n;
  const frac = clamped % 100n;
  return `${whole}.${frac.toString().padStart(2, "0")}%`;
}

/** Format an edge in basis points as percentage points, for example 512n becomes "5.12 pts". */
export function formatEdgeBp(bp: bigint): string {
  const negative = bp < 0n;
  const abs = negative ? -bp : bp;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${negative ? "-" : "+"}${whole}.${frac.toString().padStart(2, "0")} pts`;
}

export function bpToNumber(bp: bigint): number {
  return Number(bp) / 10_000;
}

export function numberToBp(value: number): bigint {
  return BigInt(Math.round(value * 10_000));
}

/** Parse a plain integer string into bigint. Returns null on invalid input. */
export function parseIntegerString(input: string): bigint | null {
  if (!/^-?\d+$/.test(input)) return null;
  return BigInt(input);
}

/** Average of two bigints with truncation, used for mid prices. */
export function midpoint(a: bigint, b: bigint): bigint {
  return (a + b) / 2n;
}
