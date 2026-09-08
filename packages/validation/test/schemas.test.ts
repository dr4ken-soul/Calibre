import { describe, expect, it } from "vitest";
import {
  auditRequestSchema,
  marketSnapshotSchema,
  modelAdjustmentSchema,
  tradeConfirmRequestSchema,
  tradePrepareRequestSchema,
} from "../src/schemas.js";
import { domainAuditToWire, wireAuditToDomain } from "../src/convert.js";

const validSnapshot = {
  marketId: "MKT-1",
  question: "Will BTC close above 100000?",
  asset: "BTC",
  strike: "100000",
  referencePrice: "99000",
  currentPrice: "100500",
  lockAt: 1_760_000_000_000,
  expiryAt: 1_760_003_600_000,
  status: "trading",
  impliedProbability: "0.5500",
  momentumBp: "0.0300",
  volume24h: "123456",
  openInterest: "45678",
  orderBook: {
    bids: [{ price: "0.5200", size: "12.500000" }],
    asks: [{ price: "0.5600", size: "8.250000" }],
    observedAt: 1_760_000_000_000,
  },
  source: "deterministic-fallback",
  observedAt: 1_760_000_000_000,
};

describe("schemas", () => {
  it("accepts a valid market snapshot", () => {
    expect(() => marketSnapshotSchema.parse(validSnapshot)).not.toThrow();
  });

  it("rejects an unknown lifecycle status", () => {
    expect(() =>
      marketSnapshotSchema.parse({ ...validSnapshot, status: "weird" }),
    ).toThrow();
  });

  it("rejects negative amounts", () => {
    expect(() =>
      marketSnapshotSchema.parse({ ...validSnapshot, volume24h: "-1" }),
    ).toThrow();
  });

  it("rejects non-decimal price strings", () => {
    expect(() =>
      marketSnapshotSchema.parse({
        ...validSnapshot,
        orderBook: { ...validSnapshot.orderBook, bids: [{ price: "abc", size: "1" }] },
      }),
    ).toThrow();
  });

  it("audit request accepts only a market id", () => {
    expect(auditRequestSchema.parse({ marketId: "MKT-1" })).toEqual({ marketId: "MKT-1" });
    expect(() => auditRequestSchema.parse({ marketId: "" })).toThrow();
    expect(() => auditRequestSchema.parse({ marketId: "MKT-1", extra: 1 })).toThrow();
  });

  it("trade prepare validates the amount as a non-negative decimal", () => {
    const walletAddress = "0x" + "11".repeat(20);
    expect(() =>
      tradePrepareRequestSchema.parse({ auditId: "a1", amount: "0.5", walletAddress }),
    ).not.toThrow();
    expect(() =>
      tradePrepareRequestSchema.parse({ auditId: "a1", amount: "-0.5", walletAddress }),
    ).toThrow();
    expect(() =>
      tradePrepareRequestSchema.parse({ auditId: "a1", amount: "abc", walletAddress }),
    ).toThrow();
    expect(() =>
      tradePrepareRequestSchema.parse({ auditId: "a1", amount: "0.5", walletAddress: "0x1234" }),
    ).toThrow();
  });

  it("trade confirm requires a 32 byte hex hash", () => {
    const good = "0x" + "ab".repeat(32);
    const walletAddress = "0x" + "11".repeat(20);
    expect(() =>
      tradeConfirmRequestSchema.parse({ tradeId: "t1", txHash: good, walletAddress }),
    ).not.toThrow();
    expect(() =>
      tradeConfirmRequestSchema.parse({ tradeId: "t1", txHash: "0x1234", walletAddress }),
    ).toThrow();
    expect(() =>
      tradeConfirmRequestSchema.parse({ tradeId: "t1", txHash: "xyz", walletAddress }),
    ).toThrow();
    expect(() =>
      tradeConfirmRequestSchema.parse({ tradeId: "t1", txHash: good, walletAddress: "0x1234" }),
    ).toThrow();
  });

  it("model adjustment is bounded and must include reasoning", () => {
    expect(modelAdjustmentSchema.parse({ adjustedProbability: 0.62, reasoning: "book tilted up" })).toBeTruthy();
    expect(() => modelAdjustmentSchema.parse({ adjustedProbability: 1.5, reasoning: "x" })).toThrow();
    expect(() => modelAdjustmentSchema.parse({ adjustedProbability: 0.5 })).toThrow();
  });
});

describe("wire conversions", () => {
  it("round trips an audit through wire and back without losing meaning", () => {
    const domainAudit = {
      auditId: "a1",
      marketId: "MKT-1",
      decision: "trade" as const,
      direction: "up" as const,
      marketProbabilityBp: 5500n,
      calibreProbabilityBp: 6234n,
      edgeBp: 734n,
      confidenceBp: 7100n,
      guards: [],
      evidence: [],
      reasons: ["edge clears threshold"],
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic" as const,
      source: "deterministic-fallback",
      createdAt: 1_760_000_000_000,
    };
    const wire = domainAuditToWire(domainAudit);
    expect(wire.marketProbability).toBe("0.5500");
    expect(wire.calibreProbability).toBe("0.6234");
    const back = wireAuditToDomain(wire);
    expect(back.marketProbabilityBp).toBe(5500n);
    expect(back.calibreProbabilityBp).toBe(6234n);
    expect(back.edgeBp).toBe(734n);
    expect(back.decision).toBe("trade");
  });
});
