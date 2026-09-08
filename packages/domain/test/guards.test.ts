import { describe, expect, it } from "vitest";
import { evaluateGuards, canExecute, decisionFromGuards, DEFAULT_GUARD_THRESHOLDS } from "../src/guards.js";
import { buildAudit, predictionMatchesOutcome, outcomeErrorBp } from "../src/decision.js";
import { estimateProbability } from "../src/estimate.js";
import type { MarketSnapshot } from "../src/types.js";

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
    impliedProbabilityBp: 4000n,
    momentumBp: 300n,
    volume24h: "1000000",
    openInterest: "500000",
    orderBook: {
      bids: [{ priceBp: 5300n, size: 500_000_000n }],
      asks: [{ priceBp: 5500n, size: 400_000_000n }],
      observedAt: now,
    },
    source: "test",
    observedAt: now,
    ...overrides,
  };
}

function runAudit(snapshot: MarketSnapshot, now = snapshot.observedAt) {
  const estimate = estimateProbability(snapshot, now);
  const audit = buildAudit({
    auditId: "audit-1",
    snapshot,
    estimate,
    guards: [],
    thresholds: { minEdgeBp: 500n, minConfidenceBp: 6500n },
    modelVersion: "test-v1",
    mode: "deterministic",
    source: snapshot.source,
    createdAt: now,
  });
  const guards = evaluateGuards(
    { snapshot, now, thresholds: DEFAULT_GUARD_THRESHOLDS },
    audit,
  );
  return { estimate, audit: { ...audit, guards }, guards };
}

describe("guards", () => {
  it("passes all guards on a healthy trading market", () => {
    const { guards } = runAudit(makeSnapshot());
    const failed = guards.filter((g) => g.status === "fail");
    expect(failed).toEqual([]);
  });

  it("fails the lifecycle guard for a locked market with a critical flag", () => {
    const { guards } = runAudit(makeSnapshot({ status: "locked" }));
    const lifecycle = guards.find((g) => g.id === "lifecycle")!;
    expect(lifecycle.status).toBe("fail");
    expect(lifecycle.critical).toBe(true);
  });

  it("fails data freshness when the snapshot is old", () => {
    const snap = makeSnapshot();
    const { guards } = runAudit(snap, snap.observedAt + 200_000);
    const freshness = guards.find((g) => g.id === "data-freshness")!;
    expect(freshness.status).toBe("fail");
    expect(freshness.critical).toBe(true);
  });

  it("fails time to expiry when too close to expiry", () => {
    const snap = makeSnapshot({ expiryAt: snap0().expiryAt });
    const now = snap.expiryAt - 60_000;
    const { guards } = runAudit({ ...snap, lockAt: now - 1000 }, now);
    const expiry = guards.find((g) => g.id === "time-to-expiry")!;
    expect(expiry.status).toBe("fail");
  });

  it("fails liquidity guard when the spread exceeds the slippage budget", () => {
    const snap = makeSnapshot({
      orderBook: {
        bids: [{ priceBp: 5000n, size: 100n }],
        asks: [{ priceBp: 5600n, size: 100n }],
        observedAt: 1_760_000_000_000,
      },
    });
    const { guards } = runAudit(snap);
    const liquidity = guards.find((g) => g.id === "liquidity")!;
    expect(liquidity.status).toBe("fail");
    expect(liquidity.critical).toBe(true);
  });

  it("blocks execution when a critical guard fails even with a passing decision", () => {
    const snap = makeSnapshot({ status: "locked" });
    const { audit } = runAudit(snap);
    expect(canExecute(audit)).toBe(false);
  });
});

describe("decision derivation", () => {
  it("yields trade only when edge and confidence clear thresholds", () => {
    expect(decisionFromGuards(false, 800n, 7000n, DEFAULT_GUARD_THRESHOLDS)).toBe("trade");
    expect(decisionFromGuards(false, 400n, 7000n, DEFAULT_GUARD_THRESHOLDS)).toBe("no_trade");
    expect(decisionFromGuards(false, 800n, 6000n, DEFAULT_GUARD_THRESHOLDS)).toBe("no_trade");
    expect(decisionFromGuards(true, 800n, 7000n, DEFAULT_GUARD_THRESHOLDS)).toBe("no_trade");
  });

  it("buildAudit marks insufficient data on very low confidence", () => {
    const snap = makeSnapshot();
    const audit = buildAudit({
      auditId: "a",
      snapshot: snap,
      estimate: { probabilityBp: 6000n, confidenceBp: 1000n, direction: "up", evidence: [] },
      guards: [],
      thresholds: { minEdgeBp: 500n, minConfidenceBp: 6500n },
      modelVersion: "v",
      mode: "deterministic",
      source: "test",
      createdAt: 0,
    });
    expect(audit.decision).toBe("insufficient_data");
    expect(audit.direction).toBeNull();
  });

  it("buildAudit produces a trade decision with direction on a clear edge", () => {
    const snap = makeSnapshot({ impliedProbabilityBp: 4000n });
    const audit = buildAudit({
      auditId: "a",
      snapshot: snap,
      estimate: { probabilityBp: 6200n, confidenceBp: 7500n, direction: "up", evidence: [] },
      guards: [],
      thresholds: { minEdgeBp: 500n, minConfidenceBp: 6500n },
      modelVersion: "v",
      mode: "deterministic",
      source: "test",
      createdAt: 0,
    });
    expect(audit.decision).toBe("trade");
    expect(audit.direction).toBe("up");
    expect(audit.edgeBp).toBe(2200n);
  });

  it("computes calibration error against settled outcomes", () => {
    expect(outcomeErrorBp(7000n, "up")).toBe(3000n);
    expect(outcomeErrorBp(7000n, "down")).toBe(7000n);
    expect(outcomeErrorBp(7000n, null)).toBeNull();
    expect(predictionMatchesOutcome(7000n, "up")).toBe(true);
    expect(predictionMatchesOutcome(7000n, "down")).toBe(false);
    expect(predictionMatchesOutcome(7000n, null)).toBe(false);
  });
});

function snap0(): MarketSnapshot {
  return makeSnapshot();
}
