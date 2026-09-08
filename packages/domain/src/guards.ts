/**
 * Deterministic guard layer.
 *
 * Guards are the safety boundary between market data and execution. They are
 * pure functions over the market snapshot and audit parameters. They never read
 * the model output and never talk to the network. A critical failure always
 * blocks execution regardless of anything else.
 */

import type { AuditResult, GuardResult, MarketSnapshot } from "./types.js";
import { clampBp, formatFixed, formatProbability } from "./fixed.js";
import { isTradable, lifecycleLabel } from "./lifecycle.js";

export interface GuardThresholds {
  minEdgeBp: bigint;
  minConfidenceBp: bigint;
  maxSlippageBp: bigint;
  minSecondsToExpiry: number;
  staleAfterMs: number;
}

export const DEFAULT_GUARD_THRESHOLDS: GuardThresholds = {
  minEdgeBp: 500n,
  minConfidenceBp: 6500n,
  maxSlippageBp: 200n,
  minSecondsToExpiry: 120,
  staleAfterMs: 90_000,
};

export interface GuardContext {
  snapshot: MarketSnapshot;
  /** Server clock at evaluation time. */
  now: number;
  thresholds: GuardThresholds;
}

function guard(
  id: string,
  label: string,
  status: GuardResult["status"],
  critical: boolean,
  message: string,
): GuardResult {
  return { id, label, status, critical, message };
}

export function evaluateGuards(ctx: GuardContext, audit: AuditResult): GuardResult[] {
  const { snapshot, now, thresholds } = ctx;
  const guards: GuardResult[] = [];

  const ageMs = now - snapshot.observedAt;
  if (ageMs <= thresholds.staleAfterMs) {
    guards.push(guard("data-freshness", "Data freshness", "pass", true,
      `Market data observed ${Math.max(0, Math.round(ageMs / 1000))}s ago, within the ${Math.round(thresholds.staleAfterMs / 1000)}s limit`));
  } else {
    guards.push(guard("data-freshness", "Data freshness", "fail", true,
      `Market data is stale: observed ${Math.round(ageMs / 1000)}s ago, limit is ${Math.round(thresholds.staleAfterMs / 1000)}s`));
  }

  if (isTradable(snapshot.status)) {
    guards.push(guard("lifecycle", "Market lifecycle", "pass", true,
      `Market status is ${lifecycleLabel(snapshot.status)}`));
  } else {
    guards.push(guard("lifecycle", "Market lifecycle", "fail", true,
      `Market status is ${lifecycleLabel(snapshot.status)}, orders require Trading`));
  }

  const secondsToExpiry = Math.max(0, Math.floor((snapshot.expiryAt - now) / 1000));
  if (secondsToExpiry >= thresholds.minSecondsToExpiry) {
    guards.push(guard("time-to-expiry", "Time to expiry", "pass", true,
      `${secondsToExpiry}s remain, minimum is ${thresholds.minSecondsToExpiry}s`));
  } else {
    guards.push(guard("time-to-expiry", "Time to expiry", "fail", true,
      `Only ${secondsToExpiry}s remain, minimum is ${thresholds.minSecondsToExpiry}s`));
  }

  if (audit.edgeBp >= thresholds.minEdgeBp) {
    guards.push(guard("edge", "Edge threshold", audit.edgeBp >= thresholds.minEdgeBp * 2n ? "pass" : "warn",
      false,
      `Edge is ${audit.edgeBp} bp, minimum is ${thresholds.minEdgeBp} bp${audit.edgeBp < thresholds.minEdgeBp * 2n ? " (thin)" : ""}`));
  } else {
    guards.push(guard("edge", "Edge threshold", "fail", false,
      `Edge is ${audit.edgeBp} bp, below the ${thresholds.minEdgeBp} bp minimum`));
  }

  if (audit.confidenceBp >= thresholds.minConfidenceBp) {
    guards.push(guard("confidence", "Model confidence", "pass", false,
      `Model confidence is ${audit.confidenceBp} bp, minimum is ${thresholds.minConfidenceBp} bp`));
  } else {
    guards.push(guard("confidence", "Model confidence", "fail", false,
      `Model confidence is ${audit.confidenceBp} bp, below the ${thresholds.minConfidenceBp} bp minimum`));
  }

  const book = snapshot.orderBook;
  const bestAsk = book.asks.length > 0 ? book.asks[0]!.priceBp : null;
  const bestBid = book.bids.length > 0 ? book.bids[0]!.priceBp : null;
  if (bestAsk === null || bestBid === null) {
    guards.push(guard("liquidity", "Liquidity", "fail", true, "Order book has no liquidity on one side"));
  } else {
    const spread = bestAsk - bestBid;
    if (spread <= thresholds.maxSlippageBp) {
      guards.push(guard("liquidity", "Liquidity", spread > thresholds.maxSlippageBp / 2n ? "warn" : "pass", true,
        `Spread is ${spread} bp, slippage budget is ${thresholds.maxSlippageBp} bp${spread > thresholds.maxSlippageBp / 2n ? " (wide)" : ""}`));
    } else {
      guards.push(guard("liquidity", "Liquidity", "fail", true,
        `Spread is ${spread} bp, above the ${thresholds.maxSlippageBp} bp slippage budget`));
    }
  }

  const hasBook = book.bids.length > 0 || book.asks.length > 0;
  if (hasBook) {
    guards.push(guard("book-available", "Order book", "pass", false, "Order book levels are available"));
  } else {
    guards.push(guard("book-available", "Order book", "fail", false, "No order book levels available"));
  }

  return guards;
}

/** Trade requires: no critical failures and decision is trade. */
export function canExecute(audit: AuditResult): boolean {
  const criticalFail = audit.guards.some((g) => g.critical && g.status === "fail");
  return audit.decision === "trade" && !criticalFail;
}

export function decisionFromGuards(
  hasCriticalFail: boolean,
  edgeBp: bigint,
  confidenceBp: bigint,
  thresholds: GuardThresholds,
): "trade" | "no_trade" {
  if (hasCriticalFail) return "no_trade";
  if (edgeBp < thresholds.minEdgeBp) return "no_trade";
  if (confidenceBp < thresholds.minConfidenceBp) return "no_trade";
  return "trade";
}

export function summarizeGuards(guards: GuardResult[]): string {
  const failed = guards.filter((g) => g.status === "fail");
  const warned = guards.filter((g) => g.status === "warn");
  if (failed.length > 0) {
    return `${failed.length} guard${failed.length === 1 ? "" : "s"} failed: ${failed.map((g) => g.label).join(", ")}`;
  }
  if (warned.length > 0) {
    return `${warned.length} guard${warned.length === 1 ? "" : "s"} warn: ${warned.map((g) => g.label).join(", ")}`;
  }
  return "All guards passed";
}

/** Human readable one-line explanation used in audit reasons. */
export function auditReasonLine(audit: AuditResult): string {
  const market = formatProbability(audit.marketProbabilityBp);
  const calibre = formatProbability(audit.calibreProbabilityBp);
  return `Market implies ${market} for up, Calibre estimates ${formatFixed(audit.calibreProbabilityBp, 0)} bp with edge ${audit.edgeBp} bp (${summarizeGuards(audit.guards)})`;
}
