/**
 * Core domain types for Calibre.
 *
 * Conventions:
 * - Probabilities are basis points (bp): 10000n means 1.0, 5230n means 0.5230.
 * - Prices and amounts are fixed-point bigints with PRICE_DECIMALS decimals.
 * - Every observation carries an observedAt epoch-milliseconds timestamp.
 * - Market ID is the durable identity. Question text is display only.
 */

export type LifecycleStatus =
  | "listed"
  | "trading"
  | "locked"
  | "resolved"
  | "redeemed"
  | "voided";

export type TradeDirection = "up" | "down";

export interface OrderBookLevel {
  /** Implied probability price in basis points, 0..10000. */
  priceBp: bigint;
  /** Size in shares, fixed point with PRICE_DECIMALS decimals. */
  size: bigint;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  observedAt: number;
}

export interface MarketSnapshot {
  marketId: string;
  question: string;
  asset: string;
  /** Decimal string of the strike price, bigint safe. */
  strike: string;
  /** Decimal string of the reference price at market open. */
  referencePrice: string;
  /** Decimal string of the latest observed underlying price. */
  currentPrice: string;
  /** Epoch ms when trading locks. */
  lockAt: number;
  /** Epoch ms when the market expires. */
  expiryAt: number;
  status: LifecycleStatus;
  /** Market implied probability of the up outcome, in basis points. */
  impliedProbabilityBp: bigint;
  /** Price change of the underlying since open, in basis points, may be negative. */
  momentumBp: bigint;
  /** 24h traded volume in shares, decimal string. */
  volume24h: string;
  /** Open interest in shares, decimal string. */
  openInterest: string;
  orderBook: OrderBook;
  /** Where this snapshot came from, for example deterministic-fallback. */
  source: string;
  observedAt: number;
}

export interface Settlement {
  marketId: string;
  status: LifecycleStatus;
  /** Resolved direction of the contract. Null when voided or unresolved. */
  outcome: TradeDirection | null;
  /** Decimal string of the closing price, null when unresolved or voided. */
  closingPrice: string | null;
  resolvedAt: number | null;
  source: string;
  observedAt: number;
}

export interface EvidenceItem {
  id: string;
  source: string;
  value: string;
  observedAt: number;
}

export type GuardStatus = "pass" | "warn" | "fail";

export interface GuardResult {
  id: string;
  label: string;
  status: GuardStatus;
  /** A critical failure always blocks execution. */
  critical: boolean;
  message: string;
}

export type AuditDecision = "trade" | "no_trade" | "insufficient_data";
export type AuditMode = "deterministic" | "model-assisted";

export interface AuditResult {
  auditId: string;
  marketId: string;
  decision: AuditDecision;
  direction: TradeDirection | null;
  marketProbabilityBp: bigint;
  calibreProbabilityBp: bigint;
  /** Absolute edge in basis points. */
  edgeBp: bigint;
  /** Model confidence in basis points, 0..10000. */
  confidenceBp: bigint;
  guards: GuardResult[];
  evidence: EvidenceItem[];
  reasons: string[];
  modelVersion: string;
  mode: AuditMode;
  /** Market data source used for the audit. */
  source: string;
  createdAt: number;
}

export type TradeStatus = "prepared" | "pending" | "confirmed" | "failed";

export type ExecutionMode = "self-transfer-demo" | "dreamdex-contract";

export interface PreparedTransaction {
  to: string;
  /** Decimal string value in STT, bigint safe. */
  value: string;
  /** Hex encoded calldata, "0x" when empty. */
  data: string;
  chainId: number;
  gasEstimate: string | null;
}

export interface TradeRecord {
  tradeId: string;
  auditId: string;
  marketId: string;
  direction: TradeDirection;
  /** Decimal string amount in STT. */
  amount: string;
  maxSlippageBp: bigint;
  status: TradeStatus;
  tx: PreparedTransaction;
  executionMode: ExecutionMode;
  txHash: string | null;
  preparedAt: number;
  submittedAt: number | null;
  confirmedAt: number | null;
  failReason: string | null;
  source: string;
}

export interface AuditCalibrationRow {
  auditId: string;
  marketId: string;
  decision: AuditDecision;
  direction: TradeDirection | null;
  calibreProbabilityBp: bigint;
  outcome: TradeDirection | null;
  settled: boolean;
  /** Absolute error between predicted probability and realized outcome, in bp. */
  outcomeErrorBp: bigint | null;
  settledAt: number | null;
}

export interface SystemEvent {
  id: string;
  kind: string;
  message: string;
  at: number;
  level: "info" | "warn" | "error";
}
