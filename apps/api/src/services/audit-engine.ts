/**
 * Audit engine.
 *
 * Deterministic baseline: the domain estimate from order book evidence. When an
 * AI provider is configured, the model may adjust the estimate within a bounded
 * range. Any model failure, schema violation, or out-of-range value falls back
 * to the deterministic result. The mode and model version are always recorded.
 */

import {
  buildAudit,
  estimateProbability,
  evaluateGuards,
  ESTIMATE_MODEL_VERSION,
  type AuditResult,
  type MarketSnapshot,
} from "@calibre/domain";
import { modelAdjustmentSchema, MODEL_MAX_ADJUSTMENT_BP } from "@calibre/validation";
import { clampBp } from "@calibre/domain";

export interface AiProvider {
  readonly providerLabel: string;
  readonly modelLabel: string;
  /** Returns a raw model response. Throwing is allowed and falls back. */
  adjust(input: {
    marketProbabilityBp: bigint;
    baselineProbabilityBp: bigint;
    evidence: { id: string; value: string }[];
    context: {
      asset: string;
      secondsToExpiry: number;
      spreadBp: bigint;
      momentumBp: bigint;
    };
  }): Promise<unknown>;
}

export interface AuditEngineConfig {
  minEdgeBp: bigint;
  minConfidenceBp: bigint;
  maxSlippageBp: bigint;
  minSecondsToExpiry: number;
  staleAfterMs: number;
  ai?: AiProvider | null;
}

export class AuditEngine {
  constructor(private readonly config: AuditEngineConfig) {}

  get modelVersion(): string {
    return this.config.ai
      ? `${ESTIMATE_MODEL_VERSION}+${this.config.ai.providerLabel}:${this.config.ai.modelLabel}`
      : ESTIMATE_MODEL_VERSION;
  }

  async run(
    snapshot: MarketSnapshot,
    now: number,
    auditId: string,
  ): Promise<AuditResult> {
    const baseline = estimateProbability(snapshot, now);

    let probabilityBp = baseline.probabilityBp;
    let mode: AuditResult["mode"] = "deterministic";
    let modelNote: string | null = null;

    const ai = this.config.ai;
    if (ai) {
      const bestBid = snapshot.orderBook.bids[0]?.priceBp ?? 0n;
      const bestAsk = snapshot.orderBook.asks[0]?.priceBp ?? 10_000n;
      try {
        const raw = await ai.adjust({
          marketProbabilityBp: snapshot.impliedProbabilityBp,
          baselineProbabilityBp: baseline.probabilityBp,
          evidence: baseline.evidence.map((e) => ({ id: e.id, value: e.value })),
          context: {
            asset: snapshot.asset,
            secondsToExpiry: Math.max(0, Math.floor((snapshot.expiryAt - now) / 1000)),
            spreadBp: bestAsk - bestBid,
            momentumBp: snapshot.momentumBp,
          },
        });
        const parsed = modelAdjustmentSchema.parse(raw);
        const adjusted = BigInt(Math.round(parsed.adjustedProbability * 10_000));
        const diff = adjusted > baseline.probabilityBp
          ? adjusted - baseline.probabilityBp
          : baseline.probabilityBp - adjusted;
        if (diff > MODEL_MAX_ADJUSTMENT_BP) {
          // Model exceeded its adjustment budget. Discard, stay deterministic.
          modelNote = "model adjustment out of bounds, using deterministic baseline";
        } else {
          probabilityBp = clampBp(adjusted, 300n, 9700n);
          mode = "model-assisted";
        }
      } catch {
        modelNote = "model adjustment failed validation, using deterministic baseline";
      }
    }

    const guards = evaluateGuards(
      {
        snapshot,
        now,
        thresholds: {
          minEdgeBp: this.config.minEdgeBp,
          minConfidenceBp: this.config.minConfidenceBp,
          maxSlippageBp: this.config.maxSlippageBp,
          minSecondsToExpiry: this.config.minSecondsToExpiry,
          staleAfterMs: this.config.staleAfterMs,
        },
      },
      // Guards only need the audit fields they read; build a stub first.
      {
        auditId,
        marketId: snapshot.marketId,
        decision: "no_trade",
        direction: null,
        marketProbabilityBp: snapshot.impliedProbabilityBp,
        calibreProbabilityBp: probabilityBp,
        edgeBp: probabilityBp > snapshot.impliedProbabilityBp
          ? probabilityBp - snapshot.impliedProbabilityBp
          : snapshot.impliedProbabilityBp - probabilityBp,
        confidenceBp: baseline.confidenceBp,
        guards: [],
        evidence: baseline.evidence,
        reasons: [],
        modelVersion: this.modelVersion,
        mode,
        source: snapshot.source,
        createdAt: now,
      },
    );

    const audit = buildAudit({
      auditId,
      snapshot,
      estimate: {
        probabilityBp,
        confidenceBp: baseline.confidenceBp,
        direction: probabilityBp >= 5000n ? "up" : "down",
        evidence: baseline.evidence,
      },
      guards,
      thresholds: {
        minEdgeBp: this.config.minEdgeBp,
        minConfidenceBp: this.config.minConfidenceBp,
      },
      modelVersion: this.modelVersion,
      mode,
      source: snapshot.source,
      createdAt: now,
    });

    if (modelNote) {
      audit.reasons.push(modelNote);
    }
    return audit;
  }
}
