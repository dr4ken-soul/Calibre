import { describe, expect, it } from "vitest";
import {
  clampBp,
  formatEdgeBp,
  formatFixed,
  formatProbability,
  mulDiv,
  parseFixed,
  probabilityToBp,
} from "../src/fixed.js";

describe("fixed point helpers", () => {
  it("parses decimal strings into scaled bigints", () => {
    expect(parseFixed("12.5")).toBe(12_500_000n);
    expect(parseFixed("0.000001")).toBe(1n);
    expect(parseFixed("-3.25")).toBe(-3_250_000n);
    expect(parseFixed("100")).toBe(100_000_000n);
  });

  it("round trips parse and format", () => {
    const values = ["0", "1.5", "2500.123456", "0.000009"];
    for (const v of values) {
      expect(formatFixed(parseFixed(v))).toBe(v);
    }
  });

  it("rejects invalid decimal strings", () => {
    expect(() => parseFixed("abc")).toThrow();
    expect(() => parseFixed("1.2.3")).toThrow();
    expect(() => parseFixed("")).toThrow();
    expect(() => parseFixed("1.0000001")).toThrow();
  });

  it("mulDiv multiplies and divides with rounding", () => {
    expect(mulDiv(3n, 4n, 2n)).toBe(6n);
    expect(mulDiv(1n, 1n, 3n)).toBe(0n);
    expect(mulDiv(2n, 1n, 3n)).toBe(1n);
    expect(mulDiv(-3n, 4n, 2n)).toBe(-6n);
    expect(() => mulDiv(1n, 1n, 0n)).toThrow();
  });

  it("clamps probabilities to basis point bounds", () => {
    expect(clampBp(-5n)).toBe(0n);
    expect(clampBp(20_000n)).toBe(10_000n);
    expect(clampBp(5230n)).toBe(5230n);
  });

  it("formats probabilities and edges", () => {
    expect(formatProbability(5230n)).toBe("52.30%");
    expect(formatProbability(0n)).toBe("0.00%");
    expect(formatEdgeBp(512n)).toBe("+5.12 pts");
    expect(formatEdgeBp(-250n)).toBe("-2.50 pts");
  });

  it("converts probability strings to basis points", () => {
    expect(probabilityToBp("0.6234")).toBe(6234n);
    expect(probabilityToBp("1")).toBe(10_000n);
  });
});
