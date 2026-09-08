/**
 * Independent probability estimate.
 *
 * Builds a deterministic estimate from observable market evidence:
 * order book imbalance, recent momentum, time pressure, and depth quality.
 * The estimate is bounded to 3..97 percent and never sees question text.
 */

import type { EvidenceItem, MarketSnapshot, TradeDirection } from "./types.js";
import { clampBp } from "./fixed.js";

export const ESTIMATE_MODEL_VERSION = "calibre-estimate-v1";

export interface EstimateWeights {
  imbalance: number;
  momentum: number;
  depth: number;
  time: number;
}

export const DEFAULT_WEIGHTS: EstimateWeights = {
  imbalance: 0.45,
  momentum: 0.35,
  depth: 0.12,
  time: 0.08,
};

export interface EstimateResult {
  probabilityBp: bigint;
  confidenceBp: bigint;
  direction: TradeDirection;
  evidence: EvidenceItem[];
}

const ESTIMATE_MIN_BP = 300n;
const ESTIMATE_MAX_BP = 9700n;

/** Sum of sizes across levels, discounted by distance from the mid. */
function weightedDepth(levels: { priceBp: bigint; size: bigint }[], midBp: bigint): bigint {
  let total = 0n;
  for (const level of levels) {
    const distance = level.priceBp > midBp ? level.priceBp - midBp : midBp - level.priceBp;
    total += (level.size * 10_000n) / (10_000n + distance);
  }
  return total;
}

export function estimateProbability(
  snapshot: MarketSnapshot,
  now: number,
  weights: EstimateWeights = DEFAULT_WEIGHTS,
): EstimateResult {
  const evidence: EvidenceItem[] = [];
  const book = snapshot.orderBook;

  const bids = book.bids;
  const asks = book.asks;
  const bestBid = bids.length > 0 ? bids[0]!.priceBp : 0n;
  const bestAsk = asks.length > 0 ? asks[0]!.priceBp : 10_000n;
  const midBp = (bestBid + bestAsk) / 2n;
  const spreadBp = bestAsk > bestBid ? bestAsk - bestBid : 0n;

  const bidDepth = weightedDepth(bids, midBp);
  const askDepth = weightedDepth(asks, midBp);
  const depthTotal = bidDepth + askDepth;
  const imbalance =
    depthTotal === 0n ? 5000n : (bidDepth * 10_000n) / depthTotal;

  const momentum = snapshot.momentumBp;

  const secondsToLock = Math.max(0, Math.floor((snapshot.lockAt - now) / 1000));
  const secondsToExpiry = Math.max(0, Math.floor((snapshot.expiryAt - now) / 1000));
  const lockPressure = Math.min(1, secondsToLock / 3600);
  const expiryPressure = Math.min(1, secondsToExpiry / 7200);

  const midPull = midBp;
  const imbalancePull = 5000n + (imbalance - 5000n) / 2n;
  const momentumPull = clampBp(5000n + momentum / 2n);

  const wI = BigInt(Math.round(weights.imbalance * 100));
  const wM = BigInt(Math.round(weights.momentum * 100));
  const wD = BigInt(Math.round(weights.depth * 100));
  const wT = BigInt(Math.round(weights.time * 100));
  const wSum = wI + wM + wD + wT;

  let blended =
    (midPull * wD + imbalancePull * wI + momentumPull * wM) / wSum;
  // Time pressure nudges toward the live book (mid) rather than the prior.
  blended = (blended * (10_000n - wT) + midPull * wT) / 10_000n;

  const probabilityBp = clampBp(blended, ESTIMATE_MIN_BP, ESTIMATE_MAX_BP);

  // Confidence: wider spread, thin depth, or far expiries lower confidence.
  let confidence = 9000n;
  confidence -= spreadBp * 2n;
  if (depthTotal === 0n) {
    confidence = 0n;
  } else {
    const depthFactor = clampBp((depthTotal * 10_000n) / 1_000_000_000n);
    const depthPenalty = ((10_000n - depthFactor) * 3000n) / 10_000n;
    confidence -= depthPenalty;
  }
  const horizonPenalty = Math.round((1 - Math.min(lockPressure, expiryPressure)) * 2000);
  confidence -= BigInt(horizonPenalty);

  const direction: TradeDirection = probabilityBp >= 5000n ? "up" : "down";

  evidence.push({ id: "best-bid", source: "order-book", value: `${bestBid} bp`, observedAt: book.observedAt });
  evidence.push({ id: "best-ask", source: "order-book", value: `${bestAsk} bp`, observedAt: book.observedAt });
  evidence.push({ id: "spread", source: "order-book", value: `${spreadBp} bp`, observedAt: book.observedAt });
  evidence.push({ id: "book-imbalance", source: "order-book", value: `${imbalance} bp bid share`, observedAt: book.observedAt });
  evidence.push({ id: "momentum", source: "market-snapshot", value: `${snapshot.momentumBp} bp`, observedAt: snapshot.observedAt });
  evidence.push({ id: "volume-24h", source: "market-snapshot", value: `${snapshot.volume24h} shares`, observedAt: snapshot.observedAt });
  evidence.push({ id: "seconds-to-lock", source: "clock", value: `${secondsToLock}s`, observedAt: now });
  evidence.push({ id: "seconds-to-expiry", source: "clock", value: `${secondsToExpiry}s`, observedAt: now });

  return {
    probabilityBp,
    confidenceBp: clampBp(confidence),
    direction,
    evidence,
  };
}
