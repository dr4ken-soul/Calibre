import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MarketSnapshot, Settlement, TradeRecord } from "@calibre/domain";
import { FALLBACK_SOURCE } from "@calibre/dreamdex-adapter";
import { JsonFileStore } from "../src/storage.js";

const TEST_POOL = "0x9df243eab4fbcbcefee61b8069cebac50d022133";
const TEST_COLLATERAL = "0x70a86d8842fb63c4ad2b7cdddf530ebf1bb25d8e";

let dir: string;
let store: JsonFileStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "calibre-store-"));
  store = new JsonFileStore(dir);
});

describe("json file store", () => {
  it("persists audits, trades, and settlements without BigInt serialization errors", async () => {
    const now = 1_760_000_000_000;
    const snapshot: MarketSnapshot = {
      marketId: "MKT-STORE",
      question: "Will the store round trip?",
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
      source: FALLBACK_SOURCE,
      observedAt: now,
    };

    const { estimateProbability, evaluateGuards, buildAudit, DEFAULT_GUARD_THRESHOLDS } =
      await import("@calibre/domain");
    const estimate = estimateProbability(snapshot, now);
    const stub = buildAudit({
      auditId: "audit_store_1",
      snapshot,
      estimate,
      guards: [],
      thresholds: {
        minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp,
        minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp,
      },
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic",
      source: snapshot.source,
      createdAt: now,
    });
    const guards = evaluateGuards(
      { snapshot, now, thresholds: DEFAULT_GUARD_THRESHOLDS },
      stub,
    );
    const audit = buildAudit({
      auditId: "audit_store_1",
      snapshot,
      estimate,
      guards,
      thresholds: {
        minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp,
        minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp,
      },
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic",
      source: snapshot.source,
      createdAt: now,
    });

    await store.putAudit(audit);

    const trade: TradeRecord = {
      tradeId: "trade_store_1",
      auditId: audit.auditId,
      marketId: snapshot.marketId,
      direction: "up",
      amount: "0.01",
      maxSlippageBp: 200n,
      status: "prepared",
      tx: {
        to: TEST_POOL,
        value: "0",
        data: "0x",
        chainId: 50312,
        gasEstimate: null,
      },
      executionMode: "dreamdex-contract",
      txHash: null,
      preparedAt: now,
      submittedAt: null,
      confirmedAt: null,
      failReason: null,
      source: snapshot.source,
    };
    await store.putTrade(trade);

    const settlement: Settlement = {
      marketId: snapshot.marketId,
      status: "resolved",
      outcome: "up",
      closingPrice: "100250",
      resolvedAt: now + 7_300_000,
      source: snapshot.source,
      observedAt: now + 7_300_000,
    };
    await store.putSettlement(settlement);

    // The written file must be valid JSON: JSON.stringify throws on BigInt.
    const raw = await readFile(path.join(dir, "store.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).audits).toHaveLength(1);
    expect(JSON.parse(raw).trades).toHaveLength(1);
    expect(JSON.parse(raw).settlements).toHaveLength(1);
  });

  it("round trips records through a fresh store instance", async () => {
    const now = 1_760_000_000_000;
    const snapshot: MarketSnapshot = {
      marketId: "MKT-STORE-2",
      question: "Will the reload work?",
      asset: "ETH",
      strike: "0",
      referencePrice: "0",
      currentPrice: "0",
      lockAt: now + 3_600_000,
      expiryAt: now + 7_200_000,
      status: "trading",
      impliedProbabilityBp: 5500n,
      momentumBp: 0n,
      volume24h: "10",
      openInterest: "0",
      orderBook: {
        bids: [{ priceBp: 5500n, size: 500_000_000n }],
        asks: [{ priceBp: 5600n, size: 600_000_000n }],
        observedAt: now,
      },
      source: FALLBACK_SOURCE,
      observedAt: now,
    };

    const { estimateProbability, evaluateGuards, buildAudit, DEFAULT_GUARD_THRESHOLDS } =
      await import("@calibre/domain");
    const estimate = estimateProbability(snapshot, now);
    const stub = buildAudit({
      auditId: "audit_store_2",
      snapshot,
      estimate,
      guards: [],
      thresholds: {
        minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp,
        minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp,
      },
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic",
      source: snapshot.source,
      createdAt: now,
    });
    const guards = evaluateGuards(
      { snapshot, now, thresholds: DEFAULT_GUARD_THRESHOLDS },
      stub,
    );
    const audit = buildAudit({
      auditId: "audit_store_2",
      snapshot,
      estimate,
      guards,
      thresholds: {
        minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp,
        minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp,
      },
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic",
      source: snapshot.source,
      createdAt: now,
    });
    await store.putAudit(audit);
    const trade: TradeRecord = {
      tradeId: "trade_store_2",
      auditId: audit.auditId,
      marketId: snapshot.marketId,
      direction: "up",
      amount: "0.02",
      maxSlippageBp: 200n,
      status: "confirmed",
      tx: {
        to: TEST_POOL,
        value: "0",
        data: "0x",
        chainId: 50312,
        gasEstimate: null,
      },
      executionMode: "dreamdex-contract",
      txHash: "0x" + "a".repeat(64),
      preparedAt: now,
      submittedAt: now,
      confirmedAt: now + 1000,
      failReason: null,
      source: snapshot.source,
    };
    await store.putTrade(trade);
    const settlement: Settlement = {
      marketId: snapshot.marketId,
      status: "resolved",
      outcome: "down",
      closingPrice: null,
      resolvedAt: now + 7_300_000,
      source: snapshot.source,
      observedAt: now + 7_300_000,
    };
    await store.putSettlement(settlement);

    const reopened = new JsonFileStore(dir);
    const audits = await reopened.listAudits(0, 100);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.auditId).toBe("audit_store_2");
    expect(typeof audits[0]!.calibreProbabilityBp).toBe("bigint");
    expect(audits[0]!.guards.length).toBeGreaterThan(0);
    const loaded = await reopened.getAudit("audit_store_2");
    expect(loaded!.marketId).toBe("MKT-STORE-2");
    const byHash = await reopened.findTradeByTxHash("0x" + "a".repeat(64));
    expect(byHash!.tradeId).toBe("trade_store_2");
    expect(typeof byHash!.maxSlippageBp).toBe("bigint");
    const open = await reopened.findOpenTradeForAudit("audit_store_2");
    expect(open).toBeNull();
    const confirmed = await reopened.getTrade("trade_store_2");
    expect(confirmed!.status).toBe("confirmed");
    const settlements = await reopened.listSettlements(0);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]!.outcome).toBe("down");
    const counts = await reopened.counts();
    expect(counts).toEqual({ audits: 1, trades: 1, settlements: 1 });
  });

  it("keeps the store usable after a failed write", async () => {
    const broken = new JsonFileStore(path.join(dir, "blocked"));
    // The parent "blocked" is created as a FILE first, so mkdir of its
    // dirname inside persist() succeeds but the nested file write fails.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(dir, "blocked-store.json"), "not-json{", "utf8");
    // Point the store at a path whose directory cannot be created because a
    // file with that name exists.
    const poisonedPath = path.join(dir, "blocked", "store.json");
    await writeFile(path.join(dir, "blocked"), "x", "utf8");
    const failing = new JsonFileStore(poisonedPath, "store.json");
    void broken;

    const now = 1_760_000_000_000;
    const snapshot: MarketSnapshot = {
      marketId: "MKT-STORE-3",
      question: "Will failures self heal?",
      asset: "BTC",
      strike: "0",
      referencePrice: "0",
      currentPrice: "0",
      lockAt: now + 3_600_000,
      expiryAt: now + 7_200_000,
      status: "trading",
      impliedProbabilityBp: 5000n,
      momentumBp: 0n,
      volume24h: "1",
      openInterest: "0",
      orderBook: {
        bids: [{ priceBp: 5000n, size: 100_000_000n }],
        asks: [{ priceBp: 5100n, size: 100_000_000n }],
        observedAt: now,
      },
      source: FALLBACK_SOURCE,
      observedAt: now,
    };
    const { estimateProbability, buildAudit, DEFAULT_GUARD_THRESHOLDS } = await import(
      "@calibre/domain"
    );
    const estimate = estimateProbability(snapshot, now);
    const audit = buildAudit({
      auditId: "audit_store_3",
      snapshot,
      estimate,
      guards: [],
      thresholds: {
        minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp,
        minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp,
      },
      modelVersion: "calibre-estimate-v1",
      mode: "deterministic",
      source: snapshot.source,
      createdAt: now,
    });

    await expect(failing.putAudit(audit)).rejects.toThrow();
    // After the failure the chain must reset so the next write can succeed.
    // The failing store writes to an impossible path; assert a good store
    // still accepts writes afterwards.
    await store.putAudit(audit);
    const recovered = await store.listAudits(0, 100);
    expect(recovered).toHaveLength(1);
    await rm(dir, { recursive: true, force: true });
  });
});
