import { describe, expect, it } from "vitest";
import { AuditEngine, type AiProvider } from "../src/services/audit-engine.js";
import type { MarketSnapshot } from "@calibre/domain";

const now = 1_760_000_000_000;

function snapshot(): MarketSnapshot {
  return {
    marketId: "MKT-1",
    question: "Will the test market resolve up?",
    asset: "BTC",
    strike: "100000",
    referencePrice: "99500",
    currentPrice: "100200",
    lockAt: now + 3_600_000,
    expiryAt: now + 7_200_000,
    status: "trading",
    impliedProbabilityBp: 4000n,
    momentumBp: 300n,
    volume24h: "1500000",
    openInterest: "300000",
    orderBook: {
      bids: [{ priceBp: 5250n, size: 900_000_000n }],
      asks: [{ priceBp: 5350n, size: 800_000_000n }],
      observedAt: now,
    },
    source: "test",
    observedAt: now,
  };
}

const config = {
  minEdgeBp: 500n,
  minConfidenceBp: 6500n,
  maxSlippageBp: 200n,
  minSecondsToExpiry: 120,
  staleAfterMs: 90_000,
};

describe("audit engine", () => {
  it("runs fully deterministic without AI", async () => {
    const engine = new AuditEngine({ ...config, ai: null });
    const audit = await engine.run(snapshot(), now, "a1");
    expect(audit.mode).toBe("deterministic");
    expect(audit.modelVersion).toBe("calibre-estimate-v1");
    expect(audit.decision === "trade" || audit.decision === "no_trade" || audit.decision === "insufficient_data").toBe(true);
  });

  it("uses a bounded model adjustment when valid", async () => {
    const ai: AiProvider = {
      providerLabel: "stub",
      modelLabel: "stub-1",
      adjust: async () => ({ adjustedProbability: 0.55, reasoning: "book pressure up" }),
    };
    const engine = new AuditEngine({ ...config, ai });
    const baseline = await new AuditEngine({ ...config, ai: null }).run(snapshot(), now, "a0");
    const assisted = await engine.run(snapshot(), now, "a1");
    expect(assisted.mode).toBe("model-assisted");
    expect(assisted.modelVersion).toContain("stub");
    const diff = assisted.calibreProbabilityBp > baseline.calibreProbabilityBp
      ? assisted.calibreProbabilityBp - baseline.calibreProbabilityBp
      : baseline.calibreProbabilityBp - assisted.calibreProbabilityBp;
    expect(diff).toBeLessThanOrEqual(800n);
  });

  it("discards model adjustments beyond the bound and notes it", async () => {
    const ai: AiProvider = {
      providerLabel: "stub",
      modelLabel: "stub-1",
      adjust: async () => ({ adjustedProbability: 0.99, reasoning: "huge move" }),
    };
    const engine = new AuditEngine({ ...config, ai });
    const snap = { ...snapshot(), impliedProbabilityBp: 4000n };
    const baseline = await new AuditEngine({ ...config, ai: null }).run(snap, now, "a0");
    const audit = await engine.run(snap, now, "a1");
    expect(audit.calibreProbabilityBp).toBe(baseline.calibreProbabilityBp);
    expect(audit.reasons.some((r) => r.includes("out of bounds"))).toBe(true);
  });

  it("falls back to deterministic when the model throws", async () => {
    const ai: AiProvider = {
      providerLabel: "stub",
      modelLabel: "stub-1",
      adjust: async () => {
        throw new Error("network down");
      },
    };
    const engine = new AuditEngine({ ...config, ai });
    const snap = snapshot();
    const baseline = await new AuditEngine({ ...config, ai: null }).run(snap, now, "a0");
    const audit = await engine.run(snap, now, "a1");
    expect(audit.mode).toBe("deterministic");
    expect(audit.calibreProbabilityBp).toBe(baseline.calibreProbabilityBp);
    expect(audit.reasons.some((r) => r.includes("failed validation"))).toBe(true);
  });

  it("falls back when the model returns schema invalid output", async () => {
    const ai: AiProvider = {
      providerLabel: "stub",
      modelLabel: "stub-1",
      adjust: async () => ({ nope: true }),
    };
    const engine = new AuditEngine({ ...config, ai });
    const audit = await engine.run(snapshot(), now, "a1");
    expect(audit.mode).toBe("deterministic");
    expect(audit.reasons.some((r) => r.includes("failed validation"))).toBe(true);
  });

  it("is reproducible: same input, same output", async () => {
    const engine = new AuditEngine({ ...config, ai: null });
    const a = await engine.run(snapshot(), now, "same");
    const b = await engine.run(snapshot(), now, "same");
    expect(a.calibreProbabilityBp).toBe(b.calibreProbabilityBp);
    expect(a.decision).toBe(b.decision);
    expect(a.guards.map((g) => g.status)).toEqual(b.guards.map((g) => g.status));
  });
});
