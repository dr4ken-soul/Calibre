/**
 * Deterministic fallback market feed.
 *
 * Purpose: DreamDEX does not publish a public testnet API or contract addresses
 * yet. To keep the full Calibre loop honest and demonstrable, this module
 * generates stable, seeded market data. The same market ID always produces the
 * same market, order book, and settlement outcome. Timing fields (lockAt,
 * expiryAt) advance with the clock so lifecycle transitions are observable.
 *
 * Honesty contract:
 * - source is always "deterministic-fallback"
 * - settlement outcomes are derived from the seeded strike and a seeded closing
 *   price, not from a claim about the real protocol
 * - this feed is never presented as live data
 */

import type { LifecycleStatus, MarketSnapshot, OrderBookLevel, Settlement, TradeDirection } from "@calibre/domain";
import { statusFromTiming } from "@calibre/domain";
import { rngFromString } from "@calibre/domain";
import type { ListMarketsQuery, ListMarketsResult } from "./types.js";

export const FALLBACK_SOURCE = "deterministic-fallback";
export const FALLBACK_ASSETS = ["BTC", "ETH", "SOM"] as const;

const HOUR_MS = 3_600_000;

interface MarketSeed {
  marketId: string;
  asset: string;
  strike: string;
  referencePrice: string;
  /** Seeded outcome for settlement, fixed per market id. */
  seededOutcome: TradeDirection;
  /** Seeded closing price drift in bp, fixed per market id. */
  seededDriftBp: number;
  /** Anchor epoch ms used to keep lock and expiry stable across calls within a session. */
  anchorAt: number;
  lockOffsetMs: number;
  expiryOffsetMs: number;
  momentumBp: bigint;
  volume24h: string;
  openInterest: string;
  question: string;
}

