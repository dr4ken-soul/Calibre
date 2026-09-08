import { describe, expect, it } from "vitest";
import { estimateProbability } from "../src/estimate.js";
import type { MarketSnapshot } from "../src/types.js";
import { rngFromString } from "../src/rng.js";

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const now = 1_760_000_000_000;
  return {
    marketId: "TEST-UP-1",
    question: "Will TEST be up?",
    asset: "TEST",
    strike: "100",
    referencePrice: "100",
    currentPrice: "101",
    lockAt: now + 3600_000,
    expiryAt: now + 7200_000,
    status: "trading",
    impliedProbabilityBp: 5500n,
    momentumBp: 300n,
    volume24h: "1000000",
    openInterest: "500000",
    orderBook: {
      bids: [
        { priceBp: 5200n, size: 500_000_000n },
        { priceBp: 5000n, size: 300_000_000n },
      ],
      asks: [
        { priceBp: 5600n, size: 400_000_000n },
        { priceBp: 5800n, size: 200_000_000n },
      ],
      observedAt: now,
    },
    source: "test",
    observedAt: now,
    ...overrides,
  };
}

describe("estimateProbability", () => {
  it("is deterministic for identical inputs", () => {
    const snap = makeSnapshot();
    const a = estimateProbability(snap, snap.observedAt);
    const b = estimateProbability(snap, snap.observedAt);
    expect(a.probabilityBp).toBe(b.probabilityBp);
    expect(a.confidenceBp).toBe(b.confidenceBp);
    expect(a.evidence.map((e) => e.id)).toEqual(b.evidence.map((e) => e.id));
  });

  it("produces a bounded probability and nonzero confidence for a healthy book", () => {
    const snap = makeSnapshot();
    const est = estimateProbability(snap, snap.observedAt);
    expect(est.probabilityBp).toBeGreaterThanOrEqual(300n);
    expect(est.probabilityBp).toBeLessThanOrEqual(9700n);
    expect(est.confidenceBp).toBeGreaterThan(0n);
    expect(est.evidence.length).toBeGreaterThan(0);
  });

  it("moves the estimate with the order book imbalance", () => {
    const heavyBids = makeSnapshot({
      orderBook: {
        bids: [
          { priceBp: 5200n, size: 5_000_000_000n },
          { priceBp: 5000n, size: 3_000_000_000n },
        ],
        asks: [{ priceBp: 5600n, size: 100_000_000n }],
        observedAt: 1_760_000_000_000,
      },
    });
    const heavyAsks = makeSnapshot({
      orderBook: {
        bids: [{ priceBp: 5200n, size: 100_000_000n }],
        asks: [
          { priceBp: 5600n, size: 5_000_000_000n },
          { priceBp: 5800n, size: 3_000_000_000n },
        ],
        observedAt: 1_760_000_000_000,
      },
    });
    const upEstimate = estimateProbability(heavyBids, 1_760_000_000_000);
    const downEstimate = estimateProbability(heavyAsks, 1_760_000_000_000);
    expect(upEstimate.probabilityBp).toBeGreaterThan(downEstimate.probabilityBp);
  });

  it("drops confidence to zero with an empty book", () => {
    const snap = makeSnapshot({
      orderBook: { bids: [], asks: [], observedAt: 1_760_000_000_000 },
    });
    const est = estimateProbability(snap, snap.observedAt);
    expect(est.confidenceBp).toBe(0n);
  });

  it("never reads the question text", () => {
    const snapA = makeSnapshot({ question: "Will it rain?" });
    const snapB = makeSnapshot({ question: "Will the moon collide with earth?" });
    const a = estimateProbability(snapA, 1_760_000_000_000);
    const b = estimateProbability(snapB, 1_760_000_000_000);
    expect(a.probabilityBp).toBe(b.probabilityBp);
  });

  it("uses a seeded rng helper for reproducible test data", () => {
    const rngA = rngFromString("x");
    const rngB = rngFromString("x");
    expect(rngA.next()).toBe(rngB.next());
  });
});
