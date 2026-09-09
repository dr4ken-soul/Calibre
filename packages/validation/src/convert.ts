/**
 * Conversion helpers between wire (decimal string) and domain (bigint) forms.
 */

import type {
  AuditResult,
  GuardResult,
  MarketSnapshot,
  OrderBook,
  OrderBookLevel,
  Settlement,
  TradeRecord,
  AuditCalibrationRow,
} from "@calibre/domain";
import type {
  AuditResultWire,
  MarketSnapshotWire,
  SettlementWire,
  TradeRecordWire,
} from "./schemas.js";

export function parseOrderBookLevel(level: { price: string; size: string }): OrderBookLevel {
  return {
    priceBp: BigInt(Math.round(Number(level.price) * 10_000)),
    size: BigInt(Math.round(Number(level.size) * 1_000_000)),
  };
}

export function wireSnapshotToDomain(wire: MarketSnapshotWire): MarketSnapshot {
  const orderBook: OrderBook = {
    bids: wire.orderBook.bids.map(parseOrderBookLevel),
    asks: wire.orderBook.asks.map(parseOrderBookLevel),
    observedAt: wire.orderBook.observedAt,
  };
  return {
    marketId: wire.marketId,
    question: wire.question,
    asset: wire.asset,
    strike: wire.strike,
    referencePrice: wire.referencePrice,
    currentPrice: wire.currentPrice,
    lockAt: wire.lockAt,
    expiryAt: wire.expiryAt,
    status: wire.status,
    impliedProbabilityBp: BigInt(Math.round(Number(wire.impliedProbability) * 10_000)),
    momentumBp: BigInt(Math.round(Number(wire.momentumBp) * 10_000)),
    volume24h: wire.volume24h,
    openInterest: wire.openInterest,
    orderBook,
    source: wire.source,
    observedAt: wire.observedAt,
  };
}

export function domainSnapshotToWire(snap: MarketSnapshot): MarketSnapshotWire {
  return {
    marketId: snap.marketId,
    question: snap.question,
    asset: snap.asset,
    strike: snap.strike,
    referencePrice: snap.referencePrice,
    currentPrice: snap.currentPrice,
    lockAt: snap.lockAt,
    expiryAt: snap.expiryAt,
    status: snap.status,
    impliedProbability: (Number(snap.impliedProbabilityBp) / 10_000).toFixed(4),
    momentumBp: (Number(snap.momentumBp) / 10_000).toFixed(4),
    volume24h: snap.volume24h,
    openInterest: snap.openInterest,
    orderBook: {
      bids: snap.orderBook.bids.map((l) => ({
        price: (Number(l.priceBp) / 10_000).toFixed(4),
        size: (Number(l.size) / 1_000_000).toFixed(6),
      })),
      asks: snap.orderBook.asks.map((l) => ({
        price: (Number(l.priceBp) / 10_000).toFixed(4),
        size: (Number(l.size) / 1_000_000).toFixed(6),
      })),
      observedAt: snap.orderBook.observedAt,
    },
    source: snap.source,
    observedAt: snap.observedAt,
  };
}

export function domainAuditToWire(audit: AuditResult): AuditResultWire {
  return {
    auditId: audit.auditId,
    marketId: audit.marketId,
    decision: audit.decision,
    direction: audit.direction,
    marketProbability: (Number(audit.marketProbabilityBp) / 10_000).toFixed(4),
    calibreProbability: (Number(audit.calibreProbabilityBp) / 10_000).toFixed(4),
    edgeBp: (Number(audit.edgeBp) / 10_000).toFixed(4),
    confidence: (Number(audit.confidenceBp) / 10_000).toFixed(4),
    guards: audit.guards,
    evidence: audit.evidence,
    reasons: audit.reasons,
    modelVersion: audit.modelVersion,
    mode: audit.mode,
    source: audit.source,
    createdAt: audit.createdAt,
  };
}

export function wireAuditToDomain(wire: AuditResultWire): AuditResult {
  return {
    auditId: wire.auditId,
    marketId: wire.marketId,
    decision: wire.decision,
    direction: wire.direction,
    marketProbabilityBp: BigInt(Math.round(Number(wire.marketProbability) * 10_000)),
    calibreProbabilityBp: BigInt(Math.round(Number(wire.calibreProbability) * 10_000)),
    edgeBp: BigInt(Math.round(Number(wire.edgeBp) * 10_000)),
    confidenceBp: BigInt(Math.round(Number(wire.confidence) * 10_000)),
    guards: wire.guards as GuardResult[],
    evidence: wire.evidence,
    reasons: wire.reasons,
    modelVersion: wire.modelVersion,
    mode: wire.mode,
    source: wire.source,
    createdAt: wire.createdAt,
  };
}

export function domainSettlementToWire(s: Settlement): SettlementWire {
  return {
    marketId: s.marketId,
    status: s.status,
    outcome: s.outcome,
    closingPrice: s.closingPrice,
    resolvedAt: s.resolvedAt,
    source: s.source,
    observedAt: s.observedAt,
  };
}

export function domainTradeToWire(trade: TradeRecord): TradeRecordWire {
  return {
    tradeId: trade.tradeId,
    auditId: trade.auditId,
    marketId: trade.marketId,
    direction: trade.direction,
    amount: trade.amount,
    maxSlippageBp: (Number(trade.maxSlippageBp) / 10_000).toFixed(4),
    status: trade.status,
    tx: trade.tx,
    executionMode: trade.executionMode,
    txHash: trade.txHash,
    preparedAt: trade.preparedAt,
    submittedAt: trade.submittedAt,
    confirmedAt: trade.confirmedAt,
    failReason: trade.failReason,
    source: trade.source,
  };
}

export function wireTradeToDomain(wire: TradeRecordWire): TradeRecord {
  return {
    tradeId: wire.tradeId,
    auditId: wire.auditId,
    marketId: wire.marketId,
    direction: wire.direction,
    amount: wire.amount,
    maxSlippageBp: BigInt(Math.round(Number(wire.maxSlippageBp) * 10_000)),
    status: wire.status,
    tx: wire.tx,
    executionMode: wire.executionMode,
    txHash: wire.txHash,
    preparedAt: wire.preparedAt,
    submittedAt: wire.submittedAt,
    confirmedAt: wire.confirmedAt,
    failReason: wire.failReason,
    source: wire.source,
  };
}

export function wireSettlementToDomain(wire: SettlementWire): Settlement {
  return {
    marketId: wire.marketId,
    status: wire.status,
    outcome: wire.outcome,
    closingPrice: wire.closingPrice,
    resolvedAt: wire.resolvedAt,
    source: wire.source,
    observedAt: wire.observedAt,
  };
}

export function calibrationRowToWire(row: AuditCalibrationRow): {
  auditId: string;
  marketId: string;
  decision: string;
  direction: string | null;
  calibreProbability: string;
  outcome: string | null;
  settled: boolean;
  outcomeErrorBp: string | null;
  settledAt: number | null;
} {
  return {
    auditId: row.auditId,
    marketId: row.marketId,
    decision: row.decision,
    direction: row.direction,
    calibreProbability: (Number(row.calibreProbabilityBp) / 10_000).toFixed(4),
    outcome: row.outcome,
    settled: row.settled,
    outcomeErrorBp: row.outcomeErrorBp === null ? null : (Number(row.outcomeErrorBp) / 10_000).toFixed(4),
    settledAt: row.settledAt,
  };
}