/** Bucket the current time so the generated schedule is stable for an hour. */
function timeBucketAnchor(now: number): number {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

/**
 * Market ids of the form ASSET-DIR-bucket-index carry their hour bucket.
 * Anchoring to that bucket lets historical ids resolve naturally, so the
 * fallback can show the full lifecycle instead of faking a resolved state.
 */
function anchorFromMarketId(marketId: string, now: number): number {
  const match = /^.*-(\d{6,})-(\d+)$/.exec(marketId);
  if (match) {
    return Number(match[1]) * HOUR_MS;
  }
  return timeBucketAnchor(now);
}

function buildSeed(marketId: string, now: number): MarketSeed {
  const rng = rngFromString(`market:${marketId}`);
  const asset = FALLBACK_ASSETS.find((a) => marketId.startsWith(a)) ?? rng.pick(FALLBACK_ASSETS);
  const basePrice =
    asset === "BTC" ? rng.range(95_000, 105_000) :
    asset === "ETH" ? rng.range(2_800, 3_600) :
    rng.range(0.2, 1.4);
  const strike = basePrice.toFixed(basePrice < 10 ? 4 : 2);
  const referencePrice = (basePrice * rng.range(0.985, 1.015)).toFixed(basePrice < 10 ? 4 : 2);

  const seededDriftBp = Math.round(rng.range(-1_800, 1_800));
  const seededOutcome: TradeDirection = seededDriftBp >= 0 ? "up" : "down";

  const anchorAt = anchorFromMarketId(marketId, now);
  // Markets lock between 10 and 50 minutes from the anchor.
  const lockOffsetMs = Math.round(rng.range(10, 50)) * 60_000;
  const expiryOffsetMs = lockOffsetMs + Math.round(rng.range(5, 20)) * 60_000;

  const momentumBp = BigInt(Math.round(rng.range(-900, 900)));
  const volume24h = Math.round(rng.range(50_000, 2_500_000)).toString();
  const openInterest = Math.round(rng.range(10_000, 900_000)).toString();

  const dir = marketId.includes("DOWN") ? "down" : "up";
  const question = `Will ${asset} close ${dir} on ${strike} by expiry?`;

  return {
    marketId,
    asset,
    strike,
    referencePrice,
    seededOutcome,
    seededDriftBp,
    anchorAt,
    lockOffsetMs,
    expiryOffsetMs,
    momentumBp,
    volume24h,
    openInterest,
    question,
  };
}

function buildOrderBook(seed: MarketSeed, now: number, snapshotAgeMs: number): {
  levels: { bids: OrderBookLevel[]; asks: OrderBookLevel[] };
  observedAt: number;
  impliedProbabilityBp: bigint;
} {
  const rng = rngFromString(`book:${seed.marketId}:${Math.floor(now / 15_000)}`);
  const centerRng = rngFromString(`center:${seed.marketId}:${timeBucketAnchor(now)}`);
  const center = Math.round(centerRng.range(3200, 6800));

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  const bidBias = rng.range(0.9, 1.4);
  const askBias = rng.range(0.9, 1.4);
  for (let i = 0; i < 5; i++) {
    const step = 60 + i * 45 + Math.round(rng.range(0, 30));
    const sizeBase = Math.round(rng.range(30_000, 480_000));
    bids.push({
      priceBp: BigInt(Math.max(50, center - step)),
      size: BigInt(Math.round(sizeBase * bidBias)) * 1_000_000n,
    });
    asks.push({
      priceBp: BigInt(Math.min(9_950, center + step)),
      size: BigInt(Math.round(sizeBase * askBias)) * 1_000_000n,
    });
  }
  const mid = (bids[0]!.priceBp + asks[0]!.priceBp) / 2n;
  return {
    levels: { bids, asks },
    observedAt: now - snapshotAgeMs,
    impliedProbabilityBp: mid,
  };
}

export function generateSnapshot(marketId: string, now: number): MarketSnapshot {
  const seed = buildSeed(marketId, now);
  const rng = rngFromString(`age:${marketId}`);
  const snapshotAgeMs = Math.round(rng.range(1_000, 8_000));
  const book = buildOrderBook(seed, now, snapshotAgeMs);

  const lockAt = seed.anchorAt + seed.lockOffsetMs;
  const expiryAt = seed.anchorAt + seed.expiryOffsetMs;
  const status: LifecycleStatus = statusFromTiming({
    now,
    openAt: seed.anchorAt - HOUR_MS,
    lockAt,
    expiryAt,
    resolveDelayMs: 60_000,
    resolvedAt: now > expiryAt + 60_000 ? expiryAt + 60_000 : null,
  });

  const driftPct = seed.seededDriftBp / 10_000;
  const ref = Number(seed.referencePrice);
  const current = (ref * (1 + driftPct / 4)).toFixed(ref < 10 ? 4 : 2);

  return {
    marketId: seed.marketId,
    question: seed.question,
    asset: seed.asset,
    strike: seed.strike,
    referencePrice: seed.referencePrice,
    currentPrice: current,
    lockAt,
    expiryAt,
    status,
    impliedProbabilityBp: book.impliedProbabilityBp,
    momentumBp: seed.momentumBp,
    volume24h: seed.volume24h,
    openInterest: seed.openInterest,
    orderBook: {
      bids: book.levels.bids,
      asks: book.levels.asks,
      observedAt: book.observedAt,
    },
    source: FALLBACK_SOURCE,
    observedAt: book.observedAt,
  };
}

/** Stable market id list for a given hour bucket, mixing lifecycle stages. */
function marketIdsForBucket(now: number): string[] {
  const bucket = Math.floor(now / HOUR_MS);
  const rng = rngFromString(`list:${bucket}`);
  const count = 8;
  const ids: string[] = [];
  const dirs: ("UP" | "DOWN")[] = ["UP", "DOWN"];
  for (let i = 0; i < count; i++) {
    const asset = rng.pick(FALLBACK_ASSETS);
    const dir = rng.pick(dirs);
    ids.push(`${asset}-${dir}-${bucket}-${i + 1}`);
  }
  // Also include a settled market from the previous bucket for Resolve demo.
  ids.push(`BTC-UP-${bucket - 1}-1`);
  ids.push(`ETH-DOWN-${bucket - 1}-2`);
  return ids;
}

export class FallbackAdapter {
  readonly sourceLabel = FALLBACK_SOURCE;

  async listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult> {
    const now = Date.now();
    const all = marketIdsForBucket(now).map((id) => generateSnapshot(id, now));
    let filtered = all;
    if (query.asset) {
      const asset = query.asset.toUpperCase();
      filtered = filtered.filter((m) => m.asset === asset);
    }
    if (query.status) {
      filtered = filtered.filter((m) => m.status === query.status);
    }
    if (query.expiryBefore !== undefined) {
      filtered = filtered.filter((m) => m.expiryAt <= query.expiryBefore!);
    }
    const limit = query.limit ?? 50;
    let start = 0;
    if (query.cursor) {
      const cursorIndex = filtered.findIndex((m) => m.marketId === query.cursor);
      if (cursorIndex >= 0) start = cursorIndex + 1;
    }
    const page = filtered.slice(start, start + limit);
    const nextCursor = start + limit < filtered.length ? (page.at(-1)?.marketId ?? null) : null;
    return { markets: page, nextCursor };
  }

  async getMarket(marketId: string): Promise<MarketSnapshot | null> {
    return generateSnapshot(marketId, Date.now());
  }

  async getSettlement(marketId: string): Promise<Settlement | null> {
    const now = Date.now();
    const snap = generateSnapshot(marketId, now);
    if (snap.status !== "resolved" && snap.status !== "redeemed" && snap.status !== "voided") {
      return null;
    }
    const rng = rngFromString(`settle:${marketId}`);
    const voided = rng.next() < 0.05;
    if (voided) {
      return {
        marketId,
        status: "voided",
        outcome: null,
        closingPrice: null,
        resolvedAt: snap.expiryAt + 60_000,
        source: FALLBACK_SOURCE,
        observedAt: now,
      };
    }
    const seed = buildSeed(marketId, now);
    const ref = Number(seed.referencePrice);
    const drift = seed.seededDriftBp / 10_000 / 4;
    const closing = (ref * (1 + drift)).toFixed(ref < 10 ? 4 : 2);
    const outcome: TradeDirection = Number(closing) > Number(seed.strike) ? "up" : "down";
    return {
      marketId,
      status: snap.status,
      outcome,
      closingPrice: closing,
      resolvedAt: snap.expiryAt + 60_000,
      source: FALLBACK_SOURCE,
      observedAt: now,
    };
  }
}
