import { describe, expect, it } from "vitest";
import { FALLBACK_SOURCE, FallbackAdapter, generateSnapshot } from "../src/fallback.js";

const HOUR = 3_600_000;

describe("deterministic fallback feed", () => {
  it("generates stable snapshots for the same market id and time", () => {
    const now = Date.now();
    const a = generateSnapshot("BTC-UP-1", now);
    const b = generateSnapshot("BTC-UP-1", now);
    expect(a).toEqual(b);
  });

  it("always labels itself as deterministic-fallback", () => {
    const snap = generateSnapshot("ETH-DOWN-2", Date.now());
    expect(snap.source).toBe(FALLBACK_SOURCE);
  });

  it("produces valid order books with sane prices", () => {
    const snap = generateSnapshot("BTC-UP-3", Date.now());
    expect(snap.orderBook.bids.length).toBeGreaterThan(0);
    expect(snap.orderBook.asks.length).toBeGreaterThan(0);
    const bestBid = snap.orderBook.bids[0]!.priceBp;
    const bestAsk = snap.orderBook.asks[0]!.priceBp;
    expect(bestBid).toBeLessThan(bestAsk);
    for (let i = 1; i < snap.orderBook.bids.length; i++) {
      expect(snap.orderBook.bids[i]!.priceBp).toBeLessThan(snap.orderBook.bids[i - 1]!.priceBp);
    }
    for (let i = 1; i < snap.orderBook.asks.length; i++) {
      expect(snap.orderBook.asks[i]!.priceBp).toBeGreaterThan(snap.orderBook.asks[i - 1]!.priceBp);
    }
  });

  it("keeps lifecycle timing coherent", () => {
    const snap = generateSnapshot("BTC-UP-4", Date.now());
    expect(snap.lockAt).toBeLessThanOrEqual(snap.expiryAt);
  });

  it("reaches resolved state after expiry plus resolve delay", () => {
    const now = Date.now();
    const bucket = Math.floor(now / HOUR);
    // A market from two buckets ago is always past its resolve delay.
    const old = generateSnapshot(`BTC-UP-${bucket - 2}-1`, now);
    expect(["resolved", "redeemed", "voided"]).toContain(old.status);
  });

  it("returns a settlement only for terminal markets", async () => {
    const adapter = new FallbackAdapter();
    const now = Date.now();
    const bucket = Math.floor(now / HOUR);
    const settled = await adapter.getSettlement(`BTC-UP-${bucket - 2}-1`);
    expect(settled).not.toBeNull();
    if (settled!.status === "resolved" || settled!.status === "redeemed") {
      expect(settled!.outcome === "up" || settled!.outcome === "down").toBe(true);
      expect(settled!.closingPrice).not.toBeNull();
      // Outcome must agree with closing price vs strike.
      const snap = generateSnapshot(`BTC-UP-${bucket - 2}-1`, now);
      const up = Number(settled!.closingPrice) > Number(snap.strike);
      expect(settled!.outcome).toBe(up ? "up" : "down");
    }
    expect(settled!.source).toBe(FALLBACK_SOURCE);
  });

  it("lists markets with filters and pagination", async () => {
    const adapter = new FallbackAdapter();
    const all = await adapter.listMarkets({});
    expect(all.markets.length).toBeGreaterThan(3);
    const btc = await adapter.listMarkets({ asset: "BTC" });
    expect(btc.markets.every((m) => m.asset === "BTC")).toBe(true);
    const limited = await adapter.listMarkets({ limit: 3 });
    expect(limited.markets.length).toBe(3);
    if (limited.nextCursor) {
      const next = await adapter.listMarkets({ limit: 3, cursor: limited.nextCursor });
      expect(next.markets.length).toBeGreaterThan(0);
      expect(next.markets[0]!.marketId).not.toBe(limited.markets[0]!.marketId);
    }
  });

  it("never presents fallback data as live", () => {
    const snap = generateSnapshot("SOM-UP-5", Date.now());
    expect(snap.source.includes("live")).toBe(false);
  });
});
