import type {
  AuditResult,
  GuardResult,
  MarketSnapshot,
  Settlement,
  TradeDirection,
} from "./types.js";
import { BPS, clampBp } from "./fixed.js";

export const DECISION_MODEL_VERSION = "calibre-decision-v1";

/**
 * Combine an independent estimate with the market implied probability into a
 * validated audit result. Guards are evaluated separately by the guard layer;
 * this function derives the decision from guard outcomes only.
 */
export function buildAudit(args: {
  auditId: string;
  snapshot: MarketSnapshot;
  estimate: { probabilityBp: bigint; confidenceBp: bigint; direction: TradeDirection; evidence: EvidenceLike[] };
  guards: GuardResult[];
  thresholds: { minEdgeBp: bigint; minConfidenceBp: bigint };
  modelVersion: string;
  mode: "deterministic" | "model-assisted";
  source: string;
  createdAt: number;
}): AuditResult {
  const { auditId, snapshot, estimate, guards, thresholds, modelVersion, mode, source, createdAt } = args;

  const marketProbabilityBp = clampBp(snapshot.impliedProbabilityBp);
  const calibreProbabilityBp = clampBp(estimate.probabilityBp);
  const rawEdge = calibreProbabilityBp > marketProbabilityBp
    ? calibreProbabilityBp - marketProbabilityBp
    : marketProbabilityBp - calibreProbabilityBp;
  const edgeBp = clampBp(rawEdge);
  const confidenceBp = clampBp(estimate.confidenceBp);

  const criticalFail = guards.some((g) => g.critical && g.status === "fail");
  let decision: AuditResult["decision"];
  let direction: TradeDirection | null = null;

  if (estimate.confidenceBp < 2000n) {
    decision = "insufficient_data";
  } else if (criticalFail) {
    decision = "no_trade";
  } else if (edgeBp < thresholds.minEdgeBp || confidenceBp < thresholds.minConfidenceBp) {
    decision = "no_trade";
  } else {
    decision = "trade";
    direction = estimate.direction;
  }

  const reasons: string[] = [];
  reasons.push(`Market implies ${marketProbabilityBp} bp for up, Calibre estimates ${calibreProbabilityBp} bp`);
  if (decision === "trade") {
    reasons.push(`Edge ${edgeBp} bp clears the ${thresholds.minEdgeBp} bp minimum and confidence clears the floor, direction ${direction}`);
  } else if (decision === "no_trade") {
    const failed = guards.filter((g) => g.status === "fail");
    if (failed.length > 0) {
      reasons.push(`Blocked by guards: ${failed.map((g) => g.label).join(", ")}`);
    } else {
      reasons.push(`Edge or confidence below thresholds, no execution`);
    }
  } else {
    reasons.push("Estimate confidence too low to produce a usable probability, treat as insufficient data");
  }

  return {
    auditId,
    marketId: snapshot.marketId,
    decision,
    direction: decision === "trade" ? direction : null,
    marketProbabilityBp,
    calibreProbabilityBp,
    edgeBp,
    confidenceBp,
    guards,
    evidence: args.estimate.evidence,
    reasons,
    modelVersion,
    mode,
    source,
    createdAt,
  };
}

interface EvidenceLike {
  id: string;
  source: string;
  value: string;
  observedAt: number;
}

/** True when the estimated probability agrees with the eventual outcome direction. */
export function predictionMatchesOutcome(estimateBp: bigint, outcome: TradeDirection | null): boolean {
  if (outcome === null) return false;
  const expected: TradeDirection = estimateBp >= 5000n ? "up" : "down";
  return expected === outcome;
}

/** Absolute calibration error in bp: |p_estimated - p_outcome| where outcome is 0 or 10000 bp. */
export function outcomeErrorBp(estimateBp: bigint, outcome: TradeDirection | null): bigint | null {
  if (outcome === null) return null;
  const realized = outcome === "up" ? BPS : 0n;
  const diff = estimateBp > realized ? estimateBp - realized : realized - estimateBp;
  return clampBp(diff);
}

export function settlementToCalibrationRow(
  audit: AuditResult,
  settlement: Settlement,
): { settled: boolean; outcome: TradeDirection | null; errorBp: bigint | null } {
  const settled = settlement.status === "resolved" || settlement.status === "redeemed";
  const outcome = settled ? settlement.outcome : null;
  return {
    settled,
    outcome,
    errorBp: outcomeErrorBp(audit.calibreProbabilityBp, outcome),
  };
}
