import { describe, expect, it } from "vitest";
import { rngFromString } from "../src/rng.js";

describe("seeded rng", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = rngFromString("BTC-up-2026-01-01");
    const b = rngFromString("BTC-up-2026-01-01");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = rngFromString("seed-a");
    const b = rngFromString("seed-b");
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("keeps outputs in range", () => {
    const rng = rngFromString("range-check");
    for (let i = 0; i < 200; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(rng.int(7)).toBeLessThan(7);
      expect(rng.int(7)).toBeGreaterThanOrEqual(0);
    }
  });
});
