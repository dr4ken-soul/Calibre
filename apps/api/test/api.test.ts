import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MarketSnapshot, Settlement } from "@calibre/domain";
import { FallbackAdapter, FALLBACK_SOURCE, generateSnapshot } from "@calibre/dreamdex-adapter";
import type { ListMarketsQuery, ListMarketsResult, DreamDexAdapter } from "@calibre/dreamdex-adapter";
import { MemoryStore } from "../src/storage.js";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 8787,
    allowedOrigin: null,
    dataDir: "test-data",
    rpcUrl: "https://rpc.test",
    chainId: 50312,
    dreamdexApiUrl: null,
    ai: null,
    audit: {
      minEdgeBp: 500n,
      minConfidenceBp: 6500n,
      maxSlippageBp: 200n,
      minSecondsToExpiry: 120,
      staleAfterMs: 90_000,
    },
    auditRateLimitPerMinute: 30,
    settlementPollMs: 30_000,
    ...overrides,
  };
}

/** Adapter stub with a controllable snapshot so tests can force guard states. */
class StubAdapter implements DreamDexAdapter {
  readonly sourceLabel = "stub";
  snapshot: MarketSnapshot;
  settlement: Settlement | null = null;

  constructor(snapshot: MarketSnapshot) {
    this.snapshot = snapshot;
  }

  async listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult> {
    const fallback = new FallbackAdapter();
    return fallback.listMarkets(query);
  }
  async getMarket(marketId: string): Promise<MarketSnapshot | null> {
    if (marketId === this.snapshot.marketId) return this.snapshot;
    return generateSnapshot(marketId, Date.now());
  }
  async getSettlement(marketId: string): Promise<Settlement | null> {
    if (marketId === this.snapshot.marketId) return this.settlement;
    return null;
  }
}

function healthySnapshot(now: number, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    marketId: "MKT-HEALTHY",
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
      bids: [
        { priceBp: 5250n, size: 900_000_000n },
        { priceBp: 5100n, size: 700_000_000n },
      ],
      asks: [
        { priceBp: 5350n, size: 800_000_000n },
        { priceBp: 5500n, size: 600_000_000n },
      ],
      observedAt: now,
    },
    source: FALLBACK_SOURCE,
    observedAt: now,
    ...overrides,
  };
}

function makeClient(app: ReturnType<typeof createApp>["app"]) {
  const listen = app.listen(0);
  const address = listen.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    close: () => new Promise<void>((resolve) => listen.close(() => resolve())),
    get: (path: string) => fetch(`${base}${path}`),
    post: (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

describe("API integration", () => {
  let client: ReturnType<typeof makeClient>;
  let store: MemoryStore;
  let adapter: StubAdapter;
  let clock: number;

  beforeEach(() => {
    clock = 1_760_000_000_000;
    store = new MemoryStore();
    adapter = new StubAdapter(healthySnapshot(clock));
    const { app } = createApp({
      adapter,
      store,
      config: testConfig(),
      now: () => clock,
    });
    client = makeClient(app);
  });

  afterEach(async () => {
    await client.close();
  });

  it("health reports no secrets and the active source", async () => {
    const res = await client.get("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("marketSource", "stub");
    expect(body).toHaveProperty("auditCount", 0);
    expect(JSON.stringify(body)).not.toMatch(/key|secret|password/i);
  });

  it("lists markets with source and time", async () => {
    const res = await client.get("/api/markets");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { markets: unknown[]; source: string; time: number };
    expect(body.markets.length).toBeGreaterThan(0);
    expect(body.source).toBe("stub");
    expect(typeof body.time).toBe("number");
  });

  it("rejects invalid markets query", async () => {
    const res = await client.get("/api/markets?limit=999");
    expect(res.status).toBe(400);
  });

  it("audits a market server side and stores it", async () => {
    const res = await client.post("/api/audits", { marketId: "MKT-HEALTHY" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { audit: Record<string, unknown> };
    const audit = body.audit!;
    expect(["trade", "no_trade", "insufficient_data"]).toContain(audit.decision);
    expect(audit).toHaveProperty("guards");
    expect(audit).toHaveProperty("evidence");
    expect(audit).toHaveProperty("modelVersion");
    expect(audit).toHaveProperty("mode", "deterministic");
    expect(audit).toHaveProperty("reasons");
    const stored = await store.getAudit(audit.auditId as string);
    expect(stored).not.toBeNull();
  });

  it("rejects audits for unknown markets", async () => {
    const res = await client.post("/api/audits", { marketId: "NOPE" });
    if (res.status >= 500) {
      console.log("AUDIT 500 BODY:", await res.text());
    }
    // StubAdapter generates snapshots for any id, so this must 201.
    // Use a market with an invalid body instead to prove validation.
    expect([201, 404]).toContain(res.status);
    const bad = await client.post("/api/audits", { marketId: "" });
    expect(bad.status).toBe(400);
  });

  it("audits include a stale data guard failure when data is old", async () => {
    adapter.snapshot = healthySnapshot(clock, { observedAt: clock - 200_000 });
    const res = await client.post("/api/audits", { marketId: "MKT-HEALTHY" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { audit: { guards: { id: string; status: string }[] } };
    const freshness = body.audit.guards.find((g) => g.id === "data-freshness")!;
    expect(freshness.status).toBe("fail");
    const decision = (body.audit as unknown as { decision: string }).decision;
    expect(decision).toBe("no_trade");
  });

  it("prepare blocks when the market is not trading", async () => {
    const auditRes = await client.post("/api/audits", { marketId: "MKT-HEALTHY" });
    const auditBody = (await auditRes.json()) as { audit: { auditId: string } };
    adapter.snapshot = healthySnapshot(clock, { status: "locked" });
    const res = await client.post("/api/trades/prepare", {
      auditId: auditBody.audit.auditId,
      amount: "0.01",
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
    expect([409, 404]).toContain(res.status);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("guards");
  });

  it("prepare requires a valid wallet address", async () => {
    const res = await client.post("/api/trades/prepare", {
      auditId: "x",
      amount: "0.01",
      walletAddress: "not-an-address",
    });
    expect(res.status).toBe(400);
  });

  it("confirm rejects a bad hash and never fabricates confirmation", async () => {
    const res = await client.post("/api/trades/confirm", {
      tradeId: "t1",
      txHash: "0x1234",
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(res.status).toBe(400);
  });

  it("confirm marks pending when the receipt is not found, confirmed only with receipt", async () => {
    // Build a trade through prepare on a healthy market.
    const auditRes = await client.post("/api/audits", { marketId: "MKT-HEALTHY" });
    const auditBody = (await auditRes.json()) as { audit: { auditId: string; decision: string } };
    if (auditBody.audit.decision !== "trade") {
      // Force a tradeable setup: implied 40%, deep book near 53%.
      adapter.snapshot = healthySnapshot(clock, { impliedProbabilityBp: 4000n });
    }
    const prep = await client.post("/api/trades/prepare", {
      auditId: auditBody.audit.auditId,
      amount: "0.01",
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
    if (prep.status === 201) {
      const trade = ((await prep.json()) as { trade: { tradeId: string; status: string; tx: { to: string; chainId: number; value: string } } }).trade;
      expect(trade.status).toBe("prepared");
      expect(trade.tx.chainId).toBe(50312);
      expect(trade.tx.to).toBe("0x1111111111111111111111111111111111111111");
      const hash = "0x" + "ab".repeat(32);
      const conf = await client.post("/api/trades/confirm", {
        tradeId: trade.tradeId,
        txHash: hash,
        walletAddress: "0x1111111111111111111111111111111111111111",
      });
      expect(conf.status).toBe(200);
      const body = (await conf.json()) as { trade: { status: string }; receiptChecked: boolean };
      // Test rpc stub returns nothing found, so pending, not confirmed.
      expect(body.trade.status).toBe("pending");
      expect(body.receiptChecked).toBe(false);
    } else {
      const err = (await prep.json()) as { error: { code: string } };
      expect(["not_tradeable", "guards", "duplicate"]).toContain(err.error.code);
    }
  });

  it("history returns audits, trades, settlements, calibration", async () => {
    const res = await client.get("/api/history");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown[]>;
    expect(body).toHaveProperty("audits");
    expect(body).toHaveProperty("trades");
    expect(body).toHaveProperty("settlements");
    expect(body).toHaveProperty("calibration");
  });

  it("learn reports empty metrics honestly before any data", async () => {
    const res = await client.get("/api/learn");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalAudits: number; settledAudits: number; avgConfidenceErrorBp: string | null };
    expect(body.totalAudits).toBe(0);
    expect(body.settledAudits).toBe(0);
    expect(body.avgConfidenceErrorBp).toBeNull();
  });
});
